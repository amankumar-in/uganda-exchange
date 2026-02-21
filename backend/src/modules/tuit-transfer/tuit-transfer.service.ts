import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TuitContractService, VestingData } from './tuit-contract.service';
import { OtpService } from '../auth/otp.service';
import { AssetsService } from '../assets/assets.service';
import { Prisma } from '@prisma/client';
import * as csv from 'csv-parse/sync';

interface CsvRecord {
  name?: string;
  email?: string;
  wallet?: string;
}

const TUIT_ASSET = 'TUIT';

export interface AuthorizedWalletWithVesting {
  id: string;
  name: string;
  email: string | null;
  walletAddress: string;
  isActive: boolean;
  isTestPair: boolean;
  testTotalAllocated: string | null;
  testUnlocked: string | null;
  testWithdrawn: string | null;
  vestingData?: VestingData;
  hasTransferred: boolean;
  transfer?: {
    id: string;
    userId: string;
    amountCredited: string;
    createdAt: Date;
  };
}

@Injectable()
export class TuitTransferService {
  private readonly logger = new Logger(TuitTransferService.name);

  constructor(
    private prisma: PrismaService,
    private contractService: TuitContractService,
    private otpService: OtpService,
    private assetsService: AssetsService,
  ) {}

  /**
   * Build dummy VestingData from stored test pair fields
   */
  private buildTestPairVestingData(wallet: {
    walletAddress: string;
    testTotalAllocated: Prisma.Decimal | null;
    testUnlocked: Prisma.Decimal | null;
    testWithdrawn: Prisma.Decimal | null;
  }): VestingData {
    const totalAllocated = wallet.testTotalAllocated?.toString() || '0';
    const unlocked = wallet.testUnlocked?.toString() || '0';
    const withdrawn = wallet.testWithdrawn?.toString() || '0';
    const available = (parseFloat(unlocked) - parseFloat(withdrawn)).toString();

    return {
      walletAddress: wallet.walletAddress,
      totalAllocated,
      unlocked,
      withdrawn,
      availableToWithdraw: available,
    };
  }

  // ============================================
  // FLOW 1: Transfer from Vesting Allocation
  // ============================================

