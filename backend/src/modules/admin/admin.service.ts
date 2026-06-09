import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UserRole, KycStatus, TransactionStatus, AppMode, TradeStatus } from '@prisma/client';
import { LearnerService } from '../learner/learner.service';

// ============================================
// INTERFACES
// ============================================

export interface UserListItem {
  id: string;
  email: string;
  phone: string;
  phoneCountry: string;
  country: string;
  role: UserRole;
  appMode: string;
  kycStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  firstName: string | null;
  lastName: string | null;
}

export interface FullUserDetails extends UserListItem {
  notificationPreferences: {
    emailMarketing: boolean;
    emailSecurityAlerts: boolean;
    emailTransactions: boolean;
    emailPriceAlerts: boolean;
    emailNewsUpdates: boolean;
    pushEnabled: boolean;
    pushSecurityAlerts: boolean;
    pushTransactions: boolean;
    pushPriceAlerts: boolean;
    pushNewsUpdates: boolean;
    smsEnabled: boolean;
    smsSecurityAlerts: boolean;
    smsTransactions: boolean;
  } | null;
  bankAccounts: Array<{
    id: string;
    accountName: string;
    accountType: string;
    accountNumber: string;
    isVerified: boolean;
    createdAt: Date;
  }>;
  _count: {
    trades: number;
    fiatTransactions: number;
    cryptoTransactions: number;
    learnerTrades: number;
  };
}

export interface BalanceItem {
  asset: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
}

export interface UserBalances {
  live: BalanceItem[];
  learner: {
    fiat: BalanceItem | null;
    crypto: BalanceItem[];
  };
}

