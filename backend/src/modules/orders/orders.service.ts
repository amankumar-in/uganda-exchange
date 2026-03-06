import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CoinbaseService } from '../coinbase/coinbase.service';
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
    private coinbaseService: CoinbaseService,
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
        'USD': baseToken.allowTradeUsd,
        'USDT': baseToken.allowTradeUsdt,
        'ETH': baseToken.allowTradeEth,
        'TUIT': baseToken.allowTradeTuit,
      };
      if (pairChecks[quote] === false) {
        throw new BadRequestException(`${asset}-${quote} trading pair is not available.`);
      }

      // Enforce transaction limits (calculate USD value first)
      const tokenPrice = baseToken.currentPrice || Number(baseToken.manualPrice) || 0;
      let usdValueForLimits: number;

      if (side === 'BUY' && quote === 'USD') {
        usdValueForLimits = amount;
      } else if (side === 'SELL') {
        usdValueForLimits = amount * tokenPrice;
      } else {
        // BUY with non-USD quote - convert to USD
        const quoteCustom = await this.tokensService.findBySymbol(quote);
        let quoteUsdPrice = 1;
        if (quoteCustom?.isNative) {
          quoteUsdPrice = quoteCustom.currentPrice || Number(quoteCustom.manualPrice) || 1;
        } else if (quote !== 'USD') {
          try {
            const quoteProduct = await this.coinbaseService.getProduct(`${quote}-USD`);
            quoteUsdPrice = parseFloat(quoteProduct.price || '1');
          } catch {
            quoteUsdPrice = 1;
          }
        }
        usdValueForLimits = amount * quoteUsdPrice;
      }

      const minAmount = Number(baseToken.minTransactionAmount) || 0;
      const maxAmount = Number(baseToken.maxTransactionAmount) || 0;

      if (minAmount > 0 && usdValueForLimits > 0 && usdValueForLimits < minAmount) {
        throw new BadRequestException(
          `Minimum transaction for ${asset} is $${minAmount}. Your order is $${usdValueForLimits.toFixed(2)}.`
        );
      }
      if (maxAmount > 0 && usdValueForLimits > maxAmount) {
        throw new BadRequestException(
          `Maximum transaction for ${asset} is $${maxAmount}. Your order is $${usdValueForLimits.toFixed(2)}.`
        );
      }
    }
    // === END PERMISSION ENFORCEMENT ===

    // Validate minimum order size: BUY orders must be at least $1 USD
    if (side === 'BUY') {
      let usdValue: number;
      
      if (quote === 'USD') {
        // Direct USD pair - amount is already in USD
        usdValue = amount;
      } else {
        // Non-USD quote (ETH, USDT, etc.) - need to convert to USD
        try {
          const quoteUsdPair = `${quote}-USD`;
          let quotePrice = 0;
          
          const customQuote = await this.tokensService.findBySymbol(quote);
          if (customQuote?.isNative) {
            quotePrice = customQuote.currentPrice || 0;
          } else {
            const quoteProduct = await this.coinbaseService.getProduct(quoteUsdPair);
            quotePrice = parseFloat(quoteProduct.price || '0');
          }
          
          if (quotePrice <= 0) {
            throw new BadRequestException(`Unable to get price for ${quote}. Please try again later.`);
          }
          
          usdValue = amount * quotePrice;
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          this.logger.error(`Failed to get USD value for ${quote}:`, error);
          throw new BadRequestException(`Unable to validate order size for ${quote}. Please try again later.`);
        }
      }
      
      if (usdValue < 1) {
        throw new BadRequestException(
          `Order size is too small. Minimum order size is $1.00 USD. Your order value is $${usdValue.toFixed(2)} USD.`
        );
      }
    }

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
      // Step 3: Calculate fees and price
      let platformFee: number;
      let userPerceivedValue = 0;
      let currentPrice = 0; // Price of base asset in terms of quote currency
      
      // Check if it's an internal trade (either side is a native platform token)
      const baseCustom = await this.tokensService.findBySymbol(asset);
      const quoteCustom = await this.tokensService.findBySymbol(quote);
      const isInternalTrade = !!baseCustom?.isNative || !!quoteCustom?.isNative;

      if (isInternalTrade) {
        // Get USD prices for both
        let baseUsdPrice = 0;
        if (baseCustom?.isNative) {
          baseUsdPrice = baseCustom.currentPrice || 0;
        } else {
          try {
            const product = await this.coinbaseService.getProduct(`${asset}-USD`);
            baseUsdPrice = parseFloat(product.price || '0');
          } catch (e) {
            this.logger.error(`Failed to get price for ${asset}`, e);
          }
        }

        let quoteUsdPrice = 0;
        if (quote === 'USD') {
          quoteUsdPrice = 1;
        } else if (quoteCustom?.isNative) {
          quoteUsdPrice = quoteCustom.currentPrice || 0;
        } else {
          try {
            const product = await this.coinbaseService.getProduct(`${quote}-USD`);
            quoteUsdPrice = parseFloat(product.price || '0');
          } catch (e) {
            this.logger.error(`Failed to get price for ${quote}`, e);
          }
        }

        if (baseUsdPrice <= 0 || quoteUsdPrice <= 0) {
          throw new BadRequestException(`Price not available for ${baseUsdPrice <= 0 ? asset : quote}.`);
        }

        // Price of base asset in terms of quote currency
        currentPrice = baseUsdPrice / quoteUsdPrice;

        if (side === 'BUY') {
          // BUY: amount is in quote currency
          platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
          userPerceivedValue = amount;
        } else {
          // SELL: amount is in base asset
          userPerceivedValue = amount * currentPrice;
          platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
        }

        // Internal trade - complete immediately
        const filledAmount = side === 'BUY' ? (amount - platformFee) / currentPrice : amount;
        const totalValue = side === 'BUY' ? amount - platformFee : (amount * currentPrice);

        await this.prisma.client.trade.update({
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

        // Update balances
        await this.assetsService.unlockBalance(userId, requiredAsset, requiredAmount);
        
        if (side === 'BUY') {
          // Subtract quote currency (full amount)
          await this.assetsService.updateBalanceAfterTrade(userId, quote, -amount);
          // Add base asset (after fee)
          await this.assetsService.updateBalanceAfterTrade(userId, asset, filledAmount);
          // Add platform fee to revenue
          await this.addRevenue(userId, quote, platformFee);
        } else {
          // Subtract base asset (full amount)
          await this.assetsService.updateBalanceAfterTrade(userId, asset, -amount);
          // Add quote currency (after fee)
          await this.assetsService.updateBalanceAfterTrade(userId, quote, totalValue - platformFee);
          // Add platform fee to revenue
          await this.addRevenue(userId, quote, platformFee);
        }

        return this.mapOrderToResponse(await this.prisma.client.trade.findUnique({ where: { id: order.id } }));
      }

      // If not internal trade, proceed with Coinbase
      let amountToSendCoinbase: string;
      if (side === 'BUY') {
        platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
        amountToSendCoinbase = (amount - platformFee).toString();
      } else {
        const product = await this.coinbaseService.getProduct(productId);
        currentPrice = parseFloat(product.price || '0');
        if (currentPrice <= 0) {
          throw new BadRequestException('Unable to get current price. Please try again later.');
        }
        userPerceivedValue = amount * currentPrice;
        platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
        amountToSendCoinbase = amount.toString();
      }

      // Place order on Coinbase (our liquidity provider)
      const coinbaseResult = await this.coinbaseService.placeMarketOrder(
        productId,
        side,
        side === 'BUY' ? amountToSendCoinbase : undefined, // quoteSize for BUY (after our fee)
        side === 'SELL' ? amountToSendCoinbase : undefined, // baseSize for SELL
      );

      // Note: placeMarketOrder now throws on error, so this check may not be needed
      // But keeping it as a safety check
      if (!coinbaseResult.success || !coinbaseResult.orderId) {
        // Unlock balance and mark order as failed
        await this.assetsService.unlockBalance(userId, requiredAsset, requiredAmount);
        await this.prisma.client.trade.update({
          where: { id: order.id },
          data: { status: 'FAILED' },
        });
        throw new BadRequestException('Unable to process trade at this time. Please try again later.');
      }

      // Poll for order status until it's filled (market orders should fill quickly)
      let coinbaseOrder = await this.coinbaseService.getOrder(coinbaseResult.orderId);
      let attempts = 0;
      const maxAttempts = 10; // Try for up to 5 seconds (10 attempts * 500ms)
      
      this.logger.log(`Order ${coinbaseResult.orderId} initial status: ${coinbaseOrder.status}`);
      
      while (coinbaseOrder.status !== 'FILLED' && coinbaseOrder.status !== 'CANCELLED' && coinbaseOrder.status !== 'EXPIRED' && coinbaseOrder.status !== 'FAILED' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        coinbaseOrder = await this.coinbaseService.getOrder(coinbaseResult.orderId);
        attempts++;
        this.logger.log(`Order ${coinbaseResult.orderId} status check ${attempts}: ${coinbaseOrder.status}, filled_size: ${coinbaseOrder.filled_size}, filled_value: ${coinbaseOrder.filled_value}`);
      }

      // Calculate actual filled amounts
      const filledAmount = parseFloat(coinbaseOrder.filled_size) || 0; // Base asset amount
      const filledValue = parseFloat(coinbaseOrder.filled_value) || 0; // Quote currency value (after Coinbase fees)
      const coinbaseCommission = parseFloat(coinbaseOrder.commission || '0'); // Coinbase fee
      const filledPrice = filledAmount > 0 && filledValue > 0 
        ? filledValue / filledAmount 
        : parseFloat(coinbaseOrder.average_filled_price) || 0;

      // Recalculate platform fee if SELL order (we calculated it before, but need to ensure it's correct)
      if (side === 'SELL' && userPerceivedValue === 0) {
        // Fallback: calculate from filled value if we didn't get price earlier
        const product = await this.coinbaseService.getProduct(productId);
        const currentPrice = parseFloat(product.price || '0');
        userPerceivedValue = amount * currentPrice;
        platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
      }

      this.logger.log(`Order ${coinbaseResult.orderId} final status: ${coinbaseOrder.status}, filledAmount: ${filledAmount}, filledValue: ${filledValue}, filledPrice: ${filledPrice}, platformFee: ${platformFee}, coinbaseCommission: ${coinbaseCommission}`);

      // Update order with Coinbase details
      const updatedOrder = await this.prisma.client.trade.update({
        where: { id: order.id },
        data: {
          coinbaseOrderId: coinbaseResult.orderId,
          filledAmount,
          price: filledPrice,
          totalValue: filledValue,
          platformFee,
          exchangeFee: coinbaseCommission, // Store Coinbase commission (hidden from users)
          status: this.mapCoinbaseStatus(coinbaseOrder.status),
          completedAt: coinbaseOrder.status === 'FILLED' ? new Date() : null,
        },
      });

      // Step 4: Update user balances in our ledger
      if (coinbaseOrder.status === 'FILLED' && filledAmount > 0) {
        // First, unlock the entire locked amount (it's no longer locked)
        await this.assetsService.unlockBalance(userId, requiredAsset, requiredAmount);
        
        if (side === 'BUY') {
          // BUY: User pays full requested amount (includes our fee)
          // Subtract quote currency: full requested amount
          await this.assetsService.updateBalanceAfterTrade(
            userId,
            quote,
            -amount, // Subtract full requested amount (user pays this)
          );
          // Add base asset received from Coinbase
          await this.assetsService.updateBalanceAfterTrade(
            userId,
            asset,
            filledAmount, // Add base asset
          );
          // Add platform fee to revenue ledger
          await this.addRevenue(userId, quote, platformFee);
        } else {
          // SELL: User receives filledValue minus our platform fee
          // Subtract base asset
          await this.assetsService.updateBalanceAfterTrade(
            userId,
            asset,
            -filledAmount, // Subtract base asset
          );
          // Add quote currency: what Coinbase gave us minus our fee
          const userReceives = filledValue - platformFee;
          await this.assetsService.updateBalanceAfterTrade(
            userId,
            quote,
            userReceives, // Add quote currency (after our fee)
          );
          // Add platform fee to revenue ledger
          await this.addRevenue(userId, quote, platformFee);
        }
      } else {
        // Order not filled, unlock the entire locked balance
        await this.assetsService.unlockBalance(userId, requiredAsset, requiredAmount);
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
   * Map Coinbase status to our status
   */
  private mapCoinbaseStatus(coinbaseStatus: string): TradeStatus {
    switch (coinbaseStatus) {
      case 'FILLED':
        return 'COMPLETED';
      case 'CANCELLED':
      case 'EXPIRED':
        return 'CANCELLED';
      case 'FAILED':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  /**
   * Get quote for a trade (estimate based on current prices)
   * For synthetic pairs, calculates sequentially with 2 steps
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
    const isSynthetic = quote === 'ETH' || quote === 'USDT';

    // Check if it's an internal trade (either side is a native platform token)
    const baseCustom = await this.tokensService.findBySymbol(asset);
    const quoteCustom = await this.tokensService.findBySymbol(quote);
    const isInternalTrade = !!baseCustom?.isNative || !!quoteCustom?.isNative;

    if (isInternalTrade) {
      // Get USD prices for both
      let baseUsdPrice = 0;
      if (baseCustom?.isNative) {
        baseUsdPrice = baseCustom.currentPrice || 0;
      } else {
        baseUsdPrice = await this.coinbaseService.getProductPrice(`${asset}-USD`) || 0;
      }

      let quoteUsdPrice = 0;
      if (quote === 'USD') {
        quoteUsdPrice = 1;
      } else if (quoteCustom?.isNative) {
        quoteUsdPrice = quoteCustom.currentPrice || 0;
      } else {
        quoteUsdPrice = await this.coinbaseService.getProductPrice(`${quote}-USD`) || 0;
      }

      if (baseUsdPrice <= 0 || quoteUsdPrice <= 0) {
        throw new BadRequestException(`Price not available for quote calculation`);
      }

      // Price of base asset in terms of quote currency
      const currentPrice = baseUsdPrice / quoteUsdPrice;

      if (side === 'BUY') {
        const platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
        const estimatedReceive = (amount - platformFee) / currentPrice;
        return {
          estimatedReceive,
          platformFee,
          totalFees: platformFee,
          estimatedPrice: currentPrice,
        };
      } else {
        const userPerceivedValue = amount * currentPrice;
        const platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
        const estimatedReceive = userPerceivedValue - platformFee;
        return {
          estimatedReceive,
          platformFee,
          totalFees: platformFee,
          estimatedPrice: currentPrice,
        };
      }
    }

    if (isSynthetic) {
      // Synthetic pair: 2-step calculation
      // Step 1: Get quote for first trade
      const step1Product = side === 'BUY' 
        ? `${quote}-USD`  // BUY: sell quote asset to get USD
        : `${asset}-USD`; // SELL: sell base asset to get USD
      
      const step1ProductData = await this.coinbaseService.getProduct(step1Product);
      const step1Price = parseFloat(step1ProductData.price || '0');
      
      if (step1Price <= 0) {
        throw new BadRequestException('Unable to get price for quote calculation');
      }

      let step1UsdValue: number;
      let step1PlatformFee: number;
      
      if (side === 'BUY') {
        // BUY: User wants to buy asset with quote currency
        // Step 1: Sell quote currency (e.g., ETH) to get USD
        const userPerceivedValue = amount * step1Price; // User's perceived value
        step1PlatformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
        // Estimate Coinbase gives us 99% (1% fee estimate)
        step1UsdValue = userPerceivedValue * 0.99 - step1PlatformFee;
      } else {
        // SELL: User wants to sell base asset for quote currency
        // Step 1: Sell base asset to get USD
        const userPerceivedValue = amount * step1Price;
        step1PlatformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
        // Estimate Coinbase gives us 99% (1% fee estimate)
        step1UsdValue = userPerceivedValue * 0.99 - step1PlatformFee;
      }

      // Step 2: Get quote for second trade
      const step2Product = side === 'BUY'
        ? `${asset}-USD`  // BUY: buy base asset with USD
        : `${quote}-USD`; // SELL: buy quote asset with USD
      
      const step2ProductData = await this.coinbaseService.getProduct(step2Product);
      const step2Price = parseFloat(step2ProductData.price || '0');
      
      if (step2Price <= 0) {
        throw new BadRequestException('Unable to get price for quote calculation');
      }

      // Step 2: Calculate our fee on available USD
      const step2PlatformFee = step1UsdValue * (this.PLATFORM_FEE_PERCENT / 100);
      const step2UsdToSpend = step1UsdValue - step2PlatformFee;
      
      // Estimate what we'll get from Coinbase (99% after their fees)
      const step2Receive = side === 'BUY'
        ? (step2UsdToSpend / step2Price) * 0.99  // BUY: get base asset
        : (step2UsdToSpend / step2Price) * 0.99; // SELL: get quote asset

      return {
        estimatedReceive: step2Receive,
        platformFee: step1PlatformFee + step2PlatformFee,
        totalFees: step1PlatformFee + step2PlatformFee, // User only sees our fees
        estimatedPrice: side === 'BUY' 
          ? step2Price / step1Price  // Cross rate
          : step1Price / step2Price,
      };
    } else {
      // Direct pair: single step
      const product = await this.coinbaseService.getProduct(productId);
      const currentPrice = parseFloat(product.price || '0');
      
      if (currentPrice <= 0) {
        throw new BadRequestException('Unable to get price for quote calculation');
      }

      if (side === 'BUY') {
        // BUY: User wants to buy $amount worth of asset
        const platformFee = amount * (this.PLATFORM_FEE_PERCENT / 100);
        // Estimate: amount sent to Coinbase * 0.99 (after their fees) / price
        const estimatedReceive = ((amount - platformFee) / currentPrice) * 0.99;
        
        return {
          estimatedReceive,
          platformFee,
          totalFees: platformFee,
          estimatedPrice: currentPrice,
        };
      } else {
        // SELL: User wants to sell amount of base asset
        const userPerceivedValue = amount * currentPrice;
        const platformFee = userPerceivedValue * (this.PLATFORM_FEE_PERCENT / 100);
        // Estimate: Coinbase gives us 99% after their fees, minus our fee
        const estimatedReceive = (userPerceivedValue * 0.99) - platformFee;
        
        return {
          estimatedReceive,
          platformFee,
          totalFees: platformFee,
          estimatedPrice: currentPrice,
        };
      }
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
            country: 'US',
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

