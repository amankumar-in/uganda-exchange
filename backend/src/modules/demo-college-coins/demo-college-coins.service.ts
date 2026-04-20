import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { Prisma } from '@prisma/client';

// Static list of top tokens that can be used as reference for pegging
export const REFERENCE_TOKENS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'Ripple' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'MATIC', name: 'Polygon' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'SHIB', name: 'Shiba Inu' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'BCH', name: 'Bitcoin Cash' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'ATOM', name: 'Cosmos' },
  { symbol: 'XLM', name: 'Stellar' },
  { symbol: 'FIL', name: 'Filecoin' },
  { symbol: 'APT', name: 'Aptos' },
  { symbol: 'ARB', name: 'Arbitrum' },
  { symbol: 'OP', name: 'Optimism' },
];

export interface DemoCollegeCoinResponse {
  id: string;
  ticker: string;
  name: string;
  iconUrl: string | null;
  peggedToAsset: string;
  peggedPercentage: number;
  isActive: boolean;
  description: string | null;
  website: string | null;
  whitepaper: string | null;
  twitter: string | null;
  discord: string | null;
  categories: string[];
  genesisDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Calculated fields (when price data is available)
  currentPrice?: number;
  referencePrice?: number;
}

export interface CreateDemoCollegeCoinDto {
  ticker: string;
  name: string;
  iconUrl?: string;
  peggedToAsset: string;
  peggedPercentage: number;
  isActive?: boolean;
  description?: string;
  website?: string;
  whitepaper?: string;
  twitter?: string;
  discord?: string;
  categories?: string[];
  genesisDate?: Date;
}

export interface UpdateDemoCollegeCoinDto {
  ticker?: string;
  name?: string;
  iconUrl?: string;
  peggedToAsset?: string;
  peggedPercentage?: number;
  isActive?: boolean;
  description?: string;
  website?: string;
  whitepaper?: string;
  twitter?: string;
  discord?: string;
  categories?: string[];
  genesisDate?: Date;
}

@Injectable()
export class DemoCollegeCoinsService {
  private readonly logger = new Logger(DemoCollegeCoinsService.name);

  constructor(
    private prisma: PrismaService,
    private tokensService: TokensService,
  ) {}

  /**
   * Get list of reference tokens that can be used for pegging
   */
  getReferenceTokens(): { symbol: string; name: string }[] {
    return REFERENCE_TOKENS;
  }

  /**
   * Get all demo college coins
   */
  async findAll(includeInactive = false): Promise<DemoCollegeCoinResponse[]> {
    const where: Prisma.DemoCollegeCoinWhereInput = includeInactive
      ? {}
      : { isActive: true };

    const coins = await this.prisma.client.demoCollegeCoin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return coins.map(this.mapToResponse);
  }

  /**
   * Get a single demo college coin by ID
   */
  async findById(id: string): Promise<DemoCollegeCoinResponse> {
    const coin = await this.prisma.client.demoCollegeCoin.findUnique({
      where: { id },
    });

    if (!coin) {
      throw new NotFoundException(`Demo college coin with ID ${id} not found`);
    }

    return this.mapToResponse(coin);
  }

  /**
   * Get a demo college coin by ticker
   */
  async findByTicker(ticker: string): Promise<DemoCollegeCoinResponse | null> {
    const coin = await this.prisma.client.demoCollegeCoin.findUnique({
      where: { ticker: ticker.toUpperCase() },
    });

    return coin ? this.mapToResponse(coin) : null;
  }

  /**
   * Check if a ticker is a demo college coin
   */
  async isDemoCollegeCoin(ticker: string): Promise<boolean> {
    const coin = await this.prisma.client.demoCollegeCoin.findUnique({
      where: { ticker: ticker.toUpperCase() },
      select: { id: true },
    });
    return !!coin;
  }

  /**
   * Create a new demo college coin
   */
  async create(dto: CreateDemoCollegeCoinDto): Promise<DemoCollegeCoinResponse> {
    // Validate reference token exists
    const validToken = REFERENCE_TOKENS.find(
      (t) => t.symbol === dto.peggedToAsset.toUpperCase(),
    );
    if (!validToken) {
      throw new Error(
        `Invalid reference token: ${dto.peggedToAsset}. Must be one of: ${REFERENCE_TOKENS.map((t) => t.symbol).join(', ')}`,
      );
    }

    const coin = await this.prisma.client.demoCollegeCoin.create({
      data: {
        ticker: dto.ticker.toUpperCase(),
        name: dto.name,
        iconUrl: dto.iconUrl || null,
        peggedToAsset: dto.peggedToAsset.toUpperCase(),
        peggedPercentage: dto.peggedPercentage,
        isActive: dto.isActive ?? true,
        description: dto.description || null,
        website: dto.website || null,
        whitepaper: dto.whitepaper || null,
        twitter: dto.twitter || null,
        discord: dto.discord || null,
        categories: dto.categories || [],
        genesisDate: dto.genesisDate || null,
      },
    });

    this.logger.log(`Created demo college coin: ${coin.ticker}`);
    return this.mapToResponse(coin);
  }

