import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';

const PLATFORM_CURRENCY = 'UGX';
const MIN_DEPOSIT_UGX = 500;
const MAX_DEPOSIT_UGX = 5_000_000;

// Pesapal token cache (5-minute TTL, we refresh at 4.5 minutes)
interface PesapalToken {
  token: string;
  expiresAt: number; // epoch ms
}

function generateTransactionId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${datePart}-${randomPart}`;
}

@Injectable()
export class FiatService {
  private readonly logger = new Logger(FiatService.name);
  private readonly consumerKey: string;
  private readonly consumerSecret: string;
  private readonly ipnId: string;
  private readonly pesapalBaseUrl: string;
  private readonly frontendUrl: string;

  // In-memory token cache
  private cachedToken: PesapalToken | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.consumerKey = this.config.get<string>('PESAPAL_CONSUMER_KEY') || '';
    this.consumerSecret = this.config.get<string>('PESAPAL_CONSUMER_SECRET') || '';
    this.ipnId = this.config.get<string>('PESAPAL_IPN_ID') || '';
    this.pesapalBaseUrl = this.config.get<string>('PESAPAL_BASE_URL') || 'https://pay.pesapal.com/v3';
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || 'https://ugcoin.com';

    if (this.consumerKey && this.consumerSecret) {
      this.logger.log('Pesapal payment gateway configured');
    } else {
      this.logger.warn('Pesapal credentials not configured — deposits disabled');
    }
  }

  // ============================================
  // PESAPAL AUTHENTICATION
  // ============================================

  /**
   * Get a valid Pesapal bearer token.
   * Caches the token and refreshes 30 seconds before expiry.
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    // Use cached token if still valid (with 30-second buffer)
    if (this.cachedToken && this.cachedToken.expiresAt > now + 30_000) {
      return this.cachedToken.token;
    }

    if (!this.consumerKey || !this.consumerSecret) {
      throw new InternalServerErrorException('Pesapal credentials not configured');
    }

    const url = `${this.pesapalBaseUrl}/api/Auth/RequestToken`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Pesapal auth failed: ${res.status} ${text}`);
      throw new InternalServerErrorException('Failed to authenticate with payment gateway');
    }

    const data = await res.json();
    if (!data.token) {
      this.logger.error(`Pesapal auth missing token. Payload: ${JSON.stringify(data)}`);
      throw new InternalServerErrorException('Invalid response from payment gateway auth');
    }

    // Token expires in ~5 minutes. Cache it with TTL.
    this.cachedToken = {
      token: data.token,
      expiresAt: now + 4.5 * 60 * 1000, // 4.5 minutes
    };

    this.logger.log('Pesapal token refreshed');
    return data.token;
  }

  // ============================================
  // DEPOSIT FLOW
  // ============================================

  /**
   * Create a Pesapal payment order for a UGX deposit.
   * Returns the Pesapal redirect URL for the user.
   */
  async createDepositOrder(
    userId: string,
    amountUgx: number,
    userEmail?: string,
    userPhone?: string,
  ): Promise<{
    orderId: string;
    redirectUrl: string;
    amount: number;
    currency: string;
  }> {
    if (!this.consumerKey || !this.consumerSecret) {
      throw new InternalServerErrorException('Deposits are not configured on this server');
    }

    if (!Number.isFinite(amountUgx) || amountUgx < MIN_DEPOSIT_UGX) {
      throw new BadRequestException(`Minimum deposit amount is UGX ${MIN_DEPOSIT_UGX.toLocaleString()}`);
    }
    if (amountUgx > MAX_DEPOSIT_UGX) {
      throw new BadRequestException(`Maximum deposit amount is UGX ${MAX_DEPOSIT_UGX.toLocaleString()}`);
    }

    // Create local transaction record first
    const transaction = await this.prisma.client.fiatTransaction.create({
      data: {
        transactionId: generateTransactionId(),
        userId,
        type: 'DEPOSIT',
        method: 'pesapal',
        amount: amountUgx,
        status: 'PENDING',
      },
    });

    try {
      const token = await this.getToken();
      const callbackUrl = `${this.frontendUrl}/deposit/callback`;

      const orderPayload: any = {
        id: transaction.transactionId || transaction.id,
        currency: PLATFORM_CURRENCY,
        amount: amountUgx,
        description: `Deposit UGX ${amountUgx.toLocaleString()} - UG Coin`,
        callback_url: callbackUrl,
        redirect_mode: '',
        notification_id: this.ipnId,
        branch: 'UG Coin',
        billing_address: {
          email_address: userEmail || '',
          phone_number: userPhone || '',
          country_code: 'UG',
          first_name: '',
          middle_name: '',
          last_name: '',
          line_1: '',
          line_2: '',
          city: '',
          state: '',
          postal_code: '',
          zip_code: '',
        },
      };

      const submitUrl = `${this.pesapalBaseUrl}/api/Transactions/SubmitOrderRequest`;
      const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!submitRes.ok) {
        const text = await submitRes.text();
        this.logger.error(`Pesapal SubmitOrderRequest failed: ${submitRes.status} ${text}`);
        throw new Error('Pesapal order submission failed');
      }

      const submitData = await submitRes.json();

      if (!submitData.redirect_url || submitData.status !== '200') {
        this.logger.error(`Pesapal unexpected response: ${JSON.stringify(submitData)}`);
        throw new Error('Invalid response from Pesapal');
      }

      // Store Pesapal order tracking ID in transaction metadata
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          metadata: {
            pesapalOrderTrackingId: submitData.order_tracking_id,
            merchantReference: submitData.merchant_reference,
          } as any,
        },
      });

      this.logger.log(
        `Pesapal deposit created for user ${userId}: txn=${transaction.id}, tracking=${submitData.order_tracking_id}`,
      );

      return {
        orderId: transaction.id,
        redirectUrl: submitData.redirect_url,
        amount: amountUgx,
        currency: PLATFORM_CURRENCY,
      };
    } catch (e: any) {
      this.logger.error(`Deposit creation failed for user ${userId}: ${e?.message || e}`);
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      throw new InternalServerErrorException('Failed to initialise payment. Please try again.');
    }
  }

  // ============================================
  // TRANSACTION STATUS CHECK
  // ============================================

  /**
   * Query Pesapal for the current status of a transaction and sync our DB.
   */
  async getDepositStatus(
    userId: string,
    orderId: string,
  ): Promise<{ status: string; amount: number; balance: number }> {
    const transaction = await this.prisma.client.fiatTransaction.findFirst({
      where: { 
        userId, 
        type: 'DEPOSIT',
        OR: [
          { id: orderId },
          { transactionId: orderId }
        ]
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // If already completed or failed, return DB state
    if (transaction.status === 'COMPLETED' || transaction.status === 'FAILED') {
      const balance = await this.prisma.client.fiatBalance.findUnique({ where: { userId } });
      return {
        status: transaction.status,
        amount: Number(transaction.amount),
        balance: Number(balance?.balance || 0),
      };
    }

    // Query Pesapal for live status
    const meta = transaction.metadata as any;
    const trackingId = meta?.pesapalOrderTrackingId;
    if (trackingId) {
      try {
        const statusResult = await this.queryPesapalTransactionStatus(trackingId);
        if (statusResult.payment_status_description === 'Completed') {
          await this.creditBalance(userId, transaction.id, Number(transaction.amount), trackingId);
          const balance = await this.prisma.client.fiatBalance.findUnique({ where: { userId } });
          return {
            status: 'COMPLETED',
            amount: Number(transaction.amount),
            balance: Number(balance?.balance || 0),
          };
        } else if (statusResult.payment_status_description === 'Failed') {
          await this.prisma.client.fiatTransaction.update({
            where: { id: transaction.id },
            data: { status: 'FAILED' },
          });
          return { status: 'FAILED', amount: Number(transaction.amount), balance: 0 };
        }
      } catch (e) {
        this.logger.warn(`Pesapal status query failed for ${trackingId}: ${e}`);
      }
    }

    const balance = await this.prisma.client.fiatBalance.findUnique({ where: { userId } });
    return {
      status: transaction.status,
      amount: Number(transaction.amount),
      balance: Number(balance?.balance || 0),
    };
  }

  // ============================================
  // IPN HANDLER
  // ============================================

  /**
   * Handle Pesapal IPN notification.
   * Pesapal calls this endpoint when payment status changes.
   * This is a PUBLIC endpoint — no auth guard.
   */
  async handleIpn(body: {
    OrderNotificationType?: string;
    OrderTrackingId?: string;
    OrderMerchantReference?: string;
  }): Promise<{ orderNotificationType: string; orderTrackingId: string; orderMerchantReference: string; status: '200' }> {
    const trackingId = body.OrderTrackingId;
    const merchantRef = body.OrderMerchantReference;

    this.logger.log(`Pesapal IPN received: tracking=${trackingId}, ref=${merchantRef}`);

    if (trackingId && merchantRef) {
      try {
        // Find the transaction by merchant reference (our transactionId)
        const transaction = await this.prisma.client.fiatTransaction.findFirst({
          where: {
            OR: [
              { transactionId: merchantRef },
              { id: merchantRef },
            ],
            type: 'DEPOSIT',
            status: 'PENDING',
          },
        });

        if (transaction) {
          const statusResult = await this.queryPesapalTransactionStatus(trackingId);
          if (statusResult.payment_status_description === 'Completed') {
            await this.creditBalance(transaction.userId, transaction.id, Number(transaction.amount), trackingId);
            this.logger.log(`IPN: Credited ${transaction.amount} UGX to user ${transaction.userId}`);
          } else if (statusResult.payment_status_description === 'Failed') {
            await this.prisma.client.fiatTransaction.update({
              where: { id: transaction.id },
              data: { status: 'FAILED', reference: trackingId },
            });
          }
        }
      } catch (e: any) {
        this.logger.error(`IPN processing error: ${e?.message || e}`);
      }
    }

    // Pesapal requires this exact response format
    return {
      orderNotificationType: body.OrderNotificationType || 'IPNCHANGE',
      orderTrackingId: trackingId || '',
      orderMerchantReference: merchantRef || '',
      status: '200',
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private async queryPesapalTransactionStatus(orderTrackingId: string): Promise<any> {
    const token = await this.getToken();
    const url = `${this.pesapalBaseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Pesapal status query returned ${res.status}`);
    }
    return res.json();
  }

  /**
   * Atomically credit UGX balance + mark transaction COMPLETED.
   * Idempotent — safe to call multiple times.
   */
  private async creditBalance(
    userId: string,
    transactionId: string,
    amount: number,
    reference: string,
  ): Promise<void> {
    // Re-check status to prevent double-credit
    const tx = await this.prisma.client.fiatTransaction.findUnique({
      where: { id: transactionId },
      select: { status: true },
    });
    if (!tx || tx.status === 'COMPLETED') return;

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
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          reference,
        },
      }),
    ]);
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

  // ============================================
  // DUMMY DEPOSIT FLOW
  // ============================================

  async dummyDeposit(userId: string, amountUgx: number, method: string = 'dummy') {
    if (!Number.isFinite(amountUgx) || amountUgx <= 0) {
      throw new BadRequestException('Invalid deposit amount');
    }

    const CUMULATIVE_LIMIT = 40_000_000;

    // Check cumulative max limit of 40M UGX
    const depositHistory = await this.prisma.client.fiatTransaction.findMany({
      where: { userId, type: 'DEPOSIT', status: 'COMPLETED' },
    });
    const totalDeposits = depositHistory.reduce((sum, tx) => sum + Number(tx.amount), 0);
    
    if (totalDeposits + amountUgx > CUMULATIVE_LIMIT) {
      throw new BadRequestException(`Maximum cumulative deposit limit is UGX ${CUMULATIVE_LIMIT.toLocaleString()}. You can deposit up to UGX ${(CUMULATIVE_LIMIT - totalDeposits).toLocaleString()} more.`);
    }

    const transactionId = generateTransactionId();

    const transaction = await this.prisma.client.fiatTransaction.create({
      data: {
        transactionId,
        userId,
        type: 'DEPOSIT',
        method,
        amount: amountUgx,
        status: 'PENDING',
      },
    });

    await this.creditBalance(userId, transaction.id, amountUgx, `DUMMY-${transactionId}`);

    return {
      success: true,
      amount: amountUgx,
      message: 'Deposit successful',
    };
  }
}
