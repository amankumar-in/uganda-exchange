'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { message } from 'antd';
import {
  getOrders,
  placeOrder,
  CoinbaseCandle,
  InternalOrder,
  OrderBook,
  PublicTrade,
} from '@/services/api/coinbase';
import { getBalances, Balance } from '@/services/api/assets';
import { getLearnerBalances, getLearnerOrders, placeLearnerTrade, LearnerOrder, createPortfolioSnapshot } from '@/services/api/learner';
import { getDemoCollegeCoins, DemoCollegeCoin } from '@/services/api/demo-college-coins';
import { getCoinOHLC } from '@/services/api/coingecko';
import { TokensApi } from '@/services/api/tokens';
import { getInternalOrderBook } from '@/services/api/orders';
import { Token } from '@/types/token';
import { useAuth } from '@/context/AuthContext';

// API base URL for resolving upload paths
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';

// Helper to resolve upload URLs (prepend API base for /api/ paths)
const resolveUploadUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  // If it's already an absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // If it's an API upload path, prepend API base
  if (url.startsWith('/api/uploads/')) return `${API_BASE}${url}`;
  // For other paths (like external URLs or legacy paths), return as-is
  return url;
};

// WebSocket URL - use environment variable or default to localhost
// Only connect if explicitly configured or in development
const WS_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_WS_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : null))
  : null;

interface PriceUpdate {
  product_id: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
  timestamp: number;
}

interface TradingPair {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  quote: string;
  baseCurrency: string;
  quoteCurrency: string;
  iconUrl: string;
  _rawVolume24h?: number;
  _usdVolume?: number;
  // Demo college coin fields (practice coins pegged to real crypto, NOT Token.isCollegeCoin for real college tokens)
  isDemoCollegeCoin?: boolean;
  peggedToAsset?: string;
  peggedPercentage?: number;
  isCustomToken?: boolean;
  coingeckoId?: string;
  // Token permissions
  permissions?: {
    allowBuy: boolean;
    allowSell: boolean;
    allowP2P: boolean;
    minTransactionAmount: number;
    maxTransactionAmount: number;
  };
}

interface ExchangeContextType {
  // App mode (learner/investor)
  appMode: 'learner' | 'investor';
  
  // Products/Pairs
  pairs: TradingPair[];
  isLoadingPairs: boolean;
  selectedPair: string;
  setSelectedPair: (pair: string) => void;
  currentPairData: TradingPair | null;
  
  // Price data
  currentPrice: number;
  priceChange: number;
  currentUsdVolume: number;
  
  // WebSocket status
  isConnected: boolean;
  
  // Candles for chart
  candles: CoinbaseCandle[];
  isLoadingCandles: boolean;
  candleGranularity: string;
  setCandleGranularity: (gran: string) => void;
  
  // Accounts/Balances
  balances: Balance[];
  isLoadingBalances: boolean;
  getBalance: (currency: string) => number;
  
  // Orders
  orders: InternalOrder[];
  isLoadingOrders: boolean;
  
  // Public trades
  publicTrades: PublicTrade[];
  isLoadingTrades: boolean;
  
  // Order book
  orderBook: OrderBook | null;
  isLoadingOrderBook: boolean;
  
  // Trading
  executeTrade: (side: 'BUY' | 'SELL', amount: number, total: number, pairOverride?: string) => Promise<{ success: boolean; order?: InternalOrder; isSimulatedFailure?: boolean }>;
  isTrading: boolean;
  
  // Refresh functions
  refreshProducts: () => Promise<void>;
  refreshCandles: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshTrades: () => Promise<void>;
  refreshOrderBook: () => Promise<void>;
}

const ExchangeContext = createContext<ExchangeContextType | null>(null);

export const useExchange = () => {
  const context = useContext(ExchangeContext);
  if (!context) {
    throw new Error('useExchange must be used within ExchangeProvider');
  }
  return context;
};

// Format volume to human readable
function formatVolume(volume: string): string {
  const num = parseFloat(volume);
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
}

// Get icon URL
function getIconUrl(symbol: string): string {
  const s = symbol.toLowerCase();
  return `https://assets.coincap.io/assets/icons/${s}@2x.png`;
}

