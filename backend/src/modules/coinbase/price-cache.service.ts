import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export interface PriceUpdate {
  product_id: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
  timestamp: number;
}

export interface PriceCache {
  [productId: string]: PriceUpdate;
}

@Injectable()
export class PriceCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceCacheService.name);
  private cache: PriceCache = {};
  private pollingInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(prices: PriceCache) => void> = new Set();
  
  private cachedUsdUgxRate: number | null = null;
  private lastRateFetch: number = 0;

  // CoinGecko free tier is ~10-30 req/min depending on traffic. We self-schedule
  // the next refresh only after the previous one finishes, so cycles never overlap.
  private readonly POLL_INTERVAL_MS = 60_000;
  // Back-off when any batch returns 429 this cycle
  private readonly BACKOFF_MS = 5 * 60_000;
  private readonly BATCH_SIZE = 250; // CoinGecko /simple/price max is ~250 ids/request
  private stopped = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Starting CoinGecko price cache service...');
    this.stopped = false;
    this.scheduleNextCycle(0);
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Self-scheduling loop: run refreshPrices, then set a single timer for the next run
   * using either the normal interval or a longer back-off if we hit 429s.
   */
  private scheduleNextCycle(delay: number) {
    if (this.stopped) return;
    this.pollingInterval = setTimeout(async () => {
      const hadRateLimit = await this.refreshPrices();
      const nextDelay = hadRateLimit ? this.BACKOFF_MS : this.POLL_INTERVAL_MS;
      this.scheduleNextCycle(nextDelay);
    }, delay);
  }

  /**
   * Poll CoinGecko for UGX prices of every active token with a coingeckoId,
   * write pair entries ({SYMBOL}-UGX, -USDT, -ETH, -TUIT) into the cache.
   */
  private async refreshPrices(): Promise<boolean> {
    let hadRateLimit = false;
    try {
      const tokens = await this.prisma.client.token.findMany({
        where: { isActive: true },
        select: {
          symbol: true,
          coingeckoId: true,
          manualPrice: true,
          allowTradeUgx: true,
          allowTradeUsdt: true,
          allowTradeEth: true,
          allowTradeTuit: true,
        },
      });

      const withCoingecko = tokens.filter(t => t.coingeckoId);
      const usdUgxRate = await this.getUsdUgxRate();
      const result = await this.fetchCoinGeckoPrices(withCoingecko.map(t => t.coingeckoId!), usdUgxRate);
      hadRateLimit = result.hadRateLimit;
      const prices = result.prices;

      // Build fresh-price maps ONLY for tokens CoinGecko actually returned this cycle.
      // Any token we didn't get data for keeps its existing value — never overwrite with zero.
      const freshUgxPrice = new Map<string, number>();
      const freshChange = new Map<string, number>();
      const freshVolume = new Map<string, number>();
      tokens.forEach(t => {
        if (t.coingeckoId && prices[t.coingeckoId]) {
          const data = prices[t.coingeckoId];
          if (typeof data.ugx === 'number' && data.ugx > 0) {
            freshUgxPrice.set(t.symbol, data.ugx);
            freshChange.set(t.symbol, data.ugx_24h_change || 0);
            freshVolume.set(t.symbol, data.ugx_24h_vol || 0);
          }
        }
      });

      // Persist the fresh set to DB so /tokens reads stay correct.
      const now = new Date();
      await Promise.all(
        Array.from(freshUgxPrice.entries()).map(([symbol, price]) =>
          this.prisma.client.token.update({
            where: { symbol },
            data: {
              currentPrice: price,
              change24h: freshChange.get(symbol) || 0,
              volume24h: freshVolume.get(symbol) || 0,
              pricesUpdatedAt: now,
            },
          }).catch(e => this.logger.error(`Price write failed for ${symbol}: ${e.message}`))
        )
      );

      // Use DB currentPrice as the authoritative last-known value. This way the
      // in-memory cache always reflects the latest successful fetch per token,
      // even when a batch gets rate-limited this cycle.
      const dbTokens = await this.prisma.client.token.findMany({
        where: { isActive: true },
        select: {
          symbol: true,
          currentPrice: true,
          change24h: true,
          volume24h: true,
          manualPrice: true,
          allowTradeUgx: true,
          allowTradeUsdt: true,
          allowTradeEth: true,
          allowTradeTuit: true,
        },
      });

      const ugxOf = (symbol: string): number => {
        const row = dbTokens.find(t => t.symbol === symbol);
        return row ? Number(row.currentPrice) || Number(row.manualPrice) || 0 : 0;
      };
      const usdtUgx = ugxOf('USDT');
      const ethUgx = ugxOf('ETH');
      const tuitUgx = ugxOf('TUIT');
      const timestamp = Date.now();

      const putEntry = (productId: string, price: number, change: number, volume: number) => {
        if (price <= 0) return; // never cache a zero — keep last known entry instead
        this.cache[productId] = {
          product_id: productId,
          price: price.toString(),
          price_percentage_change_24h: change.toString(),
          volume_24h: volume.toString(),
          timestamp,
        };
      };

      dbTokens.forEach(t => {
        const ugxPrice = Number(t.currentPrice) || Number(t.manualPrice) || 0;
        const change = t.change24h || 0;
        const volUgx = Number(t.volume24h) || 0;
        if (t.allowTradeUgx) putEntry(`${t.symbol}-UGX`, ugxPrice, change, volUgx);
        if (t.allowTradeUsdt && t.symbol !== 'USDT' && usdtUgx > 0) {
          // Express volume in the quote currency so sort-by-volume stays comparable
          putEntry(`${t.symbol}-USDT`, ugxPrice / usdtUgx, change, volUgx / usdtUgx);
        }
        if (t.allowTradeEth && t.symbol !== 'ETH' && ethUgx > 0) {
          putEntry(`${t.symbol}-ETH`, ugxPrice / ethUgx, change, volUgx / ethUgx);
        }
        if (t.allowTradeTuit && t.symbol !== 'TUIT' && tuitUgx > 0) {
          putEntry(`${t.symbol}-TUIT`, ugxPrice / tuitUgx, change, volUgx / tuitUgx);
        }
      });

      // Special entry: Broadcast the exchange rate to the frontend
      putEntry('FIAT-USD-UGX', await this.getUsdUgxRate(), 0, 0);

      this.notifyListeners();
    } catch (error) {
      this.logger.error('Failed to refresh prices from CoinGecko', error);
    }
    return hadRateLimit;
  }

  /**
   * Fetch live USD -> UGX exchange rate from open.er-api.com (updates once a day, free, no key)
   */
  private async getUsdUgxRate(): Promise<number> {
    const now = Date.now();
    // Cache for 1 hour
    if (this.cachedUsdUgxRate && (now - this.lastRateFetch) < 3600_000) {
      return this.cachedUsdUgxRate;
    }

    try {
      this.logger.log('Fetching live USD -> UGX exchange rate...');
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates && data.rates.UGX) {
          this.cachedUsdUgxRate = data.rates.UGX;
          this.lastRateFetch = now;
          this.logger.log(`Updated exchange rate: 1 USD = ${this.cachedUsdUgxRate} UGX`);
          return this.cachedUsdUgxRate || 3700;
        }
      }
    } catch (e) {
      this.logger.error(`Failed to fetch exchange rate: ${e}`);
    }

    // Fallback to previous cache or hardcoded default if all fails
    return this.cachedUsdUgxRate || 3700;
  }

  /**
   * Hit CoinGecko /simple/price in batches. No retries — if a batch 429s we
   * bail out fast so the outer loop can back off to a longer interval.
   */
  private async fetchCoinGeckoPrices(
    ids: string[],
    usdUgxRate: number,
  ): Promise<{ prices: Record<string, { ugx: number; ugx_24h_change: number; ugx_24h_vol: number }>; hadRateLimit: boolean }> {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const merged: Record<string, { ugx: number; ugx_24h_change: number; ugx_24h_vol: number }> = {};
    const headers: Record<string, string> = {};
    const apiKey = process.env.COINGECKO_API_KEY;
    if (apiKey) headers['x-cg-demo-api-key'] = apiKey;
    let hadRateLimit = false;

    for (let i = 0; i < ids.length; i += this.BATCH_SIZE) {
      if (hadRateLimit) break; // stop after first 429 — don't compound the problem
      const chunk = ids.slice(i, i + this.BATCH_SIZE).join(',');
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${chunk}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
        const res = await fetch(url, { headers });
        if (res.status === 429) {
          hadRateLimit = true;
          this.logger.warn(`CoinGecko rate-limited, backing off for ${this.BACKOFF_MS / 1000}s`);
          break;
        }
        if (!res.ok) {
          this.logger.warn(`CoinGecko returned ${res.status}`);
          continue;
        }
        
        const rawData = await res.json();
        for (const [coinId, data] of Object.entries(rawData) as any) {
          merged[coinId] = {
            ugx: (data.usd || 0) * usdUgxRate,
            ugx_24h_change: data.usd_24h_change || 0,
            ugx_24h_vol: (data.usd_24h_vol || 0) * usdUgxRate
          };
        }
      } catch (e) {
        this.logger.error(`CoinGecko batch fetch failed: ${e}`);
      }
      if (i + this.BATCH_SIZE < ids.length) await sleep(2_000);
    }
    return { prices: merged, hadRateLimit };
  }

  getCache(): PriceCache {
    return { ...this.cache };
  }

  getPrice(productId: string): PriceUpdate | null {
    return this.cache[productId] || null;
  }

  addListener(callback: (prices: PriceCache) => void) {
    this.listeners.add(callback);
  }

  removeListener(callback: (prices: PriceCache) => void) {
    this.listeners.delete(callback);
  }

  private notifyListeners() {
    const cache = this.getCache();
    this.listeners.forEach(callback => {
      try {
        callback(cache);
      } catch (error) {
        this.logger.error('Listener error', error);
      }
    });
  }
}