  /**
   * Update a demo college coin
   */
  async update(
    id: string,
    dto: UpdateDemoCollegeCoinDto,
  ): Promise<DemoCollegeCoinResponse> {
    // Verify coin exists
    await this.findById(id);

    // Validate reference token if being updated
    if (dto.peggedToAsset) {
      const peggedAsset = dto.peggedToAsset;
      const validToken = REFERENCE_TOKENS.find(
        (t) => t.symbol === peggedAsset.toUpperCase(),
      );
      if (!validToken) {
        throw new Error(
          `Invalid reference token: ${dto.peggedToAsset}. Must be one of: ${REFERENCE_TOKENS.map((t) => t.symbol).join(', ')}`,
        );
      }
    }

    const coin = await this.prisma.client.demoCollegeCoin.update({
      where: { id },
      data: {
        ...(dto.ticker && { ticker: dto.ticker.toUpperCase() }),
        ...(dto.name && { name: dto.name }),
        ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl || null }),
        ...(dto.peggedToAsset && {
          peggedToAsset: dto.peggedToAsset.toUpperCase(),
        }),
        ...(dto.peggedPercentage !== undefined && {
          peggedPercentage: dto.peggedPercentage,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.description !== undefined && {
          description: dto.description || null,
        }),
        ...(dto.website !== undefined && { website: dto.website || null }),
        ...(dto.whitepaper !== undefined && {
          whitepaper: dto.whitepaper || null,
        }),
        ...(dto.twitter !== undefined && { twitter: dto.twitter || null }),
        ...(dto.discord !== undefined && { discord: dto.discord || null }),
        ...(dto.categories !== undefined && { categories: dto.categories }),
        ...(dto.genesisDate !== undefined && {
          genesisDate: dto.genesisDate || null,
        }),
      },
    });

    this.logger.log(`Updated demo college coin: ${coin.ticker}`);
    return this.mapToResponse(coin);
  }

  /**
   * Delete a demo college coin
   */
  async delete(id: string): Promise<void> {
    // Verify coin exists
    await this.findById(id);

    await this.prisma.client.demoCollegeCoin.delete({
      where: { id },
    });

    this.logger.log(`Deleted demo college coin with ID: ${id}`);
  }

  /**
   * Calculate the current price of a demo college coin
   * Price = referenceTokenPrice * (peggedPercentage / 100)
   */
  async calculatePrice(ticker: string): Promise<{
    collegeCoinPrice: number;
    referencePrice: number;
    peggedToAsset: string;
    peggedPercentage: number;
  } | null> {
    const coin = await this.findByTicker(ticker);
    if (!coin) return null;

    // Reference price comes from the tokens table (populated by CoinGecko in INR)
    const refToken = await this.tokensService.findBySymbol(coin.peggedToAsset);
    const referencePrice = refToken?.currentPrice || Number(refToken?.manualPrice) || 0;

    if (!referencePrice) {
      this.logger.warn(
        `Could not get reference price for ${coin.peggedToAsset}`,
      );
      return null;
    }

    const collegeCoinPrice = referencePrice * (coin.peggedPercentage / 100);

    return {
      collegeCoinPrice,
      referencePrice,
      peggedToAsset: coin.peggedToAsset,
      peggedPercentage: coin.peggedPercentage,
    };
  }

  /**
   * Get all active demo college coins with calculated prices
   */
  async findAllWithPrices(): Promise<DemoCollegeCoinResponse[]> {
    const coins = await this.findAll(false);

    // Get unique reference tokens
    const referenceTokens = [...new Set(coins.map((c) => c.peggedToAsset))];

    // Fetch all reference prices in parallel from tokens table
    const pricePromises = referenceTokens.map(async (token) => {
      const t = await this.tokensService.findBySymbol(token);
      const price = t?.currentPrice || Number(t?.manualPrice) || 0;
      return { token, price };
    });

    const prices = await Promise.all(pricePromises);
    const priceMap = new Map(prices.map((p) => [p.token, p.price]));

    // Add calculated prices to coins
    return coins.map((coin) => {
      const referencePrice = priceMap.get(coin.peggedToAsset) || 0;
      return {
        ...coin,
        referencePrice,
        currentPrice: referencePrice * (coin.peggedPercentage / 100),
      };
    });
  }

  private mapToResponse(coin: any): DemoCollegeCoinResponse {
    return {
      id: coin.id,
      ticker: coin.ticker,
      name: coin.name,
      iconUrl: coin.iconUrl,
      peggedToAsset: coin.peggedToAsset,
      peggedPercentage: parseFloat(coin.peggedPercentage.toString()),
      isActive: coin.isActive,
      description: coin.description,
      website: coin.website,
      whitepaper: coin.whitepaper,
      twitter: coin.twitter,
      discord: coin.discord,
      categories: coin.categories,
      genesisDate: coin.genesisDate,
      createdAt: coin.createdAt,
      updatedAt: coin.updatedAt,
    };
  }
}