  /**
   * Step 1: Validate email-wallet pair and send verification code
   */
  async initiateTransfer(email: string, walletAddress: string): Promise<{ success: boolean; name: string }> {
    // Normalize inputs
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedWallet = walletAddress.toLowerCase().trim();

    // Find authorized wallet
    const authorizedWallet = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { walletAddress: normalizedWallet },
      include: { transfers: true },
    });

    if (!authorizedWallet) {
      throw new NotFoundException(
        'This wallet address is not found in our authorized list. Please contact help@intuitionexchange.com if you believe this is an error.',
      );
    }

    if (!authorizedWallet.isActive) {
      throw new BadRequestException(
        'This wallet has been deactivated. Please contact help@intuitionexchange.com.',
      );
    }

    // Check if email matches (case-insensitive)
    if (!authorizedWallet.email) {
      throw new BadRequestException(
        'No email is associated with this wallet. Please contact help@intuitionexchange.com with your Name, Email, and Wallet Address.',
      );
    }

    if (authorizedWallet.email.toLowerCase() !== normalizedEmail) {
      throw new BadRequestException(
        'The email address does not match our records for this wallet. Please use the email address you provided for TUIT allocation.',
      );
    }

    // Check if already transferred (skip for test pairs - unlimited use)
    if (authorizedWallet.transfers.length > 0 && !authorizedWallet.isTestPair) {
      throw new ConflictException(
        'This wallet has already been used to transfer TUIT balance. Each wallet can only transfer once.',
      );
    }

    // Send verification code (skip for test pairs - any 6-digit code will work)
    if (!authorizedWallet.isTestPair) {
      await this.otpService.sendEmailOtp(normalizedEmail, 'TUIT_TRANSFER');
    }

    return {
      success: true,
      name: authorizedWallet.name,
    };
  }

  /**
   * Step 2: Verify code and get vesting data
   */
  async verifyAndGetVestingData(
    email: string,
    walletAddress: string,
    code: string,
  ): Promise<{ vestingData: VestingData; name: string; authorizedWalletId: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedWallet = walletAddress.toLowerCase().trim();

    // Re-validate the wallet (in case something changed)
    const authorizedWallet = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { walletAddress: normalizedWallet },
      include: { transfers: true },
    });

    if (!authorizedWallet || !authorizedWallet.isActive) {
      throw new BadRequestException('Wallet is no longer valid for transfer');
    }

    // Verify OTP (skip for test pairs - any 6-digit code accepted)
    if (!authorizedWallet.isTestPair) {
      const isValid = await this.otpService.verifyEmailOtp(normalizedEmail, code, 'TUIT_TRANSFER');
      if (!isValid) {
        throw new BadRequestException('Invalid or expired verification code');
      }
    }

    // Check if already transferred (skip for test pairs)
    if (authorizedWallet.transfers.length > 0 && !authorizedWallet.isTestPair) {
      throw new ConflictException('This wallet has already transferred its balance');
    }

    // Get vesting data: dummy for test pairs, real contract for normal wallets
    const vestingData = authorizedWallet.isTestPair
      ? this.buildTestPairVestingData(authorizedWallet)
      : await this.contractService.getVestingData(walletAddress);

    return {
      vestingData,
      name: authorizedWallet.name,
      authorizedWalletId: authorizedWallet.id,
    };
  }

  /**
   * Step 3: Confirm and execute the transfer
   */
  async confirmTransfer(
    userId: string,
    authorizedWalletId: string,
    verificationEmail: string,
  ): Promise<{ success: boolean; amountCredited: string }> {
    // Get authorized wallet and verify it hasn't been transferred
    const authorizedWallet = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { id: authorizedWalletId },
      include: { transfers: true },
    });

    if (!authorizedWallet) {
      throw new NotFoundException('Authorized wallet not found');
    }

    if (!authorizedWallet.isActive) {
      throw new BadRequestException('This wallet has been deactivated');
    }

    // For non-test-pairs: enforce one-time transfer
    if (!authorizedWallet.isTestPair) {
      if (authorizedWallet.transfers.length > 0) {
        throw new ConflictException('This wallet has already transferred its balance');
      }

      const existingUserTransfer = await this.prisma.client.tuitTransfer.findFirst({
        where: {
          userId,
          authorizedWalletId,
        },
      });

      if (existingUserTransfer) {
        throw new ConflictException('You have already transferred from this wallet');
      }
    }

    // Get vesting data: dummy for test pairs, real contract for normal wallets
    const vestingData = authorizedWallet.isTestPair
      ? this.buildTestPairVestingData(authorizedWallet)
      : await this.contractService.getVestingData(authorizedWallet.walletAddress);
    const availableAmount = parseFloat(vestingData.availableToWithdraw);

    if (availableAmount <= 0) {
      throw new BadRequestException(
        'No tokens available to transfer. The balance may have already been withdrawn externally.',
      );
    }

    // Execute transfer in a transaction
    await this.prisma.client.$transaction(async (tx) => {
      // For test pairs: delete existing transfer records to allow re-creation
      if (authorizedWallet.isTestPair) {
        await tx.tuitTransfer.deleteMany({
          where: { authorizedWalletId },
        });
      }

      // Create transfer record
      await tx.tuitTransfer.create({
        data: {
          userId,
          authorizedWalletId,
          verificationEmail: verificationEmail.toLowerCase(),
          totalAllocated: new Prisma.Decimal(vestingData.totalAllocated),
          totalUnlocked: new Prisma.Decimal(vestingData.unlocked),
          totalWithdrawn: new Prisma.Decimal(vestingData.withdrawn),
          amountCredited: new Prisma.Decimal(vestingData.availableToWithdraw),
          status: 'COMPLETED',
        },
      });
    });

    // Credit the user's TUIT balance
    await this.assetsService.updateBalanceAfterTrade(userId, TUIT_ASSET, availableAmount);

    this.logger.log(
      `TUIT Transfer completed${authorizedWallet.isTestPair ? ' (TEST PAIR)' : ''}: User ${userId} credited ${availableAmount} TUIT from wallet ${authorizedWallet.walletAddress}`,
    );

    return {
      success: true,
      amountCredited: vestingData.availableToWithdraw,
    };
  }

  /**
   * Get user's transfer history
   */
  async getUserTransfers(userId: string) {
    const transfers = await this.prisma.client.tuitTransfer.findMany({
      where: { userId },
      include: {
        authorizedWallet: {
          select: {
            name: true,
            walletAddress: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return transfers.map((t) => ({
      id: t.id,
      name: t.authorizedWallet.name,
      walletAddress: t.authorizedWallet.walletAddress,
      verificationEmail: t.verificationEmail,
      totalAllocated: t.totalAllocated.toString(),
      totalUnlocked: t.totalUnlocked.toString(),
      totalWithdrawn: t.totalWithdrawn.toString(),
      amountCredited: t.amountCredited.toString(),
      status: t.status,
      createdAt: t.createdAt,
    }));
  }

  // ============================================
  // FLOW 2: Conversion of Withdrawn Tokens
  // ============================================

  /**
   * Submit a conversion request
   */
  async submitConversionRequest(
    userId: string,
    txHash: string,
  ): Promise<{ success: boolean; requestId: string }> {
    // Normalize tx hash
    const normalizedTxHash = txHash.toLowerCase().trim();
    const isTestHash = normalizedTxHash.startsWith('0xtest');

    // Check if this tx hash was already submitted
    const existingRequest = await this.prisma.client.tuitConversionRequest.findUnique({
      where: { txHash: normalizedTxHash },
    });

    if (existingRequest) {
      throw new ConflictException(
        'This transaction hash has already been submitted for conversion',
      );
    }

    // Check if user already has a completed conversion (skip for test hashes)
    if (!isTestHash) {
      const completedConversion = await this.prisma.client.tuitConversionRequest.findFirst({
        where: {
          userId,
          status: 'APPROVED',
        },
      });

      if (completedConversion) {
        throw new ConflictException(
          'You have already completed a token conversion. Only one conversion is allowed per user.',
        );
      }
    }

    let amount: string;

    if (isTestHash) {
      // Test hash: bypass on-chain verification, use dummy amount
      amount = '100';
      this.logger.log(
        `Test conversion request: User ${userId}, TxHash ${normalizedTxHash}, Amount ${amount} TUIT`,
      );
    } else {
      // Real hash: verify on-chain
      const transferInfo = await this.contractService.verifyTransferTransaction(normalizedTxHash);

      if (!transferInfo) {
        throw new BadRequestException(
          'Could not find a valid TUIT transfer in this transaction. Please ensure you submitted the correct transaction hash.',
        );
      }

      if (!transferInfo.isValidDeposit) {
        const addresses = this.contractService.getContractAddresses();
        throw new BadRequestException(
          `This transaction does not transfer TUIT to our deposit wallet. Please transfer to: ${addresses.depositWallet}`,
        );
      }

      amount = transferInfo.amount;
      this.logger.log(
        `Conversion request submitted: User ${userId}, TxHash ${normalizedTxHash}, Amount ${amount} TUIT`,
      );
    }

    // Create conversion request
    const request = await this.prisma.client.tuitConversionRequest.create({
      data: {
        userId,
        txHash: normalizedTxHash,
        amount: new Prisma.Decimal(amount),
        status: 'PENDING',
      },
    });

    return {
      success: true,
      requestId: request.id,
    };
  }

  /**
   * Get user's conversion requests
   */
  async getUserConversionRequests(userId: string) {
    const requests = await this.prisma.client.tuitConversionRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      txHash: r.txHash,
      amount: r.amount?.toString() || null,
      status: r.status,
      reviewNotes: r.reviewNotes,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    }));
  }

  // ============================================
  // ADMIN FUNCTIONS
  // ============================================

  /**
   * Import authorized wallets from CSV
   */
  async importFromCsv(csvContent: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const record of records as CsvRecord[]) {
      const name = record.name?.trim();
      const email = record.email?.trim().toLowerCase() || null;
      const wallet = record.wallet?.trim().toLowerCase();

      if (!name) {
        errors.push(`Skipped row: missing name`);
        skipped++;
        continue;
      }

      if (!wallet) {
        errors.push(`Skipped ${name}: missing wallet address`);
        skipped++;
        continue;
      }

      // Validate wallet format
      if (!wallet.match(/^0x[a-f0-9]{40}$/i)) {
        errors.push(`Skipped ${name}: invalid wallet address format`);
        skipped++;
        continue;
      }

      try {
        await this.prisma.client.tuitAuthorizedWallet.upsert({
          where: { walletAddress: wallet },
          create: {
            name,
            email,
            walletAddress: wallet,
            isActive: true,
          },
          update: {
            name,
            email,
            // Don't update isActive on reimport
          },
        });
        imported++;
      } catch (error) {
        errors.push(`Failed to import ${name}: ${error.message}`);
        skipped++;
      }
    }

    this.logger.log(`CSV Import: ${imported} imported, ${skipped} skipped`);

    return { imported, skipped, errors };
  }

  /**
   * Get all authorized wallets with their status
   */
  async getAllAuthorizedWallets(
    page: number = 1,
    limit: number = 50,
    search?: string,
  ): Promise<{
    wallets: AuthorizedWalletWithVesting[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { walletAddress: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [wallets, total] = await Promise.all([
      this.prisma.client.tuitAuthorizedWallet.findMany({
        where,
        include: {
          transfers: {
            select: {
              id: true,
              userId: true,
              amountCredited: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.tuitAuthorizedWallet.count({ where }),
    ]);

    return {
      wallets: wallets.map((w) => ({
        id: w.id,
        name: w.name,
        email: w.email,
        walletAddress: w.walletAddress,
        isActive: w.isActive,
        isTestPair: w.isTestPair,
        testTotalAllocated: w.testTotalAllocated?.toString() || null,
        testUnlocked: w.testUnlocked?.toString() || null,
        testWithdrawn: w.testWithdrawn?.toString() || null,
        hasTransferred: w.transfers.length > 0,
        transfer: w.transfers[0]
          ? {
              id: w.transfers[0].id,
              userId: w.transfers[0].userId,
              amountCredited: w.transfers[0].amountCredited.toString(),
              createdAt: w.transfers[0].createdAt,
            }
          : undefined,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get vesting data for an authorized wallet (admin)
   */
  async getWalletVestingData(walletId: string): Promise<VestingData> {
    const wallet = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.isTestPair) {
      return this.buildTestPairVestingData(wallet);
    }

    return this.contractService.getVestingData(wallet.walletAddress);
  }

  /**
   * Add a new authorized wallet
   */
  async addAuthorizedWallet(
    name: string,
    email: string | null,
    walletAddress: string,
    isTestPair: boolean = false,
    testVestingData?: {
      totalAllocated?: string;
      unlocked?: string;
      withdrawn?: string;
    },
  ): Promise<{ id: string }> {
    const normalizedWallet = walletAddress.toLowerCase().trim();

    const existing = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { walletAddress: normalizedWallet },
    });

    if (existing) {
      throw new ConflictException('This wallet address is already registered');
    }

    const wallet = await this.prisma.client.tuitAuthorizedWallet.create({
      data: {
        name: name.trim(),
        email: email?.toLowerCase().trim() || null,
        walletAddress: normalizedWallet,
        isActive: true,
        isTestPair,
        ...(isTestPair && testVestingData && {
          testTotalAllocated: testVestingData.totalAllocated
            ? new Prisma.Decimal(testVestingData.totalAllocated)
            : undefined,
          testUnlocked: testVestingData.unlocked
            ? new Prisma.Decimal(testVestingData.unlocked)
            : undefined,
          testWithdrawn: testVestingData.withdrawn
            ? new Prisma.Decimal(testVestingData.withdrawn)
            : undefined,
        }),
      },
    });

    return { id: wallet.id };
  }

  /**
   * Update an authorized wallet
   */
  async updateAuthorizedWallet(
    id: string,
    data: {
      name?: string;
      email?: string | null;
      isActive?: boolean;
      isTestPair?: boolean;
      testTotalAllocated?: string | null;
      testUnlocked?: string | null;
      testWithdrawn?: string | null;
    },
  ): Promise<void> {
    const wallet = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    await this.prisma.client.tuitAuthorizedWallet.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name.trim() }),
        ...(data.email !== undefined && { email: data.email?.toLowerCase().trim() || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isTestPair !== undefined && { isTestPair: data.isTestPair }),
        ...(data.testTotalAllocated !== undefined && {
          testTotalAllocated: data.testTotalAllocated
            ? new Prisma.Decimal(data.testTotalAllocated)
            : null,
        }),
        ...(data.testUnlocked !== undefined && {
          testUnlocked: data.testUnlocked
            ? new Prisma.Decimal(data.testUnlocked)
            : null,
        }),
        ...(data.testWithdrawn !== undefined && {
          testWithdrawn: data.testWithdrawn
            ? new Prisma.Decimal(data.testWithdrawn)
            : null,
        }),
      },
    });
  }

  /**
   * Delete an authorized wallet (only if no transfer has occurred)
   */
  async deleteAuthorizedWallet(id: string): Promise<void> {
    const wallet = await this.prisma.client.tuitAuthorizedWallet.findUnique({
      where: { id },
      include: { transfers: true },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.transfers.length > 0 && !wallet.isTestPair) {
      throw new BadRequestException(
        'Cannot delete a wallet that has already completed a transfer. Deactivate it instead.',
      );
    }

    // For test pairs, clean up transfer records first
    if (wallet.isTestPair && wallet.transfers.length > 0) {
      await this.prisma.client.tuitTransfer.deleteMany({
        where: { authorizedWalletId: id },
      });
    }

    await this.prisma.client.tuitAuthorizedWallet.delete({
      where: { id },
    });
  }

  /**
   * Get all conversion requests (admin)
   */
  async getAllConversionRequests(
    page: number = 1,
    limit: number = 50,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ) {
    const where = status ? { status } : {};

    const [requests, total] = await Promise.all([
      this.prisma.client.tuitConversionRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.tuitConversionRequest.count({ where }),
    ]);

    return {
      requests: requests.map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user.email,
        txHash: r.txHash,
        amount: r.amount?.toString() || null,
        status: r.status,
        reviewNotes: r.reviewNotes,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Approve a conversion request
   */
  async approveConversionRequest(
    requestId: string,
    adminUserId: string,
    notes?: string,
  ): Promise<void> {
    const request = await this.prisma.client.tuitConversionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Conversion request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve a request that is already ${request.status}`);
    }

    if (!request.amount) {
      throw new BadRequestException('Cannot approve a request without a verified amount');
    }

    const amount = parseFloat(request.amount.toString());

    // Update request status
    await this.prisma.client.tuitConversionRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminUserId,
        reviewNotes: notes,
        reviewedAt: new Date(),
      },
    });

    // Credit user's balance
    await this.assetsService.updateBalanceAfterTrade(request.userId, TUIT_ASSET, amount);

    this.logger.log(
      `Conversion approved: Request ${requestId}, User ${request.userId}, Amount ${amount} TUIT`,
    );
  }

  /**
   * Reject a conversion request
   */
  async rejectConversionRequest(
    requestId: string,
    adminUserId: string,
    notes: string,
  ): Promise<void> {
    const request = await this.prisma.client.tuitConversionRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Conversion request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Cannot reject a request that is already ${request.status}`);
    }

    await this.prisma.client.tuitConversionRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminUserId,
        reviewNotes: notes,
        reviewedAt: new Date(),
      },
    });

    this.logger.log(`Conversion rejected: Request ${requestId}, Reason: ${notes}`);
  }

  /**
   * Get transfer statistics
   */
  async getTransferStats() {
    const [
      totalWallets,
      activeWallets,
      completedTransfers,
      pendingConversions,
      approvedConversions,
    ] = await Promise.all([
      this.prisma.client.tuitAuthorizedWallet.count(),
      this.prisma.client.tuitAuthorizedWallet.count({ where: { isActive: true } }),
      this.prisma.client.tuitTransfer.count({ where: { status: 'COMPLETED' } }),
      this.prisma.client.tuitConversionRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.client.tuitConversionRequest.count({ where: { status: 'APPROVED' } }),
    ]);

    const totalCredited = await this.prisma.client.tuitTransfer.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amountCredited: true },
    });

    const totalConverted = await this.prisma.client.tuitConversionRequest.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    });

    return {
      totalWallets,
      activeWallets,
      completedTransfers,
      pendingConversions,
      approvedConversions,
      totalCredited: totalCredited._sum.amountCredited?.toString() || '0',
      totalConverted: totalConverted._sum.amount?.toString() || '0',
    };
  }
}
