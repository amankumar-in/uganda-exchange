import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * CoinGecko API Service
 * Provides rich token metadata including descriptions, market data, and links
 * Uses Demo API key for higher rate limits
 */

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

// Cache duration in milliseconds (5 minutes for price data, 1 hour for static data)
const PRICE_CACHE_DURATION = 5 * 60 * 1000;
const STATIC_CACHE_DURATION = 60 * 60 * 1000;

// Map Coinbase symbols to CoinGecko IDs (common ones)
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  XRP: 'ripple',
  SOL: 'solana',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  XLM: 'stellar',
  ALGO: 'algorand',
  VET: 'vechain',
  FIL: 'filecoin',
  AAVE: 'aave',
  EOS: 'eos',
  NEAR: 'near',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  IMX: 'immutable-x',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  GALA: 'gala',
  ENJ: 'enjincoin',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  FLOKI: 'floki',
  BONK: 'bonk',
  WIF: 'dogwifcoin',
  SUI: 'sui',
  SEI: 'sei-network',
  TIA: 'celestia',
  INJ: 'injective-protocol',
  FET: 'fetch-ai',
  RNDR: 'render-token',
  GRT: 'the-graph',
  MKR: 'maker',
  SNX: 'havven',
  CRV: 'curve-dao-token',
  COMP: 'compound-governance-token',
  YFI: 'yearn-finance',
  SUSHI: 'sushi',
  '1INCH': '1inch',
  BAL: 'balancer',
  LDO: 'lido-dao',
  RPL: 'rocket-pool',
  BLUR: 'blur',
  JASMY: 'jasmycoin',
  HBAR: 'hedera-hashgraph',
  ICP: 'internet-computer',
  QNT: 'quant-network',
  EGLD: 'elrond-erd-2',
  XTZ: 'tezos',
  THETA: 'theta-token',
  XMR: 'monero',
  ETC: 'ethereum-classic',
  ZEC: 'zcash',
  DASH: 'dash',
  NEO: 'neo',
  WAVES: 'waves',
  ZIL: 'zilliqa',
  IOTA: 'iota',
  ONE: 'harmony',
  CKB: 'nervos-network',
  ROSE: 'oasis-network',
  KAVA: 'kava',
  CELO: 'celo',
  FTM: 'fantom',
  RUNE: 'thorchain',
  OSMO: 'osmosis',
  STX: 'blockstack',
  CFX: 'conflux-token',
  KAS: 'kaspa',
  TON: 'the-open-network',
  TRX: 'tron',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  BUSD: 'binance-usd',
  WBTC: 'wrapped-bitcoin',
  WETH: 'weth',
  stETH: 'staked-ether',
  cbETH: 'coinbase-wrapped-staked-eth',
};

export interface TokenMarketData {
  id: string;
  symbol: string;
  name: string;
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  description: string;
  links: {
    homepage: string[];
    whitepaper: string;
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    twitter_screen_name: string;
    telegram_channel_identifier: string;
    subreddit_url: string;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  categories: string[];
  genesis_date: string | null;
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    market_cap_rank: number;
    fully_diluted_valuation: { usd: number };
    total_volume: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number | null;
    ath: { usd: number };
    ath_change_percentage: { usd: number };
    ath_date: { usd: string };
    atl: { usd: number };
    atl_change_percentage: { usd: number };
    atl_date: { usd: string };
  };
  community_data: {
    twitter_followers: number;
    reddit_subscribers: number;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
  };
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    commit_count_4_weeks: number;
  };
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  watchlist_portfolio_users: number;
  last_updated: string;
}

export interface MarketListItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  sparkline_in_7d?: { price: number[] };
  price_change_percentage_7d_in_currency?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

@Injectable()
export class CoinGeckoService {
  private readonly logger = new Logger(CoinGeckoService.name);
  private readonly apiKey: string | undefined;
  
