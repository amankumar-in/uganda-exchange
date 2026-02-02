import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { Prisma, P2PTradeStatus, P2PEscrowStatus, P2PAdStatus } from '@prisma/client';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
  PaymentMethodType,
} from './dto/payment-method.dto';
import { CreateAdDto, UpdateAdDto, ListAdsQueryDto, AdSide } from './dto/ad.dto';
import {
  CreateTradeDto,
  UploadProofDto,
  ListTradesQueryDto,
  TradeStatusFilter,
} from './dto/trade.dto';
import { OpenDisputeDto, ResolveDisputeDto, DisputeOutcome } from './dto/dispute.dto';

// Daily limit in USD
const DAILY_LIMIT_USD = 5000;
// Payment window in seconds (15 minutes)
const PAYMENT_WINDOW_SECONDS = 900;

/**
 * Generate a human-readable trade number
 * Format: P2P-YYYYMMDD-XXXXXX
 */
function generateTradeNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `P2P-${datePart}-${randomPart}`;
}

@Injectable()
export class P2PService {
  private readonly logger = new Logger(P2PService.name);

  constructor(
    private prisma: PrismaService,
    private tokensService: TokensService,
  ) {}

  // ============================================
  // PAYMENT METHODS
  // ============================================

  async createPaymentMethod(userId: string, dto: CreatePaymentMethodDto) {
    const paymentMethod = await this.prisma.client.p2PPaymentMethod.create({
      data: {
        userId,
        type: dto.type,
        name: dto.name,
        details: dto.details,
      },
    });

    return this.formatPaymentMethod(paymentMethod);
  }

  async updatePaymentMethod(
    userId: string,
    paymentMethodId: string,
    dto: UpdatePaymentMethodDto,
  ) {
    const existing = await this.prisma.client.p2PPaymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Payment method not found');
    }

