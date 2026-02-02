'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { message } from 'antd';
import {
  getProducts,
  getCandles,
  getOrders,
  placeOrder,
  getOrderBook,
  getPublicTrades,
  CoinbaseCandle,
  InternalOrder,
  OrderBook,
  PublicTrade,
} from '@/services/api/coinbase';
import { getBalances, Balance } from '@/services/api/assets';
import { getLearnerBalances, getLearnerOrders, placeLearnerTrade, LearnerOrder, createPortfolioSnapshot } from '@/services/api/learner';
import { getDemoCollegeCoins, DemoCollegeCoin } from '@/services/api/college-coins';
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
  // Demo college coin fields
  isCollegeCoin?: boolean;
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
  const [selectedPair, setSelectedPair] = useState('BTC-USD');
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
      
      // Fetch data sources in parallel for better performance and to avoid sequential await chains
      const [products, collegeData, customTokens] = await Promise.all([
        getProducts().catch(err => { console.error('Coinbase fetch failed:', err); return []; }),
        getDemoCollegeCoins().catch(() => ({ coins: [] as DemoCollegeCoin[] })),
        TokensApi.getAll(true).catch(() => [] as any[])
      ]);
      
      // 1. Filter and Transform Coinbase products
      const quoteCurrencies = ['USD', 'USDT', 'ETH'];
      const filteredProducts = products.filter(p => quoteCurrencies.includes(p.quote_currency));
      
      const baseProducts = new Map<string, Omit<TradingPair, 'price' | 'change' | 'volume'>>();
      const coinbasePairs: TradingPair[] = filteredProducts.map(p => {
        const baseInfo = {
          symbol: p.product_id,
          name: p.base_name,
          quote: p.quote_currency,
          baseCurrency: p.base_currency,
          quoteCurrency: p.quote_currency,
          iconUrl: getIconUrl(p.base_currency),
        };
        baseProducts.set(p.product_id, baseInfo);
        const price = parseFloat(p.price) || 0;
        const volume24h = parseFloat(p.volume_24h) || 0;
        return {
          ...baseInfo,
          price,
          change: parseFloat(p.price_percentage_change_24h) || 0,
          volume: formatVolume(p.volume_24h),
          _rawVolume24h: volume24h,
          _usdVolume: volume24h * price,
        };
      });

      // 2. Generate Synthetic Pairs (Cross-rates)
      const usdPairsMap = new Map<string, TradingPair>();
      coinbasePairs.forEach(p => { if (p.quote === 'USD') usdPairsMap.set(p.baseCurrency, p); });
      const ethUsd = usdPairsMap.get('ETH');
      const usdtUsd = usdPairsMap.get('USDT');

      const syntheticPairs: TradingPair[] = [];
      if (ethUsd && ethUsd.price > 0) {
        usdPairsMap.forEach((usdPair, base) => {
          if (base !== 'ETH' && !coinbasePairs.find(p => p.symbol === `${base}-ETH`)) {
            syntheticPairs.push({
              symbol: `${base}-ETH`, name: usdPair.name, quote: 'ETH', baseCurrency: base, quoteCurrency: 'ETH',
              iconUrl: getIconUrl(base), price: usdPair.price / ethUsd.price, change: usdPair.change,
              volume: formatVolume((usdPair._rawVolume24h || 0).toString()),
              _rawVolume24h: usdPair._rawVolume24h || 0, _usdVolume: (usdPair._rawVolume24h || 0) * usdPair.price,
            });
          }
        });
      }
      if (usdtUsd && usdtUsd.price > 0) {
        usdPairsMap.forEach((usdPair, base) => {
          if (base !== 'USDT' && !coinbasePairs.find(p => p.symbol === `${base}-USDT`)) {
            syntheticPairs.push({
              symbol: `${base}-USDT`, name: usdPair.name, quote: 'USDT', baseCurrency: base, quoteCurrency: 'USDT',
              iconUrl: getIconUrl(base), price: usdPair.price / usdtUsd.price, change: usdPair.change,
              volume: formatVolume((usdPair._rawVolume24h || 0).toString()),
              _rawVolume24h: usdPair._rawVolume24h || 0, _usdVolume: (usdPair._rawVolume24h || 0) * usdPair.price,
            });
          }
        });
      }

      // 3. Transform College Coins
      const collegePairs: TradingPair[] = collegeData.coins.map((coin: DemoCollegeCoin) => {
        const refPair = coinbasePairs.find(p => p.symbol === `${coin.peggedToAsset}-USD`);
        return {
          symbol: `${coin.ticker}-USD`, name: coin.name, price: coin.currentPrice || 0,
          change: refPair?.change || 0, volume: '0', quote: 'USD', baseCurrency: coin.ticker, quoteCurrency: 'USD',
          iconUrl: resolveUploadUrl(coin.iconUrl) || `https://ui-avatars.com/api/?name=${coin.ticker}&size=64&background=667eea&color=ffffff&bold=true`,
          isCollegeCoin: true, peggedToAsset: coin.peggedToAsset, peggedPercentage: coin.peggedPercentage,
        };
      });

      // 4. Transform Custom Tokens
      const customPairs: TradingPair[] = [];
      customTokens.forEach(token => {
        if (!token.isActive) return;
        const price = token.currentPrice || token.manualPrice || 0;
        const icon = token.iconUrl || getIconUrl(token.symbol);

        // Build permissions object for this token
        const permissions = {
          allowBuy: token.allowBuy ?? true,
          allowSell: token.allowSell ?? true,
          allowP2P: token.allowP2P ?? true,
          minTransactionAmount: Number(token.minTransactionAmount) || 0,
          maxTransactionAmount: Number(token.maxTransactionAmount) || 0,
        };

        if (token.allowTradeUsd) {
          customPairs.push({
            symbol: `${token.symbol}-USD`, name: token.name, price, change: token.change24h || 0,
            volume: '0', quote: 'USD', baseCurrency: token.symbol, quoteCurrency: 'USD', iconUrl: icon, isCustomToken: true, coingeckoId: token.coingeckoId,
            permissions,
          });
        }
        if (token.allowTradeUsdt) {
          const usdtPrice = usdtUsd && usdtUsd.price > 0 ? price / usdtUsd.price : price;
          customPairs.push({
            symbol: `${token.symbol}-USDT`, name: token.name, price: usdtPrice, change: token.change24h || 0,
            volume: '0', quote: 'USDT', baseCurrency: token.symbol, quoteCurrency: 'USDT', iconUrl: icon, isCustomToken: true,
            permissions,
          });
        }
        if (token.allowTradeEth) {
          const ethPrice = ethUsd && ethUsd.price > 0 ? price / ethUsd.price : price;
          customPairs.push({
            symbol: `${token.symbol}-ETH`, name: token.name, price: ethPrice, change: token.change24h || 0,
            volume: '0', quote: 'ETH', baseCurrency: token.symbol, quoteCurrency: 'ETH', iconUrl: icon, isCustomToken: true,
            peggedToAsset: token.peggedToAsset, peggedPercentage: token.peggedPercentage,
            permissions,
          });
        }
      });

      // 5. Merge and Deduplicate by symbol
      // Order of precedence (last one wins): Custom > College > Synthetic > Coinbase
      const allPossible = [...coinbasePairs, ...syntheticPairs, ...collegePairs, ...customPairs];
      const mergedMap = new Map<string, TradingPair>();
      allPossible.forEach(p => mergedMap.set(p.symbol, p));
      
      const finalPairs = Array.from(mergedMap.values()).sort((a, b) => {
        const volA = (a as any)._usdVolume || 0;
        const volB = (b as any)._usdVolume || 0;
        return volB - volA; // Sort by volume
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
          return {
            ...pair,
            price: parseFloat(update.price) || pair.price,
            change: parseFloat(update.price_percentage_change_24h) || pair.change,
            volume: formatVolume(update.volume_24h),
          };
        }
        
        // College coin update - use reference token's price
        if (pair.isCollegeCoin && pair.peggedToAsset && pair.peggedPercentage) {
          const refSymbol = `${pair.peggedToAsset}-USD`;
          const refUpdate = pricesData[refSymbol];
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
      
      // For synthetic pairs (ETH/USDT quotes), fetch USD pair candles and convert
      const [baseAsset, quoteAsset] = selectedPair.split('-');
      let coinbasePair = selectedPair;
      let conversionRate = 1;
      
      // Use ref to get latest pairs without causing callback recreation
      const currentPairs = pairsRef.current;
      const currentPair = currentPairs.find(p => p.symbol === selectedPair);

      // Skip custom tokens: fetch real OHLC or fallback to mock
      // Skip custom tokens: fetch real OHLC or fallback to mock
      if (currentPair?.isCustomToken) {
        let loaded = false;
        if (currentPair.coingeckoId) {
          try {
             // Map granularity to appropriate lookback days to get best resolution from CoinGecko
             // CoinGecko resolution: 1-2 days = 30m; 3-30 days = 4h; 31+ days = 4d.
             let days = 1;
             if (candleGranularity === '1H') days = 7;
             if (candleGranularity === '4H') days = 30;
             if (candleGranularity === '1D') days = 90;
             
             // For very sparse tokens, we might need more days. 
             // The backend getCoinOHLC will handle the fallback logic.
             const ohlcData = await getCoinOHLC(currentPair.coingeckoId, days);
             
             let candles: CoinbaseCandle[] = [];
             
             if (ohlcData && ohlcData.length > 0) {
                candles = ohlcData.map(c => ({
                  start: Math.floor(c[0] / 1000).toString(),
                  open: c[1].toString(),
                  high: c[2].toString(),
                  low: c[3].toString(),
                  close: c[4].toString(),
                  volume: '0'
                }));
             }

             // RESAMPLING STRATEGY
             // We generate ~200 candles ending at "Now", sampling the last known price for each.
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
             
             // Sort source data by time ascending
             candles.sort((a, b) => parseInt(a.start) - parseInt(b.start));
             
             // Get the live price from context to ensure the chart connects to the header
             const livePrice = currentPair.price;

             for (let i = numCandles - 1; i >= 0; i--) {
                const targetTime = nowSeconds - (i * intervalSeconds);
                
                // Find the price effective at targetTime (LAST trade before or at targetTime)
                let currentPrice = '0';
                let found = false;
                
                // Iterate backwards from end of source data
                for (let j = candles.length - 1; j >= 0; j--) {
                   const candleTime = parseInt(candles[j].start);
                   if (candleTime <= targetTime) {
                      currentPrice = candles[j].close;
                      found = true;
                      break;
                   }
                }
                
                // If checking a time BEFORE all history, use the oldest known price
                if (!found && candles.length > 0) {
                   currentPrice = candles[0].close;
                }
                
                // For the VERY LATEST candles (last 2 intervals), if we have a live price,
                // prefer it to ensure a smooth line to the current market value.
                if (i <= 1 && livePrice > 0) {
                   currentPrice = livePrice.toString();
                }

                resampledCandles.push({
                   start: targetTime.toString(),
                   open: currentPrice,
                   high: currentPrice,
                   low: currentPrice,
                   close: currentPrice,
                   volume: '0'
                });
             }
             
             setCandles(resampledCandles);
             setIsLoadingCandles(false);
             loaded = true;
             return;
          } catch(e) { console.error('Failed to fetch CoinGecko OHLC:', e); }
        }

        if (!loaded) {
          // Fallback: Mock flat candles
          let secondsPerCandle = 3600;
          if (candleGranularity === '1M') secondsPerCandle = 60;
          if (candleGranularity === '5M') secondsPerCandle = 300;
          if (candleGranularity === '15M') secondsPerCandle = 900;
          if (candleGranularity === '1D') secondsPerCandle = 86400;

          const mockPrice = currentPair.price || 0;
          const mockCandles = Array.from({ length: 50 }).map((_, i) => ({
            start: (now - ((49 - i) * secondsPerCandle)).toString(),
            open: mockPrice.toString(),
            high: mockPrice.toString(),
            low: mockPrice.toString(),
            close: mockPrice.toString(),
            volume: '0'
          }));
          
          setCandles(mockCandles);
          setIsLoadingCandles(false);
          return;
        }
      }
      
      // Check if this is a college coin
      const isCollegeCoin = currentPair?.isCollegeCoin === true;
      const isSynthetic = (quoteAsset === 'ETH' || quoteAsset === 'USDT') && currentPair && !isCollegeCoin;
      
      if (isCollegeCoin && currentPair.peggedToAsset && currentPair.peggedPercentage) {
        // For college coins, fetch reference token candles and scale by percentage
        coinbasePair = `${currentPair.peggedToAsset}-USD`;
        conversionRate = currentPair.peggedPercentage / 100;
      } else if (isSynthetic) {
        // Use base-USD pair for candles (Coinbase doesn't have ETH/USDT quote pairs)
        coinbasePair = `${baseAsset}-USD`;
        
        // Get conversion rate: 1 USD = ? ETH or ? USDT
        const quoteUsdPair = currentPairs.find(p => p.symbol === `${quoteAsset}-USD`);
        if (quoteUsdPair && quoteUsdPair.price > 0) {
          conversionRate = 1 / quoteUsdPair.price; // Convert USD price to quote currency
        }
      }
      
      const candleData = await getCandles(coinbasePair, gran, start, now);
      
      // Convert candle prices if synthetic pair or college coin
      const needsConversion = isSynthetic || isCollegeCoin;
      const convertedCandles = needsConversion ? candleData.map(candle => ({
        ...candle,
        open: (parseFloat(candle.open) * conversionRate).toString(),
        high: (parseFloat(candle.high) * conversionRate).toString(),
        low: (parseFloat(candle.low) * conversionRate).toString(),
        close: (parseFloat(candle.close) * conversionRate).toString(),
      })) : candleData;
      
      setCandles(convertedCandles);
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

  // Fetch public trades
  const refreshTrades = useCallback(async () => {
    if (!selectedPair) return;
    try {
      setIsLoadingTrades(true);
      
      // For synthetic pairs (ETH/USDT quotes), fetch USD pair trades and convert
      const [baseAsset, quoteAsset] = selectedPair.split('-');
      const currentPairs = pairsRef.current;
      const currentPair = currentPairs.find(p => p.symbol === selectedPair);
      
      // Check if this is a college coin
      const isCollegeCoin = currentPair?.isCollegeCoin === true;
      const isSynthetic = (quoteAsset === 'ETH' || quoteAsset === 'USDT') && currentPair && !isCollegeCoin;
      
      let coinbasePair = selectedPair;
      let conversionRate = 1;
      
      if (isCollegeCoin && currentPair.peggedToAsset && currentPair.peggedPercentage) {
        // For college coins, fetch reference token trades and scale by percentage
        coinbasePair = `${currentPair.peggedToAsset}-USD`;
        conversionRate = currentPair.peggedPercentage / 100;
      } else if (isSynthetic) {
        // Use base-USD pair for trades (Coinbase doesn't have ETH/USDT quote pairs)
        coinbasePair = `${baseAsset}-USD`;
        
        // Get conversion rate: 1 USD = ? ETH or ? USDT
        const quoteUsdPair = currentPairs.find(p => p.symbol === `${quoteAsset}-USD`);
        if (quoteUsdPair && quoteUsdPair.price > 0) {
          conversionRate = 1 / quoteUsdPair.price; // Convert USD price to quote currency
        }
      }
      
      // Skip custom tokens as they don't have public trades on Coinbase
      if (currentPair?.isCustomToken) {
        setPublicTrades([]);
        setIsLoadingTrades(false);
        return;
      }

      const tradesData = await getPublicTrades(coinbasePair, 50);
      
      // Convert trade prices if synthetic pair or college coin
      const needsConversion = isSynthetic || isCollegeCoin;
      const convertedTrades = needsConversion ? tradesData.map(trade => ({
        ...trade,
        price: (parseFloat(trade.price) * conversionRate).toString(),
      })) : tradesData;
      
      setPublicTrades(convertedTrades);
    } catch (error) {
      console.error('Failed to fetch trades:', error);
    } finally {
      setIsLoadingTrades(false);
    }
  }, [selectedPair]);

  // Fetch order book
  const refreshOrderBook = useCallback(async () => {
    if (!selectedPair) return;
    try {
      setIsLoadingOrderBook(true);
      
      // For synthetic pairs (ETH/USDT quotes), fetch USD pair order book and convert
      const [baseAsset, quoteAsset] = selectedPair.split('-');
      // Use ref to get latest pairs without causing callback recreation
      const currentPairs = pairsRef.current;
      const currentPair = currentPairs.find(p => p.symbol === selectedPair);
      
      // Skip custom tokens: fetch real INTERNAL order book
      if (currentPair?.isCustomToken) {
         try {
           const internalBook = await getInternalOrderBook(currentPair.symbol);
           setOrderBook(internalBook);
         } catch (e) {
           console.error('Failed to load internal book', e);
           setOrderBook({ bids: [], asks: [] });
         }
         setIsLoadingOrderBook(false);
         return;
      }

      // Check if this is a college coin
      const isCollegeCoin = currentPair?.isCollegeCoin === true;
      const isSynthetic = (quoteAsset === 'ETH' || quoteAsset === 'USDT') && currentPair && !isCollegeCoin;
      
      let coinbasePair = selectedPair;
      let conversionRate = 1;
      
      if (isCollegeCoin && currentPair.peggedToAsset && currentPair.peggedPercentage) {
        // For college coins, fetch reference token order book and scale by percentage
        coinbasePair = `${currentPair.peggedToAsset}-USD`;
        conversionRate = currentPair.peggedPercentage / 100;
      } else if (isSynthetic) {
        // Use base-USD pair for order book (Coinbase doesn't have ETH/USDT quote pairs)
        coinbasePair = `${baseAsset}-USD`;
        
        // Get conversion rate: 1 USD = ? ETH or ? USDT
        const quoteUsdPair = currentPairs.find(p => p.symbol === `${quoteAsset}-USD`);
        if (quoteUsdPair && quoteUsdPair.price > 0) {
          conversionRate = 1 / quoteUsdPair.price; // Convert USD price to quote currency
        }
      }
      
      const bookData = await getOrderBook(coinbasePair, 15);
      
      // Convert order book prices if synthetic pair or college coin
      const needsConversion = isSynthetic || isCollegeCoin;
      const convertedBook = needsConversion ? {
        ...bookData,
        bids: bookData.bids.map(bid => ({
          ...bid,
          price: (parseFloat(bid.price) * conversionRate).toString(),
        })),
        asks: bookData.asks.map(ask => ({
          ...ask,
          price: (parseFloat(ask.price) * conversionRate).toString(),
        })),
      } : bookData;
      
      setOrderBook(convertedBook);
    } catch (error) {
      console.error('Failed to fetch order book:', error);
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
              if (pair.symbol.endsWith('-USD')) {
                const asset = pair.symbol.replace('-USD', '');
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
      
      // Check if this is a synthetic pair (ETH or USDT quote, not directly on Coinbase)
      // All pairs with ETH or USDT as quote are synthetic (converted from USD pairs)
      const isSynthetic = (quoteAsset === 'ETH' || quoteAsset === 'USDT') && !tradingPairData.isCustomToken;
      
      if (isSynthetic) {
        // Validate minimum order size: Synthetic pairs must be at least $1 USD
        const quoteUsdPair = currentPairs.find(p => p.symbol === `${quoteAsset}-USD`);
        if (!quoteUsdPair) {
          console.error(`${quoteAsset}-USD pair not found`);
          return { success: false };
        }
        
        let usdValue: number;
        if (side === 'BUY') {
          // total is in quote currency (ETH/USDT), convert to USD
          usdValue = total * quoteUsdPair.price;
        } else {
          // SELL: amount is in base currency, total is expected quote currency value
          // Convert total (in quote currency) to USD
          usdValue = total * quoteUsdPair.price;
        }
        
        if (usdValue < 1) {
          const errorMsg = `Order size is too small. Minimum order size is $1.00 USD. Your order value is $${usdValue.toFixed(2)} USD.`;
          message.error(errorMsg);
          return { success: false };
        }
        
        // For synthetic pairs, do 2-step conversion via USD
        // Example: SOL-ETH -> SOL-USD then ETH-USD
        
        let lastOrder: InternalOrder | undefined;
        
        // Step 1: Convert to/from USD
        if (side === 'BUY') {
          // BUY XRP-ETH means: Buy XRP, paying with ETH
          // total is the amount in quote currency (ETH), not USD
          
          // total is already in the quote currency (ETH), so we sell that amount directly
          const quoteAmountToSell = total; // This is the ETH amount the user wants to spend
          
          // Sell quote asset to get USD
          const sellResult = await placeOrder(
            `${quoteAsset}-USD`,
            'SELL',
            quoteAmountToSell, // base size in quote currency (ETH)
          );
          
          if (!sellResult.success) {
            return { success: false };
          }
          
          // Step 2: Buy base asset with USD
          const baseUsdPair = currentPairs.find(p => p.symbol === `${baseAsset}-USD`);
          if (!baseUsdPair) {
            console.error(`${baseAsset}-USD pair not found`);
            return { success: false };
          }
          
          // Calculate USD value: convert ETH to USD, then apply fee estimate
          // total (ETH) * ETH-USD price = USD value, then subtract estimated fee
          const estimatedUsdValue = total * quoteUsdPair.price;
          const estimatedUsdAfterFees = estimatedUsdValue * 0.995; // 0.5% fee estimate
          
          // Buy base asset with the USD we got
          const buyResult = await placeOrder(
            `${baseAsset}-USD`,
            'BUY',
            estimatedUsdAfterFees, // quote size in USD
          );
          
          if (!buyResult.success) {
            return { success: false };
          }
          
          // Return the last order (buy order) for tracking
          lastOrder = buyResult.order;
        } else {
          // SELL XRP-ETH means: Sell XRP, receiving ETH
          // amount is in base currency (XRP), total is expected ETH received
          
          // Step 1: Sell base asset to get USD
          const baseUsdPair = currentPairs.find(p => p.symbol === `${baseAsset}-USD`);
          if (!baseUsdPair) {
            console.error(`${baseAsset}-USD pair not found`);
            return { success: false };
          }
          
          // Sell base asset (amount is in base currency)
          const sellResult = await placeOrder(
            `${baseAsset}-USD`,
            'SELL',
            amount, // base size (XRP)
          );
          
          if (!sellResult.success) {
            return { success: false };
          }
          
          // Step 2: Buy quote asset (ETH) with USD
          const quoteUsdPair = currentPairs.find(p => p.symbol === `${quoteAsset}-USD`);
          if (!quoteUsdPair) {
            console.error(`${quoteAsset}-USD pair not found`);
            return { success: false };
          }
          
          // Calculate USD value: convert base asset to USD, then apply fee estimate
          // amount (XRP) * XRP-USD price = USD value, then subtract estimated fee
          const estimatedUsdValue = amount * baseUsdPair.price;
          const estimatedUsdAfterFees = estimatedUsdValue * 0.995; // 0.5% fee estimate
          
          // Buy quote asset with the USD we got
          const buyResult = await placeOrder(
            `${quoteAsset}-USD`,
            'BUY',
            estimatedUsdAfterFees, // quote size in USD
          );
          
          if (!buyResult.success) {
            return { success: false };
          }
          
          // Return the last order (buy order) for tracking
          lastOrder = buyResult.order;
        }
        
        // Refresh balances and orders after successful trade
        await Promise.all([refreshBalances(), refreshOrders()]);
        
        // Return the last order so modal can track it
        return { success: true, order: lastOrder };
      } else {
        // Direct pair (e.g., BTC-USD) - single order
        // For BUY: amount is in quote currency (USD), for SELL: amount is in base currency (BTC)
        const orderAmount = side === 'BUY' ? total : amount;
        
        const result = await placeOrder(
          tradingPair,
          side,
          orderAmount,
        );
        
        if (!result.success) {
          // Return false with error - don't throw to prevent Next.js overlay
          // The error message will be shown by the caller
          return { success: false };
        }
        
        // Return the order so the caller can show the modal immediately
        return { success: true, order: result.order };
      }
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
  
  // Auto-select first college coin in learner mode when pairs load
  // Only runs ONCE on initial load, and only if there's no URL pair parameter
  useEffect(() => {
    if (!isLoadingPairs && pairs.length > 0 && appMode === 'learner' && !hasAutoSelectedRef.current) {
      // Check if there's a URL pair parameter - don't override if user navigated with a specific pair
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlPair = urlParams?.get('pair');
      
      // Only auto-select if:
      // 1. Current pair is the default BTC-USD AND
      // 2. There's no URL pair parameter
      if (selectedPair === 'BTC-USD' && !urlPair) {
        const firstCollegeCoin = pairs.find(p => p.isCollegeCoin);
        if (firstCollegeCoin) {
          setSelectedPair(firstCollegeCoin.symbol);
        }
      }
      hasAutoSelectedRef.current = true;
    }
  }, [isLoadingPairs, pairs, appMode, selectedPair]);

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
      if (currentPair?.isCollegeCoin) {
        // Reset to BTC-USD when switching to investor mode with a college coin selected
        setSelectedPair('BTC-USD');
      }
    }
  }, [appMode, pairs, selectedPair]);

  // Fetch candles when pair or granularity changes
  useEffect(() => {
    if (!isLoadingPairs && selectedPair) {
      refreshCandles();
    }
  }, [selectedPair, candleGranularity, isLoadingPairs, refreshCandles]);

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
