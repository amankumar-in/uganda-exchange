/**
 * CoinGecko API Service
 * Provides rich token metadata including descriptions, market data, and links
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Types
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
    current_price: { inr: number };
    market_cap: { inr: number };
    market_cap_rank: number;
    fully_diluted_valuation: { inr: number };
    total_volume: { inr: number };
    high_24h: { inr: number };
    low_24h: { inr: number };
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    circulating_supply: number;
    total_supply: number;
    max_supply: number | null;
    ath: { inr: number };
    ath_change_percentage: { inr: number };
    ath_date: { inr: string };
    atl: { inr: number };
    atl_change_percentage: { inr: number };
    atl_date: { inr: string };
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

export interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  thumb: string;
  market_cap_rank: number;
}

export interface GlobalData {
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { btc: number; eth: number };
  active_cryptocurrencies: number;
  markets: number;
  market_cap_change_percentage_24h_usd: number;
}

// Helper for API calls
async function apiCall<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `API request failed: ${response.status}`);
    }

    return data;
  } catch (error: any) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your connection.');
    }
    throw error;
  }
}

/**
 * Get detailed token information including description, links, and market data
 */
export async function getCoinOHLC(id: string, days: number): Promise<[number, number, number, number, number][]> {
  try {
    const data = await apiCall<{ success: boolean; data: [number, number, number, number, number][] }>(
      `/coingecko/coins/${id}/ohlc?days=${days}`,
    );
    return data.data;
  } catch {
    return [];
  }
}

/**
 * Get detailed token information including description, links, and market data
 */
export async function getTokenDetails(symbol: string): Promise<TokenMarketData | null> {
  try {
    const data = await apiCall<{ success: boolean; token: TokenMarketData }>(
      `/coingecko/token/${symbol}`,
    );
    return data.token;
  } catch {
    return null;
  }
}

/**
 * Get detailed token information by ID
 */
export async function getTokenDetailsById(id: string): Promise<TokenMarketData | null> {
  try {
    const data = await apiCall<{ success: boolean; token: TokenMarketData }>(
      `/coingecko/token/id/${id}`,
    );
    return data.token;
  } catch {
    return null;
  }
}

/**
 * Get market list with basic data for all major tokens
 */
export async function getMarketsList(
  page = 1,
  perPage = 100,
  sparkline = false,
  ids?: string,
): Promise<MarketListItem[]> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
    sparkline: sparkline.toString(),
  });
  if (ids) queryParams.append('ids', ids);

  const data = await apiCall<{ success: boolean; markets: MarketListItem[] }>(
    `/coingecko/markets?${queryParams.toString()}`,
  );
  return data.markets;
}

/**
 * Get trending coins
 */
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const data = await apiCall<{ success: boolean; trending: TrendingCoin[] }>(
    '/coingecko/trending',
  );
  return data.trending;
}

/**
 * Get global market data
 */
export async function getGlobalData(): Promise<GlobalData | null> {
  try {
    const data = await apiCall<{ success: boolean; data: GlobalData }>(
      '/coingecko/global',
    );
    return data.data;
  } catch {
    return null;
  }
}

/**
 * Get simple prices for multiple tokens
 */
export async function getSimplePrices(
  symbols: string[],
): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  const data = await apiCall<{
    success: boolean;
    prices: Record<string, { usd: number; usd_24h_change: number }>;
  }>(`/coingecko/prices?symbols=${symbols.join(',')}`);
  return data.prices;
}

/**
 * Format large numbers for display
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `₹${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `₹${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `₹${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `₹${(num / 1e3).toFixed(2)}K`;
  return `₹${num.toFixed(2)}`;
}

/**
 * Format supply numbers
 */
export function formatSupply(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

/**
 * Format percentage
 */
export function formatPercentage(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price: number): string {
  if (price >= 1000) return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `₹${price.toFixed(2)}`;
  if (price >= 0.01) return `₹${price.toFixed(4)}`;
  if (price >= 0.0001) return `₹${price.toFixed(6)}`;
  return `₹${price.toFixed(8)}`;
}