export const ExchangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state
  const { isLoggedIn, user } = useAuth();
  
  // App mode state - synced with database via user profile
  const [appMode, setAppMode] = useState<'learner' | 'investor'>('learner');
  
  // Sync app mode from user profile (database) and listen for localStorage changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Primary source: user profile from database (set by AuthContext)
    if (user && user.appMode) {
      const dbMode = user.appMode.toLowerCase() as 'learner' | 'investor';
      setAppMode(dbMode);
      // Sync to localStorage for immediate updates within same tab
      localStorage.setItem('appMode', dbMode);
    } else {
      // Fallback to localStorage for non-logged in users or during loading
      const savedMode = localStorage.getItem('appMode') as 'learner' | 'investor' | null;
      if (savedMode) {
        setAppMode(savedMode);
      }
    }
  }, [user]);
  
  // Listen for localStorage changes (for immediate updates when settings page changes mode)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appMode' && e.newValue) {
        setAppMode(e.newValue as 'learner' | 'investor');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Poll for changes within same tab (for immediate sync after settings change)
    const interval = setInterval(() => {
      const currentMode = localStorage.getItem('appMode') as 'learner' | 'investor' | null;
      if (currentMode && currentMode !== appMode) {
        setAppMode(currentMode);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [appMode]);
  
  // State
  const [pairs, setPairs] = useState<TradingPair[]>([]);
  const [collegeCoins, setCollegeCoins] = useState<DemoCollegeCoin[]>([]);
  const [isLoadingPairs, setIsLoadingPairs] = useState(true);
  const [selectedPair, setSelectedPair] = useState('BTC-INR');
  const [isConnected, setIsConnected] = useState(false);
  
  const [candles, setCandles] = useState<CoinbaseCandle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState(false);
  const [candleGranularity, setCandleGranularity] = useState('1H');
  
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(true); // Start true - will be set false after first fetch
  
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  const [publicTrades, setPublicTrades] = useState<PublicTrade[]>([]);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);
  
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [isLoadingOrderBook, setIsLoadingOrderBook] = useState(false);
  
  const [isTrading, setIsTrading] = useState(false);
  
  // WebSocket ref
  const socketRef = useRef<Socket | null>(null);
  
  // Store base product info (without prices) for merging with WS updates
  const baseProductsRef = useRef<Map<string, Omit<TradingPair, 'price' | 'change' | 'volume'>>>(new Map());
  
  // Store latest pairs in ref to avoid recreating callbacks on every price update
  const pairsRef = useRef<TradingPair[]>([]);

  // Derived state
  const currentPairData = pairs.find(p => p.symbol === selectedPair) || null;
  const currentPrice = currentPairData?.price || 0;
  const priceChange = currentPairData?.change || 0;
  
  // Calculate USD trading volume for current pair
  const getUsdVolume = (pair: TradingPair | null): number => {
    if (!pair || !pair.price || pair.price <= 0) return 0;
    const rawVolume = (pair as any)._rawVolume24h;
    if (rawVolume) return rawVolume * pair.price;
    // Fallback: parse from formatted volume string (less accurate)
    const volStr = pair.volume.replace(/[BMK]/g, '');
    const volNum = parseFloat(volStr) || 0;
    if (pair.volume.includes('B')) return volNum * 1e9 * pair.price;
    if (pair.volume.includes('M')) return volNum * 1e6 * pair.price;
    if (pair.volume.includes('K')) return volNum * 1e3 * pair.price;
    return volNum * pair.price;
  };
  
  const currentUsdVolume = getUsdVolume(currentPairData);

  // Fetch all products (initial load only)
  const refreshProducts = useCallback(async () => {
    try {
      setIsLoadingPairs(true);

      // Catalog is the tokens table. Demo college coins come from their own table.
      const [collegeData, customTokens] = await Promise.all([
        getDemoCollegeCoins().catch(() => ({ coins: [] as DemoCollegeCoin[] })),
        TokensApi.getAll(true).catch(() => [] as any[])
      ]);

      const activeTokens = customTokens.filter((t: any) => t.isActive);

      // Index tokens by symbol for non-INR pair price conversion
      const tokenInrPrice = new Map<string, number>();
      activeTokens.forEach((t: any) => {
        const p = t.currentPrice || Number(t.manualPrice) || 0;
        tokenInrPrice.set(t.symbol, p);
      });
      const getInrPrice = (sym: string) => tokenInrPrice.get(sym) || 0;

      const baseProducts = new Map<string, Omit<TradingPair, 'price' | 'change' | 'volume'>>();
      const tokenPairs: TradingPair[] = [];

      activeTokens.forEach((token: any) => {
        const inrPrice = token.currentPrice || Number(token.manualPrice) || 0;
        const icon = token.iconUrl || getIconUrl(token.symbol);
        const permissions = {
          allowBuy: token.allowBuy ?? true,
          allowSell: token.allowSell ?? true,
          allowP2P: token.allowP2P ?? true,
          minTransactionAmount: Number(token.minTransactionAmount) || 0,
          maxTransactionAmount: Number(token.maxTransactionAmount) || 0,
        };

        const inrVolume = Number(token.volume24h) || 0;
        const pushPair = (quote: string, price: number, volume: number) => {
          const symbol = `${token.symbol}-${quote}`;
          const baseInfo = {
            symbol, name: token.name, quote, baseCurrency: token.symbol, quoteCurrency: quote, iconUrl: icon,
          };
          baseProducts.set(symbol, baseInfo);
          tokenPairs.push({
            ...baseInfo,
            price,
            change: token.change24h || 0,
            volume: formatVolume(volume.toString()),
            _rawVolume24h: price > 0 ? volume / price : 0,
            _usdVolume: inrVolume, // always the INR-denominated volume for sorting
            isCustomToken: token.isNative || false,
            coingeckoId: token.coingeckoId,
            permissions,
          });
        };

        if (token.allowTradeInr) {
          pushPair('INR', inrPrice, inrVolume);
        }
        if (token.allowTradeUsdt && token.symbol !== 'USDT') {
          const usdtInr = getInrPrice('USDT');
          pushPair('USDT', usdtInr > 0 ? inrPrice / usdtInr : 0, usdtInr > 0 ? inrVolume / usdtInr : 0);
        }
        if (token.allowTradeEth && token.symbol !== 'ETH') {
          const ethInr = getInrPrice('ETH');
          pushPair('ETH', ethInr > 0 ? inrPrice / ethInr : 0, ethInr > 0 ? inrVolume / ethInr : 0);
        }
        if (token.allowTradeTuit && token.symbol !== 'TUIT') {
          const tuitInr = getInrPrice('TUIT');
          pushPair('TUIT', tuitInr > 0 ? inrPrice / tuitInr : 0, tuitInr > 0 ? inrVolume / tuitInr : 0);
        }
      });

      // Demo college coins — learner mode virtual pairs, INR-quoted
      const collegePairs: TradingPair[] = collegeData.coins.map((coin: DemoCollegeCoin) => {
        const refInrPrice = getInrPrice(coin.peggedToAsset);
        return {
          symbol: `${coin.ticker}-INR`, name: coin.name, price: coin.currentPrice || 0,
          change: 0, volume: '0',
          quote: 'INR', baseCurrency: coin.ticker, quoteCurrency: 'INR',
          iconUrl: resolveUploadUrl(coin.iconUrl) || `https://ui-avatars.com/api/?name=${coin.ticker}&size=64&background=667eea&color=ffffff&bold=true`,
          isDemoCollegeCoin: true, peggedToAsset: coin.peggedToAsset, peggedPercentage: coin.peggedPercentage,
          _rawVolume24h: 0, _usdVolume: 0,
        };
      });

      // Merge and dedupe by symbol (college pairs win if they collide)
      const mergedMap = new Map<string, TradingPair>();
      [...tokenPairs, ...collegePairs].forEach(p => mergedMap.set(p.symbol, p));

      // Sort by INR volume desc so popular pairs lead; fall back to symbol
      const finalPairs = Array.from(mergedMap.values()).sort((a, b) => {
        const volA = (a as any)._usdVolume || 0;
        const volB = (b as any)._usdVolume || 0;
        if (volB !== volA) return volB - volA;
        return a.baseCurrency.localeCompare(b.baseCurrency);
      });

      setPairs(finalPairs);
      pairsRef.current = finalPairs;
      baseProductsRef.current = baseProducts;
      if (collegeData.coins.length > 0) setCollegeCoins(collegeData.coins);

    } catch (error) {
      console.error('Failed to refresh products:', error);
    } finally {
      setIsLoadingPairs(false);
    }
  }, []);

  // Handle WebSocket price updates
  const handlePriceUpdate = useCallback((pricesData: Record<string, PriceUpdate>) => {
    setPairs(prevPairs => {
      const updated = prevPairs.map(pair => {
        // Regular pair update
        const update = pricesData[pair.symbol];
        if (update) {
          const newVol = parseFloat(update.volume_24h) || 0;
          return {
            ...pair,
            price: parseFloat(update.price) || pair.price,
            change: parseFloat(update.price_percentage_change_24h) || pair.change,
            volume: formatVolume(update.volume_24h),
            _usdVolume: newVol,
            _rawVolume24h: pair.price > 0 ? newVol / pair.price : pair._rawVolume24h,
          };
        }
        
        // College coin update — pegged to reference token's INR price
        if (pair.isDemoCollegeCoin && pair.peggedToAsset && pair.peggedPercentage) {
          const refUpdate = pricesData[`${pair.peggedToAsset}-INR`];
          if (refUpdate) {
            const refPrice = parseFloat(refUpdate.price);
            const newPrice = refPrice * (pair.peggedPercentage / 100);
            return {
              ...pair,
              price: newPrice,
              change: parseFloat(refUpdate.price_percentage_change_24h) || pair.change,
            };
          }
        }
        
        return pair;
      });
      pairsRef.current = updated;
      return updated;
    });
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    // Only connect if WS_URL is defined and we're in the browser
    if (typeof window === 'undefined' || !WS_URL || WS_URL === 'undefined') {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ WebSocket URL not configured, skipping connection');
      }
      return;
    }

    let socket: Socket | null = null;
    let isMounted = true;

    const connectSocket = () => {
      try {
        socket = io(`${WS_URL}/prices`, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 10000,
          autoConnect: true,
        });

        if (!isMounted) {
          socket.disconnect();
          return;
        }

        socketRef.current = socket;

        socket.on('connect', () => {
          if (isMounted) {
            console.log('🔌 WebSocket connected');
            setIsConnected(true);
          }
        });

        socket.on('disconnect', (reason) => {
          if (isMounted) {
            console.log('🔌 WebSocket disconnected:', reason);
            setIsConnected(false);
          }
        });

        socket.on('prices', (data: Record<string, PriceUpdate>) => {
          if (isMounted) {
            handlePriceUpdate(data);
          }
        });

        socket.on('connect_error', (error) => {
          // Silently handle connection errors - don't spam console
          if (isMounted && process.env.NODE_ENV === 'development') {
            console.warn('WebSocket connection error (will retry):', error.message);
          }
          if (isMounted) {
            setIsConnected(false);
          }
        });

        // Suppress WebSocket errors from showing in console
        socket.io.on('error', (error: Error) => {
          // Only log in development
          if (isMounted && process.env.NODE_ENV === 'development') {
            console.warn('WebSocket IO error:', error.message);
          }
        });
      } catch (error) {
        if (isMounted && process.env.NODE_ENV === 'development') {
          console.error('Failed to initialize WebSocket:', error);
        }
        if (isMounted) {
          setIsConnected(false);
        }
      }
    };

    connectSocket();

    return () => {
      isMounted = false;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [handlePriceUpdate]);

  // Fetch candles for chart
  const refreshCandles = useCallback(async () => {
    if (!selectedPair) return;
    
    try {
      setIsLoadingCandles(true);
      const granMap: Record<string, 'ONE_MINUTE' | 'FIVE_MINUTE' | 'FIFTEEN_MINUTE' | 'ONE_HOUR' | 'SIX_HOUR' | 'ONE_DAY'> = {
        '1M': 'ONE_MINUTE',
        '5M': 'FIVE_MINUTE',
        '15M': 'FIFTEEN_MINUTE',
        '1H': 'ONE_HOUR',
        '4H': 'SIX_HOUR',
        '1D': 'ONE_DAY',
      };
      const gran = granMap[candleGranularity] || 'ONE_HOUR';
      
      // Calculate time range - Coinbase limits to 350 candles max
      const now = Math.floor(Date.now() / 1000);
      let start: number;
      switch (candleGranularity) {
        case '1M': start = now - 60 * 300; break;
        case '5M': start = now - 5 * 60 * 300; break;
        case '15M': start = now - 15 * 60 * 300; break;
        case '1H': start = now - 60 * 60 * 300; break;
        case '4H': start = now - 6 * 60 * 60 * 300; break;
        case '1D': start = now - 24 * 60 * 60 * 300; break;
        default: start = now - 60 * 60 * 100;
      }
      
      // Every chart is driven by CoinGecko OHLC (INR-denominated) plus optional
      // cross-rate conversion for USDT/ETH-quoted pairs and peg for demo college coins.
      const [baseAsset, quoteAsset] = selectedPair.split('-');
      let conversionRate = 1;

      const currentPairs = pairsRef.current;
      const currentPair = currentPairs.find(p => p.symbol === selectedPair);

      // Demo college coins: pull reference asset candles and scale by peg %
      const isDemoCollegeCoin = currentPair?.isDemoCollegeCoin === true;
      let coingeckoId = currentPair?.coingeckoId;
      if (isDemoCollegeCoin && currentPair?.peggedToAsset) {
        const refPair = currentPairs.find(p => p.baseCurrency === currentPair.peggedToAsset && p.quote === 'INR');
        coingeckoId = refPair?.coingeckoId;
        conversionRate = (currentPair.peggedPercentage || 0) / 100;
      } else if (quoteAsset !== 'INR') {
        // Non-INR quote — chart reference is always base-INR price, divide by quote-INR price
        const baseInrPair = currentPairs.find(p => p.baseCurrency === baseAsset && p.quote === 'INR');
        const quoteInrPair = currentPairs.find(p => p.baseCurrency === quoteAsset && p.quote === 'INR');
        coingeckoId = baseInrPair?.coingeckoId;
        if (quoteInrPair && quoteInrPair.price > 0) {
          conversionRate = 1 / quoteInrPair.price;
        }
      }

      if (coingeckoId) {
        try {
          // Map granularity to CoinGecko lookback (CG returns 5m/1h/4h/4d resolutions by range)
          let days = 1;
          if (candleGranularity === '1H') days = 7;
          if (candleGranularity === '4H') days = 30;
          if (candleGranularity === '1D') days = 90;

          const ohlcData = await getCoinOHLC(coingeckoId, days);

          let sourceCandles: CoinbaseCandle[] = (ohlcData || []).map(c => ({
            start: Math.floor(c[0] / 1000).toString(),
            open: (c[1] * conversionRate).toString(),
            high: (c[2] * conversionRate).toString(),
            low: (c[3] * conversionRate).toString(),
            close: (c[4] * conversionRate).toString(),
            volume: '0',
          }));

          let intervalSeconds = 3600;
          if (candleGranularity === '1M') intervalSeconds = 60;
          if (candleGranularity === '5M') intervalSeconds = 300;
          if (candleGranularity === '15M') intervalSeconds = 900;
          if (candleGranularity === '1H') intervalSeconds = 3600;
          if (candleGranularity === '4H') intervalSeconds = 14400;
          if (candleGranularity === '1D') intervalSeconds = 86400;

          const numCandles = 200;
          const nowSeconds = Math.floor(Date.now() / 1000);
          const resampledCandles: CoinbaseCandle[] = [];

          sourceCandles.sort((a, b) => parseInt(a.start) - parseInt(b.start));
          const livePrice = currentPair?.price || 0;

          for (let i = numCandles - 1; i >= 0; i--) {
            const targetTime = nowSeconds - (i * intervalSeconds);
            let price = '0';
            let found = false;
            for (let j = sourceCandles.length - 1; j >= 0; j--) {
              if (parseInt(sourceCandles[j].start) <= targetTime) {
                price = sourceCandles[j].close;
                found = true;
                break;
              }
            }
            if (!found && sourceCandles.length > 0) price = sourceCandles[0].close;
            if (i <= 1 && livePrice > 0) price = livePrice.toString();

            resampledCandles.push({
              start: targetTime.toString(),
              open: price, high: price, low: price, close: price, volume: '0',
            });
          }

          setCandles(resampledCandles);
          setIsLoadingCandles(false);
          return;
        } catch (e) {
          console.error('Failed to fetch CoinGecko OHLC:', e);
        }
      }

      // Fallback: flat candles at current live price (no OHLC data available)
      let secondsPerCandle = 3600;
      if (candleGranularity === '1M') secondsPerCandle = 60;
      if (candleGranularity === '5M') secondsPerCandle = 300;
      if (candleGranularity === '15M') secondsPerCandle = 900;
      if (candleGranularity === '1D') secondsPerCandle = 86400;

      const mockPrice = currentPair?.price || 0;
      const mockCandles = Array.from({ length: 50 }).map((_, i) => ({
        start: (now - ((49 - i) * secondsPerCandle)).toString(),
        open: mockPrice.toString(),
        high: mockPrice.toString(),
        low: mockPrice.toString(),
        close: mockPrice.toString(),
        volume: '0',
      }));
      setCandles(mockCandles);
    } catch (error) {
      console.error('Failed to fetch candles:', error);
      setCandles([]);
    } finally {
      setIsLoadingCandles(false);
    }
  }, [selectedPair, candleGranularity]);

  // Fetch balances from our ledger (requires auth)
  // Uses learner balances when in learner mode
  const refreshBalances = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      setIsLoadingBalances(true);
      
      if (appMode === 'learner') {
        // Fetch learner mode balances
        const { balances: learnerBalances } = await getLearnerBalances();
        setBalances(learnerBalances);
      } else {
        // Fetch real balances
        const balanceData = await getBalances();
        setBalances(balanceData);
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [isLoggedIn, appMode]);

  // Fetch orders (requires auth)
  // Uses learner orders when in learner mode
  const refreshOrders = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      setIsLoadingOrders(true);
      
      if (appMode === 'learner') {
        // Fetch learner mode orders
        const { orders: learnerOrders } = await getLearnerOrders({ limit: 50 });
        // Convert learner orders to internal order format
        const convertedOrders: InternalOrder[] = learnerOrders.map((order: LearnerOrder) => ({
          id: order.id,
          transactionId: order.transactionId,
          productId: order.productId,
          asset: order.asset,
          quote: order.quote,
          side: order.side,
          requestedAmount: order.requestedAmount,
          filledAmount: order.filledAmount,
          price: order.price,
          totalValue: order.totalValue,
          platformFee: order.platformFee,
          exchangeFee: order.exchangeFee,
          status: order.status,
          coinbaseOrderId: null,
          createdAt: order.createdAt,
          completedAt: order.completedAt,
        }));
        setOrders(convertedOrders);
      } else {
        // Fetch real orders
        const { orders: orderData } = await getOrders({ limit: 50 });
        setOrders(orderData);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [isLoggedIn, appMode]);

  // Public trades — we don't run a real exchange, so this is just our internal
  // completed trades for the selected pair. Kept empty for now; fillable later
  // from an /orders/public-trades endpoint when product requires it.
  const refreshTrades = useCallback(async () => {
    setPublicTrades([]);
    setIsLoadingTrades(false);
  }, []);

  // Order book is always our internal DB-based book (pending orders aggregated by price)
  const refreshOrderBook = useCallback(async () => {
    if (!selectedPair) return;
    try {
      setIsLoadingOrderBook(true);
      const internalBook = await getInternalOrderBook(selectedPair);
      setOrderBook(internalBook);
    } catch (error) {
      console.error('Failed to fetch order book:', error);
      setOrderBook({ bids: [], asks: [] });
    } finally {
      setIsLoadingOrderBook(false);
    }
  }, [selectedPair]);

  // Get balance for a currency
  const getBalance = useCallback((currency: string): number => {
    const balance = balances.find(b => b.asset === currency.toUpperCase());
    return balance ? balance.availableBalance : 0;
  }, [balances]);

  // Execute trade
  // In learner mode: simulates trade with virtual balances
  // In investor mode: executes real trade on Coinbase
  // pairOverride: optional pair to use instead of selectedPair (for BuySell form)
  const executeTrade = useCallback(async (
    side: 'BUY' | 'SELL',
    amount: number,
    total: number,
    pairOverride?: string,
  ): Promise<{ success: boolean; order?: InternalOrder; isSimulatedFailure?: boolean }> => {
    // Use pairOverride if provided, otherwise fall back to selectedPair
    const tradingPair = pairOverride || selectedPair;
    const tradingPairData = pairOverride 
      ? pairsRef.current.find(p => p.symbol === pairOverride) 
      : currentPairData;
    
    if (!tradingPairData) return { success: false };
    
    try {
      setIsTrading(true);
      
      const [baseAsset, quoteAsset] = tradingPair.split('-');
      const currentPairs = pairsRef.current;
      
      // ============ LEARNER MODE ============
      if (appMode === 'learner') {
        // Simulate delay to make it feel realistic (1-3 seconds)
        const delay = 1000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Use current real price for the simulation
        const currentPrice = tradingPairData.price;
        
        // Execute learner trade
        const result = await placeLearnerTrade(
          tradingPair,
          side,
          side === 'BUY' ? total : amount,
          currentPrice,
        );
        
        // Refresh balances and orders after trade
        await Promise.all([refreshBalances(), refreshOrders()]);
        
        // Create portfolio snapshot with current prices (for growth chart)
        if (result.order.status === 'COMPLETED') {
          try {
            // Build crypto prices from current pairs
            const cryptoPrices: Record<string, number> = {};
            pairsRef.current.forEach(pair => {
              if (pair.symbol.endsWith('-INR')) {
                const asset = pair.symbol.replace('-INR', '');
                cryptoPrices[asset] = pair.price;
              }
            });
            await createPortfolioSnapshot(cryptoPrices);
          } catch (snapshotError) {
            console.error('Failed to create portfolio snapshot:', snapshotError);
            // Don't fail the trade if snapshot fails
          }
        }
        
        if (result.isSimulatedFailure) {
          // Return with simulated failure flag
          const failedOrder: InternalOrder = {
            id: result.order.id,
            transactionId: result.order.transactionId,
            productId: result.order.productId,
            asset: result.order.asset,
            quote: result.order.quote,
            side: result.order.side,
            requestedAmount: result.order.requestedAmount,
            filledAmount: result.order.filledAmount,
            price: result.order.price,
            totalValue: result.order.totalValue,
            platformFee: result.order.platformFee,
            exchangeFee: result.order.exchangeFee,
            status: 'FAILED',
            coinbaseOrderId: null,
            createdAt: result.order.createdAt,
            completedAt: result.order.completedAt,
          };
          return { success: false, order: failedOrder, isSimulatedFailure: true };
        }
        
        // Convert learner order to internal order format
        const learnerOrder: InternalOrder = {
          id: result.order.id,
          transactionId: result.order.transactionId,
          productId: result.order.productId,
          asset: result.order.asset,
          quote: result.order.quote,
          side: result.order.side,
          requestedAmount: result.order.requestedAmount,
          filledAmount: result.order.filledAmount,
          price: result.order.price,
          totalValue: result.order.totalValue,
          platformFee: result.order.platformFee,
          exchangeFee: result.order.exchangeFee,
          status: result.order.status,
          coinbaseOrderId: null,
          createdAt: result.order.createdAt,
          completedAt: result.order.completedAt,
        };
        
        return { success: true, order: learnerOrder };
      }
      
      // ============ INVESTOR MODE (Real Trading) ============
      // All pairs route straight to the backend — no synthetic USD routing.
      // orders.service.ts handles INR/USDT/ETH/TUIT quotes internally using
      // token-table INR prices for cross-rate calculation.
      const orderAmount = side === 'BUY' ? total : amount;
      const result = await placeOrder(tradingPair, side, orderAmount);
      if (!result.success) return { success: false };
      await Promise.all([refreshBalances(), refreshOrders()]);
      return { success: true, order: result.order };
    } catch (error: any) {
      // Log error for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('Trade failed:', error);
      }
      // Return false instead of throwing to prevent Next.js overlay
      // The error message will be shown by the caller
      return { success: false };
    } finally {
      setIsTrading(false);
    }
  }, [selectedPair, currentPairData, refreshBalances, refreshOrders, appMode]);

  // Initial load - products are public, balances require auth
  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  // Track if we've done the initial auto-select (to avoid overriding URL navigation)
  const hasAutoSelectedRef = useRef(false);
  
  // Default pair selection — prefer BTC-INR, fall back to first available pair.
  // No automatic college-coin routing; users pick via the Colleges tab in learner mode.
  useEffect(() => {
    if (!isLoadingPairs && pairs.length > 0 && !hasAutoSelectedRef.current) {
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlPair = urlParams?.get('pair');
      if (!urlPair && !pairs.some(p => p.symbol === selectedPair)) {
        const preferred = pairs.find(p => p.symbol === 'BTC-INR') || pairs[0];
        if (preferred) setSelectedPair(preferred.symbol);
      }
      hasAutoSelectedRef.current = true;
    }
  }, [isLoadingPairs, pairs, selectedPair]);

  // Fetch balances and orders when logged in or when app mode changes
  // Clear on logout
  useEffect(() => {
    if (isLoggedIn) {
      refreshBalances();
      refreshOrders();
    } else {
      // Clear user-specific data on logout
      setBalances([]);
      setOrders([]);
      setIsLoadingBalances(false); // Not loading when logged out
      setIsLoadingOrders(false);
    }
  }, [isLoggedIn, appMode, refreshBalances, refreshOrders]);

  // Reset selectedPair when switching to investor mode if current pair is a college coin
  useEffect(() => {
    if (appMode === 'investor' && pairs.length > 0) {
      const currentPair = pairs.find(p => p.symbol === selectedPair);
      if (currentPair?.isDemoCollegeCoin) {
        setSelectedPair('BTC-INR');
      }
    }
  }, [appMode, pairs, selectedPair]);

  // Fetch candles when pair or granularity changes
  useEffect(() => {
    if (!isLoadingPairs && selectedPair) {
      refreshCandles();
    }
  }, [selectedPair, candleGranularity, isLoadingPairs, refreshCandles]);

  // Live-update the most recent candle whenever the current pair price ticks.
  // Historical candles stay fixed; only the last candle's close + high/low adjust
  // so the chart follows the header price instead of going stale between refetches.
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;
    setCandles(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const priceStr = currentPrice.toString();
      if (last.close === priceStr) return prev;
      const lastHigh = Math.max(parseFloat(last.high) || 0, currentPrice);
      const lastLow = Math.min(parseFloat(last.low) || currentPrice, currentPrice);
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...last,
        close: priceStr,
        high: lastHigh.toString(),
        low: lastLow.toString(),
      };
      return updated;
    });
  }, [currentPrice]);

  // Fetch trades and order book when pair changes
  useEffect(() => {
    if (!isLoadingPairs && selectedPair) {
      refreshTrades();
      refreshOrderBook();
    }
  }, [selectedPair, isLoadingPairs, refreshTrades, refreshOrderBook]);

  const value: ExchangeContextType = {
    appMode,
    pairs,
    isLoadingPairs,
    selectedPair,
    setSelectedPair,
    currentPairData,
    currentPrice,
    priceChange,
    currentUsdVolume,
    isConnected,
    candles,
    isLoadingCandles,
    candleGranularity,
    setCandleGranularity,
    balances,
    isLoadingBalances,
    getBalance,
    orders,
    isLoadingOrders,
    publicTrades,
    isLoadingTrades,
    orderBook,
    isLoadingOrderBook,
    executeTrade,
    isTrading,
    refreshProducts,
    refreshCandles,
    refreshBalances,
    refreshOrders,
    refreshTrades,
    refreshOrderBook,
  };

  return (
    <ExchangeContext.Provider value={value}>
      {children}
    </ExchangeContext.Provider>
  );
};