    const updated = await this.prisma.client.p2PPaymentMethod.update({
      where: { id: paymentMethodId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.details && { details: dto.details }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.formatPaymentMethod(updated);
  }

  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    const existing = await this.prisma.client.p2PPaymentMethod.findFirst({
      where: { id: paymentMethodId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Payment method not found');
    }

    // Check if used in any active ads
    const usedInAds = await this.prisma.client.p2PAdPaymentMethod.findFirst({
      where: {
        paymentMethodId,
        ad: { status: 'ACTIVE' },
      },
    });

    if (usedInAds) {
      throw new BadRequestException(
        'Cannot delete payment method used in active ads. Pause or close the ads first.',
      );
    }

    await this.prisma.client.p2PPaymentMethod.delete({
      where: { id: paymentMethodId },
    });

    return { message: 'Payment method deleted' };
  }

  async getUserPaymentMethods(userId: string) {
    const methods = await this.prisma.client.p2PPaymentMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return methods.map(this.formatPaymentMethod);
  }

  private formatPaymentMethod(pm: any) {
    return {
      id: pm.id,
      type: pm.type,
      name: pm.name,
      details: pm.details,
      isActive: pm.isActive,
      createdAt: pm.createdAt,
    };
  }

  // ============================================
  // ADS
  // ============================================

  async createAd(userId: string, dto: CreateAdDto) {
    // Check P2P permission for this token
    const token = await this.tokensService.findBySymbol(dto.asset);
    if (token && !token.allowP2P) {
      throw new BadRequestException(`P2P trading for ${dto.asset} is currently disabled.`);
    }

    // Validate payment methods belong to user and are active
    const paymentMethods = await this.prisma.client.p2PPaymentMethod.findMany({
      where: {
        id: { in: dto.paymentMethodIds },
        userId,
        isActive: true,
      },
    });

    if (paymentMethods.length !== dto.paymentMethodIds.length) {
      throw new BadRequestException('One or more payment methods are invalid or inactive');
    }

    // Validate quantity bounds
    if (dto.minQty > dto.maxQty) {
      throw new BadRequestException('Minimum quantity cannot be greater than maximum quantity');
    }

    if (dto.maxQty > dto.totalQty) {
      throw new BadRequestException('Maximum per-trade quantity cannot exceed total quantity');
    }

    // For SELL ads: Check if user has sufficient crypto balance
    if (dto.side === AdSide.SELL) {
      if (dto.asset === 'USD') {
        const balance = await this.prisma.client.fiatBalance.findUnique({
          where: { userId },
        });

        const available = balance ? parseFloat(balance.availableBalance.toString()) : 0;
        if (available < dto.totalQty) {
          throw new BadRequestException(
            `Insufficient ${dto.asset} balance. Available: ${available}, Required: ${dto.totalQty}`,
          );
        }
      } else {
        const balance = await this.prisma.client.cryptoBalance.findUnique({
          where: { userId_asset: { userId, asset: dto.asset } },
        });

        const available = balance ? parseFloat(balance.availableBalance.toString()) : 0;
        if (available < dto.totalQty) {
          throw new BadRequestException(
            `Insufficient ${dto.asset} balance. Available: ${available}, Required: ${dto.totalQty}`,
          );
        }
      }
    }

    // Create the ad with payment methods
    const ad = await this.prisma.client.p2PAd.create({
      data: {
        userId,
        side: dto.side,
        asset: dto.asset.toUpperCase(),
        fiatCurrency: dto.fiatCurrency.toUpperCase(),
        price: dto.price,
        totalQty: dto.totalQty,
        remainingQty: dto.totalQty,
        minQty: dto.minQty,
        maxQty: dto.maxQty,
        terms: dto.terms,
        paymentMethods: {
          create: dto.paymentMethodIds.map((pmId) => ({
            paymentMethodId: pmId,
          })),
        },
      },
      include: {
        paymentMethods: {
          include: { paymentMethod: true },
        },
        user: {
          select: { id: true, email: true },
        },
      },
    });

    return this.formatAd(ad);
  }

  async updateAd(userId: string, adId: string, dto: UpdateAdDto) {
    const ad = await this.prisma.client.p2PAd.findFirst({
      where: { id: adId, userId },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    if (ad.status === 'CLOSED') {
      throw new BadRequestException('Cannot update a closed ad');
    }

    // Validate payment methods if provided
    if (dto.paymentMethodIds) {
      const paymentMethods = await this.prisma.client.p2PPaymentMethod.findMany({
        where: {
          id: { in: dto.paymentMethodIds },
          userId,
          isActive: true,
        },
      });

      if (paymentMethods.length !== dto.paymentMethodIds.length) {
        throw new BadRequestException('One or more payment methods are invalid or inactive');
      }
    }

    // Update the ad
    const updated = await this.prisma.client.$transaction(async (tx) => {
      // Update payment methods if provided
      if (dto.paymentMethodIds) {
        // Delete existing
        await tx.p2PAdPaymentMethod.deleteMany({ where: { adId } });
        // Create new
        await tx.p2PAdPaymentMethod.createMany({
          data: dto.paymentMethodIds.map((pmId) => ({
            adId,
            paymentMethodId: pmId,
          })),
        });
      }

      return tx.p2PAd.update({
        where: { id: adId },
        data: {
          ...(dto.price && { price: dto.price }),
          ...(dto.minQty && { minQty: dto.minQty }),
          ...(dto.maxQty && { maxQty: dto.maxQty }),
          ...(dto.terms !== undefined && { terms: dto.terms }),
        },
        include: {
          paymentMethods: {
            include: { paymentMethod: true },
          },
          user: {
            select: { id: true, email: true },
          },
        },
      });
    });

    return this.formatAd(updated);
  }

  async pauseAd(userId: string, adId: string) {
    const ad = await this.prisma.client.p2PAd.findFirst({
      where: { id: adId, userId },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    if (ad.status === 'CLOSED') {
      throw new BadRequestException('Cannot pause a closed ad');
    }

    const updated = await this.prisma.client.p2PAd.update({
      where: { id: adId },
      data: { status: 'PAUSED' },
      include: {
        paymentMethods: { include: { paymentMethod: true } },
        user: { select: { id: true, email: true } },
      },
    });

    return this.formatAd(updated);
  }

  async resumeAd(userId: string, adId: string) {
    const ad = await this.prisma.client.p2PAd.findFirst({
      where: { id: adId, userId },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    if (ad.status === 'CLOSED') {
      throw new BadRequestException('Cannot resume a closed ad');
    }

    // For SELL ads: Re-check balance before resuming
    if (ad.side === 'SELL') {
      let available = 0;
      
      if (ad.asset === 'USD') {
        const balance = await this.prisma.client.fiatBalance.findUnique({
          where: { userId },
        });
        available = balance ? parseFloat(balance.availableBalance.toString()) : 0;
      } else {
        const balance = await this.prisma.client.cryptoBalance.findUnique({
          where: { userId_asset: { userId, asset: ad.asset } },
        });
        available = balance ? parseFloat(balance.availableBalance.toString()) : 0;
      }

      const remaining = parseFloat(ad.remainingQty.toString());

      if (available < remaining) {
        throw new BadRequestException(
          `Insufficient ${ad.asset} balance to resume. Available: ${available}, Required: ${remaining}`,
        );
      }
    }

    const updated = await this.prisma.client.p2PAd.update({
      where: { id: adId },
      data: { status: 'ACTIVE' },
      include: {
        paymentMethods: { include: { paymentMethod: true } },
        user: { select: { id: true, email: true } },
      },
    });

    return this.formatAd(updated);
  }

  async closeAd(userId: string, adId: string) {
    const ad = await this.prisma.client.p2PAd.findFirst({
      where: { id: adId, userId },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    // Check for active trades
    const activeTrades = await this.prisma.client.p2PTrade.count({
      where: {
        adId,
        status: { in: ['CREATED', 'PAID', 'DISPUTED'] },
      },
    });

    if (activeTrades > 0) {
      throw new BadRequestException(
        `Cannot close ad with ${activeTrades} active trade(s). Wait for trades to complete or cancel.`,
      );
    }

    const updated = await this.prisma.client.p2PAd.update({
      where: { id: adId },
      data: { status: 'CLOSED' },
      include: {
        paymentMethods: { include: { paymentMethod: true } },
        user: { select: { id: true, email: true } },
      },
    });

    return this.formatAd(updated);
  }

  async getAd(adId: string) {
    const ad = await this.prisma.client.p2PAd.findUnique({
      where: { id: adId },
      include: {
        paymentMethods: { include: { paymentMethod: true } },
        user: { select: { id: true, email: true } },
      },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    return this.formatAd(ad);
  }

  async listAds(query: ListAdsQueryDto) {
    const where: Prisma.P2PAdWhereInput = {
      status: 'ACTIVE',
      remainingQty: { gt: 0 },
      ...(query.side && { side: query.side }),
      ...(query.asset && { asset: query.asset.toUpperCase() }),
      ...(query.fiatCurrency && { fiatCurrency: query.fiatCurrency.toUpperCase() }),
    };

    const [ads, total] = await Promise.all([
      this.prisma.client.p2PAd.findMany({
        where,
        include: {
          paymentMethods: { include: { paymentMethod: true } },
          user: { select: { id: true, email: true } },
        },
        orderBy: [
          { price: 'asc' }, // Best price first
          { createdAt: 'asc' }, // FIFO for same price
        ],
        take: query.limit || 20,
        skip: query.offset || 0,
      }),
      this.prisma.client.p2PAd.count({ where }),
    ]);

    return {
      ads: ads.map(this.formatAd),
      total,
      limit: query.limit || 20,
      offset: query.offset || 0,
    };
  }

  async getUserAds(userId: string, includeAll = false) {
    const where: Prisma.P2PAdWhereInput = {
      userId,
      ...(includeAll ? {} : { status: { not: 'CLOSED' } }),
    };

    const ads = await this.prisma.client.p2PAd.findMany({
      where,
      include: {
        paymentMethods: { include: { paymentMethod: true } },
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ads.map(this.formatAd);
  }

  private formatAd(ad: any) {
    return {
      id: ad.id,
      userId: ad.userId,
      userEmail: ad.user?.email,
      side: ad.side,
      asset: ad.asset,
      fiatCurrency: ad.fiatCurrency,
      price: parseFloat(ad.price.toString()),
      totalQty: parseFloat(ad.totalQty.toString()),
      remainingQty: parseFloat(ad.remainingQty.toString()),
      minQty: parseFloat(ad.minQty.toString()),
      maxQty: parseFloat(ad.maxQty.toString()),
      status: ad.status,
      terms: ad.terms,
      paymentMethods: ad.paymentMethods?.map((apm: any) => ({
        id: apm.paymentMethod.id,
        type: apm.paymentMethod.type,
        name: apm.paymentMethod.name,
      })),
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
    };
  }

  // ============================================
  // TRADES
  // ============================================

  async createTrade(userId: string, dto: CreateTradeDto) {
    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.prisma.client.p2PTrade.findUnique({
        where: { createIdempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.getTrade(userId, existing.id);
      }
    }

    // Get the ad
    const ad = await this.prisma.client.p2PAd.findUnique({
      where: { id: dto.adId },
      include: {
        paymentMethods: { include: { paymentMethod: true } },
        user: true,
      },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    // Check P2P permission for this token
    const token = await this.tokensService.findBySymbol(ad.asset);
    if (token && !token.allowP2P) {
      throw new BadRequestException(`P2P trading for ${ad.asset} is currently disabled.`);
    }

    // Check ad is active
    if (ad.status !== 'ACTIVE') {
      throw new BadRequestException('Ad is not active');
    }

    // Cannot trade with yourself
    if (ad.userId === userId) {
      throw new BadRequestException('Cannot trade with your own ad');
    }

    // Validate quantity
    const remainingQty = parseFloat(ad.remainingQty.toString());
    const minQty = parseFloat(ad.minQty.toString());
    const maxQty = parseFloat(ad.maxQty.toString());

    if (dto.qty < minQty) {
      throw new BadRequestException(`Minimum quantity is ${minQty} ${ad.asset}`);
    }

    if (dto.qty > maxQty) {
      throw new BadRequestException(`Maximum quantity is ${maxQty} ${ad.asset}`);
    }

    if (dto.qty > remainingQty) {
      throw new BadRequestException(
        `Insufficient ad quantity. Available: ${remainingQty} ${ad.asset}`,
      );
    }

    // Validate payment method is accepted by ad
    const acceptedTypes = ad.paymentMethods.map((pm: any) => pm.paymentMethod.type);
    if (!acceptedTypes.includes(dto.paymentMethodType)) {
      throw new BadRequestException(
        `Payment method ${dto.paymentMethodType} not accepted by this ad`,
      );
    }

    // Determine buyer and seller
    const buyerUserId = ad.side === 'SELL' ? userId : ad.userId;
    const sellerUserId = ad.side === 'SELL' ? ad.userId : userId;

    // Check both users have approved KYC
    const [buyer, seller] = await Promise.all([
      this.prisma.client.user.findUnique({
        where: { id: buyerUserId },
        select: { kycStatus: true },
      }),
      this.prisma.client.user.findUnique({
        where: { id: sellerUserId },
        select: { kycStatus: true },
      }),
    ]);

    if (buyer?.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Buyer must have approved KYC');
    }

    if (seller?.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Seller must have approved KYC');
    }

    // Check daily limits for both users
    await this.checkDailyLimit(buyerUserId, dto.qty * parseFloat(ad.price.toString()));
    await this.checkDailyLimit(sellerUserId, dto.qty * parseFloat(ad.price.toString()));

    // Check seller has sufficient balance
    const sellerBalance = await this.prisma.client.cryptoBalance.findUnique({
      where: { userId_asset: { userId: sellerUserId, asset: ad.asset } },
    });

    const sellerAvailable = sellerBalance
      ? parseFloat(sellerBalance.availableBalance.toString())
      : 0;

    if (sellerAvailable < dto.qty) {
      // Auto-pause the ad if seller has insufficient balance
      await this.prisma.client.p2PAd.update({
        where: { id: ad.id },
        data: { status: 'PAUSED' },
      });

      throw new BadRequestException(
        'Seller has insufficient balance. Ad has been paused.',
      );
    }

    // Calculate notional value
    const price = parseFloat(ad.price.toString());
    const notional = dto.qty * price;

    // Create trade with escrow in a transaction
    const trade = await this.prisma.client.$transaction(async (tx) => {
      // 1. Reserve inventory (decrease remainingQty)
      const updatedAd = await tx.p2PAd.update({
        where: { id: ad.id },
        data: {
          remainingQty: { decrement: dto.qty },
        },
      });

      // Verify remainingQty didn't go negative (concurrent safety)
      if (parseFloat(updatedAd.remainingQty.toString()) < 0) {
        throw new ConflictException('Insufficient ad quantity. Please try again.');
      }

      // 2. Lock escrow (move from available to locked)
      if (ad.asset === 'USD') {
        await tx.fiatBalance.update({
          where: { userId: sellerUserId },
          data: {
            availableBalance: { decrement: dto.qty },
            lockedBalance: { increment: dto.qty },
          },
        });
      } else {
        await tx.cryptoBalance.update({
          where: { userId_asset: { userId: sellerUserId, asset: ad.asset } },
          data: {
            availableBalance: { decrement: dto.qty },
            lockedBalance: { increment: dto.qty },
          },
        });
      }

      // 3. Create the trade
      const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_SECONDS * 1000);
      const tradeNumber = generateTradeNumber();

      const newTrade = await tx.p2PTrade.create({
        data: {
          tradeNumber,
          adId: ad.id,
          buyerUserId,
          sellerUserId,
          asset: ad.asset,
          fiatCurrency: ad.fiatCurrency,
          qtyCrypto: dto.qty,
          price,
          notional,
          paymentMethodType: dto.paymentMethodType,
          paymentWindowSeconds: PAYMENT_WINDOW_SECONDS,
          expiresAt,
          createIdempotencyKey: dto.idempotencyKey,
        },
      });

      // 4. Create escrow record
      await tx.p2PEscrow.create({
        data: {
          tradeId: newTrade.id,
          asset: ad.asset,
          qtyLocked: dto.qty,
          status: 'LOCKED',
        },
      });

      // 5. Create audit log
      await tx.p2PAuditLog.create({
        data: {
          tradeId: newTrade.id,
          action: 'CREATE',
          triggeredBy: userId,
          previousState: null,
          newState: 'CREATED',
          metadata: {
            adId: ad.id,
            qty: dto.qty,
            price,
            notional,
            paymentMethodType: dto.paymentMethodType,
          },
        },
      });

      // 6. Update daily volume for both users
      await this.updateDailyVolume(tx, buyerUserId, notional);
      await this.updateDailyVolume(tx, sellerUserId, notional);

      return newTrade;
    });

    return this.getTrade(userId, trade.id);
  }

  async uploadProof(userId: string, tradeId: string, dto: UploadProofDto) {
    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Only buyer can upload proof
    if (trade.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can upload proof');
    }

    if (trade.status !== 'CREATED') {
      throw new BadRequestException('Proof can only be uploaded before marking paid');
    }

    const updated = await this.prisma.client.p2PTrade.update({
      where: { id: tradeId },
      data: {
        proofUrls: dto.proofUrls,
      },
    });

    return this.getTrade(userId, updated.id);
  }

  async markPaid(userId: string, tradeId: string, idempotencyKey?: string) {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.client.p2PTrade.findUnique({
        where: { markPaidIdempotencyKey: idempotencyKey },
      });
      if (existing) {
        return this.getTrade(userId, existing.id);
      }
    }

    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Only buyer can mark as paid
    if (trade.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can mark as paid');
    }

    if (trade.status !== 'CREATED') {
      throw new BadRequestException('Trade is not in CREATED status');
    }

    // Check if payment window has expired
    if (new Date() > trade.expiresAt) {
      throw new BadRequestException('Payment window has expired');
    }

    // Proof is mandatory
    if (trade.proofRequired && trade.proofUrls.length === 0) {
      throw new BadRequestException('Proof of payment is required');
    }

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const result = await tx.p2PTrade.update({
        where: { id: tradeId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          markPaidIdempotencyKey: idempotencyKey,
        },
      });

      await tx.p2PAuditLog.create({
        data: {
          tradeId,
          action: 'MARK_PAID',
          triggeredBy: userId,
          previousState: 'CREATED',
          newState: 'PAID',
          metadata: {
            proofUrls: trade.proofUrls,
          },
        },
      });

      return result;
    });

    return this.getTrade(userId, updated.id);
  }

  async cancelTrade(userId: string, tradeId: string, idempotencyKey?: string) {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.client.p2PTrade.findUnique({
        where: { cancelIdempotencyKey: idempotencyKey },
      });
      if (existing) {
        return this.getTrade(userId, existing.id);
      }
    }

    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { escrow: true, ad: true },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Only buyer can cancel
    if (trade.buyerUserId !== userId) {
      throw new ForbiddenException('Only the buyer can cancel the trade');
    }

    // Can only cancel in CREATED status
    if (trade.status !== 'CREATED') {
      throw new BadRequestException('Trade can only be cancelled before marking paid');
    }

    await this.prisma.client.$transaction(async (tx) => {
      // 1. Update trade status
      await tx.p2PTrade.update({
        where: { id: tradeId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelIdempotencyKey: idempotencyKey,
        },
      });

      // 2. Unlock escrow (move back to seller's available balance)
      const qtyLocked = parseFloat(trade.escrow!.qtyLocked.toString());
      
      if (trade.asset === 'USD') {
        await tx.fiatBalance.update({
          where: { userId: trade.sellerUserId },
          data: {
            availableBalance: { increment: qtyLocked },
            lockedBalance: { decrement: qtyLocked },
          },
        });
      } else {
        await tx.cryptoBalance.update({
          where: {
            userId_asset: { userId: trade.sellerUserId, asset: trade.asset },
          },
          data: {
            availableBalance: { increment: qtyLocked },
            lockedBalance: { decrement: qtyLocked },
          },
        });
      }

      // 3. Update escrow status
      await tx.p2PEscrow.update({
        where: { id: trade.escrow!.id },
        data: {
          status: 'UNLOCKED',
          unlockedAt: new Date(),
        },
      });

      // 4. Restore ad remaining quantity
      await tx.p2PAd.update({
        where: { id: trade.adId },
        data: {
          remainingQty: { increment: qtyLocked },
        },
      });

      // 5. Create audit log
      await tx.p2PAuditLog.create({
        data: {
          tradeId,
          action: 'CANCEL',
          triggeredBy: userId,
          previousState: trade.status,
          newState: 'CANCELLED',
          metadata: {
            reason: 'Buyer cancelled',
          },
        },
      });
    });

    return this.getTrade(userId, tradeId);
  }

  async releaseTrade(userId: string, tradeId: string, idempotencyKey?: string) {
    // Idempotency check
    if (idempotencyKey) {
      const existing = await this.prisma.client.p2PTrade.findUnique({
        where: { releaseIdempotencyKey: idempotencyKey },
      });
      if (existing) {
        return this.getTrade(userId, existing.id);
      }
    }

    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { escrow: true },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Only seller can release
    if (trade.sellerUserId !== userId) {
      throw new ForbiddenException('Only the seller can release the trade');
    }

    // Can only release in PAID status
    if (trade.status !== 'PAID') {
      throw new BadRequestException('Trade can only be released after buyer marks paid');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const qtyLocked = parseFloat(trade.escrow!.qtyLocked.toString());

      // 1. Transfer from seller's locked to buyer's available
      if (trade.asset === 'USD') {
        // Seller decrement
        await tx.fiatBalance.update({
          where: { userId: trade.sellerUserId },
          data: {
            lockedBalance: { decrement: qtyLocked },
            balance: { decrement: qtyLocked },
          },
        });

        // Buyer increment
        await tx.fiatBalance.upsert({
          where: { userId: trade.buyerUserId },
          create: {
            userId: trade.buyerUserId,
            currency: 'USD',
            balance: qtyLocked,
            availableBalance: qtyLocked,
            lockedBalance: 0,
          },
          update: {
            balance: { increment: qtyLocked },
            availableBalance: { increment: qtyLocked },
          },
        });
      } else {
        // Seller decrement
        await tx.cryptoBalance.update({
          where: {
            userId_asset: { userId: trade.sellerUserId, asset: trade.asset },
          },
          data: {
            lockedBalance: { decrement: qtyLocked },
            balance: { decrement: qtyLocked },
          },
        });

        // Buyer increment
        await tx.cryptoBalance.upsert({
          where: {
            userId_asset: { userId: trade.buyerUserId, asset: trade.asset },
          },
          create: {
            userId: trade.buyerUserId,
            asset: trade.asset,
            balance: qtyLocked,
            availableBalance: qtyLocked,
            lockedBalance: 0,
          },
          update: {
            balance: { increment: qtyLocked },
            availableBalance: { increment: qtyLocked },
          },
        });
      }

      // 2. Update escrow status
      await tx.p2PEscrow.update({
        where: { id: trade.escrow!.id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
        },
      });

      // 3. Update trade status
      await tx.p2PTrade.update({
        where: { id: tradeId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releaseIdempotencyKey: idempotencyKey,
        },
      });

      // 4. Update user stats
      await this.incrementTradeStats(tx, trade.buyerUserId, 'completed');
      await this.incrementTradeStats(tx, trade.sellerUserId, 'completed');

      // 5. Create audit log
      await tx.p2PAuditLog.create({
        data: {
          tradeId,
          action: 'RELEASE',
          triggeredBy: userId,
          previousState: 'PAID',
          newState: 'RELEASED',
          metadata: {
            qtyCrypto: qtyLocked,
            buyerReceived: qtyLocked,
          },
        },
      });
    });

    return this.getTrade(userId, tradeId);
  }

  async getTrade(userId: string, tradeId: string) {
    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
      include: {
        ad: true,
        buyer: { select: { id: true, email: true } },
        seller: { select: { id: true, email: true } },
        escrow: true,
        dispute: {
          include: {
            openedBy: { select: { id: true, email: true } },
            resolvedBy: { select: { id: true, email: true } },
          },
        },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // Check user is party to the trade or admin
    if (trade.buyerUserId !== userId && trade.sellerUserId !== userId) {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('You are not a party to this trade');
      }
    }

    return this.formatTrade(trade, userId);
  }

  async listTrades(userId: string, query: ListTradesQueryDto) {
    const where: Prisma.P2PTradeWhereInput = {
      OR: [
        ...(query.role !== 'seller' ? [{ buyerUserId: userId }] : []),
        ...(query.role !== 'buyer' ? [{ sellerUserId: userId }] : []),
      ],
      ...(query.status && query.status !== TradeStatusFilter.ALL && {
        status: query.status as P2PTradeStatus,
      }),
    };

    const [trades, total] = await Promise.all([
      this.prisma.client.p2PTrade.findMany({
        where,
        include: {
          ad: true,
          buyer: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
          escrow: true,
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit || 20,
        skip: query.offset || 0,
      }),
      this.prisma.client.p2PTrade.count({ where }),
    ]);

    return {
      trades: trades.map((t) => this.formatTrade(t, userId)),
      total,
      limit: query.limit || 20,
      offset: query.offset || 0,
    };
  }

  private formatTrade(trade: any, currentUserId?: string) {
    const userRole =
      trade.buyerUserId === currentUserId
        ? 'buyer'
        : trade.sellerUserId === currentUserId
          ? 'seller'
          : 'observer';

    return {
      id: trade.id,
      tradeNumber: trade.tradeNumber,
      adId: trade.adId,
      userRole,
      buyer: {
        id: trade.buyer.id,
        email: trade.buyer.email,
      },
      seller: {
        id: trade.seller.id,
        email: trade.seller.email,
      },
      asset: trade.asset,
      fiatCurrency: trade.fiatCurrency,
      qtyCrypto: parseFloat(trade.qtyCrypto.toString()),
      price: parseFloat(trade.price.toString()),
      notional: parseFloat(trade.notional.toString()),
      paymentMethodType: trade.paymentMethodType,
      paymentWindowSeconds: trade.paymentWindowSeconds,
      expiresAt: trade.expiresAt,
      proofRequired: trade.proofRequired,
      proofUrls: trade.proofUrls,
      status: trade.status,
      escrow: trade.escrow
        ? {
            status: trade.escrow.status,
            qtyLocked: parseFloat(trade.escrow.qtyLocked.toString()),
          }
        : null,
      dispute: trade.dispute
        ? {
            id: trade.dispute.id,
            status: trade.dispute.status,
            outcome: trade.dispute.outcome,
            reason: trade.dispute.reason,
            openedBy: trade.dispute.openedBy,
            resolvedBy: trade.dispute.resolvedBy,
          }
        : null,
      createdAt: trade.createdAt,
      paidAt: trade.paidAt,
      releasedAt: trade.releasedAt,
      cancelledAt: trade.cancelledAt,
      auditLogs: trade.auditLogs?.map((log: any) => ({
        action: log.action,
        triggeredBy: log.triggeredBy,
        previousState: log.previousState,
        newState: log.newState,
        createdAt: log.createdAt,
      })),
    };
  }

  // ============================================
  // DISPUTES
  // ============================================

  async openDispute(userId: string, tradeId: string, dto: OpenDisputeDto) {
    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { dispute: true },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    // User must be party to the trade
    if (trade.buyerUserId !== userId && trade.sellerUserId !== userId) {
      throw new ForbiddenException('You are not a party to this trade');
    }

    // Can only dispute after PAID
    if (trade.status !== 'PAID') {
      throw new BadRequestException('Disputes can only be opened after payment is marked');
    }

    // Check if dispute already exists
    if (trade.dispute) {
      throw new ConflictException('A dispute has already been opened for this trade');
    }

    await this.prisma.client.$transaction(async (tx) => {
      // 1. Create dispute
      await tx.p2PDispute.create({
        data: {
          tradeId,
          openedById: userId,
          reason: dto.reason,
          evidence: dto.evidence || [],
        },
      });

      // 2. Update trade status
      await tx.p2PTrade.update({
        where: { id: tradeId },
        data: { status: 'DISPUTED' },
      });

      // 3. Create audit log
      await tx.p2PAuditLog.create({
        data: {
          tradeId,
          action: 'DISPUTE_OPEN',
          triggeredBy: userId,
          previousState: 'PAID',
          newState: 'DISPUTED',
          metadata: {
            reason: dto.reason,
            evidence: dto.evidence,
          },
        },
      });
    });

    return this.getTrade(userId, tradeId);
  }

  async resolveDispute(
    adminId: string,
    tradeId: string,
    dto: ResolveDisputeDto,
  ) {
    // Verify admin
    const admin = await this.prisma.client.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });

    if (admin?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can resolve disputes');
    }

    const trade = await this.prisma.client.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { dispute: true, escrow: true },
    });

    if (!trade) {
      throw new NotFoundException('Trade not found');
    }

    if (trade.status !== 'DISPUTED') {
      throw new BadRequestException('Trade is not in disputed status');
    }

    if (!trade.dispute) {
      throw new BadRequestException('No dispute found for this trade');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const qtyLocked = parseFloat(trade.escrow!.qtyLocked.toString());
      let newTradeStatus: P2PTradeStatus;
      let escrowStatus: P2PEscrowStatus;

      if (dto.outcome === DisputeOutcome.RELEASE_TO_BUYER) {
        // Transfer to buyer
        newTradeStatus = 'RELEASED';
        escrowStatus = 'RELEASED';

        // Decrease seller's locked balance
        if (trade.asset === 'USD') {
          await tx.fiatBalance.update({
            where: { userId: trade.sellerUserId },
            data: {
              lockedBalance: { decrement: qtyLocked },
              balance: { decrement: qtyLocked },
            },
          });

          // Increase buyer's balance
          await tx.fiatBalance.upsert({
            where: { userId: trade.buyerUserId },
            create: {
              userId: trade.buyerUserId,
              currency: 'USD',
              balance: qtyLocked,
              availableBalance: qtyLocked,
              lockedBalance: 0,
            },
            update: {
              balance: { increment: qtyLocked },
              availableBalance: { increment: qtyLocked },
            },
          });
        } else {
          await tx.cryptoBalance.update({
            where: {
              userId_asset: { userId: trade.sellerUserId, asset: trade.asset },
            },
            data: {
              lockedBalance: { decrement: qtyLocked },
              balance: { decrement: qtyLocked },
            },
          });

          // Increase buyer's balance
          await tx.cryptoBalance.upsert({
            where: {
              userId_asset: { userId: trade.buyerUserId, asset: trade.asset },
            },
            create: {
              userId: trade.buyerUserId,
              asset: trade.asset,
              balance: qtyLocked,
              availableBalance: qtyLocked,
              lockedBalance: 0,
            },
            update: {
              balance: { increment: qtyLocked },
              availableBalance: { increment: qtyLocked },
            },
          });
        }

        await tx.p2PEscrow.update({
          where: { id: trade.escrow!.id },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });

        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      } else {
        // Refund to seller
        newTradeStatus = 'REFUNDED';
        escrowStatus = 'UNLOCKED';

        // Move from locked back to available
        if (trade.asset === 'USD') {
          await tx.fiatBalance.update({
            where: { userId: trade.sellerUserId },
            data: {
              lockedBalance: { decrement: qtyLocked },
              availableBalance: { increment: qtyLocked },
            },
          });
        } else {
          await tx.cryptoBalance.update({
            where: {
              userId_asset: { userId: trade.sellerUserId, asset: trade.asset },
            },
            data: {
              lockedBalance: { decrement: qtyLocked },
              availableBalance: { increment: qtyLocked },
            },
          });
        }

        await tx.p2PEscrow.update({
          where: { id: trade.escrow!.id },
          data: { status: 'UNLOCKED', unlockedAt: new Date() },
        });

        await tx.p2PTrade.update({
          where: { id: tradeId },
          data: { status: 'REFUNDED', cancelledAt: new Date() },
        });

        // Restore ad remaining qty
        await tx.p2PAd.update({
          where: { id: trade.adId },
          data: { remainingQty: { increment: qtyLocked } },
        });
      }

      // Update dispute
      await tx.p2PDispute.update({
        where: { id: trade.dispute!.id },
        data: {
          status: 'RESOLVED',
          outcome: dto.outcome,
          resolvedById: adminId,
          resolution: dto.resolution,
          resolvedAt: new Date(),
        },
      });

      // Create audit log
      await tx.p2PAuditLog.create({
        data: {
          tradeId,
          action: 'DISPUTE_RESOLVE',
          triggeredBy: adminId,
          previousState: 'DISPUTED',
          newState: newTradeStatus,
          metadata: {
            outcome: dto.outcome,
            resolution: dto.resolution,
          },
        },
      });
    });

    return this.getTrade(adminId, tradeId);
  }

  // ============================================
  // EXPIRY (called by cron job)
  // ============================================

  async expireUnpaidTrades() {
    const expiredTrades = await this.prisma.client.p2PTrade.findMany({
      where: {
        status: 'CREATED',
        expiresAt: { lt: new Date() },
      },
      include: { escrow: true },
    });

    for (const trade of expiredTrades) {
      try {
        await this.prisma.client.$transaction(async (tx) => {
          const qtyLocked = parseFloat(trade.escrow!.qtyLocked.toString());

          // 1. Update trade status
          await tx.p2PTrade.update({
            where: { id: trade.id },
            data: {
              status: 'EXPIRED',
              cancelledAt: new Date(),
            },
          });

          // 2. Unlock escrow
          if (trade.asset === 'USD') {
            await tx.fiatBalance.update({
              where: { userId: trade.sellerUserId },
              data: {
                availableBalance: { increment: qtyLocked },
                lockedBalance: { decrement: qtyLocked },
              },
            });
          } else {
            await tx.cryptoBalance.update({
              where: {
                userId_asset: { userId: trade.sellerUserId, asset: trade.asset },
              },
              data: {
                availableBalance: { increment: qtyLocked },
                lockedBalance: { decrement: qtyLocked },
              },
            });
          }

          await tx.p2PEscrow.update({
            where: { id: trade.escrow!.id },
            data: {
              status: 'UNLOCKED',
              unlockedAt: new Date(),
            },
          });

          // 3. Restore ad quantity
          await tx.p2PAd.update({
            where: { id: trade.adId },
            data: {
              remainingQty: { increment: qtyLocked },
            },
          });

          // 4. Add strike to buyer
          await this.addStrike(tx, trade.buyerUserId, 'UNPAID_EXPIRY');

          // 5. Create audit log
          await tx.p2PAuditLog.create({
            data: {
              tradeId: trade.id,
              action: 'EXPIRE',
              triggeredBy: 'SYSTEM',
              previousState: 'CREATED',
              newState: 'EXPIRED',
              metadata: {
                reason: 'Payment window expired',
              },
            },
          });
        });

        this.logger.log(`Expired trade ${trade.tradeNumber}`);
      } catch (error) {
        this.logger.error(`Failed to expire trade ${trade.id}`, error);
      }
    }

    return { expiredCount: expiredTrades.length };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async checkDailyLimit(userId: string, notionalUsd: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await this.prisma.client.p2PUserStats.findUnique({
      where: { userId },
    });

    if (stats && stats.suspendedUntil && stats.suspendedUntil > new Date()) {
      throw new ForbiddenException(
        `Account suspended until ${stats.suspendedUntil.toISOString()}`,
      );
    }

    let currentDailyVolume = 0;

    if (stats && stats.dailyVolumeDate) {
      const volumeDate = new Date(stats.dailyVolumeDate);
      volumeDate.setHours(0, 0, 0, 0);

      if (volumeDate.getTime() === today.getTime()) {
        currentDailyVolume = parseFloat(stats.dailyVolumeUsd.toString());
      }
    }

    if (currentDailyVolume + notionalUsd > DAILY_LIMIT_USD) {
      throw new BadRequestException(
        `Daily limit exceeded. Current: $${currentDailyVolume.toFixed(2)}, Limit: $${DAILY_LIMIT_USD}`,
      );
    }
  }

  private async updateDailyVolume(
    tx: Prisma.TransactionClient,
    userId: string,
    notionalUsd: number,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await tx.p2PUserStats.upsert({
      where: { userId },
      create: {
        userId,
        dailyVolumeUsd: notionalUsd,
        dailyVolumeDate: today,
      },
      update: {
        dailyVolumeUsd: { increment: notionalUsd },
        dailyVolumeDate: today,
      },
    });
  }

  private async addStrike(
    tx: Prisma.TransactionClient,
    userId: string,
    reason: string,
  ) {
    const stats = await tx.p2PUserStats.upsert({
      where: { userId },
      create: {
        userId,
        strikeCount: 1,
        lastStrikeAt: new Date(),
        dailyVolumeUsd: 0,
        dailyVolumeDate: new Date(),
      },
      update: {
        strikeCount: { increment: 1 },
        lastStrikeAt: new Date(),
      },
    });

    // Suspend after 3 strikes (24 hours)
    if (stats.strikeCount >= 3) {
      const suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.p2PUserStats.update({
        where: { userId },
        data: { suspendedUntil },
      });

      this.logger.warn(`User ${userId} suspended until ${suspendedUntil.toISOString()}`);
    }
  }

  private async incrementTradeStats(
    tx: Prisma.TransactionClient,
    userId: string,
    type: 'completed' | 'cancelled',
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const updateData =
      type === 'completed'
        ? { totalTradesCompleted: { increment: 1 } }
        : { totalTradesCancelled: { increment: 1 } };

    await tx.p2PUserStats.upsert({
      where: { userId },
      create: {
        userId,
        dailyVolumeUsd: 0,
        dailyVolumeDate: today,
        ...(type === 'completed' ? { totalTradesCompleted: 1 } : { totalTradesCancelled: 1 }),
      },
      update: updateData,
    });
  }

  // ============================================
  // USER STATS
  // ============================================

  async getUserStats(userId: string) {
    const stats = await this.prisma.client.p2PUserStats.findUnique({
      where: { userId },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyVolumeUsd = 0;
    if (stats?.dailyVolumeDate) {
      const volumeDate = new Date(stats.dailyVolumeDate);
      volumeDate.setHours(0, 0, 0, 0);
      if (volumeDate.getTime() === today.getTime()) {
        dailyVolumeUsd = parseFloat(stats.dailyVolumeUsd.toString());
      }
    }

    return {
      dailyVolumeUsd,
      dailyLimitUsd: DAILY_LIMIT_USD,
      dailyRemainingUsd: Math.max(0, DAILY_LIMIT_USD - dailyVolumeUsd),
      strikeCount: stats?.strikeCount || 0,
      suspendedUntil: stats?.suspendedUntil,
      totalTradesCompleted: stats?.totalTradesCompleted || 0,
      totalTradesCancelled: stats?.totalTradesCancelled || 0,
    };
  }
}

