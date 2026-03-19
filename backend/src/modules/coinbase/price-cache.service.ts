import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CoinbaseService, CoinbaseProduct } from './coinbase.service';

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

  // Top trading pairs to track (most popular)
  private readonly trackedPairs = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD',
    'ADA-USD', 'AVAX-USD', 'DOT-USD', 'MATIC-USD', 'LINK-USD',
    'LTC-USD', 'UNI-USD', 'ATOM-USD', 'FIL-USD', 'APT-USD',
    'BTC-USDT', 'ETH-USDT', 'SOL-USDT',
  ];

  constructor(private readonly coinbaseService: CoinbaseService) {}

  async onModuleInit() {
    this.logger.log('Starting price cache service...');
    await this.refreshPrices();
    this.startPolling();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  /**
   * Start polling Coinbase for price updates
   */
  private startPolling() {
    // Poll every 15 seconds (reduces memory pressure and API calls)
    this.pollingInterval = setInterval(() => {
      this.refreshPrices();
    }, 15000);

    this.logger.log('Price polling started (every 15 seconds)');
  }

  /**
   * Stop polling
   */
  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.log('Price polling stopped');
    }
  }

  /**
   * Refresh all tracked prices from Coinbase
   */
  private async refreshPrices() {
    try {
      const products = await this.coinbaseService.getProducts();
      const timestamp = Date.now();
      
      // Filter to tracked pairs and update cache
      const updates: PriceCache = {};
      
      for (const product of products) {
        if (this.trackedPairs.includes(product.product_id) || 
            product.quote_currency === 'USD' || 
            product.quote_currency === 'USDT') {
          
          const update: PriceUpdate = {
            product_id: product.product_id,
            price: product.price,
            price_percentage_change_24h: product.price_percentage_change_24h,
            volume_24h: product.volume_24h,
            timestamp,
          };
          
          this.cache[product.product_id] = update;
          updates[product.product_id] = update;
        }
      }

      // Notify all listeners
      this.notifyListeners();
      
    } catch (error) {
      this.logger.error('Failed to refresh prices', error);
    }
  }

  /**
   * Get current cached prices
   */
  getCache(): PriceCache {
    return { ...this.cache };
  }

  /**
   * Get price for a specific product
   */
  getPrice(productId: string): PriceUpdate | null {
    return this.cache[productId] || null;
  }

  /**
   * Register a listener for price updates
   */
  addListener(callback: (prices: PriceCache) => void) {
    this.listeners.add(callback);
  }

  /**
   * Remove a listener
   */
  removeListener(callback: (prices: PriceCache) => void) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of price updates
   */
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

