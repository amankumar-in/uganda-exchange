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
   * Poll CoinGecko for INR prices of every active token with a coingeckoId,
   * write pair entries ({SYMBOL}-INR, -USDT, -ETH, -TUIT) into the cache.
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
          allowTradeInr: true,
          allowTradeUsdt: true,
          allowTradeEth: true,
          allowTradeTuit: true,
        },
      });

      const withCoingecko = tokens.filter(t => t.coingeckoId);
      const result = await this.fetchCoinGeckoPrices(withCoingecko.map(t => t.coingeckoId!));
      hadRateLimit = result.hadRateLimit;
      const prices = result.prices;

      // Build fresh-price maps ONLY for tokens CoinGecko actually returned this cycle.
      // Any token we didn't get data for keeps its existing value — never overwrite with zero.
      const freshInrPrice = new Map<string, number>();
      const freshChange = new Map<string, number>();
      const freshVolume = new Map<string, number>();
      tokens.forEach(t => {
        if (t.coingeckoId && prices[t.coingeckoId]) {
          const data = prices[t.coingeckoId];
          if (typeof data.inr === 'number' && data.inr > 0) {
            freshInrPrice.set(t.symbol, data.inr);
            freshChange.set(t.symbol, data.inr_24h_change || 0);
            freshVolume.set(t.symbol, data.inr_24h_vol || 0);
          }
        }
      });

      // Persist the fresh set to DB so /tokens reads stay correct.
      const now = new Date();
      await Promise.all(
        Array.from(freshInrPrice.entries()).map(([symbol, price]) =>
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
          allowTradeInr: true,
          allowTradeUsdt: true,
          allowTradeEth: true,
          allowTradeTuit: true,
        },
      });

      const inrOf = (symbol: string): number => {
        const row = dbTokens.find(t => t.symbol === symbol);
        return row ? Number(row.currentPrice) || Number(row.manualPrice) || 0 : 0;
      };
      const usdtInr = inrOf('USDT');
      const ethInr = inrOf('ETH');
      const tuitInr = inrOf('TUIT');
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
        const inrPrice = Number(t.currentPrice) || Number(t.manualPrice) || 0;
        const change = t.change24h || 0;
        const volInr = Number(t.volume24h) || 0;
        if (t.allowTradeInr) putEntry(`${t.symbol}-INR`, inrPrice, change, volInr);
        if (t.allowTradeUsdt && t.symbol !== 'USDT' && usdtInr > 0) {
          // Express volume in the quote currency so sort-by-volume stays comparable
          putEntry(`${t.symbol}-USDT`, inrPrice / usdtInr, change, volInr / usdtInr);
        }
        if (t.allowTradeEth && t.symbol !== 'ETH' && ethInr > 0) {
          putEntry(`${t.symbol}-ETH`, inrPrice / ethInr, change, volInr / ethInr);
        }
        if (t.allowTradeTuit && t.symbol !== 'TUIT' && tuitInr > 0) {
          putEntry(`${t.symbol}-TUIT`, inrPrice / tuitInr, change, volInr / tuitInr);
        }
      });

      this.notifyListeners();
    } catch (error) {
      this.logger.error('Failed to refresh prices from CoinGecko', error);
    }
    return hadRateLimit;
  }

  /**
   * Hit CoinGecko /simple/price in batches. No retries — if a batch 429s we
   * bail out fast so the outer loop can back off to a longer interval.
   */
  private async fetchCoinGeckoPrices(
    ids: string[],
  ): Promise<{ prices: Record<string, { inr: number; inr_24h_change: number; inr_24h_vol: number }>; hadRateLimit: boolean }> {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const merged: Record<string, { inr: number; inr_24h_change: number; inr_24h_vol: number }> = {};
    const headers: Record<string, string> = {};
    const apiKey = process.env.COINGECKO_API_KEY;
    if (apiKey) headers['x-cg-demo-api-key'] = apiKey;
    let hadRateLimit = false;

    for (let i = 0; i < ids.length; i += this.BATCH_SIZE) {
      if (hadRateLimit) break; // stop after first 429 — don't compound the problem
      const chunk = ids.slice(i, i + this.BATCH_SIZE).join(',');
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${chunk}&vs_currencies=inr&include_24hr_change=true&include_24hr_vol=true`;
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
        Object.assign(merged, await res.json());
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
