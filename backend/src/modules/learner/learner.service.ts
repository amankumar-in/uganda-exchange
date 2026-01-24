import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, TradeStatus, OrderType } from '@prisma/client';
import { CoinbaseService, OrderValidationResult } from '../coinbase/coinbase.service';
import { CollegeCoinsService } from '../college-coins/college-coins.service';
import { TokensService } from '../tokens/tokens.service';

export interface LearnerBalanceResponse {
  asset: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
}

export interface LearnerOrderResponse {
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
  isSimulated: boolean;
  createdAt: Date;
  completedAt: Date | null;
}

export interface PortfolioSnapshotResponse {
  totalValue: number;
  investedValue: number;
  cashBalance: number;
  cryptoValue: number;
  snapshotDate: Date;
}

/**
 * Generate a human-readable transaction ID for learner mode
 * Format: LRN-YYYYMMDD-XXXXXX (e.g., LRN-20241216-A1B2C3)
 */
function generateLearnerTransactionId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LRN-${datePart}-${randomPart}`;
}

@Injectable()
export class LearnerService {
  private readonly logger = new Logger(LearnerService.name);
  private readonly PLATFORM_FEE_PERCENT = 0.5; // 0.5% platform fee (same as live)
  
  // Initial balance configuration
  private readonly CASH_BALANCE = 40000; // $40,000 starting cash
  private readonly COLLEGE_COIN_VALUE_EACH = 15000; // $15,000 worth of each college coin
  private readonly MAX_COLLEGE_COINS = 4; // Maximum 4 college coins to give

  constructor(
    private prisma: PrismaService,
    private coinbaseService: CoinbaseService,
    @Inject(forwardRef(() => CollegeCoinsService))
    private collegeCoinsService: CollegeCoinsService,
    private tokensService: TokensService,
  ) {}

  // ============================================
  // BALANCE MANAGEMENT
  // ============================================

  /**
   * Initialize learner account for a new user
   * Creates $40,000 USD balance + $15,000 worth of up to 4 college coins
   */
  async initializeLearnerAccount(userId: string): Promise<void> {
    // Check if already initialized
    const existing = await this.prisma.client.learnerFiatBalance.findUnique({
      where: { userId },
    });

    if (existing) {
      this.logger.log(`Learner account already exists for user ${userId}`);
      return;
    }

    // Create initial fiat balance with $40,000
    await this.prisma.client.learnerFiatBalance.create({
      data: {
        userId,
        currency: 'USD',
        balance: this.CASH_BALANCE,
        availableBalance: this.CASH_BALANCE,
        lockedBalance: 0,
      },
    });

    // Track crypto value for portfolio snapshot
    let totalCryptoValue = 0;
    const coinsGiven: string[] = [];

    // Get active college coins
    const allCollegeCoins = await this.collegeCoinsService.findAll(false);

    if (allCollegeCoins.length > 0) {
      // Determine which coins to give
      let selectedCoins = allCollegeCoins;

      if (allCollegeCoins.length > this.MAX_COLLEGE_COINS) {
        // Randomly select 4 coins by shuffling and taking first 4
        selectedCoins = [...allCollegeCoins]
          .sort(() => Math.random() - 0.5)
          .slice(0, this.MAX_COLLEGE_COINS);
      }

      // Give $15,000 worth of each selected coin
      for (const coin of selectedCoins) {
        try {
          // Calculate the current price of the college coin
          const priceData = await this.collegeCoinsService.calculatePrice(coin.ticker);

          if (!priceData) {
            this.logger.warn(`Could not get price for college coin ${coin.ticker}, skipping`);
            continue;
          }

          // Calculate quantity: $1,500 / price
          const quantity = this.COLLEGE_COIN_VALUE_EACH / priceData.collegeCoinPrice;

          // Create crypto balance for this college coin
          await this.prisma.client.learnerCryptoBalance.create({
            data: {
              userId,
              asset: coin.ticker,
              balance: quantity,
              availableBalance: quantity,
              lockedBalance: 0,
            },
          });

          totalCryptoValue += this.COLLEGE_COIN_VALUE_EACH;
          coinsGiven.push(`${coin.ticker} (${quantity.toFixed(8)} @ $${priceData.collegeCoinPrice.toFixed(2)})`);

          this.logger.log(`Gave user ${userId} $${this.COLLEGE_COIN_VALUE_EACH} worth of ${coin.ticker}: ${quantity.toFixed(8)} coins`);
        } catch (error) {
          this.logger.error(`Failed to give college coin ${coin.ticker} to user ${userId}:`, error);
          // Continue with other coins
        }
      }
    }

    // Create initial portfolio snapshot
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalValue = this.CASH_BALANCE + totalCryptoValue;

    await this.prisma.client.learnerPortfolioSnapshot.create({
      data: {
        userId,
        totalValue,
        investedValue: totalValue, // Starting capital counts as "invested"
        cashBalance: this.CASH_BALANCE,
        cryptoValue: totalCryptoValue,
        snapshotDate: today,
      },
    });

    if (coinsGiven.length > 0) {
      this.logger.log(`Initialized learner account for user ${userId} with $${this.CASH_BALANCE} cash + ${coinsGiven.length} college coins: ${coinsGiven.join(', ')}`);
    } else {
      this.logger.log(`Initialized learner account for user ${userId} with $${this.CASH_BALANCE} cash (no college coins available)`);
    }
  }

  /**
   * Reset learner account back to initial state
   * Deletes all trades and balances, reinitializes with $40,000 + college coins
   */
  async resetLearnerAccount(userId: string): Promise<{ message: string }> {
    // Delete all learner trades
    await this.prisma.client.learnerTrade.deleteMany({
      where: { userId },
    });

    // Delete all crypto balances
    await this.prisma.client.learnerCryptoBalance.deleteMany({
      where: { userId },
    });

    // Delete all portfolio snapshots
    await this.prisma.client.learnerPortfolioSnapshot.deleteMany({
      where: { userId },
    });

    // Delete fiat balance
    await this.prisma.client.learnerFiatBalance.deleteMany({
      where: { userId },
    });

    // Reinitialize with new $40,000 + college coins distribution
    await this.initializeLearnerAccount(userId);

    // Get the balances to build a dynamic message
    const balances = await this.getLearnerBalances(userId);
    const cryptoCount = balances.filter(b => b.asset !== 'USD').length;
    
    let message = `Learner account reset successfully. You now have $${this.CASH_BALANCE.toLocaleString()} in cash`;
    if (cryptoCount > 0) {
      message += ` plus $${(this.COLLEGE_COIN_VALUE_EACH * cryptoCount).toLocaleString()} worth of ${cryptoCount} college coin${cryptoCount > 1 ? 's' : ''} to practice with.`;
    } else {
      message += ' to practice with.';
    }

    this.logger.log(`Reset learner account for user ${userId}`);
    return { message };
  }

  /**
   * Get all learner balances (fiat + crypto)
   */
  async getLearnerBalances(userId: string): Promise<LearnerBalanceResponse[]> {
    // Ensure account is initialized
    await this.initializeLearnerAccount(userId);

    const [fiatBalance, cryptoBalances] = await Promise.all([
      this.prisma.client.learnerFiatBalance.findUnique({
        where: { userId },
      }),
      this.prisma.client.learnerCryptoBalance.findMany({
        where: { userId },
      }),
    ]);

    const balances: LearnerBalanceResponse[] = [];

    // Add USD balance
    if (fiatBalance) {
      balances.push({
        asset: 'USD',
        balance: parseFloat(fiatBalance.balance.toString()),
        availableBalance: parseFloat(fiatBalance.availableBalance.toString()),
        lockedBalance: parseFloat(fiatBalance.lockedBalance.toString()),
      });
    }

    // Add crypto balances
    for (const crypto of cryptoBalances) {
      balances.push({
        asset: crypto.asset,
        balance: parseFloat(crypto.balance.toString()),
        availableBalance: parseFloat(crypto.availableBalance.toString()),
        lockedBalance: parseFloat(crypto.lockedBalance.toString()),
      });
    }

    return balances;
  }

  /**
   * Get or create learner crypto balance
   */
  private async getOrCreateCryptoBalance(
    userId: string,
    asset: string,
  ): Promise<LearnerBalanceResponse> {
    const balance = await this.prisma.client.learnerCryptoBalance.findUnique({
      where: {
        userId_asset: {
          userId,
          asset,
        },
      },
    });

    if (balance) {
      return {
        asset: balance.asset,
        balance: parseFloat(balance.balance.toString()),
        availableBalance: parseFloat(balance.availableBalance.toString()),
        lockedBalance: parseFloat(balance.lockedBalance.toString()),
      };
    }

    return {
      asset,
      balance: 0,
      availableBalance: 0,
      lockedBalance: 0,
    };
  }

  /**
   * Check if user has sufficient learner balance
   */
  private async hasSufficientBalance(
    userId: string,
    asset: string,
    amount: number,
  ): Promise<boolean> {
    if (asset === 'USD') {
      const fiatBalance = await this.prisma.client.learnerFiatBalance.findUnique({
        where: { userId },
      });
      return fiatBalance ? parseFloat(fiatBalance.availableBalance.toString()) >= amount : false;
    }

    const cryptoBalance = await this.getOrCreateCryptoBalance(userId, asset);
    return cryptoBalance.availableBalance >= amount;
  }

  /**
   * Update learner balance after trade
   */
  private async updateBalance(
    userId: string,
    asset: string,
    amount: number, // Positive to add, negative to subtract
  ): Promise<void> {
    if (asset === 'USD') {
      await this.prisma.client.learnerFiatBalance.update({
        where: { userId },
        data: {
          balance: {
            increment: amount,
          },
          availableBalance: {
            increment: amount,
          },
        },
      });
    } else {
      await this.prisma.client.learnerCryptoBalance.upsert({
        where: {
          userId_asset: {
            userId,
            asset,
          },
        },
        create: {
          userId,
          asset,
          balance: amount,
          availableBalance: amount,
          lockedBalance: 0,
        },
        update: {
          balance: {
            increment: amount,
          },
          availableBalance: {
            increment: amount,
          },
        },
      });
    }
  }

  // ============================================
  // TRADE SIMULATION
  // ============================================

  /**
   * Simulate a trade in learner mode
   * Uses the SAME validation as live trading (via coinbaseService) for regular tokens
   * For demo college coins, uses calculated price from reference token
   * Randomly fails ~10% of the time to simulate real trading conditions
   */
  async placeLearnerTrade(
    userId: string,
    productId: string,
    side: 'BUY' | 'SELL',
    amount: number,
    currentPrice: number, // Real price from frontend (used as fallback)
  ): Promise<{ success: boolean; order: LearnerOrderResponse; isSimulatedFailure?: boolean }> {
    // Ensure account is initialized
    await this.initializeLearnerAccount(userId);

    const [asset, quote] = productId.split('-');

    // ========================================
    // STEP 1: Check if this is a demo college coin
    // ========================================
    const isDemoCollegeCoin = await this.collegeCoinsService.isDemoCollegeCoin(asset);
    
    let formattedAmount: number;
    let executionPrice: number;

    if (isDemoCollegeCoin) {
      // ========================================
      // DEMO COLLEGE COIN VALIDATION
      // Apply same rules but use calculated price
      // ========================================
      const priceData = await this.collegeCoinsService.calculatePrice(asset);
      
      if (!priceData) {
        throw new BadRequestException(`Unable to get price for demo college coin ${asset}`);
      }

      executionPrice = priceData.collegeCoinPrice;
      
      // Apply same validation rules as regular tokens
      // Min order size: $1 USD
      const minMarketFunds = 1;
      
      if (side === 'BUY') {
        // amount is in USD (quote currency)
        // Round to 2 decimal places for USD
        formattedAmount = Math.round(amount * 100) / 100;
        
        if (formattedAmount < minMarketFunds) {
          throw new BadRequestException(`Order size is too small. Minimum order size is $${minMarketFunds} USD.`);
        }
      } else {
        // SELL: amount is in base currency (college coin)
        // Round to 8 decimal places
        formattedAmount = Math.round(amount * 1e8) / 1e8;
        
        // Check estimated USD value
        const estimatedValue = formattedAmount * executionPrice;
        if (estimatedValue < minMarketFunds) {
          throw new BadRequestException(`Order value is too small. Minimum order value is $${minMarketFunds} USD.`);
        }
      }
      
      this.logger.log(`[placeLearnerTrade] Demo college coin ${asset}: price=${executionPrice}, formattedAmount=${formattedAmount}`);
    } else {
      // Check if it's a custom token
      const customToken = await this.tokensService.findBySymbol(asset);
      if (customToken) {
        executionPrice = customToken.currentPrice || 0;
        if (executionPrice <= 0) {
          throw new BadRequestException(`Price not available for custom token ${asset}`);
        }

        const minMarketFunds = 1;

        if (side === 'BUY') {
          formattedAmount = Math.round(amount * 100) / 100;
          if (formattedAmount < minMarketFunds) {
            throw new BadRequestException(`Order size is too small. Minimum order size is $${minMarketFunds} USD.`);
          }
        } else {
          formattedAmount = Math.round(amount * 1e8) / 1e8;
          const estimatedValue = formattedAmount * executionPrice;
          if (estimatedValue < minMarketFunds) {
            throw new BadRequestException(`Order value is too small. Minimum order value is $${minMarketFunds} USD.`);
          }
        }
        
        this.logger.log(`[placeLearnerTrade] Custom token ${asset}: price=${executionPrice}, formattedAmount=${formattedAmount}`);
      } else {
        // ========================================
        // REGULAR TOKEN VALIDATION
        // Use Coinbase validation
        // ========================================
        const validation = await this.coinbaseService.validateAndFormatOrder(
          productId,
          side,
          side === 'BUY' ? amount : undefined, // quoteSize for BUY
          side === 'SELL' ? amount : undefined, // baseSize for SELL
        );

        this.logger.log(`[placeLearnerTrade] Validation passed for ${productId} ${side}: ${JSON.stringify(validation)}`);

        // Use validated/formatted amounts
        formattedAmount = side === 'BUY'
          ? parseFloat(validation.formattedQuoteSize!)
          : parseFloat(validation.formattedBaseSize!);

        // Use price from Coinbase product data if available, otherwise use frontend price
        executionPrice = validation.productPrice || currentPrice;
      }
    }

    // ========================================
    // STEP 2: Check learner balance
    // ========================================
    const requiredAsset = side === 'BUY' ? quote : asset;
    const requiredAmount = formattedAmount;

    const hasBalance = await this.hasSufficientBalance(userId, requiredAsset, requiredAmount);
    if (!hasBalance) {
      const balance = requiredAsset === 'USD'
        ? await this.prisma.client.learnerFiatBalance.findUnique({ where: { userId } })
        : await this.getOrCreateCryptoBalance(userId, requiredAsset);
      
      const available = balance
        ? (requiredAsset === 'USD' 
            ? parseFloat((balance as any).availableBalance.toString())
            : (balance as LearnerBalanceResponse).availableBalance)
        : 0;
      
      throw new BadRequestException(
        `Insufficient ${requiredAsset} balance. Available: ${available.toFixed(requiredAsset === 'USD' ? 2 : 8)}, Required: ${requiredAmount.toFixed(requiredAsset === 'USD' ? 2 : 8)}`
      );
    }

    // ========================================
    // STEP 3: Calculate trade details
    // ========================================
    let filledAmount: number;
    let totalValue: number;
    let platformFee: number;

    if (side === 'BUY') {
      // BUY: User spends quote currency to get base asset
      platformFee = formattedAmount * (this.PLATFORM_FEE_PERCENT / 100);
      const amountAfterFee = formattedAmount - platformFee;
      filledAmount = amountAfterFee / executionPrice;
      totalValue = formattedAmount;
    } else {
      // SELL: User sells base asset to get quote currency
      const grossValue = formattedAmount * executionPrice;
      platformFee = grossValue * (this.PLATFORM_FEE_PERCENT / 100);
      filledAmount = formattedAmount;
      totalValue = grossValue - platformFee;
    }

    // ========================================
    // STEP 4: Create and execute trade
    // ========================================
    const trade = await this.prisma.client.learnerTrade.create({
      data: {
        transactionId: generateLearnerTransactionId(),
        userId,
        productId,
        asset,
        quote,
        side: side as OrderType,
        requestedAmount: formattedAmount,
        filledAmount: 0, // Will update after "execution"
        price: executionPrice,
        totalValue: 0,
        platformFee,
        exchangeFee: 0, // No exchange fee in simulation
        status: 'PENDING',
        isSimulated: true,
      },
    });

    // Simulate random failure (~10% chance)
    const shouldFail = Math.random() < 0.1;

    if (shouldFail) {
      const failedTrade = await this.prisma.client.learnerTrade.update({
        where: { id: trade.id },
        data: { status: 'FAILED' },
      });

      return {
        success: false,
        order: this.mapLearnerTradeToResponse(failedTrade),
        isSimulatedFailure: true,
      };
    }

    // Execute the trade - update learner balances
    if (side === 'BUY') {
      await this.updateBalance(userId, quote, -formattedAmount);
      await this.updateBalance(userId, asset, filledAmount);
    } else {
      await this.updateBalance(userId, asset, -formattedAmount);
      await this.updateBalance(userId, quote, totalValue);
    }

    // Update trade as completed
    const completedTrade = await this.prisma.client.learnerTrade.update({
      where: { id: trade.id },
      data: {
        filledAmount,
        totalValue: side === 'BUY' ? totalValue : totalValue + platformFee,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      order: this.mapLearnerTradeToResponse(completedTrade),
    };
  }

  /**
   * Get learner orders for a user
   */
  async getLearnerOrders(
    userId: string,
    options?: {
      productId?: string;
      status?: TradeStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ orders: LearnerOrderResponse[]; total: number }> {
    const where: Prisma.LearnerTradeWhereInput = {
      userId,
      ...(options?.productId && { productId: options.productId }),
      ...(options?.status && { status: options.status }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.client.learnerTrade.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.client.learnerTrade.count({ where }),
    ]);

    return {
      orders: orders.map(this.mapLearnerTradeToResponse),
      total,
    };
  }

  /**
   * Get a single learner order
   */
  async getLearnerOrder(userId: string, orderId: string): Promise<LearnerOrderResponse | null> {
    const order = await this.prisma.client.learnerTrade.findFirst({
      where: { id: orderId, userId },
    });

    return order ? this.mapLearnerTradeToResponse(order) : null;
  }

  // ============================================
  // PORTFOLIO SNAPSHOTS
  // ============================================

  /**
   * Create a portfolio snapshot for the current day
   * Should be called periodically (e.g., daily cron job) or on demand
   */
  async createPortfolioSnapshot(
    userId: string,
    cryptoPrices: Record<string, number>, // Map of asset -> USD price
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get current balances
    const balances = await this.getLearnerBalances(userId);
    
    const cashBalance = balances.find(b => b.asset === 'USD')?.balance || 0;
    
    let cryptoValue = 0;
    for (const balance of balances) {
      if (balance.asset !== 'USD' && cryptoPrices[balance.asset]) {
        cryptoValue += balance.balance * cryptoPrices[balance.asset];
      }
    }

    const totalValue = cashBalance + cryptoValue;

    // Get the initial investedValue from the first snapshot for this user
    // This preserves the original starting capital they received
    const firstSnapshot = await this.prisma.client.learnerPortfolioSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotDate: 'asc' },
      select: { investedValue: true },
    });

    // Use the original invested value, or calculate based on current balances if no prior snapshot
    const investedValue = firstSnapshot 
      ? parseFloat(firstSnapshot.investedValue.toString())
      : this.CASH_BALANCE + (balances.filter(b => b.asset !== 'USD').length * this.COLLEGE_COIN_VALUE_EACH);

    // Upsert snapshot (update if exists for today, create otherwise)
    await this.prisma.client.learnerPortfolioSnapshot.upsert({
      where: {
        userId_snapshotDate: {
          userId,
          snapshotDate: today,
        },
      },
      create: {
        userId,
        totalValue,
        investedValue,
        cashBalance,
        cryptoValue,
        snapshotDate: today,
      },
      update: {
        totalValue,
        investedValue,
        cashBalance,
        cryptoValue,
      },
    });
  }

  /**
   * Get portfolio history for growth chart
   * Returns snapshots for the specified time range
   */
  async getPortfolioHistory(
    userId: string,
    range: '1D' | '1W' | '1M' | '6M' | '1Y',
  ): Promise<PortfolioSnapshotResponse[]> {
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case '1D':
        startDate = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h to include yesterday's midnight snapshot
        break;
      case '1W':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1M':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '6M':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1Y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const snapshots = await this.prisma.client.learnerPortfolioSnapshot.findMany({
      where: {
        userId,
        snapshotDate: {
          gte: startDate,
        },
      },
      orderBy: {
        snapshotDate: 'asc',
      },
    });

    return snapshots.map(s => ({
      totalValue: parseFloat(s.totalValue.toString()),
      investedValue: parseFloat(s.investedValue.toString()),
      cashBalance: parseFloat(s.cashBalance.toString()),
      cryptoValue: parseFloat(s.cryptoValue.toString()),
      snapshotDate: s.snapshotDate,
    }));
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapLearnerTradeToResponse(trade: any): LearnerOrderResponse {
    return {
      id: trade.id,
      transactionId: trade.transactionId || `LRN-${trade.id.slice(0, 8).toUpperCase()}`,
      productId: trade.productId,
      asset: trade.asset,
      quote: trade.quote,
      side: trade.side,
      requestedAmount: parseFloat(trade.requestedAmount.toString()),
      filledAmount: parseFloat(trade.filledAmount.toString()),
      price: parseFloat(trade.price.toString()),
      totalValue: parseFloat(trade.totalValue.toString()),
      platformFee: parseFloat(trade.platformFee.toString()),
      exchangeFee: parseFloat(trade.exchangeFee.toString()),
      status: trade.status,
      isSimulated: trade.isSimulated,
      createdAt: trade.createdAt,
      completedAt: trade.completedAt,
    };
  }
}


