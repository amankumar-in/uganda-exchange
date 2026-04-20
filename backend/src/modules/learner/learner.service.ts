import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, TradeStatus, OrderType } from '@prisma/client';
import { DemoCollegeCoinsService } from '../demo-college-coins/demo-college-coins.service';
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
  private readonly CASH_BALANCE = 100000; // ₹1,00,000 starting cash
  private readonly COLLEGE_COIN_VALUE_EACH = 25000; // ₹25,000 worth of each college coin
  private readonly MAX_COLLEGE_COINS = 4; // Maximum 4 college coins to give

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => DemoCollegeCoinsService))
    private collegeCoinsService: DemoCollegeCoinsService,
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
    console.log(`[INIT DEBUG] Starting initializeLearnerAccount for ${userId}`);
    const startTime = Date.now();

    // Check if already initialized
    const existing = await this.prisma.client.learnerFiatBalance.findUnique({
      where: { userId },
    });

    if (existing) {
      console.log(`[INIT DEBUG] Account already exists for ${userId}, returning early`);
      this.logger.log(`Learner account already exists for user ${userId}`);
      return;
    }

    console.log(`[INIT DEBUG] No existing account for ${userId}, creating new one`);

    // Create initial fiat balance with ₹1,00,000
    console.log(`[INIT DEBUG] Creating fiat balance for ${userId}`);
    await this.prisma.client.learnerFiatBalance.create({
      data: {
        userId,
        currency: 'INR',
        balance: this.CASH_BALANCE,
        availableBalance: this.CASH_BALANCE,
        lockedBalance: 0,
      },
    });
    console.log(`[INIT DEBUG] Fiat balance created for ${userId}`);

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
          coinsGiven.push(`${coin.ticker} (${quantity.toFixed(8)} @ ₹${priceData.collegeCoinPrice.toFixed(2)})`);

          this.logger.log(`Gave user ${userId} ₹${this.COLLEGE_COIN_VALUE_EACH} worth of ${coin.ticker}: ${quantity.toFixed(8)} coins`);
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

    console.log(`[INIT DEBUG] Creating portfolio snapshot for ${userId}`);
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
    console.log(`[INIT DEBUG] Portfolio snapshot created for ${userId}`);

    if (coinsGiven.length > 0) {
      this.logger.log(`Initialized learner account for user ${userId} with ₹${this.CASH_BALANCE} cash + ${coinsGiven.length} college coins: ${coinsGiven.join(', ')}`);
    } else {
      this.logger.log(`Initialized learner account for user ${userId} with ₹${this.CASH_BALANCE} cash (no college coins available)`);
    }
    console.log(`[INIT DEBUG] Completed initializeLearnerAccount for ${userId} in ${Date.now() - startTime}ms`);
  }

  /**
   * Reset learner account back to initial state
   * Deletes all trades and balances, reinitializes with ₹1,00,000 + college coins
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
    const cryptoCount = balances.filter(b => b.asset !== 'INR').length;
    
    let message = `Learner account reset successfully. You now have ₹${this.CASH_BALANCE.toLocaleString()} in cash`;
    if (cryptoCount > 0) {
      message += ` plus ₹${(this.COLLEGE_COIN_VALUE_EACH * cryptoCount).toLocaleString()} worth of ${cryptoCount} college coin${cryptoCount > 1 ? 's' : ''} to practice with.`;
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
    console.log(`[BALANCE DEBUG] getLearnerBalances called for ${userId}`);
    const startTime = Date.now();

    // Ensure account is initialized
    console.log(`[BALANCE DEBUG] Calling initializeLearnerAccount for ${userId}`);
    await this.initializeLearnerAccount(userId);
    console.log(`[BALANCE DEBUG] initializeLearnerAccount returned for ${userId} in ${Date.now() - startTime}ms`);

    const [fiatBalance, cryptoBalances] = await Promise.all([
      this.prisma.client.learnerFiatBalance.findUnique({
        where: { userId },
      }),
      this.prisma.client.learnerCryptoBalance.findMany({
        where: { userId },
      }),
    ]);

    console.log(`[BALANCE DEBUG] Queried balances for ${userId}: fiat=${fiatBalance ? 'exists' : 'null'}, crypto count=${cryptoBalances.length}`);

    const balances: LearnerBalanceResponse[] = [];

    // Add USD balance
    if (fiatBalance) {
      balances.push({
        asset: 'INR',
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

    console.log(`[BALANCE DEBUG] Returning ${balances.length} balances for ${userId} in ${Date.now() - startTime}ms`);
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
    if (asset === 'INR') {
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
    if (asset === 'INR') {
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
   * Uses token-table prices (populated by CoinGecko) for all assets
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
      const priceData = await this.collegeCoinsService.calculatePrice(asset);
      if (!priceData) {
        throw new BadRequestException(`Unable to get price for demo college coin ${asset}`);
      }
      executionPrice = priceData.collegeCoinPrice;
      formattedAmount = side === 'BUY'
        ? Math.round(amount * 100) / 100   // INR: 2 decimal places
        : Math.round(amount * 1e8) / 1e8;  // base asset: 8 decimal places
      this.logger.log(`[placeLearnerTrade] Demo college coin ${asset}: price=${executionPrice}, formattedAmount=${formattedAmount}`);
    } else {
      // Resolve price from tokens table (populated by CoinGecko via price-cache)
      const token = await this.tokensService.findBySymbol(asset);
      executionPrice = token?.currentPrice || Number(token?.manualPrice) || currentPrice || 0;
      if (executionPrice <= 0) {
        throw new BadRequestException(`Price not available for ${asset}`);
      }
      formattedAmount = side === 'BUY'
        ? Math.round(amount * 100) / 100
        : Math.round(amount * 1e8) / 1e8;
      this.logger.log(`[placeLearnerTrade] Token ${asset}: price=${executionPrice}, formattedAmount=${formattedAmount}`);
    }

    // ========================================
    // STEP 2: Check learner balance
    // ========================================
    const requiredAsset = side === 'BUY' ? quote : asset;
    const requiredAmount = formattedAmount;

    const hasBalance = await this.hasSufficientBalance(userId, requiredAsset, requiredAmount);
    if (!hasBalance) {
      const balance = requiredAsset === 'INR'
        ? await this.prisma.client.learnerFiatBalance.findUnique({ where: { userId } })
        : await this.getOrCreateCryptoBalance(userId, requiredAsset);
      
      const available = balance
        ? (requiredAsset === 'INR' 
            ? parseFloat((balance as any).availableBalance.toString())
            : (balance as LearnerBalanceResponse).availableBalance)
        : 0;
      
      throw new BadRequestException(
        `Insufficient ${requiredAsset} balance. Available: ${available.toFixed(requiredAsset === 'INR' ? 2 : 8)}, Required: ${requiredAmount.toFixed(requiredAsset === 'INR' ? 2 : 8)}`
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
    
    const cashBalance = balances.find(b => b.asset === 'INR')?.balance || 0;
    
    let cryptoValue = 0;
    for (const balance of balances) {
      if (balance.asset !== 'INR' && cryptoPrices[balance.asset]) {
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
      : this.CASH_BALANCE + (balances.filter(b => b.asset !== 'INR').length * this.COLLEGE_COIN_VALUE_EACH);

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


