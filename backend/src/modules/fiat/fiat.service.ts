import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../../prisma.service';

const PLATFORM_CURRENCY = 'INR';
const MIN_DEPOSIT_INR = 100;
const MAX_DEPOSIT_INR = 1_000_000;

function generateTransactionId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${datePart}-${randomPart}`;
}

@Injectable()
export class FiatService {
  private readonly logger = new Logger(FiatService.name);
  private readonly razorpay: Razorpay | null;
  private readonly keyId: string | undefined;
  private readonly keySecret: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (this.keyId && this.keySecret) {
      this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
      this.logger.log('Razorpay client initialised');
    } else {
      this.razorpay = null;
      this.logger.warn('Razorpay keys not configured — deposits disabled');
    }
  }

  /**
   * Create a Razorpay order for an INR deposit.
   * Returns the data the frontend needs to open Razorpay Checkout.
   */
  async createDepositOrder(
    userId: string,
    amountInr: number,
  ): Promise<{
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }> {
    if (!this.razorpay || !this.keyId) {
      throw new InternalServerErrorException('Deposits are not configured on this server');
    }

    if (!Number.isFinite(amountInr) || amountInr < MIN_DEPOSIT_INR) {
      throw new BadRequestException(`Minimum deposit amount is ₹${MIN_DEPOSIT_INR}`);
    }
    if (amountInr > MAX_DEPOSIT_INR) {
      throw new BadRequestException(`Maximum deposit amount is ₹${MAX_DEPOSIT_INR.toLocaleString('en-IN')}`);
    }

    const amountPaise = Math.round(amountInr * 100);

    // Create local transaction record first so we can reference its id in Razorpay's receipt.
    const transaction = await this.prisma.client.fiatTransaction.create({
      data: {
        transactionId: generateTransactionId(),
        userId,
        type: 'DEPOSIT',
        method: 'razorpay',
        amount: amountInr,
        status: 'PENDING',
      },
    });

    try {
      const order = await this.razorpay.orders.create({
        amount: amountPaise,
        currency: PLATFORM_CURRENCY,
        receipt: transaction.transactionId ?? transaction.id,
        notes: {
          userId,
          transactionId: transaction.id,
        },
      });

      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: { metadata: { razorpayOrderId: order.id } as any },
      });

      return {
        orderId: transaction.id,
        razorpayOrderId: order.id,
        amount: amountPaise,
        currency: PLATFORM_CURRENCY,
        keyId: this.keyId,
      };
    } catch (e: any) {
      this.logger.error(`Razorpay order creation failed for user ${userId}: ${e?.message || e}`);
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      throw new InternalServerErrorException('Failed to initialise payment. Please try again.');
    }
  }

  /**
   * Verify a Razorpay payment signature and credit the user's INR balance.
   * Must be called from an authenticated endpoint tied to the same userId.
   */
  async verifyDeposit(
    userId: string,
    input: {
      orderId: string; // our internal FiatTransaction id
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ): Promise<{ success: boolean; balance: number }> {
    if (!this.keySecret) {
      throw new InternalServerErrorException('Deposits are not configured on this server');
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new BadRequestException('Missing payment verification fields');
    }

    const transaction = await this.prisma.client.fiatTransaction.findFirst({
      where: { id: orderId, userId, type: 'DEPOSIT' },
    });
    if (!transaction) {
      throw new BadRequestException('Unknown deposit transaction');
    }
    if (transaction.status === 'COMPLETED') {
      const balance = await this.prisma.client.fiatBalance.findUnique({ where: { userId } });
      return { success: true, balance: Number(balance?.balance || 0) };
    }

    const expected = createHmac('sha256', this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expected !== razorpaySignature) {
      this.logger.warn(`Signature mismatch on deposit ${orderId} for user ${userId}`);
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          metadata: {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            reason: 'signature_mismatch',
          } as any,
        },
      });
      throw new BadRequestException('Payment signature verification failed');
    }

    const amount = Number(transaction.amount);

    // Atomically credit balance + mark transaction complete
    await this.prisma.client.$transaction([
      this.prisma.client.fiatBalance.upsert({
        where: { userId },
        create: {
          userId,
          currency: PLATFORM_CURRENCY,
          balance: amount,
          availableBalance: amount,
          lockedBalance: 0,
        },
        update: {
          balance: { increment: amount },
          availableBalance: { increment: amount },
        },
      }),
      this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          reference: razorpayPaymentId,
          metadata: {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
          } as any,
        },
      }),
    ]);

    const updated = await this.prisma.client.fiatBalance.findUnique({ where: { userId } });
    return { success: true, balance: Number(updated?.balance || 0) };
  }

  async getUserDeposits(userId: string, limit = 50) {
    const transactions = await this.prisma.client.fiatTransaction.findMany({
      where: { userId, type: 'DEPOSIT' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return transactions.map(t => ({
      id: t.id,
      transactionId: t.transactionId,
      amount: Number(t.amount),
      status: t.status,
      reference: t.reference,
      createdAt: t.createdAt,
    }));
  }
}
