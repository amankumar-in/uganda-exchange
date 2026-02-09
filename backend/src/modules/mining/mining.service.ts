import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class MiningService {
  private readonly logger = new Logger(MiningService.name);

  constructor(
    private prisma: PrismaService,
    private assetsService: AssetsService,
  ) {}

  // ============================================
  // COLLEGE LIST MANAGEMENT
  // ============================================

  async addCollege(userId: string, tokenId: string) {
    // Validate token exists and is a minable college coin
    const token = await this.prisma.client.token.findUnique({
      where: { id: tokenId },
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    if (!token.isCollegeCoin || !token.miningAllowed) {
      throw new BadRequestException(
        'This token is not available for mining',
      );
    }

    // Check max 10 colleges
    const currentCount = await this.prisma.client.userMiningCollege.count({
      where: { userId },
    });

    if (currentCount >= 10) {
      throw new BadRequestException(
        'You can add a maximum of 10 colleges to your mining list',
      );
    }

    // Check if already added
    const existing = await this.prisma.client.userMiningCollege.findUnique({
      where: {
        userId_tokenId: { userId, tokenId },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'This college is already in your mining list',
      );
    }

    const entry = await this.prisma.client.userMiningCollege.create({
      data: { userId, tokenId },
      include: { token: true },
    });

    return entry;
  }

  async removeCollege(userId: string, tokenId: string) {
    // Check if there is an active mining session for this college
    const activeSession = await this.prisma.client.miningSession.findFirst({
      where: {
        userId,
        tokenId,
        isActive: true,
      },
    });

    if (activeSession) {
      throw new BadRequestException(
        'Stop mining for this college before removing it from your list',
      );
    }

    const entry = await this.prisma.client.userMiningCollege.findUnique({
      where: {
        userId_tokenId: { userId, tokenId },
      },
    });

    if (!entry) {
      throw new NotFoundException(
        'This college is not in your mining list',
      );
    }

    await this.prisma.client.userMiningCollege.delete({
      where: { id: entry.id },
    });

    return { success: true };
  }

  async getUserColleges(userId: string) {
    const colleges = await this.prisma.client.userMiningCollege.findMany({
      where: { userId },
      include: { token: true },
      orderBy: { addedAt: 'desc' },
    });

    return colleges;
  }

  // ============================================
  // MINING SESSION MANAGEMENT
  // ============================================

  async startMining(userId: string, tokenId: string) {
    // Auto-stop any expired sessions first
    await this.stopExpiredSessions(userId);

    // Validate token exists in user's mining list
    const miningCollege =
      await this.prisma.client.userMiningCollege.findUnique({
        where: {
          userId_tokenId: { userId, tokenId },
        },
        include: { token: true },
      });

    if (!miningCollege) {
      throw new BadRequestException(
        'You must add this college to your mining list first',
      );
    }

    const token = miningCollege.token;

    if (!token.miningAllowed) {
      throw new BadRequestException(
        'Mining is not allowed for this token',
      );
    }

    // Check if already mining this token (active AND unexpired)
    const now = new Date();
    const existingSession =
      await this.prisma.client.miningSession.findFirst({
        where: {
          userId,
          tokenId,
          isActive: true,
          endTime: { gt: now },
        },
      });

    if (existingSession) {
      throw new BadRequestException(
        'You are already mining for this college',
      );
    }

    // Earning rate = flat base rate from token (no referral bonuses on Exchange)
    const earningRate = token.miningBaseRate;
    const sessionHours = token.miningSessionHours || 24;

    const startTime = new Date();
    const endTime = new Date(
      startTime.getTime() + sessionHours * 60 * 60 * 1000,
    );

    const session = await this.prisma.client.miningSession.create({
      data: {
        userId,
        tokenId,
        startTime,
        endTime,
        earningRate,
        isActive: true,
        status: 'ACTIVE',
      },
      include: { token: true },
    });

    this.logger.log(
      `Mining started: user=${userId} token=${token.symbol} rate=${earningRate}/h duration=${sessionHours}h`,
    );

    return session;
  }

  async stopMining(userId: string, tokenId: string) {
    const session = await this.prisma.client.miningSession.findFirst({
      where: {
        userId,
        tokenId,
        isActive: true,
      },
      include: { token: true },
    });

    if (!session) {
      throw new NotFoundException(
        'No active mining session found for this college',
      );
    }

    // Verify session belongs to the user
    if (session.userId !== userId) {
      throw new BadRequestException('Session does not belong to you');
    }

    const now = new Date();
    const elapsedMs = now.getTime() - session.startTime.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const totalSessionHours =
      (session.endTime.getTime() - session.startTime.getTime()) /
      (1000 * 60 * 60);

    // tokensEarned = min(elapsed_hours, total_hours) * earningRate
    const effectiveHours = Math.min(elapsedHours, totalSessionHours);
    const tokensEarned = effectiveHours * session.earningRate;

    // Mark session inactive
    const updated = await this.prisma.client.miningSession.updateMany({
      where: {
        id: session.id,
        isActive: true,
      },
      data: {
        isActive: false,
        tokensEarned,
        stoppedAt: now,
        status: 'COMPLETED',
      },
    });

    if (updated.count === 0) {
      throw new BadRequestException('Session was already stopped');
    }

    // Credit tokens to user's CryptoBalance via AssetsService
    if (tokensEarned > 0) {
      await this.assetsService.updateBalanceAfterTrade(
        userId,
        session.token.symbol,
        tokensEarned,
      );
    }

    // Update mining profile total
    await this.prisma.client.userMiningProfile.upsert({
      where: { userId },
      create: {
        userId,
        totalTokensMined: tokensEarned,
      },
      update: {
        totalTokensMined: { increment: tokensEarned },
      },
    });

    this.logger.log(
      `Mining stopped: user=${userId} token=${session.token.symbol} earned=${tokensEarned.toFixed(4)} elapsed=${effectiveHours.toFixed(2)}h`,
    );

    return {
      session: { ...session, isActive: false, tokensEarned, stoppedAt: now },
      tokensEarned,
      elapsedHours: effectiveHours,
    };
  }

  async stopAllMining(userId: string) {
    const activeSessions = await this.prisma.client.miningSession.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: { token: true },
    });

    if (activeSessions.length === 0) {
      throw new BadRequestException('No active mining sessions found');
    }

    const now = new Date();
    const results: Array<{
      tokenId: string;
      symbol: string;
      tokensEarned: number;
    }> = [];

    for (const session of activeSessions) {
      const elapsedMs = now.getTime() - session.startTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const totalSessionHours =
        (session.endTime.getTime() - session.startTime.getTime()) /
        (1000 * 60 * 60);
      const effectiveHours = Math.min(elapsedHours, totalSessionHours);
      const tokensEarned = effectiveHours * session.earningRate;

      const updated = await this.prisma.client.miningSession.updateMany({
        where: {
          id: session.id,
          isActive: true,
        },
        data: {
          isActive: false,
          tokensEarned,
          stoppedAt: now,
          status: 'COMPLETED',
        },
      });

      if (updated.count === 0) continue;

      if (tokensEarned > 0) {
        await this.assetsService.updateBalanceAfterTrade(
          userId,
          session.token.symbol,
          tokensEarned,
        );
      }

      // Update mining profile
      await this.prisma.client.userMiningProfile.upsert({
        where: { userId },
        create: {
          userId,
          totalTokensMined: tokensEarned,
        },
        update: {
          totalTokensMined: { increment: tokensEarned },
        },
      });

      results.push({
        tokenId: session.tokenId,
        symbol: session.token.symbol,
        tokensEarned,
      });
    }

    this.logger.log(
      `Stop all mining: user=${userId} stopped=${results.length} sessions`,
    );

    return {
      stoppedCount: results.length,
      results,
    };
  }

  async startAllMining(userId: string) {
    // Auto-stop any expired sessions first
    await this.stopExpiredSessions(userId);

    const miningColleges =
      await this.prisma.client.userMiningCollege.findMany({
        where: { userId },
        include: { token: true },
      });

    if (miningColleges.length === 0) {
      throw new BadRequestException('No mining colleges found');
    }

    const now = new Date();
    let startedCount = 0;
    const results: Array<{
      tokenId: string;
      symbol: string;
      status: string;
    }> = [];

    for (const mc of miningColleges) {
      const token = mc.token;

      if (!token.miningAllowed) {
        results.push({
          tokenId: token.id,
          symbol: token.symbol,
          status: 'mining_disabled',
        });
        continue;
      }

      // Check if already mining
      const existingSession =
        await this.prisma.client.miningSession.findFirst({
          where: {
            userId,
            tokenId: token.id,
            isActive: true,
            endTime: { gt: now },
          },
        });

      if (existingSession) {
        results.push({
          tokenId: token.id,
          symbol: token.symbol,
          status: 'already_active',
        });
        continue;
      }

      const earningRate = token.miningBaseRate;
      const sessionHours = token.miningSessionHours || 24;
      const startTime = new Date();
      const endTime = new Date(
        startTime.getTime() + sessionHours * 60 * 60 * 1000,
      );

      await this.prisma.client.miningSession.create({
        data: {
          userId,
          tokenId: token.id,
          startTime,
          endTime,
          earningRate,
          isActive: true,
          status: 'ACTIVE',
        },
      });

      startedCount++;
      results.push({
        tokenId: token.id,
        symbol: token.symbol,
        status: 'started',
      });
    }

    this.logger.log(
      `Start all mining: user=${userId} started=${startedCount}`,
    );

    return { startedCount, results };
  }

  async getMiningStatus(userId: string) {
    const now = new Date();

    // Get user's mining colleges
    const miningColleges =
      await this.prisma.client.userMiningCollege.findMany({
        where: { userId },
        include: { token: true },
      });

    // Get all active sessions
    const activeSessions =
      await this.prisma.client.miningSession.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: { token: true },
      });

    // Calculate current tokens for each active session
    const sessionsWithProgress = activeSessions.map((session) => {
      const elapsedMs = now.getTime() - session.startTime.getTime();
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      const totalSessionHours =
        (session.endTime.getTime() - session.startTime.getTime()) /
        (1000 * 60 * 60);
      const effectiveHours = Math.min(elapsedHours, totalSessionHours);
      const currentTokens = Math.max(0, effectiveHours * session.earningRate);
      const remainingMs = session.endTime.getTime() - now.getTime();
      const remainingHours = Math.max(0, remainingMs / (1000 * 60 * 60));

      return {
        sessionId: session.id,
        tokenId: session.tokenId,
        symbol: session.token.symbol,
        name: session.token.name,
        iconUrl: session.token.iconUrl,
        startTime: session.startTime,
        endTime: session.endTime,
        earningRate: session.earningRate,
        currentTokens,
        remainingHours,
        isExpired: remainingHours <= 0,
      };
    });

    // Get balances for mined tokens
    const balances = await this.assetsService.getUserBalances(userId);
    const miningBalances = miningColleges.map((mc) => {
      const balance = balances.find((b) => b.asset === mc.token.symbol);
      return {
        tokenId: mc.token.id,
        symbol: mc.token.symbol,
        name: mc.token.name,
        iconUrl: mc.token.iconUrl,
        balance: balance?.balance || 0,
        availableBalance: balance?.availableBalance || 0,
      };
    });

    return {
      miningColleges: miningColleges.map((mc) => ({
        id: mc.id,
        tokenId: mc.token.id,
        symbol: mc.token.symbol,
        name: mc.token.name,
        collegeName: mc.token.collegeName,
        iconUrl: mc.token.iconUrl,
        collegeLogo: mc.token.collegeLogo,
        miningBaseRate: mc.token.miningBaseRate,
        miningSessionHours: mc.token.miningSessionHours,
        miningAllowed: mc.token.miningAllowed,
        collegeCountry: mc.token.collegeCountry,
        addedAt: mc.addedAt,
      })),
      activeSessions: sessionsWithProgress,
      balances: miningBalances,
    };
  }

  // ============================================
  // EXPIRED SESSION MANAGEMENT
  // ============================================

  async stopExpiredSessions(userId?: string) {
    const now = new Date();
    const whereClause: any = {
      isActive: true,
      endTime: { lte: now },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const expiredSessions =
      await this.prisma.client.miningSession.findMany({
        where: whereClause,
        include: { token: true },
      });

    let stoppedCount = 0;

    for (const session of expiredSessions) {
      const totalSessionHours =
        (session.endTime.getTime() - session.startTime.getTime()) /
        (1000 * 60 * 60);
      const tokensEarned = totalSessionHours * session.earningRate;

      // Atomically mark inactive
      const updated = await this.prisma.client.miningSession.updateMany({
        where: {
          id: session.id,
          isActive: true,
        },
        data: {
          isActive: false,
          tokensEarned,
          status: 'EXPIRED',
        },
      });

      if (updated.count === 0) continue;

      // Credit tokens
      if (tokensEarned > 0) {
        await this.assetsService.updateBalanceAfterTrade(
          session.userId,
          session.token.symbol,
          tokensEarned,
        );
      }

      // Update mining profile
      await this.prisma.client.userMiningProfile.upsert({
        where: { userId: session.userId },
        create: {
          userId: session.userId,
          totalTokensMined: tokensEarned,
        },
        update: {
          totalTokensMined: { increment: tokensEarned },
        },
      });

      stoppedCount++;
    }

    if (stoppedCount > 0) {
      this.logger.log(
        `Stopped ${stoppedCount} expired mining sessions${userId ? ` for user ${userId}` : ''}`,
      );
    }

    return stoppedCount;
  }
}