export interface TransactionItem {
  id: string;
  transactionId: string | null;
  type: string;
  method: string;
  amount: number;
  status: string;
  reference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradeItem {
  id: string;
  transactionId: string | null;
  productId: string;
  asset: string;
  quote: string;
  side: string;
  requestedAmount: number;
  filledAmount: number;
  price: number;
  totalValue: number;
  platformFee: number;
  exchangeFee: number;
  status: string;
  coinbaseOrderId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  isSimulated?: boolean;
}

export interface UpdateUserDto {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  appMode?: AppMode;
  role?: UserRole;
}

export interface BalanceAdjustmentDto {
  asset: string;
  amount: number;
  reason?: string;
  mode: 'live' | 'learner';
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => LearnerService))
    private learnerService: LearnerService,
  ) {}

  // ============================================
  // USER LISTING
  // ============================================

  /**
   * Get paginated list of users
   */
  async getUsers(options?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    kycStatus?: KycStatus;
  }): Promise<{ users: UserListItem[]; total: number; page: number; limit: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options?.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search } },
        { id: { contains: options.search } },
      ];
    }

    if (options?.role) {
      where.role = options.role;
    }

    if (options?.kycStatus) {
      where.kycStatus = options.kycStatus;
    }

    const [users, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      users: users.map((user) => {
        const firstName = null;
        const lastName = null;
        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          phoneCountry: user.phoneCountry,
          country: user.country,
          role: user.role,
          appMode: user.appMode,
          kycStatus: user.kycStatus,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          firstName,
          lastName,
        };
      }),
      total,
      page,
      limit,
    };
  }

  // ============================================
  // USER DETAILS
  // ============================================

  /**
   * Get full user details with all relations
   */
  async getFullUserDetails(id: string): Promise<FullUserDetails> {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
      include: {
        notificationPreferences: true,
        bankAccounts: true,
        _count: {
          select: {
            trades: true,
            fiatTransactions: true,
            cryptoTransactions: true,
            learnerTrades: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const firstName = null;
        const lastName = null;
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      phoneCountry: user.phoneCountry,
      country: user.country,
      role: user.role,
      appMode: user.appMode,
      kycStatus: user.kycStatus,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      firstName,
      lastName,
      notificationPreferences: user.notificationPreferences
        ? {
            emailMarketing: user.notificationPreferences.emailMarketing,
            emailSecurityAlerts: user.notificationPreferences.emailSecurityAlerts,
            emailTransactions: user.notificationPreferences.emailTransactions,
            emailPriceAlerts: user.notificationPreferences.emailPriceAlerts,
            emailNewsUpdates: user.notificationPreferences.emailNewsUpdates,
            pushEnabled: user.notificationPreferences.pushEnabled,
            pushSecurityAlerts: user.notificationPreferences.pushSecurityAlerts,
            pushTransactions: user.notificationPreferences.pushTransactions,
            pushPriceAlerts: user.notificationPreferences.pushPriceAlerts,
            pushNewsUpdates: user.notificationPreferences.pushNewsUpdates,
            smsEnabled: user.notificationPreferences.smsEnabled,
            smsSecurityAlerts: user.notificationPreferences.smsSecurityAlerts,
            smsTransactions: user.notificationPreferences.smsTransactions,
          }
        : null,
      bankAccounts: user.bankAccounts.map((ba) => ({
        id: ba.id,
        accountName: ba.accountName,
        accountType: ba.accountType,
        accountNumber: ba.accountNumber,
        isVerified: ba.isVerified,
        createdAt: ba.createdAt,
      })),
      _count: user._count,
    };
  }

  /**
   * Get single user details (legacy - for backwards compatibility)
   */
  async getUserById(id: string): Promise<FullUserDetails> {
    return this.getFullUserDetails(id);
  }

  // ============================================
  // BALANCES
  // ============================================

  /**
   * Get user balances (live + learner)
   */
  async getUserBalances(userId: string): Promise<UserBalances> {
    // Verify user exists
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Get live balances
    const liveCryptoBalances = await this.prisma.client.cryptoBalance.findMany({
      where: { userId },
    });

    const liveFiatBalance = await this.prisma.client.fiatBalance.findUnique({
      where: { userId },
    });

    // Combine live balances
    const liveBalances: BalanceItem[] = [];

    if (liveFiatBalance) {
      liveBalances.push({
        asset: 'UGX',
        balance: parseFloat(liveFiatBalance.balance.toString()),
        availableBalance: parseFloat(liveFiatBalance.availableBalance.toString()),
        lockedBalance: parseFloat(liveFiatBalance.lockedBalance.toString()),
      });
    }

    liveBalances.push(
      ...liveCryptoBalances
        .filter((b) => b.asset !== 'UGX')
        .map((b) => ({
          asset: b.asset,
          balance: parseFloat(b.balance.toString()),
          availableBalance: parseFloat(b.availableBalance.toString()),
          lockedBalance: parseFloat(b.lockedBalance.toString()),
        })),
    );

    // Get learner fiat balance
    const learnerFiatBalance = await this.prisma.client.learnerFiatBalance.findUnique({
      where: { userId },
    });

    // Get learner crypto balances
    const learnerCryptoBalances = await this.prisma.client.learnerCryptoBalance.findMany({
      where: { userId },
    });

    return {
      live: liveBalances,
      learner: {
        fiat: learnerFiatBalance
          ? {
              asset: learnerFiatBalance.currency,
              balance: parseFloat(learnerFiatBalance.balance.toString()),
              availableBalance: parseFloat(learnerFiatBalance.availableBalance.toString()),
              lockedBalance: parseFloat(learnerFiatBalance.lockedBalance.toString()),
            }
          : null,
        crypto: learnerCryptoBalances.map((b) => ({
          asset: b.asset,
          balance: parseFloat(b.balance.toString()),
          availableBalance: parseFloat(b.availableBalance.toString()),
          lockedBalance: parseFloat(b.lockedBalance.toString()),
        })),
      },
    };
  }

  /**
   * Adjust user balance (admin action)
   */
  async adjustBalance(
    userId: string,
    dto: BalanceAdjustmentDto,
    adminId: string,
  ): Promise<{ success: boolean; newBalance: BalanceItem }> {
    // Verify user exists
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (dto.mode === 'live') {
      // Adjust live balance
      if (dto.asset === 'UGX') {
        const balance = await this.prisma.client.fiatBalance.upsert({
          where: { userId },
          create: {
            userId,
            currency: 'UGX',
            balance: dto.amount,
            availableBalance: dto.amount,
            lockedBalance: 0,
          },
          update: {
            balance: { increment: dto.amount },
            availableBalance: { increment: dto.amount },
          },
        });

        this.logger.log(
          `Admin ${adminId} adjusted ${dto.mode} balance for user ${userId}: ${dto.asset} ${dto.amount > 0 ? '+' : ''}${dto.amount}. Reason: ${dto.reason}`,
        );

        return {
          success: true,
          newBalance: {
            asset: 'UGX',
            balance: parseFloat(balance.balance.toString()),
            availableBalance: parseFloat(balance.availableBalance.toString()),
            lockedBalance: parseFloat(balance.lockedBalance.toString()),
          },
        };
      }

      const balance = await this.prisma.client.cryptoBalance.upsert({
        where: {
          userId_asset: {
            userId,
            asset: dto.asset,
          },
        },
        create: {
          userId,
          asset: dto.asset,
          balance: dto.amount,
          availableBalance: dto.amount,
          lockedBalance: 0,
        },
        update: {
          balance: {
            increment: dto.amount,
          },
          availableBalance: {
            increment: dto.amount,
          },
        },
      });

      this.logger.log(
        `Admin ${adminId} adjusted ${dto.mode} balance for user ${userId}: ${dto.asset} ${dto.amount > 0 ? '+' : ''}${dto.amount}. Reason: ${dto.reason}`,
      );

      return {
        success: true,
        newBalance: {
          asset: balance.asset,
          balance: parseFloat(balance.balance.toString()),
          availableBalance: parseFloat(balance.availableBalance.toString()),
          lockedBalance: parseFloat(balance.lockedBalance.toString()),
        },
      };
    } else {
      // Adjust learner balance
      if (dto.asset === 'UGX') {
        const balance = await this.prisma.client.learnerFiatBalance.upsert({
          where: { userId },
          create: {
            userId,
            currency: 'UGX',
            balance: dto.amount,
            availableBalance: dto.amount,
            lockedBalance: 0,
          },
          update: {
            balance: {
              increment: dto.amount,
            },
            availableBalance: {
              increment: dto.amount,
            },
          },
        });

        this.logger.log(
          `Admin ${adminId} adjusted ${dto.mode} balance for user ${userId}: ${dto.asset} ${dto.amount > 0 ? '+' : ''}${dto.amount}. Reason: ${dto.reason}`,
        );

        return {
          success: true,
          newBalance: {
            asset: balance.currency,
            balance: parseFloat(balance.balance.toString()),
            availableBalance: parseFloat(balance.availableBalance.toString()),
            lockedBalance: parseFloat(balance.lockedBalance.toString()),
          },
        };
      } else {
        const balance = await this.prisma.client.learnerCryptoBalance.upsert({
          where: {
            userId_asset: {
              userId,
              asset: dto.asset,
            },
          },
          create: {
            userId,
            asset: dto.asset,
            balance: dto.amount,
            availableBalance: dto.amount,
            lockedBalance: 0,
          },
          update: {
            balance: {
              increment: dto.amount,
            },
            availableBalance: {
              increment: dto.amount,
            },
          },
        });

        this.logger.log(
          `Admin ${adminId} adjusted ${dto.mode} balance for user ${userId}: ${dto.asset} ${dto.amount > 0 ? '+' : ''}${dto.amount}. Reason: ${dto.reason}`,
        );

        return {
          success: true,
          newBalance: {
            asset: balance.asset,
            balance: parseFloat(balance.balance.toString()),
            availableBalance: parseFloat(balance.availableBalance.toString()),
            lockedBalance: parseFloat(balance.lockedBalance.toString()),
          },
        };
      }
    }
  }

  // ============================================
  // TRANSACTIONS
  // ============================================

  /**
   * Get user fiat transactions (deposits/withdrawals)
   */
  async getUserTransactions(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      type?: 'DEPOSIT' | 'WITHDRAWAL';
      status?: TransactionStatus;
    },
  ): Promise<{ transactions: TransactionItem[]; total: number; page: number; limit: number }> {
    // Verify user exists
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options?.type) where.type = options.type;
    if (options?.status) where.status = options.status;

    const [transactions, total] = await Promise.all([
      this.prisma.client.fiatTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.fiatTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        transactionId: t.transactionId,
        type: t.type,
        method: t.method,
        amount: parseFloat(t.amount.toString()),
        status: t.status,
        reference: t.reference,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    userId: string,
    transactionId: string,
    status: TransactionStatus,
    adminId: string,
  ): Promise<TransactionItem> {
    const transaction = await this.prisma.client.fiatTransaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found for user ${userId}`);
    }

    const updated = await this.prisma.client.fiatTransaction.update({
      where: { id: transactionId },
      data: { status },
    });

    this.logger.log(
      `Admin ${adminId} updated transaction ${transactionId} status from ${transaction.status} to ${status}`,
    );

    return {
      id: updated.id,
      transactionId: updated.transactionId,
      type: updated.type,
      method: updated.method,
      amount: parseFloat(updated.amount.toString()),
      status: updated.status,
      reference: updated.reference,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // ============================================
  // TRADES
  // ============================================

  /**
   * Get user trades (live + learner)
   */
  async getUserTrades(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      mode?: 'live' | 'learner' | 'all';
      status?: TradeStatus;
    },
  ): Promise<{ trades: TradeItem[]; total: number; page: number; limit: number }> {
    // Verify user exists
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;
    const mode = options?.mode || 'all';

    let trades: TradeItem[] = [];
    let total = 0;

    if (mode === 'live' || mode === 'all') {
      const whereL: any = { userId };
      if (options?.status) whereL.status = options.status;

      const [liveTrades, liveTotal] = await Promise.all([
        this.prisma.client.trade.findMany({
          where: whereL,
          skip: mode === 'live' ? skip : 0,
          take: mode === 'live' ? limit : 1000,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.client.trade.count({ where: whereL }),
      ]);

      trades.push(
        ...liveTrades.map((t) => ({
          id: t.id,
          transactionId: t.transactionId,
          productId: t.productId,
          asset: t.asset,
          quote: t.quote,
          side: t.side,
          requestedAmount: parseFloat(t.requestedAmount.toString()),
          filledAmount: parseFloat(t.filledAmount.toString()),
          price: parseFloat(t.price.toString()),
          totalValue: parseFloat(t.totalValue.toString()),
          platformFee: parseFloat(t.platformFee.toString()),
          exchangeFee: parseFloat(t.exchangeFee.toString()),
          status: t.status,
          coinbaseOrderId: t.coinbaseOrderId,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          isSimulated: false,
        })),
      );

      if (mode === 'live') {
        total = liveTotal;
      } else {
        total += liveTotal;
      }
    }

    if (mode === 'learner' || mode === 'all') {
      const whereL: any = { userId };
      if (options?.status) whereL.status = options.status;

      const [learnerTrades, learnerTotal] = await Promise.all([
        this.prisma.client.learnerTrade.findMany({
          where: whereL,
          skip: mode === 'learner' ? skip : 0,
          take: mode === 'learner' ? limit : 1000,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.client.learnerTrade.count({ where: whereL }),
      ]);

      trades.push(
        ...learnerTrades.map((t) => ({
          id: t.id,
          transactionId: t.transactionId,
          productId: t.productId,
          asset: t.asset,
          quote: t.quote,
          side: t.side,
          requestedAmount: parseFloat(t.requestedAmount.toString()),
          filledAmount: parseFloat(t.filledAmount.toString()),
          price: parseFloat(t.price.toString()),
          totalValue: parseFloat(t.totalValue.toString()),
          platformFee: parseFloat(t.platformFee.toString()),
          exchangeFee: parseFloat(t.exchangeFee.toString()),
          status: t.status,
          coinbaseOrderId: null,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
          isSimulated: true,
        })),
      );

      if (mode === 'learner') {
        total = learnerTotal;
      } else {
        total += learnerTotal;
      }
    }

    // Sort combined trades by date if mode is 'all'
    if (mode === 'all') {
      trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // Apply pagination to combined result
      trades = trades.slice(skip, skip + limit);
    }

    return {
      trades,
      total,
      page,
      limit,
    };
  }

  // ============================================
  // USER UPDATES
  // ============================================

  /**
   * Update user fields
   */
  async updateUser(id: string, dto: UpdateUserDto, adminId: string): Promise<UserListItem> {
    const user = await this.prisma.client.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate role if provided
    if (dto.role && !['USER', 'ADMIN'].includes(dto.role)) {
      throw new BadRequestException('Invalid role. Must be USER or ADMIN.');
    }

    // Validate appMode if provided
    if (dto.appMode && !['LEARNER', 'INVESTOR'].includes(dto.appMode)) {
      throw new BadRequestException('Invalid appMode. Must be LEARNER or INVESTOR.');
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id },
      data: {
        ...(dto.emailVerified !== undefined && { emailVerified: dto.emailVerified }),
        ...(dto.phoneVerified !== undefined && { phoneVerified: dto.phoneVerified }),
        ...(dto.appMode && { appMode: dto.appMode }),
        ...(dto.role && { role: dto.role }),
      },
      
    });

    this.logger.log(`Admin ${adminId} updated user ${id}: ${JSON.stringify(dto)}`);

    const firstName = null;
    const lastName = null;
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      phone: updatedUser.phone,
      phoneCountry: updatedUser.phoneCountry,
      country: updatedUser.country,
      role: updatedUser.role,
      appMode: updatedUser.appMode,
      kycStatus: updatedUser.kycStatus,
      emailVerified: updatedUser.emailVerified,
      phoneVerified: updatedUser.phoneVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      firstName,
      lastName,
    };
  }

  /**
   * Update user role (legacy - for backwards compatibility)
   */
  async updateUserRole(id: string, role: UserRole): Promise<UserListItem> {
    return this.updateUser(id, { role }, 'system');
  }



  // ============================================
  // LEARNER ACCOUNT
  // ============================================

  /**
   * Reset learner account
   * Delegates to LearnerService to use the same initialization logic
   * ($4,000 cash + $1,500 worth of up to 4 college coins)
   */
  async resetLearnerAccount(userId: string, adminId: string): Promise<{ message: string }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Use LearnerService to reset the account with the new distribution logic
    const result = await this.learnerService.resetLearnerAccount(userId);

    this.logger.log(`Admin ${adminId} reset learner account for user ${userId}`);

    return result;
  }

  // ============================================
  // DELETE USER
  // ============================================

  /**
   * Delete user and all related data
   */
  async deleteUser(userId: string, adminId: string): Promise<{ message: string }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Prevent deleting admin users (safety)
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot delete admin users');
    }

    // Delete user (cascades to related records due to onDelete: Cascade in schema)
    await this.prisma.client.user.delete({
      where: { id: userId },
    });

    this.logger.log(`Admin ${adminId} deleted user ${userId} (${user.email})`);

    return { message: `User ${user.email} has been deleted` };
  }

  // ============================================
  // PLATFORM-WIDE TRANSACTIONS
  // ============================================

  /**
   * Get all platform transactions (trades + fiat) with filters and pagination
   */
  async getAllTransactions(options?: {
    page?: number;
    limit?: number;
    type?: 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL';
    status?: string;
    asset?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<{
    transactions: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const isTrade = !options?.type || options.type === 'BUY' || options.type === 'SELL';
    const isFiat = !options?.type || options.type === 'DEPOSIT' || options.type === 'WITHDRAWAL';

    let trades: any[] = [];
    let tradeTotal = 0;
    let fiatTxns: any[] = [];
    let fiatTotal = 0;

    // Build date filters
    const dateFilter: any = {};
    if (options?.dateFrom) dateFilter.gte = new Date(options.dateFrom);
    if (options?.dateTo) {
      const endDate = new Date(options.dateTo);
      endDate.setHours(23, 59, 59, 999);
      dateFilter.lte = endDate;
    }

    // Search by user email or transactionId
    let searchUserIds: string[] | undefined;
    if (options?.search) {
      const users = await this.prisma.client.user.findMany({
        where: {
          OR: [
            { email: { contains: options.search, mode: 'insensitive' } },
            { phone: { contains: options.search } },
          ],
        },
        select: { id: true },
        take: 100,
      });
      searchUserIds = users.map(u => u.id);
    }

    // Fetch trades (BUY/SELL)
    if (isTrade) {
      const tradeWhere: any = {};
      if (options?.type === 'BUY' || options?.type === 'SELL') {
        tradeWhere.side = options.type;
      }
      if (options?.status) tradeWhere.status = options.status;
      if (options?.asset) {
        tradeWhere.OR = [
          { asset: options.asset.toUpperCase() },
          { quote: options.asset.toUpperCase() },
        ];
      }
      if (options?.userId) tradeWhere.userId = options.userId;
      if (Object.keys(dateFilter).length > 0) tradeWhere.createdAt = dateFilter;
      if (options?.search) {
        const txnSearch = { transactionId: { contains: options.search, mode: 'insensitive' } };
        if (searchUserIds && searchUserIds.length > 0) {
          tradeWhere.OR = [
            ...(tradeWhere.OR || []),
            txnSearch,
            { userId: { in: searchUserIds } },
          ];
        } else {
          tradeWhere.OR = [...(tradeWhere.OR || []), txnSearch];
        }
      }

      const [tradeResults, tradeCount] = await Promise.all([
        this.prisma.client.trade.findMany({
          where: tradeWhere,
          include: { user: { select: { email: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
          take: !options?.type ? 1000 : limit,
          skip: !options?.type ? 0 : skip,
        }),
        this.prisma.client.trade.count({ where: tradeWhere }),
      ]);

      trades = tradeResults.map(t => ({
        id: t.id,
        transactionId: t.transactionId,
        txnType: t.side as string, // BUY or SELL
        category: 'trade',
        asset: t.asset,
        quote: t.quote,
        productId: t.productId,
        amount: parseFloat(t.requestedAmount.toString()),
        filledAmount: parseFloat(t.filledAmount.toString()),
        price: parseFloat(t.price.toString()),
        totalValue: parseFloat(t.totalValue.toString()),
        platformFee: parseFloat(t.platformFee.toString()),
        exchangeFee: parseFloat(t.exchangeFee.toString()),
        status: t.status,
        userId: t.userId,
        userEmail: (t as any).user?.email || '',
        userPhone: (t as any).user?.phone || '',
        coinbaseOrderId: t.coinbaseOrderId,
        method: null,
        reference: null,
        metadata: null,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      }));
      tradeTotal = tradeCount;
    }

    // Fetch fiat transactions (DEPOSIT/WITHDRAWAL)
    if (isFiat) {
      const fiatWhere: any = {};
      if (options?.type === 'DEPOSIT' || options?.type === 'WITHDRAWAL') {
        fiatWhere.type = options.type;
      }
      if (options?.status) fiatWhere.status = options.status;
      if (options?.asset && options.asset.toUpperCase() === 'UGX') {
        // UGX is the only fiat asset
      } else if (options?.asset) {
        // Non-UGX asset filter — no fiat transactions to show
        fiatTxns = [];
        fiatTotal = 0;
      }
      if (options?.userId) fiatWhere.userId = options.userId;
      if (Object.keys(dateFilter).length > 0) fiatWhere.createdAt = dateFilter;
      if (options?.search) {
        const txnSearch = { transactionId: { contains: options.search, mode: 'insensitive' } };
        if (searchUserIds && searchUserIds.length > 0) {
          fiatWhere.OR = [
            txnSearch,
            { userId: { in: searchUserIds } },
          ];
        } else {
          fiatWhere.OR = [txnSearch];
        }
      }

      // Only fetch if we haven't excluded by non-UGX asset filter
      if (!(options?.asset && options.asset.toUpperCase() !== 'UGX')) {
        const [fiatResults, fiatCount] = await Promise.all([
          this.prisma.client.fiatTransaction.findMany({
            where: fiatWhere,
            include: { user: { select: { email: true, phone: true } } },
            orderBy: { createdAt: 'desc' },
            take: !options?.type ? 1000 : limit,
            skip: !options?.type ? 0 : skip,
          }),
          this.prisma.client.fiatTransaction.count({ where: fiatWhere }),
        ]);

        fiatTxns = fiatResults.map(t => ({
          id: t.id,
          transactionId: t.transactionId,
          txnType: t.type as string, // DEPOSIT or WITHDRAWAL
          category: 'fiat',
          asset: 'UGX',
          quote: null,
          productId: null,
          amount: parseFloat(t.amount.toString()),
          filledAmount: null,
          price: null,
          totalValue: parseFloat(t.amount.toString()),
          platformFee: 0,
          exchangeFee: 0,
          status: t.status,
          userId: t.userId,
          userEmail: (t as any).user?.email || '',
          userPhone: (t as any).user?.phone || '',
          coinbaseOrderId: null,
          method: t.method,
          reference: t.reference,
          metadata: t.metadata,
          createdAt: t.createdAt,
          completedAt: null,
        }));
        fiatTotal = fiatCount;
      }
    }

    // Combine and sort
    let combined = [...trades, ...fiatTxns];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = tradeTotal + fiatTotal;

    // Apply pagination to combined result when fetching all types
    if (!options?.type) {
      combined = combined.slice(skip, skip + limit);
    }

    return { transactions: combined, total, page, limit };
  }

  /**
   * Get full detail for a single transaction
   */
  async getTransactionDetail(
    id: string,
    type: 'trade' | 'fiat',
  ): Promise<any> {
    if (type === 'trade') {
      const trade = await this.prisma.client.trade.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, phone: true, phoneCountry: true } } },
      });

      if (!trade) throw new NotFoundException(`Trade ${id} not found`);

      return {
        id: trade.id,
        transactionId: trade.transactionId,
        txnType: trade.side,
        category: 'trade',
        asset: trade.asset,
        quote: trade.quote,
        productId: trade.productId,
        requestedAmount: parseFloat(trade.requestedAmount.toString()),
        filledAmount: parseFloat(trade.filledAmount.toString()),
        price: parseFloat(trade.price.toString()),
        totalValue: parseFloat(trade.totalValue.toString()),
        platformFee: parseFloat(trade.platformFee.toString()),
        exchangeFee: parseFloat(trade.exchangeFee.toString()),
        feePercent: parseFloat(trade.totalValue.toString()) > 0
          ? (parseFloat(trade.platformFee.toString()) / parseFloat(trade.totalValue.toString()) * 100)
          : 0,
        status: trade.status,
        coinbaseOrderId: trade.coinbaseOrderId,
        user: trade.user,
        createdAt: trade.createdAt,
        updatedAt: trade.updatedAt,
        completedAt: trade.completedAt,
      };
    } else {
      const txn = await this.prisma.client.fiatTransaction.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, phone: true, phoneCountry: true } } },
      });

      if (!txn) throw new NotFoundException(`Transaction ${id} not found`);

      return {
        id: txn.id,
        transactionId: txn.transactionId,
        txnType: txn.type,
        category: 'fiat',
        asset: 'UGX',
        amount: parseFloat(txn.amount.toString()),
        method: txn.method,
        reference: txn.reference,
        metadata: txn.metadata,
        status: txn.status,
        user: txn.user,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
      };
    }
  }

  // ============================================
  // PLATFORM HOLDINGS
  // ============================================

  /**
   * Get platform-wide holdings: aggregated user balances + revenue
   */
  async getPlatformHoldings(): Promise<{
    fiat: { asset: string; totalBalance: number; userCount: number };
    crypto: Array<{ asset: string; totalBalance: number; userCount: number }>;
    learnerFiat: { asset: string; totalBalance: number; userCount: number };
    learnerCrypto: Array<{ asset: string; totalBalance: number; userCount: number }>;
    revenue: Array<{ currency: string; amount: number }>;
    totalUsers: number;
  }> {
    // Aggregate fiat balances (Live)
    const fiatAgg = await this.prisma.client.fiatBalance.aggregate({
      _sum: { balance: true },
      _count: true,
    });

    // Aggregate crypto balances per asset (Live)
    const cryptoGroups = await this.prisma.client.cryptoBalance.groupBy({
      by: ['asset'],
      _sum: { balance: true },
      _count: true,
      where: {
        NOT: { asset: { startsWith: 'REVENUE_' } },
      },
    });

    const crypto = cryptoGroups
      .filter(g => parseFloat(g._sum.balance?.toString() || '0') > 0)
      .map(g => ({
        asset: g.asset,
        totalBalance: parseFloat(g._sum.balance?.toString() || '0'),
        userCount: g._count,
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    // Aggregate learner fiat balances (Demo)
    const learnerFiatAgg = await this.prisma.client.learnerFiatBalance.aggregate({
      _sum: { balance: true },
      _count: true,
    });

    // Aggregate learner crypto balances (Demo)
    const learnerCryptoGroups = await this.prisma.client.learnerCryptoBalance.groupBy({
      by: ['asset'],
      _sum: { balance: true },
      _count: true,
    });

    const learnerCrypto = learnerCryptoGroups
      .filter(g => parseFloat(g._sum.balance?.toString() || '0') > 0)
      .map(g => ({
        asset: g.asset,
        totalBalance: parseFloat(g._sum.balance?.toString() || '0'),
        userCount: g._count,
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    // Get revenue from SYSTEM user
    const SYSTEM_EMAIL = 'system@intuitionexchange.internal';
    let revenue: Array<{ currency: string; amount: number }> = [];
    const systemUser = await this.prisma.client.user.findUnique({
      where: { email: SYSTEM_EMAIL },
      select: { id: true },
    });

    if (systemUser) {
      const revenueBalances = await this.prisma.client.cryptoBalance.findMany({
        where: {
          userId: systemUser.id,
          asset: { startsWith: 'REVENUE_' },
        },
      });

      revenue = revenueBalances
        .map(b => ({
          currency: b.asset.replace('REVENUE_', ''),
          amount: parseFloat(b.balance.toString()),
        }))
        .filter(r => r.amount > 0);
    }

    // Total unique users with any balance
    const totalUsers = await this.prisma.client.user.count({
      where: {
        email: { not: SYSTEM_EMAIL },
      },
    });

    return {
      fiat: {
        asset: 'UGX',
        totalBalance: parseFloat(fiatAgg._sum.balance?.toString() || '0'),
        userCount: fiatAgg._count || 0,
      },
      crypto,
      learnerFiat: {
        asset: 'UGX (Demo)',
        totalBalance: parseFloat(learnerFiatAgg._sum.balance?.toString() || '0'),
        userCount: learnerFiatAgg._count || 0,
      },
      learnerCrypto,
      revenue,
      totalUsers,
    };
  }

  // ============================================
  // FEE REPORTS
  // ============================================

  /**
   * Get fee report for a given period
   */
  async getFeeReport(options?: {
    period?: 'today' | 'thisMonth' | 'thisYear' | 'custom';
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    summary: {
      totalFees: number;
      totalTransactions: number;
      avgFeePerTxn: number;
      totalVolume: number;
      feePercentOfVolume: number;
    };
    byCurrency: Array<{
      currency: string;
      totalFees: number;
      transactionCount: number;
      avgFee: number;
    }>;
    transactions: any[];
    period: { from: string; to: string };
  }> {
    const now = new Date();
    let dateFrom: Date;
    let dateTo = new Date(now);
    dateTo.setHours(23, 59, 59, 999);

    switch (options?.period) {
      case 'today':
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        break;
      case 'thisMonth':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'thisYear':
        dateFrom = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        dateFrom = options?.dateFrom ? new Date(options.dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
        if (options?.dateTo) {
          dateTo = new Date(options.dateTo);
          dateTo.setHours(23, 59, 59, 999);
        }
        break;
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const tradeWhere = {
      status: 'COMPLETED' as TradeStatus,
      platformFee: { gt: 0 },
      createdAt: { gte: dateFrom, lte: dateTo },
    };

    // Get all completed trades with fees in the period
    const trades = await this.prisma.client.trade.findMany({
      where: tradeWhere,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by quote currency
    const currencyMap = new Map<string, { totalFees: number; count: number }>();
    let totalFees = 0;
    let totalVolume = 0;

    trades.forEach(t => {
      const fee = parseFloat(t.platformFee.toString());
      const vol = parseFloat(t.totalValue.toString());
      totalFees += fee;
      totalVolume += vol;

      const currency = t.quote;
      if (!currencyMap.has(currency)) {
        currencyMap.set(currency, { totalFees: 0, count: 0 });
      }
      const entry = currencyMap.get(currency)!;
      entry.totalFees += fee;
      entry.count += 1;
    });

    const byCurrency = Array.from(currencyMap.entries()).map(([currency, data]) => ({
      currency,
      totalFees: data.totalFees,
      transactionCount: data.count,
      avgFee: data.count > 0 ? data.totalFees / data.count : 0,
    }));

    const totalTransactions = trades.length;
    const avgFeePerTxn = totalTransactions > 0 ? totalFees / totalTransactions : 0;
    const feePercentOfVolume = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;

    // Map trades for response
    const transactionList = trades.map(t => ({
      id: t.id,
      transactionId: t.transactionId,
      txnType: t.side,
      asset: t.asset,
      quote: t.quote,
      productId: t.productId,
      totalValue: parseFloat(t.totalValue.toString()),
      platformFee: parseFloat(t.platformFee.toString()),
      feePercent: parseFloat(t.totalValue.toString()) > 0
        ? (parseFloat(t.platformFee.toString()) / parseFloat(t.totalValue.toString()) * 100)
        : 0,
      status: t.status,
      userEmail: (t as any).user?.email || '',
      createdAt: t.createdAt,
    }));

    return {
      summary: {
        totalFees,
        totalTransactions,
        avgFeePerTxn,
        totalVolume,
        feePercentOfVolume,
      },
      byCurrency,
      transactions: transactionList,
      period: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
      },
    };
  }

  // ============================================
  // ASSET-SPECIFIC TRANSACTIONS
  // ============================================

  /**
   * Get transactions for a specific asset
   */
  async getAssetTransactions(
    asset: string,
    options?: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ transactions: any[]; total: number; page: number; limit: number }> {
    // Delegate to getAllTransactions with asset filter
    return this.getAllTransactions({
      ...options,
      asset,
      type: options?.type as any,
      page: options?.page,
      limit: options?.limit,
    });
  }
}
