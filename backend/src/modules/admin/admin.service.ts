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
  kyc: {
    id: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    dateOfBirth: Date | null;
    street1: string | null;
    street2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    currentStep: number;
    status: string;
    veriffSessionId: string | null;
    veriffStatus: string | null;
    veriffReason: string | null;
    reviewNotes: string | null;
    reviewedAt: Date | null;
    reviewedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
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

export interface UpdateKycStatusDto {
  status: KycStatus;
  reviewNotes?: string;
  reviewedBy: string;
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
        { kyc: { firstName: { contains: options.search, mode: 'insensitive' } } },
        { kyc: { lastName: { contains: options.search, mode: 'insensitive' } } },
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
        include: {
          kyc: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
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
        firstName: user.kyc?.firstName || null,
        lastName: user.kyc?.lastName || null,
      })),
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
        kyc: true,
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
      firstName: user.kyc?.firstName || null,
      lastName: user.kyc?.lastName || null,
      kyc: user.kyc
        ? {
            id: user.kyc.id,
            firstName: user.kyc.firstName,
            middleName: user.kyc.middleName,
            lastName: user.kyc.lastName,
            dateOfBirth: user.kyc.dateOfBirth,
            street1: user.kyc.street1,
            street2: user.kyc.street2,
            city: user.kyc.city,
            region: user.kyc.region,
            postalCode: user.kyc.postalCode,
            country: user.kyc.country,
            currentStep: user.kyc.currentStep,
            status: user.kyc.status,
            veriffSessionId: user.kyc.veriffSessionId,
            veriffStatus: user.kyc.veriffStatus,
            veriffReason: user.kyc.veriffReason,
            reviewNotes: user.kyc.reviewNotes,
            reviewedAt: user.kyc.reviewedAt,
            reviewedBy: user.kyc.reviewedBy,
            createdAt: user.kyc.createdAt,
            updatedAt: user.kyc.updatedAt,
          }
        : null,
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
        asset: 'INR',
        balance: parseFloat(liveFiatBalance.balance.toString()),
        availableBalance: parseFloat(liveFiatBalance.availableBalance.toString()),
        lockedBalance: parseFloat(liveFiatBalance.lockedBalance.toString()),
      });
    }

    liveBalances.push(
      ...liveCryptoBalances
        .filter((b) => b.asset !== 'INR')
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
      if (dto.asset === 'INR') {
        const balance = await this.prisma.client.fiatBalance.upsert({
          where: { userId },
          create: {
            userId,
            currency: 'INR',
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
            asset: 'INR',
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
      if (dto.asset === 'INR') {
        const balance = await this.prisma.client.learnerFiatBalance.upsert({
          where: { userId },
          create: {
            userId,
            currency: 'INR',
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
      include: {
        kyc: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Admin ${adminId} updated user ${id}: ${JSON.stringify(dto)}`);

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
      firstName: updatedUser.kyc?.firstName || null,
      lastName: updatedUser.kyc?.lastName || null,
    };
  }

  /**
   * Update user role (legacy - for backwards compatibility)
   */
  async updateUserRole(id: string, role: UserRole): Promise<UserListItem> {
    return this.updateUser(id, { role }, 'system');
  }

  // ============================================
  // KYC MANAGEMENT
  // ============================================

  /**
   * Update KYC status (approve/reject)
   */
  async updateKycStatus(
    userId: string,
    dto: UpdateKycStatusDto,
  ): Promise<{ success: boolean; kyc: any }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { kyc: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (!user.kyc) {
      throw new BadRequestException(`User ${userId} has no KYC record`);
    }

    // Validate status
    if (!['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(dto.status)) {
      throw new BadRequestException('Invalid KYC status');
    }

    // Update KYC
    const updatedKyc = await this.prisma.client.kyc.update({
      where: { id: user.kyc.id },
      data: {
        status: dto.status,
        reviewNotes: dto.reviewNotes || null,
        reviewedAt: new Date(),
        reviewedBy: dto.reviewedBy,
        currentStep: dto.status === 'APPROVED' ? 4 : user.kyc.currentStep,
      },
    });

    // Update user KYC status
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { kycStatus: dto.status },
    });

    this.logger.log(
      `Admin ${dto.reviewedBy} updated KYC status for user ${userId} to ${dto.status}`,
    );

    return {
      success: true,
      kyc: {
        id: updatedKyc.id,
        status: updatedKyc.status,
        reviewNotes: updatedKyc.reviewNotes,
        reviewedAt: updatedKyc.reviewedAt,
        reviewedBy: updatedKyc.reviewedBy,
      },
    };
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
}
