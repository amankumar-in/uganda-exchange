import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AssetsService } from '../assets/assets.service';
import { TokensService } from '../tokens/tokens.service';
import { Prisma, TradeStatus, OrderType } from '@prisma/client';

export interface CreateOrderDto {
  userId: string;
  productId: string;
  side: 'BUY' | 'SELL';
  amount: number; // For SELL: base amount, For BUY: quote amount
}

export interface OrderResponse {
  id: string;
  transactionId: string;
  productId: string;
  asset: string;
  quote: string;
  side: OrderType;
  requestedAmount: number;
  filledAmount: number;
  price: number;
  totalValue: number;
  platformFee: number;
  exchangeFee: number;
  status: TradeStatus;
  coinbaseOrderId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Generate a human-readable transaction ID
 * Format: TXN-YYYYMMDD-XXXXXX (e.g., TXN-20241216-A1B2C3)
 */
function generateTransactionId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${datePart}-${randomPart}`;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly PLATFORM_FEE_PERCENT = 0.5; // 0.5% platform fee

  constructor(
    private prisma: PrismaService,
    private assetsService: AssetsService,
    private tokensService: TokensService,
  ) {}

  /**
   * Place a market order
   * Flow:
   * 1. Check user has sufficient balance in our ledger
   * 2. Lock the balance
   * 3. Execute trade on Coinbase (our liquidity provider)
   * 4. Update user balances in our ledger
   * 5. Unlock any remaining balance
   */
  async placeOrder(dto: CreateOrderDto): Promise<OrderResponse> {
    const { userId, productId, side, amount } = dto;
    const [asset, quote] = productId.split('-');

    // === TOKEN PERMISSION ENFORCEMENT ===
    const baseToken = await this.tokensService.findBySymbol(asset);
    if (baseToken) {
      // Check buy/sell permissions
      if (side === 'BUY' && !baseToken.allowBuy) {
        throw new BadRequestException(
          `Buying ${asset} is currently disabled. Please check back later or contact support.`
        );
      }
      if (side === 'SELL' && !baseToken.allowSell) {
        throw new BadRequestException(
          `Selling ${asset} is currently disabled. Please check back later or contact support.`
        );
      }

      // Check trading pair permissions
      const pairChecks: Record<string, boolean | null> = {
        'UGX': baseToken.allowTradeUgx,
        'USDT': baseToken.allowTradeUsdt,
        'ETH': baseToken.allowTradeEth,
        'TUIT': baseToken.allowTradeTuit,
      };
      if (pairChecks[quote] === false) {
        throw new BadRequestException(`${asset}-${quote} trading pair is not available.`);
      }

      // Enforce transaction limits (calculate UGX value first)
      const tokenPrice = baseToken.currentPrice || Number(baseToken.manualPrice) || 0;
      let ugxValueForLimits: number;

      if (side === 'BUY' && quote === 'UGX') {
        ugxValueForLimits = amount;
      } else if (side === 'SELL') {
        ugxValueForLimits = amount * tokenPrice;
      } else {
        // BUY with non-UGX quote - convert to UGX
        const quoteCustom = await this.tokensService.findBySymbol(quote);
        let quoteUgxPrice = 1;
        if (quoteCustom) {
          quoteUgxPrice = quoteCustom.currentPrice || Number(quoteCustom.manualPrice) || 1;
        }
        ugxValueForLimits = amount * quoteUgxPrice;
      }

      const minAmount = Number(baseToken.minTransactionAmount) || 0;
      const maxAmount = Number(baseToken.maxTransactionAmount) || 0;

      if (minAmount > 0 && ugxValueForLimits > 0 && ugxValueForLimits < minAmount) {
        throw new BadRequestException(
          `Minimum transaction for ${asset} is ₹${minAmount}. Your order is ₹${ugxValueForLimits.toFixed(2)}.`
        );
      }
      if (maxAmount > 0 && ugxValueForLimits > maxAmount) {
        throw new BadRequestException(
          `Maximum transaction for ${asset} is ₹${maxAmount}. Your order is ₹${ugxValueForLimits.toFixed(2)}.`
        );
      }
    }
    // === END PERMISSION ENFORCEMENT ===

    // Step 1: Check user balance in our ledger
    let requiredAsset: string;
    let requiredAmount: number;
    
    if (side === 'BUY') {
      // BUY: User needs quote currency (USD/ETH/USDT) to buy base asset
      requiredAsset = quote;
      requiredAmount = amount; // amount is in quote currency
    } else {
      // SELL: User needs base asset to sell
      requiredAsset = asset;
      requiredAmount = amount; // amount is in base asset
    }

    // Check if user has sufficient balance
    const hasBalance = await this.assetsService.hasSufficientBalance(
      userId,
      requiredAsset,
      requiredAmount,
    );

    if (!hasBalance) {
      const balance = await this.assetsService.getOrCreateBalance(userId, requiredAsset);
      throw new BadRequestException(
        `Insufficient ${requiredAsset} balance. Available: ${balance.availableBalance}, Required: ${requiredAmount}`,
      );
    }

    // Step 2: Lock the balance
    await this.assetsService.lockBalance(userId, requiredAsset, requiredAmount);

    // Create pending order in database
    const order = await this.prisma.client.trade.create({
      data: {
        transactionId: generateTransactionId(),
        userId,
        productId,
        asset,
        quote,
        side: side as OrderType,
        requestedAmount: amount,
        filledAmount: 0,
        price: 0,
        totalValue: 0,
        platformFee: 0,
        exchangeFee: 0,
        status: 'PENDING',
      },
    });

    try {
      // Step 3: All trades settle internally against our ledger using token-table prices.
      // Look up UGX reference price for both base and quote, then compute cross-rate.
      const baseToken = await this.tokensService.findBySymbol(asset);
      const quoteToken = await this.tokensService.findBySymbol(quote);

      const baseUgxPrice = baseToken?.currentPrice || Number(baseToken?.manualPrice) || 0;
      const quoteUgxPrice = quote === 'UGX'
        ? 1
        : (quoteToken?.currentPrice || Number(quoteToken?.manualPrice) || 0);

      if (baseUgxPrice <= 0 || quoteUgxPrice <= 0) {
        throw new BadRequestException(`Price not available for ${baseUgxPrice <= 0 ? asset : quote}.`);
      }

      // Price of base asset expressed in quote currency
      const currentPrice = baseUgxPrice / quoteUgxPrice;

      let platformFee: number;
      let userPerceivedValue: number;
      if (side === 'BUY') {
        // amount is in quote currency
        platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
        userPerceivedValue = amount;
      } else {
        // amount is in base asset
        userPerceivedValue = amount * currentPrice;
        platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
      }

      const filledAmount = side === 'BUY' ? (amount - platformFee) / currentPrice : amount;
      const totalValue = side === 'BUY' ? amount - platformFee : amount * currentPrice;

      const updatedOrder = await this.prisma.client.trade.update({
        where: { id: order.id },
        data: {
          filledAmount,
          price: currentPrice,
          totalValue,
          platformFee,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Step 4: Settle balances
      await this.assetsService.unlockBalance(userId, requiredAsset, requiredAmount);

      if (side === 'BUY') {
        await this.assetsService.updateBalanceAfterTrade(userId, quote, -amount);
        await this.assetsService.updateBalanceAfterTrade(userId, asset, filledAmount);
        await this.addRevenue(userId, quote, platformFee);
      } else {
        await this.assetsService.updateBalanceAfterTrade(userId, asset, -amount);
        await this.assetsService.updateBalanceAfterTrade(userId, quote, totalValue - platformFee);
        await this.addRevenue(userId, quote, platformFee);
      }

      return this.mapOrderToResponse(updatedOrder);
    } catch (error) {
      this.logger.error(`Order failed for user ${userId}`, error);
      
      // Unlock balance and mark order as failed
      try {
        await this.assetsService.unlockBalance(userId, requiredAsset, requiredAmount);
      } catch (unlockError) {
        this.logger.error(`Failed to unlock balance for user ${userId}`, unlockError);
      }
      
      await this.prisma.client.trade.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      });

      throw error;
    }
  }

  /**
   * Get public order book for a filtered product
   * Aggregates pending orders by price
   */
  async getOrderBook(productId: string): Promise<{ bids: { price: string, size: string }[], asks: { price: string, size: string }[] }> {
    const pendingOrders = await this.prisma.client.trade.findMany({
      where: {
        productId,
        status: { in: ['PENDING'] } // Only show PENDING orders
      }
    });

    const bidsMap = new Map<number, number>();
    const asksMap = new Map<number, number>();

    pendingOrders.forEach(order => {
      // For Limit orders, price is fixed. For market orders, it's 0 (irrelevant for book usually, but we store them)
      // Assuming we only show Limit orders in book?
      // Or just aggregagte all pending.
      // If price is 0 (Market Order), it shouldn't be in order book technically as it executes immediately.
      // But if it's pending, maybe it's stuck?
      // Let's only include if price > 0.
      
      const price = parseFloat(order.price ? order.price.toString() : '0');
      if (price <= 0) return;
      
      const reqAmt = parseFloat(order.requestedAmount.toString());
      const filledAmt = parseFloat(order.filledAmount.toString());
      const size = reqAmt - filledAmt;
      
      if (order.side === 'BUY') {
        bidsMap.set(price, (bidsMap.get(price) || 0) + size);
      } else {
        asksMap.set(price, (asksMap.get(price) || 0) + size);
      }
    });

    const bids = Array.from(bidsMap.entries())
      .sort((a, b) => b[0] - a[0]) // Descending price
      .slice(0, 50)
      .map(([price, size]) => ({ price: price.toString(), size: size.toString() }));

    const asks = Array.from(asksMap.entries())
      .sort((a, b) => a[0] - b[0]) // Ascending price
      .slice(0, 50)
      .map(([price, size]) => ({ price: price.toString(), size: size.toString() }));

    return { bids, asks };
  }

  /**
   * Get orders for a user
   */
  async getUserOrders(
    userId: string,
    options?: {
      productId?: string;
      status?: TradeStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ orders: OrderResponse[]; total: number }> {
    const where: Prisma.TradeWhereInput = { 
      userId,
      ...(options?.productId && { productId: options.productId }),
      ...(options?.status && { status: options.status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.client.trade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.client.trade.count({ where }),
    ]);

    return {
      orders: orders.map(this.mapOrderToResponse),
      total,
    };
  }

  /**
   * Get a single order
   */
  async getOrder(userId: string, orderId: string): Promise<OrderResponse | null> {
    const order = await this.prisma.client.trade.findFirst({
      where: { id: orderId, userId },
    });

    return order ? this.mapOrderToResponse(order) : null;
  }

  /**
   * Get quote for a trade (estimate based on token-table UGX prices)
   */
  async getQuote(
    productId: string,
    side: 'BUY' | 'SELL',
    amount: number,
  ): Promise<{
    estimatedReceive: number;
    platformFee: number;
    totalFees: number;
    estimatedPrice: number;
  }> {
    const [asset, quote] = productId.split('-');

    const baseToken = await this.tokensService.findBySymbol(asset);
    const quoteToken = await this.tokensService.findBySymbol(quote);

    const baseUgxPrice = baseToken?.currentPrice || Number(baseToken?.manualPrice) || 0;
    const quoteUgxPrice = quote === 'UGX'
      ? 1
      : (quoteToken?.currentPrice || Number(quoteToken?.manualPrice) || 0);

    if (baseUgxPrice <= 0 || quoteUgxPrice <= 0) {
      throw new BadRequestException(`Price not available for quote calculation`);
    }

    const currentPrice = baseUgxPrice / quoteUgxPrice;

    if (side === 'BUY') {
      const platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
      const estimatedReceive = (amount - platformFee) / currentPrice;
      return { estimatedReceive, platformFee, totalFees: platformFee, estimatedPrice: currentPrice };
    } else {
      const userPerceivedValue = amount * currentPrice;
      const platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
      const estimatedReceive = userPerceivedValue - platformFee;
      return { estimatedReceive, platformFee, totalFees: platformFee, estimatedPrice: currentPrice };
    }
  }

  /**
   * Get revenue balances (SYSTEM user's REVENUE_* assets)
   */
  async getRevenue(): Promise<Array<{ currency: string; amount: number }>> {
    const systemUserId = await this.getOrCreateSystemUser();
    const balances = await this.assetsService.getUserBalances(systemUserId);
    
    // Filter only REVENUE_* assets and extract currency
    const revenue = balances
      .filter((b) => b.asset.startsWith('REVENUE_'))
      .map((b) => ({
        currency: b.asset.replace('REVENUE_', ''),
        amount: b.balance,
      }))
      .filter((r) => r.amount > 0); // Only show currencies with revenue
    
    return revenue;
  }

  /**
   * Get or create SYSTEM user for revenue tracking
   */
  private async getOrCreateSystemUser(): Promise<string> {
    const SYSTEM_EMAIL = 'system@intuitionexchange.internal';
    const SYSTEM_PHONE = '0000000000';
    const SYSTEM_PHONE_COUNTRY = '00';

    // Try to find existing SYSTEM user
    let systemUser = await this.prisma.client.user.findUnique({
      where: { email: SYSTEM_EMAIL },
    });

    if (!systemUser) {
      // Create SYSTEM user if it doesn't exist
      // Using a dummy password hash (this user will never login)
      const dummyPasswordHash =
        '$2b$10$dummy.hash.for.system.user.never.login.1234567890123456789012';
      
      try {
        systemUser = await this.prisma.client.user.create({
          data: {
            email: SYSTEM_EMAIL,
            phone: SYSTEM_PHONE,
            phoneCountry: SYSTEM_PHONE_COUNTRY,
            passwordHash: dummyPasswordHash,
            country: 'IN',
            emailVerified: true,
            phoneVerified: true,
            role: 'ADMIN', // SYSTEM user has admin role
            kycStatus: 'APPROVED', // SYSTEM user is pre-approved
          },
        });
        this.logger.log('Created SYSTEM user for revenue tracking');
      } catch (error: any) {
        // If creation fails (e.g., phone conflict), try to find by phone
        systemUser = await this.prisma.client.user.findUnique({
          where: { phone: SYSTEM_PHONE },
        });
        
        if (!systemUser) {
          this.logger.error('Failed to create SYSTEM user for revenue tracking', error);
          throw error;
        }
      }
    }

    return systemUser.id;
  }

  /**
   * Add platform fee to revenue ledger
   */
  private async addRevenue(userId: string, currency: string, amount: number): Promise<void> {
    try {
      const systemUserId = await this.getOrCreateSystemUser();
      const REVENUE_ASSET = `REVENUE_${currency}`;

      await this.assetsService.updateBalanceAfterTrade(
        systemUserId,
        REVENUE_ASSET,
        amount,
      );

      this.logger.log(
        `Revenue: ${amount} ${currency} from user ${userId} (platform fee)`,
      );
    } catch (error: any) {
      // Log error but don't fail the trade if revenue tracking fails
      this.logger.error(
        `Failed to track revenue: ${amount} ${currency} from user ${userId}`,
        error,
      );
    }
  }

  /**
   * Map database order to response
   */
  private mapOrderToResponse(order: any): OrderResponse {
    return {
      id: order.id,
      transactionId: order.transactionId || `TXN-${order.id.slice(0, 8).toUpperCase()}`,
      productId: order.productId,
      asset: order.asset,
      quote: order.quote,
      side: order.side,
      requestedAmount: parseFloat(order.requestedAmount.toString()),
      filledAmount: parseFloat(order.filledAmount.toString()),
      price: parseFloat(order.price.toString()),
      totalValue: parseFloat(order.totalValue.toString()),
      platformFee: parseFloat(order.platformFee.toString()),
      exchangeFee: parseFloat(order.exchangeFee.toString()),
      status: order.status,
      coinbaseOrderId: order.coinbaseOrderId,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
    };
  }
}

