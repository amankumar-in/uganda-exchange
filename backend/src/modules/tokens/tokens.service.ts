
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';
import { Token } from '@prisma/client';
import { GlobalSettingsService } from '../global-settings/global-settings.service';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  // Simple in-memory cache for pricing to avoid hitting rate limits
  private priceCache: Map<string, { price: number; change24h?: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 60 seconds

  constructor(
    private prisma: PrismaService,
    private globalSettingsService: GlobalSettingsService,
  ) {}

  async create(createTokenDto: CreateTokenDto) {
    // Fetch global defaults and apply for any field not explicitly provided
    const defaults = await this.globalSettingsService.getSettings();

    const data = {
      allowBuy: createTokenDto.allowBuy ?? defaults.defaultAllowBuy,
      allowSell: createTokenDto.allowSell ?? defaults.defaultAllowSell,
      allowP2P: createTokenDto.allowP2P ?? defaults.defaultAllowP2P,
      allowDeposit: createTokenDto.allowDeposit ?? defaults.defaultAllowDeposit,
      allowWithdraw: createTokenDto.allowWithdraw ?? defaults.defaultAllowWithdraw,
      allowTradeUsd: createTokenDto.allowTradeUsd ?? defaults.defaultAllowTradeUsd,
      allowTradeUsdt: createTokenDto.allowTradeUsdt ?? defaults.defaultAllowTradeUsdt,
      allowTradeEth: createTokenDto.allowTradeEth ?? defaults.defaultAllowTradeEth,
      allowTradeTuit: createTokenDto.allowTradeTuit ?? defaults.defaultAllowTradeTuit,
      minTransactionAmount: createTokenDto.minTransactionAmount ?? Number(defaults.defaultMinTransaction),
      maxTransactionAmount: createTokenDto.maxTransactionAmount ?? Number(defaults.defaultMaxTransaction),
      miningBaseRate: createTokenDto.miningBaseRate ?? defaults.defaultMiningBaseRate,
      miningSessionHours: createTokenDto.miningSessionHours ?? defaults.defaultMiningSessionHours,
      ...createTokenDto,
      symbol: createTokenDto.symbol.toUpperCase(),
    };

    const token = await this.prisma.client.token.create({ data });
    this.logger.log(`Created new token: ${token.symbol}`);
    return token;
  }

  async findAll() {
    return this.prisma.client.token.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const token = await this.prisma.client.token.findUnique({
      where: { id },
    });
    if (!token) throw new NotFoundException(`Token with ID ${id} not found`);
    return token;
  }

  async findBySymbol(symbol: string) {
    const token = await this.prisma.client.token.findUnique({
      where: { symbol: symbol.toUpperCase() },
    });
    // Don't throw if not found, just return null so controller can handle or return null
    if (!token) return null;

    let price = 0;
    let change = 0;

    if (token.isActive) {
      if (token.contractAddress && token.chain) {
        const data = await this.getPriceFromContract(token.chain, token.contractAddress);
        price = data.price || 0;
        change = data.change || 0;
      } else if (token.coingeckoId) {
        const prices = await this.getPricesFromIds(token.coingeckoId);
        const data = prices[token.coingeckoId];
        if (data) {
          price = data.usd || 0;
          change = data.usd_24h_change || 0;
        }
      }
    }

    return { 
      ...token, 
      currentPrice: price || Number(token.manualPrice), 
      change24h: change 
    };
  }

  async update(id: string, updateTokenDto: UpdateTokenDto) {
    await this.findOne(id); // Ensure exists
    
    const token = await this.prisma.client.token.update({
      where: { id },
      data: {
        ...updateTokenDto,
        symbol: updateTokenDto.symbol ? updateTokenDto.symbol.toUpperCase() : undefined,
      },
    });
    this.logger.log(`Updated token: ${token.symbol}`);
    return token;
  }

  async remove(id: string) {
    await this.findOne(id); // Ensure exists
    await this.prisma.client.token.delete({ where: { id } });
    this.logger.log(`Deleted token ID: ${id}`);
  }

  // ==========================================
  // COINGECKO INTEGRATION & PRICE DISCOVERY
  // ==========================================

  /**
   * Search CoinGecko for tokens (Proxy for Admin Widget)
   */
  async searchCoinGecko(query: string) {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error(`CoinGecko Search Failed: ${response.status}`);
      const data = await response.json();
      return data.coins || [];
    } catch (error: any) {
      this.logger.error(`CoinGecko Search Error: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch prices for a list of tokens
   */
  async fetchPrices() {
    const tokens = await this.findAll();
    const results: (Token & { currentPrice: number; change24h?: number })[] = [];

    // Separate tokens based on price source
    const contractTokens = tokens.filter(t => t.isActive && t.contractAddress && t.chain);
    const idTokens = tokens.filter(t => t.isActive && t.coingeckoId && !t.contractAddress);
    const manualTokens = tokens.filter(t => t.isActive && !t.coingeckoId && !t.contractAddress);

    // 1. Process Contract-Based Tokens
    for (const token of contractTokens) {
      const { price, change } = await this.getPriceFromContract(token.chain!, token.contractAddress!);
      results.push({ 
        ...token, 
        currentPrice: price || Number(token.manualPrice),
        change24h: change || 0
      });
    }

    // 2. Process ID-Based Tokens (Batch Request)
    if (idTokens.length > 0) {
      const ids = idTokens.map(t => t.coingeckoId).join(',');
      const prices = await this.getPricesFromIds(ids);
      
      idTokens.forEach(token => {
        const data = prices[token.coingeckoId!];
        if (data) {
          results.push({ 
            ...token, 
            currentPrice: data.usd || Number(token.manualPrice),
            change24h: data.usd_24h_change || 0
          });
        } else {
          results.push({ ...token, currentPrice: Number(token.manualPrice), change24h: 0 });
        }
      });
    }

    // 3. Process Manual/Fallback Tokens
    manualTokens.forEach(token => {
      results.push({ ...token, currentPrice: Number(token.manualPrice), change24h: 0 });
    });

    return results;
  }

  /**
   * Helper: Get price via Contract Address
   */
  private async getPriceFromContract(chain: string, address: string): Promise<{ price: number | null; change: number | null }> {
    const cacheKey = `contract:${chain}:${address}`;
    const cached = this.getCachedPrice(cacheKey);
    if (cached) return { price: cached.price, change: cached.change24h || null };

    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${chain}?contract_addresses=${address}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(url);
      if (!res.ok) return { price: null, change: null };
      
      const data = await res.json();
      const tokenData = data[address.toLowerCase()];
      const price = tokenData?.usd;
      const change = tokenData?.usd_24h_change;
      
      if (price) this.setCachedPrice(cacheKey, price, change);
      return { price, change };
    } catch (e) {
      this.logger.error(`Failed to fetch contract price for ${address}: ${e}`);
      return { price: null, change: null };
    }
  }

  /**
   * Helper: Get prices via CoinGecko IDs
   */
  private async getPricesFromIds(ids: string): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
    const cacheKey = `ids:${ids}`; // Rough cache key for batch
    // Note: Caching batches is tricky if composition changes. For MVP, we might skip caching batch or use short TTL.
    // Simplifying: Just fetch.
    
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
      const res = await fetch(url);
      if (!res.ok) return {};
      return await res.json();
    } catch (e) {
      this.logger.error(`Failed to fetch prices for IDs ${ids}: ${e}`);
      return {};
    }
  }

  // Cache Utilities
  private getCachedPrice(key: string): { price: number; change24h?: number } | null {
    const item = this.priceCache.get(key);
    if (item && Date.now() - item.timestamp < this.CACHE_TTL) {
      return { price: item.price, change24h: item.change24h };
    }
    return null;
  }

  private setCachedPrice(key: string, price: number, change24h?: number) {
    this.priceCache.set(key, { price, change24h, timestamp: Date.now() });
  }
}
