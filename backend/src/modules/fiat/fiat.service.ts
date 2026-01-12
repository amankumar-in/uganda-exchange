import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import Stripe from 'stripe';

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
export class FiatService {
  private readonly logger = new Logger(FiatService.name);
  public stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not found in environment variables');
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2025-11-17.clover',
      });
    }
  }

  /**
   * Create a deposit payment intent
   */
  async createDepositIntent(
    userId: string,
    amount: number,
  ): Promise<{ clientSecret: string; transactionId: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Validate amount (minimum $10, maximum $10,000)
    if (amount < 10) {
      throw new BadRequestException('Minimum deposit amount is $10');
    }
    if (amount > 10000) {
      throw new BadRequestException('Maximum deposit amount is $10,000');
    }

    // Create transaction record
    const transaction = await this.prisma.client.fiatTransaction.create({
      data: {
        transactionId: generateTransactionId(),
        userId,
        type: 'DEPOSIT',
        method: 'card',
        amount: amount,
        status: 'PENDING',
      },
    });

    try {
      // Create Stripe Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          userId,
          transactionId: transaction.id,
          type: 'deposit',
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Update transaction with Stripe reference
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          reference: paymentIntent.id,
          metadata: {
            stripePaymentIntentId: paymentIntent.id,
            stripeClientSecret: paymentIntent.client_secret,
          },
        },
      });

      return {
        clientSecret: paymentIntent.client_secret!,
        transactionId: transaction.id,
      };
    } catch (error) {
      this.logger.error('Failed to create Stripe payment intent', error);
      // Update transaction as failed
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type} (id: ${event.id})`);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        this.logger.log(`Handling payment_intent.succeeded for event ${event.id}`);
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        this.logger.log(`Handling payment_intent.payment_failed for event ${event.id}`);
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payout.paid':
        this.logger.log(`Handling payout.paid for event ${event.id}`);
        await this.handlePayoutPaid(event.data.object as Stripe.Payout);
        break;
      case 'payout.failed':
        this.logger.log(`Handling payout.failed for event ${event.id}`);
        await this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;
      case 'payout.canceled':
        this.logger.log(`Handling payout.canceled for event ${event.id}`);
        await this.handlePayoutFailed(event.data.object as Stripe.Payout);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log(`handlePaymentSuccess called for payment intent: ${paymentIntent.id}`);
    
    const transactionId = paymentIntent.metadata?.transactionId;
    const userId = paymentIntent.metadata?.userId;

    this.logger.log(`Payment intent metadata - transactionId: ${transactionId}, userId: ${userId}`);

    if (!transactionId || !userId) {
      this.logger.error(`Missing metadata in payment intent ${paymentIntent.id}. transactionId: ${transactionId}, userId: ${userId}`);
      return;
    }

    const amount = paymentIntent.amount / 100; // Convert from cents
    this.logger.log(`Processing deposit: ${amount} USD for user ${userId}, transaction ${transactionId}`);

    try {
      // Update transaction status
      this.logger.log(`Updating transaction ${transactionId} status to COMPLETED`);
      await this.prisma.client.fiatTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...(paymentIntent.metadata as any),
            completedAt: new Date().toISOString(),
          },
        },
      });
      this.logger.log(`Transaction ${transactionId} updated successfully`);

      // Check current balance before update
      const currentBalance = await this.prisma.client.cryptoBalance.findUnique({
        where: {
          userId_asset: {
            userId,
            asset: 'USD',
          },
        },
      });
      this.logger.log(`Current USD balance for user ${userId}: ${currentBalance ? currentBalance.balance.toString() : '0 (does not exist)'}`);

      // Update user's USD balance (in fiat_balances table as USD asset)
      this.logger.log(`Upserting USD balance: adding ${amount} to user ${userId}`);
      const updatedBalance = await this.prisma.client.fiatBalance.upsert({
        where: { userId },
        create: {
          userId,
          currency: 'USD',
          balance: amount,
          availableBalance: amount,
          lockedBalance: 0,
        },
        update: {
          balance: { increment: amount },
          availableBalance: { increment: amount },
        },
      });
      this.logger.log(`USD balance updated successfully. New balance: ${updatedBalance.balance.toString()}, available: ${updatedBalance.availableBalance.toString()}`);

      this.logger.log(`Deposit completed: ${amount} USD for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to process successful payment', error);
      this.logger.error('Error details:', JSON.stringify(error, null, 2));
      throw error; // Re-throw to see the error in the controller
    }
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const transactionId = paymentIntent.metadata?.transactionId;

    if (!transactionId) {
      this.logger.error('Missing transactionId in payment intent', paymentIntent.id);
      return;
    }

    try {
      await this.prisma.client.fiatTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          metadata: {
            ...(paymentIntent.metadata as any),
            failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
        },
      });

      this.logger.log(`Deposit failed for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error('Failed to process failed payment', error);
    }
  }

  /**
   * Get user's fiat transactions
   */
  async getUserTransactions(
    userId: string,
    options?: {
      type?: 'DEPOSIT' | 'WITHDRAWAL';
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { userId };
    if (options?.type) {
      where.type = options.type;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.client.fiatTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.client.fiatTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        transactionId: t.transactionId || `TXN-${t.id.slice(0, 8).toUpperCase()}`,
        type: t.type,
        method: t.method,
        amount: parseFloat(t.amount.toString()),
        status: t.status,
        reference: t.reference,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
    };
  }

  /**
   * Sync payment status from Stripe and update balance if needed
   * This is a fallback if webhook didn't process the payment
   */
  async syncPaymentStatus(userId: string, transactionId: string): Promise<void> {
    this.logger.log(`Syncing payment status for transaction ${transactionId}, user ${userId}`);

    const transaction = await this.prisma.client.fiatTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      this.logger.error(`Transaction ${transactionId} not found`);
      throw new Error('Transaction not found');
    }

    const metadata = transaction.metadata as any;
    const paymentIntentId = metadata?.stripePaymentIntentId || transaction.reference;

    if (!paymentIntentId) {
      this.logger.error(`No payment intent ID found for transaction ${transactionId}`);
      return;
    }

    try {
      // Check payment intent status from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      this.logger.log(`Payment intent ${paymentIntentId} status: ${paymentIntent.status}, transaction status: ${transaction.status}`);

      if (paymentIntent.status === 'succeeded') {
        // Payment succeeded - ensure transaction is marked as completed and balance is updated
        if (transaction.status !== 'COMPLETED') {
          this.logger.log(`Transaction ${transactionId} not marked as completed, processing now...`);
          await this.handlePaymentSuccess(paymentIntent);
        } else {
          // Transaction is completed, but check if balance was updated
          // Since we can't easily track which transactions were processed,
          // we'll just ensure the balance exists and is at least the transaction amount
          // This is safe because handlePaymentSuccess uses upsert with increment
          this.logger.log(`Transaction ${transactionId} already completed, verifying balance...`);
          
          const amount = parseFloat(transaction.amount.toString());
          const balance = await this.prisma.client.fiatBalance.findUnique({
            where: { userId },
          });

          // If balance doesn't exist or is less than transaction amount, update it
          // This handles the case where webhook failed but transaction was marked complete
          if (!balance || parseFloat(balance.balance.toString()) < amount) {
            this.logger.log(`Balance missing or insufficient, updating balance for transaction ${transactionId}`);
            await this.prisma.client.fiatBalance.upsert({
              where: { userId },
              create: {
                userId,
                currency: 'USD',
                balance: amount,
                availableBalance: amount,
                lockedBalance: 0,
              },
              update: {
                balance: { increment: amount },
                availableBalance: { increment: amount },
              },
            });
            this.logger.log(`Balance updated for transaction ${transactionId}`);
          } else {
            this.logger.log(`Balance already updated for transaction ${transactionId}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to sync payment status for transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's bank accounts
   */
  async getUserBankAccounts(userId: string) {
    const bankAccounts = await this.prisma.client.bankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return bankAccounts.map((account) => ({
      id: account.id,
      accountName: account.accountName,
      accountType: account.accountType,
      last4: account.accountNumber.length >= 4 ? account.accountNumber.slice(-4) : account.accountNumber,
      routingNumber: account.routingNumber.length > 4 
        ? account.routingNumber.slice(0, 2) + '****' + account.routingNumber.slice(-2) 
        : account.routingNumber,
      isVerified: account.isVerified,
      createdAt: account.createdAt,
    }));
  }

  /**
   * Add a bank account using Stripe payment method ID
   * The payment method is created on the frontend using Stripe.js Payment Element
   */
  async addBankAccount(
    userId: string,
    paymentMethodId: string,
    accountName: string,
  ): Promise<{ id: string; last4: string; stripeBankAccountId: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    try {
      // Retrieve the payment method to get bank account details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);

      if (paymentMethod.type !== 'us_bank_account' || !paymentMethod.us_bank_account) {
        throw new BadRequestException('Invalid bank account payment method');
      }

      const bankAccountDetails = paymentMethod.us_bank_account;

      // Get or create Stripe customer for this user
      let customerId: string;
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      // Check if customer already exists
      const customers = await this.stripe.customers.list({
        email: user?.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        // Create new customer
        const customer = await this.stripe.customers.create({
          email: user?.email,
          metadata: {
            userId,
          },
        });
        customerId = customer.id;
      }

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      // For bank account payouts, we need the bank account ID (ba_xxx)
      // Payment methods don't directly provide this, so we'll store the payment method ID
      // and use it to retrieve bank account details when needed
      // Note: For production, consider using Stripe Financial Connections or collecting
      // full bank account details securely
      
      // Store the payment method ID - we'll use it to get bank account details for payouts
      const stripeBankAccountId = paymentMethodId; // Temporary: store PM ID, will need to convert to ba_xxx for payouts

      // Store bank account in database
      const savedAccount = await this.prisma.client.bankAccount.create({
        data: {
          userId,
          accountNumber: bankAccountDetails.last4 || '****', // Store last4 for display
          routingNumber: bankAccountDetails.routing_number ? 
            bankAccountDetails.routing_number.slice(0, 2) + '****' + bankAccountDetails.routing_number.slice(-2) : '****',
          accountType: 'checking', // Default, can be enhanced
          accountName,
          stripeBankAccountId: paymentMethodId, // Store payment method ID for now
          isVerified: false, // Will be verified via micro-deposits if needed
        },
      });

      return {
        id: savedAccount.id,
        last4: bankAccountDetails.last4 || '****',
        stripeBankAccountId: paymentMethodId,
      };
    } catch (error: any) {
      this.logger.error('Failed to add bank account', error);
      if (error.type === 'StripeInvalidRequestError') {
        throw new BadRequestException('Invalid bank account information');
      }
      throw new BadRequestException('Failed to add bank account');
    }
  }

  /**
   * Delete a bank account
   */
  async deleteBankAccount(userId: string, bankAccountId: string): Promise<void> {
    const bankAccount = await this.prisma.client.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId, // Ensure user owns this account
      },
    });

    if (!bankAccount) {
      throw new BadRequestException('Bank account not found');
    }

    await this.prisma.client.bankAccount.delete({
      where: { id: bankAccountId },
    });

    this.logger.log(`Bank account ${bankAccountId} deleted for user ${userId}`);
  }

  /**
   * Create a withdrawal (Stripe payout)
   */
  async createWithdrawal(
    userId: string,
    bankAccountId: string,
    amount: number,
  ): Promise<{ transactionId: string; payoutId: string }> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }

    // Validate amount (minimum $10, maximum $10,000)
    if (amount < 10) {
      throw new BadRequestException('Minimum withdrawal amount is $10');
    }
    if (amount > 10000) {
      throw new BadRequestException('Maximum withdrawal amount is $10,000');
    }

    // Check user has sufficient balance
    const balance = await this.prisma.client.fiatBalance.findUnique({
      where: { userId },
    });

    const availableBalance = balance ? parseFloat(balance.availableBalance.toString()) : 0;
    if (availableBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

      // Get bank account
      const bankAccount = await this.prisma.client.bankAccount.findFirst({
        where: {
          id: bankAccountId,
          userId,
        },
      });

      if (!bankAccount) {
        throw new BadRequestException('Bank account not found');
      }

      if (!bankAccount.isVerified) {
        throw new BadRequestException('Bank account must be verified before withdrawal');
      }

      // Create transaction record
      const transaction = await this.prisma.client.fiatTransaction.create({
        data: {
          transactionId: generateTransactionId(),
          userId,
          type: 'WITHDRAWAL',
          method: 'bank',
          amount: amount,
          status: 'PENDING',
        },
      });

      try {
        // Lock the balance
        await this.prisma.client.fiatBalance.update({
          where: { userId },
          data: {
            availableBalance: { decrement: amount },
            lockedBalance: { increment: amount },
          },
        });

      // Create Stripe payout
      // Note: We're storing payment method ID, but need to convert it to bank account ID for payouts
      // For now, we'll need to retrieve the payment method and get bank account details
      // Then create a bank account object or use the payment method's bank account
      
      if (!bankAccount.stripeBankAccountId) {
        throw new BadRequestException('Bank account is not properly configured. Please re-add the bank account.');
      }

      // Try to use the stored ID - if it's a payment method ID (pm_xxx), we need to convert it
      // If it's already a bank account ID (ba_xxx), we can use it directly
      let destinationBankAccountId = bankAccount.stripeBankAccountId;
      
      if (bankAccount.stripeBankAccountId.startsWith('pm_')) {
        // It's a payment method ID, we need to get the bank account from it
        // For payouts, we can't directly use payment methods - we need bank account objects
        // This is a limitation - we'll need to implement proper bank account collection
        throw new BadRequestException('Bank account payout requires bank account ID. Please re-add your bank account using the full account details.');
      }

      // Create the payout
      const payout = await this.stripe.payouts.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        method: 'standard', // or 'instant' for faster payouts (additional fee)
        destination: destinationBankAccountId,
        metadata: {
          userId,
          transactionId: transaction.id,
          type: 'withdrawal',
        },
      });

      // Update transaction with Stripe reference
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          reference: payout.id,
          metadata: {
            stripePayoutId: payout.id,
            stripeBankAccountId: destinationBankAccountId,
          },
        },
      });

      return {
        transactionId: transaction.id,
        payoutId: payout.id,
      };

      // Update transaction with Stripe reference
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: {
          reference: payout.id,
          metadata: {
            stripePayoutId: payout.id,
            stripeBankAccountId: destinationBankAccountId,
          },
        },
      });

      return {
        transactionId: transaction.id,
        payoutId: payout.id,
      };
    } catch (error: any) {
      this.logger.error('Failed to create withdrawal', error);
      
      // Unlock the balance on error
      await this.prisma.client.fiatBalance.update({
        where: { userId },
        data: {
          availableBalance: { increment: amount },
          lockedBalance: { decrement: amount },
        },
      });

      // Update transaction as failed
      await this.prisma.client.fiatTransaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });

      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create withdrawal');
    }
  }

  /**
   * Handle payout webhook events
   */
  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    const transactionId = payout.metadata?.transactionId;
    const userId = payout.metadata?.userId;

    if (!transactionId || !userId) {
      this.logger.error(`Missing metadata in payout ${payout.id}`);
      return;
    }

    const amount = payout.amount / 100; // Convert from cents

    try {
      // Update transaction status
      await this.prisma.client.fiatTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          metadata: {
            stripePayoutId: payout.id,
            completedAt: new Date().toISOString(),
          },
        },
      });

      // Deduct from locked balance (already locked during withdrawal creation)
      await this.prisma.client.fiatBalance.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
          lockedBalance: { decrement: amount },
        },
      });

      this.logger.log(`Withdrawal completed: ${amount} USD for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to process payout success', error);
      throw error;
    }
  }

  /**
   * Handle failed payout
   */
  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    const transactionId = payout.metadata?.transactionId;
    const userId = payout.metadata?.userId;

    if (!transactionId || !userId) {
      this.logger.error(`Missing metadata in payout ${payout.id}`);
      return;
    }

    const amount = payout.amount / 100; // Convert from cents

    try {
      // Update transaction status
      await this.prisma.client.fiatTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'FAILED',
          metadata: {
            stripePayoutId: payout.id,
            failureReason: payout.failure_code || 'Payout failed',
          },
        },
      });

      // Unlock and restore balance
      await this.prisma.client.fiatBalance.update({
        where: { userId },
        data: {
          availableBalance: { increment: amount },
          lockedBalance: { decrement: amount },
        },
      });

      this.logger.log(`Withdrawal failed for transaction ${transactionId}`);
    } catch (error) {
      this.logger.error('Failed to process payout failure', error);
    }
  }
}