  // In-memory cache
  private tokenCache = new Map<string, CacheEntry<TokenMarketData>>();
  private marketsCache: CacheEntry<MarketListItem[]> | null = null;
  private marketsSparklineCache: CacheEntry<MarketListItem[]> | null = null;
  private coinListCache: CacheEntry<Array<{ id: string; symbol: string; name: string }>> | null = null;
  // OHLC cached per (coingeckoId, days). 10 min TTL — chart history isn't fast-moving.
  private ohlcCache = new Map<string, CacheEntry<[number, number, number, number, number][]>>();
  private readonly OHLC_CACHE_DURATION = 10 * 60 * 1000;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('COINGECKO_API_KEY');
    if (this.apiKey) {
      this.logger.log('✅ CoinGecko API key configured');
    } else {
      this.logger.warn('⚠️ CoinGecko API key not configured - using free tier');
    }
  }

  /**
   * Get headers for CoinGecko API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Convert symbol to CoinGecko ID
   */
  async getIdFromSymbol(symbol: string): Promise<string | null> {
    const upperSymbol = symbol.toUpperCase();
    
    // Check hardcoded mapping first
    if (SYMBOL_TO_COINGECKO_ID[upperSymbol]) {
      return SYMBOL_TO_COINGECKO_ID[upperSymbol];
    }

    // Fallback: fetch coin list from CoinGecko
    try {
      const coinList = await this.getCoinList();
      const coin = coinList.find(
        (c) => c.symbol.toUpperCase() === upperSymbol,
      );
      return coin?.id || null;
    } catch (error) {
      this.logger.error(`Failed to get ID for symbol ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get full coin list from CoinGecko (cached for 1 hour)
   */
  private async getCoinList(): Promise<
    Array<{ id: string; symbol: string; name: string }>
  > {
    if (
      this.coinListCache &&
      Date.now() - this.coinListCache.timestamp < STATIC_CACHE_DURATION
    ) {
      return this.coinListCache.data;
    }

    try {
      const response = await fetch(`${COINGECKO_API_URL}/coins/list`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }
      const data = await response.json();
      this.coinListCache = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      this.logger.error('Failed to fetch coin list', error);
      throw error;
    }
  }

  /**
   * Get detailed token information by Symbol
   */
  async getTokenDetails(symbol: string): Promise<TokenMarketData | null> {
    const id = await this.getIdFromSymbol(symbol);
    if (!id) {
      this.logger.warn(`No CoinGecko ID found for symbol: ${symbol}`);
      return null;
    }
    return this.getTokenDetailsById(id);
  }

  async getCoinOHLC(id: string, days: number): Promise<[number, number, number, number, number][]> {
    const cacheKey = `${id}:${days}`;
    const cached = this.ohlcCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.OHLC_CACHE_DURATION) {
      return cached.data;
    }

    const fetchWithFallback = async (d: number): Promise<[number, number, number, number, number][]> => {
      // 1. Try Market Chart first (High resolution: 5m for 1d, 1h for 1-90d)
      try {
        const chartRes = await fetch(
          `${COINGECKO_API_URL}/coins/${id}/market_chart?vs_currency=inr&days=${d}`,
          { headers: this.getHeaders() }
        );
        if (chartRes.ok) {
          const chartData = await chartRes.json();
          if (chartData.prices && Array.isArray(chartData.prices) && chartData.prices.length > 5) {
            // Convert Price Points [timestamp, price] to Candle [timestamp, o, h, l, c]
            return chartData.prices.map((p: [number, number]) => [p[0], p[1], p[1], p[1], p[1]]);
          }
        }
      } catch (e) {
        this.logger.warn(`Market chart failed for ${id} (${d} days): ${e.message}`);
      }

      // 2. Fallback: Standard OHLC Endpoint (Fixed resolutions: 30m, 4h, 4d)
      try {
        const ohlcRes = await fetch(
          `${COINGECKO_API_URL}/coins/${id}/ohlc?vs_currency=inr&days=${d}`,
          { headers: this.getHeaders() }
        );
        if (ohlcRes.ok) {
          const ohlcData = await ohlcRes.json();
          if (Array.isArray(ohlcData) && ohlcData.length > 0) {
            return ohlcData;
          }
        }
      } catch (e) {
        this.logger.warn(`OHLC failed for ${id} (${d} days): ${e.message}`);
      }

      return [];
    };

    try {
      let data = await fetchWithFallback(days);
      if (data.length < 5 && days < 30) data = await fetchWithFallback(30);
      if (data.length < 5 && days < 90) data = await fetchWithFallback(90);

      // Cache even empty results briefly to avoid hammering CoinGecko for 404-ish coins.
      this.ohlcCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      this.logger.error(`Fatal crash in getCoinOHLC for ${id}:`, error);
      // Serve stale on error if we have any
      return cached?.data || [];
    }
  }

  /**
   * Get detailed token information by ID
   */
  async getTokenDetailsById(id: string): Promise<TokenMarketData | null> {
    // Check cache
    const cached = this.tokenCache.get(id);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(
        `${COINGECKO_API_URL}/coins/${id}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`,
        { headers: this.getHeaders() },
      );

      if (!response.ok) {
        if (response.status === 429) {
          this.logger.warn('CoinGecko rate limit hit');
          // Return cached data if available, even if stale
          if (cached) return cached.data;
        }
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      const tokenData: TokenMarketData = {
        id: data.id,
        symbol: data.symbol,
        name: data.name,
        image: data.image,
        description: data.description?.en || '',
        links: {
          homepage: data.links?.homepage || [],
          whitepaper: data.links?.whitepaper || '',
          blockchain_site: data.links?.blockchain_site || [],
          official_forum_url: data.links?.official_forum_url || [],
          chat_url: data.links?.chat_url || [],
          announcement_url: data.links?.announcement_url || [],
          twitter_screen_name: data.links?.twitter_screen_name || '',
          telegram_channel_identifier:
            data.links?.telegram_channel_identifier || '',
          subreddit_url: data.links?.subreddit_url || '',
          repos_url: data.links?.repos_url || { github: [], bitbucket: [] },
        },
        categories: data.categories || [],
        genesis_date: data.genesis_date,
        market_data: {
          current_price: data.market_data?.current_price || { usd: 0 },
          market_cap: data.market_data?.market_cap || { usd: 0 },
          market_cap_rank: data.market_data?.market_cap_rank || 0,
          fully_diluted_valuation:
            data.market_data?.fully_diluted_valuation || { usd: 0 },
          total_volume: data.market_data?.total_volume || { usd: 0 },
          high_24h: data.market_data?.high_24h || { usd: 0 },
          low_24h: data.market_data?.low_24h || { usd: 0 },
          price_change_24h: data.market_data?.price_change_24h || 0,
          price_change_percentage_24h:
            data.market_data?.price_change_percentage_24h || 0,
          price_change_percentage_7d:
            data.market_data?.price_change_percentage_7d || 0,
          price_change_percentage_30d:
            data.market_data?.price_change_percentage_30d || 0,
          market_cap_change_24h: data.market_data?.market_cap_change_24h || 0,
          market_cap_change_percentage_24h:
            data.market_data?.market_cap_change_percentage_24h || 0,
          circulating_supply: data.market_data?.circulating_supply || 0,
          total_supply: data.market_data?.total_supply || 0,
          max_supply: data.market_data?.max_supply || null,
          ath: data.market_data?.ath || { usd: 0 },
          ath_change_percentage: data.market_data?.ath_change_percentage || {
            usd: 0,
          },
          ath_date: data.market_data?.ath_date || { usd: '' },
          atl: data.market_data?.atl || { usd: 0 },
          atl_change_percentage: data.market_data?.atl_change_percentage || {
            usd: 0,
          },
          atl_date: data.market_data?.atl_date || { usd: '' },
        },
        community_data: {
          twitter_followers: data.community_data?.twitter_followers || 0,
          reddit_subscribers: data.community_data?.reddit_subscribers || 0,
          reddit_average_posts_48h:
            data.community_data?.reddit_average_posts_48h || 0,
          reddit_average_comments_48h:
            data.community_data?.reddit_average_comments_48h || 0,
        },
        developer_data: {
          forks: data.developer_data?.forks || 0,
          stars: data.developer_data?.stars || 0,
          subscribers: data.developer_data?.subscribers || 0,
          total_issues: data.developer_data?.total_issues || 0,
          closed_issues: data.developer_data?.closed_issues || 0,
          pull_requests_merged: data.developer_data?.pull_requests_merged || 0,
          pull_request_contributors:
            data.developer_data?.pull_request_contributors || 0,
          commit_count_4_weeks: data.developer_data?.commit_count_4_weeks || 0,
        },
        sentiment_votes_up_percentage:
          data.sentiment_votes_up_percentage || 0,
        sentiment_votes_down_percentage:
          data.sentiment_votes_down_percentage || 0,
        watchlist_portfolio_users: data.watchlist_portfolio_users || 0,
        last_updated: data.last_updated || '',
      };

      // Update cache
      this.tokenCache.set(id, { data: tokenData, timestamp: Date.now() });

      return tokenData;
    } catch (error) {
      this.logger.error(`Failed to fetch token details for ID ${id}`, error);
      // Return cached data if available
      if (cached) return cached.data;
      return null;
    }
  }

  /**
   * Get market list with basic data for all major tokens
   * Useful for markets overview page
   */
  async getMarketsList(
    page = 1,
    perPage = 100,
    sparkline = false,
    ids?: string,
  ): Promise<MarketListItem[]> {
    // Check cache (only for first page and when no specific IDs are requested)
    if (page === 1 && !ids) {
      if (sparkline) {
        // Check sparkline cache
        if (
          this.marketsSparklineCache &&
          Date.now() - this.marketsSparklineCache.timestamp < PRICE_CACHE_DURATION
        ) {
          return this.marketsSparklineCache.data;
        }
      } else {
        // Check regular cache
        if (
          this.marketsCache &&
          Date.now() - this.marketsCache.timestamp < PRICE_CACHE_DURATION
        ) {
          return this.marketsCache.data;
        }
      }
    }

    try {
      const url = new URL(`${COINGECKO_API_URL}/coins/markets`);
      url.searchParams.set('vs_currency', 'usd');
      url.searchParams.set('order', 'market_cap_desc');
      url.searchParams.set('per_page', perPage.toString());
      url.searchParams.set('page', page.toString());
      url.searchParams.set('sparkline', sparkline.toString());
      if (ids) {
        url.searchParams.set('ids', ids);
      }
      url.searchParams.set('price_change_percentage', '7d');

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 429) {
          this.logger.warn('CoinGecko rate limit hit');
          // Return appropriate cache based on sparkline param
          const fallbackCache = sparkline ? this.marketsSparklineCache : this.marketsCache;
          if (fallbackCache) return fallbackCache.data;
        }
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data: MarketListItem[] = await response.json();

      // Cache first page (separate caches for sparkline vs non-sparkline)
      if (page === 1) {
        if (sparkline) {
          this.marketsSparklineCache = { data, timestamp: Date.now() };
        } else {
          this.marketsCache = { data, timestamp: Date.now() };
        }
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to fetch markets list', error);
      // Return appropriate cache based on sparkline param
      const fallbackCache = sparkline ? this.marketsSparklineCache : this.marketsCache;
      if (fallbackCache) return fallbackCache.data;
      throw error;
    }
  }

  /**
   * Get simple price for multiple tokens
   */
  async getSimplePrices(
    symbols: string[],
  ): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
    const ids: string[] = [];

    for (const symbol of symbols) {
      const id = await this.getIdFromSymbol(symbol);
      if (id) ids.push(id);
    }

    if (ids.length === 0) {
      return {};
    }

    try {
      const url = new URL(`${COINGECKO_API_URL}/simple/price`);
      url.searchParams.set('ids', ids.join(','));
      url.searchParams.set('vs_currencies', 'usd');
      url.searchParams.set('include_24hr_change', 'true');

      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      // Map back to symbols
      const result: Record<string, { usd: number; usd_24h_change: number }> =
        {};
      for (const symbol of symbols) {
        const id = await this.getIdFromSymbol(symbol);
        if (id && data[id]) {
          result[symbol] = {
            usd: data[id].usd,
            usd_24h_change: data[id].usd_24h_change,
          };
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to fetch simple prices', error);
      return {};
    }
  }

  /**
   * Get trending coins
   */
  async getTrending(): Promise<
    Array<{
      id: string;
      symbol: string;
      name: string;
      thumb: string;
      market_cap_rank: number;
    }>
  > {
    try {
      const response = await fetch(`${COINGECKO_API_URL}/search/trending`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.coins || []).map((item: any) => ({
        id: item.item.id,
        symbol: item.item.symbol,
        name: item.item.name,
        thumb: item.item.thumb,
        market_cap_rank: item.item.market_cap_rank,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch trending', error);
      return [];
    }
  }

  /**
   * Get global market data
   */
  async getGlobalData(): Promise<{
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    active_cryptocurrencies: number;
    markets: number;
    market_cap_change_percentage_24h_usd: number;
  } | null> {
    try {
      const response = await fetch(`${COINGECKO_API_URL}/global`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      this.logger.error('Failed to fetch global data', error);
      return null;
    }
  }
}

