
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';
import { Token } from '@prisma/client';
import { GlobalSettingsService } from '../global-settings/global-settings.service';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

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
      allowTradeInr: createTokenDto.allowTradeInr ?? defaults.defaultAllowTradeInr,
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

  /**
   * Auto-sync Coinbase tokens into the Token table.
   * Creates any missing tokens with GlobalAssetSettings defaults.
   */
  async syncCoinbaseTokens(products: { base_currency: string; base_name: string }[]) {
    // Get unique base currencies
    const uniqueTokens = new Map<string, string>();
    products.forEach(p => {
      if (!uniqueTokens.has(p.base_currency)) {
        uniqueTokens.set(p.base_currency, p.base_name);
      }
    });

    // Find which ones already exist
    const existingTokens = await this.prisma.client.token.findMany({
      select: { symbol: true },
    });
    const existingSymbols = new Set(existingTokens.map(t => t.symbol));

    // Filter to only new tokens
    const newTokens: { symbol: string; name: string }[] = [];
    uniqueTokens.forEach((name, symbol) => {
      if (!existingSymbols.has(symbol)) {
        newTokens.push({ symbol, name });
      }
    });

    if (newTokens.length === 0) return;

    // Get global defaults
    const defaults = await this.globalSettingsService.getSettings();

    // Batch create
    await this.prisma.client.token.createMany({
      data: newTokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        allowBuy: defaults.defaultAllowBuy,
        allowSell: defaults.defaultAllowSell,
        allowP2P: defaults.defaultAllowP2P,
        allowDeposit: defaults.defaultAllowDeposit,
        allowWithdraw: defaults.defaultAllowWithdraw,
        allowTradeInr: defaults.defaultAllowTradeInr,
        allowTradeUsdt: defaults.defaultAllowTradeUsdt,
        allowTradeEth: defaults.defaultAllowTradeEth,
        allowTradeTuit: defaults.defaultAllowTradeTuit,
        minTransactionAmount: Number(defaults.defaultMinTransaction),
        maxTransactionAmount: Number(defaults.defaultMaxTransaction),
      })),
      skipDuplicates: true,
    });

    this.logger.log(`Synced ${newTokens.length} new Coinbase tokens: ${newTokens.map(t => t.symbol).join(', ')}`);
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
    if (!token) return null;

    // Price comes from DB (maintained by PriceCacheService). No external call.
    return {
      ...token,
      currentPrice: Number(token.currentPrice) || Number(token.manualPrice) || 0,
      change24h: token.change24h || 0,
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
   * Return all tokens with their last-known live UGX price.
   * Prices are maintained in the DB by PriceCacheService (polls CoinGecko every ~60s).
   * This method does not make any external API calls per request — reads only.
   */
  async fetchPrices() {
    const tokens = await this.findAll();
    return tokens.map(t => ({
      ...t,
      currentPrice: Number(t.currentPrice) || Number(t.manualPrice) || 0,
      change24h: t.change24h || 0,
    }));
  }

}
