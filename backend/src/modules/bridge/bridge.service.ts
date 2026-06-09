import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { AssetsService } from '../assets/assets.service';
import * as crypto from 'crypto';

interface CfcCollegeData {
  _id: string;
  name: string;
  shortName: string;
  country: string;
  logo: string | null;
  ticker: string;
  tokenName: string;
  preferredIcon: string | null;
  baseRate: number;
  status: string;
  stats: {
    totalMiners: number;
    activeMiners: number;
    totalTokensMined: number;
  };
}

@Injectable()
export class BridgeService {
  private readonly logger = new Logger(BridgeService.name);

  constructor(
    private prisma: PrismaService,
    private assetsService: AssetsService,
    private configService: ConfigService,
  ) {}

  /**
   * Find CfcLink by cfcUserId. Falls back to looking up by userId (exchangeUserId)
   * if cfcUserId is actually an Exchange user ID (for backwards compat with CFC).
   */
  private async findLinkByCfcUserId(cfcUserId: string) {
    // First try exact match on cfcUserId
    let link = await this.prisma.client.cfcLink.findUnique({
      where: { cfcUserId },
    });

    if (!link) {
      // Fallback: CFC might be sending exchangeUserId (our userId)
      link = await this.prisma.client.cfcLink.findUnique({
        where: { userId: cfcUserId },
      });
    }

    return link;
  }

  /**
   * Generate a short-lived auth code for the bridge OAuth flow.
   * Called by the Exchange frontend after user approves linking.
   * Returns a base64-encoded JSON payload: { userId, email, state, exp }
   */
  async generateAuthCode(userId: string, email: string, state: string): Promise<string> {
    const payload = {
      userId,
      email,
      state,
      exp: Date.now() + 5 * 60 * 1000, // 5 minutes
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Exchange an auth code for a link record.
   * CFC calls this after the user authorizes on Exchange.
   * Code is a base64-encoded JSON payload: { userId, email, exp }
   */
  async exchangeCode(code: string, state: string) {
    let payload: { userId: string; email: string; exp: number };
    try {
      const decoded = Buffer.from(code, 'base64').toString('utf-8');
      payload = JSON.parse(decoded);
    } catch {
      throw new BadRequestException('Invalid auth code format');
    }

    if (!payload.userId || !payload.email) {
      throw new BadRequestException('Auth code missing required fields');
    }

    if (payload.exp && payload.exp < Date.now()) {
      throw new BadRequestException('Auth code has expired');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new NotFoundException('Exchange user not found');
    }

    const bridgeToken = crypto.randomBytes(32).toString('hex');
    const bridgeTokenHash = crypto
      .createHash('sha256')
      .update(bridgeToken)
      .digest('hex');

    const existingLink = await this.prisma.client.cfcLink.findUnique({
      where: { userId: payload.userId },
    });

    if (existingLink && existingLink.status === 'ACTIVE') {
      throw new ConflictException(
        'This Exchange user is already linked to a CFC account',
      );
    }

    // CFC doesn't send its userId during exchange-code.
    // Use state token as temporary cfcUserId (unique per linking attempt).
    // CFC will update this when it calls register-cfc-user or we update
    // it on the first revoke/migrate/sync call.
    const tempCfcUserId = `pending_${state.substring(0, 32)}`;

    if (existingLink) {
      await this.prisma.client.cfcLink.update({
        where: { userId: payload.userId },
        data: {
          cfcUserId: tempCfcUserId,
          cfcEmail: '',
          bridgeToken,
          bridgeTokenHash,
          status: 'ACTIVE',
          linkedAt: new Date(),
          revokedAt: null,
        },
      });
    } else {
      await this.prisma.client.cfcLink.create({
        data: {
          userId: payload.userId,
          cfcUserId: tempCfcUserId,
          cfcEmail: '',
          bridgeToken,
          bridgeTokenHash,
          status: 'ACTIVE',
          linkedAt: new Date(),
        },
      });
    }

    this.logger.log(
      `CFC link created for Exchange user ${payload.userId}`,
    );

    return {
      exchangeUserId: payload.userId,
      email: user.email,
    };
  }

  /**
   * Revoke a CFC link. Called by CFC when the user unlinks.
   */
  async revokeLink(cfcUserId: string) {
    const link = await this.findLinkByCfcUserId(cfcUserId);

    if (!link) {
      throw new NotFoundException('No link found for this CFC user');
    }

    if (link.status === 'REVOKED') {
      throw new BadRequestException('Link is already revoked');
    }

    await this.prisma.client.cfcLink.update({
      where: { id: link.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    this.logger.log(
      `CFC link revoked for Exchange user ${link.userId} (cfcUserId: ${cfcUserId})`,
    );

    return { success: true };
  }

  /**
   * Migrate wallet balances from CFC to Exchange.
   * For each wallet, create a MigrationRecord (cfcWalletId as idempotency key)
   * and credit the CryptoBalance via AssetsService.
   */
  async migrateBalances(
    cfcUserId: string,
    wallets: Array<{
      cfcWalletId: string;
      collegeCfcId: string;
      tokenSymbol: string;
      amount: number;
    }>,
  ) {
    const link = await this.findLinkByCfcUserId(cfcUserId);

    if (!link) {
      throw new NotFoundException('No link found for this CFC user');
    }

    if (link.status !== 'ACTIVE') {
      throw new BadRequestException('CFC link is not active');
    }

    const exchangeUserId = link.userId;
    let migratedCount = 0;
    const transactionId = crypto.randomUUID();

    for (const wallet of wallets) {
      // Idempotency: skip if cfcWalletId already migrated
      const existing = await this.prisma.client.migrationRecord.findUnique({
        where: { cfcWalletId: wallet.cfcWalletId },
      });

      if (existing) {
        this.logger.warn(
          `Skipping duplicate migration for cfcWalletId: ${wallet.cfcWalletId}`,
        );
        if (existing.status === 'COMPLETED') {
          migratedCount++;
        }
        continue;
      }

      try {
        // Look up the Exchange token by collegeCfcId to get the correct symbol
        const token = await this.prisma.client.token.findFirst({
          where: { collegeCfcId: wallet.collegeCfcId },
        });

        if (!token) {
          this.logger.warn(
            `No Exchange token found for collegeCfcId ${wallet.collegeCfcId} (CFC symbol: ${wallet.tokenSymbol}). Skipping.`,
          );
          continue;
        }

        const resolvedSymbol = token.symbol;

        await this.prisma.client.migrationRecord.create({
          data: {
            userId: exchangeUserId,
            cfcWalletId: wallet.cfcWalletId,
            collegeCfcId: wallet.collegeCfcId,
            tokenSymbol: resolvedSymbol,
            amount: wallet.amount,
            status: 'PENDING',
          },
        });

        await this.assetsService.updateBalanceAfterTrade(
          exchangeUserId,
          resolvedSymbol,
          wallet.amount,
        );

        // Add college to user's mining list
        await this.prisma.client.userMiningCollege.upsert({
          where: {
            userId_tokenId: { userId: exchangeUserId, tokenId: token.id },
          },
          create: { userId: exchangeUserId, tokenId: token.id },
          update: {},
        });

        await this.prisma.client.migrationRecord.update({
          where: { cfcWalletId: wallet.cfcWalletId },
          data: { status: 'COMPLETED' },
        });

        migratedCount++;
        this.logger.log(
          `Migrated ${wallet.amount} ${wallet.tokenSymbol} for user ${exchangeUserId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to migrate cfcWalletId ${wallet.cfcWalletId}: ${error.message}`,
        );

        await this.prisma.client.migrationRecord
          .update({
            where: { cfcWalletId: wallet.cfcWalletId },
            data: {
              status: 'FAILED',
              errorMessage: error.message,
            },
          })
          .catch(() => {});
      }
    }

    this.logger.log(
      `Migration complete: ${migratedCount}/${wallets.length} wallets (txId: ${transactionId})`,
    );

    return { transactionId, migratedCount };
  }

  /**
   * Check the link status for a given CFC user ID.
   */
  async checkLink(cfcUserId: string) {
    const link = await this.findLinkByCfcUserId(cfcUserId);

    if (!link) {
      return { active: false, linked: false };
    }

    return {
      active: link.status === 'ACTIVE',
      linked: true,
      status: link.status,
      linkedAt: link.linkedAt,
      exchangeUserId: link.userId,
    };
  }

  // ============================================
  // COLLEGE IMPORT / SYNC
  // ============================================

  /**
   * Resolve a unique token symbol. If the base symbol is taken, append an
   * incrementing number until a free one is found.
   */
  private async resolveUniqueSymbol(baseSymbol: string): Promise<string> {
    let symbol = baseSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!symbol || symbol.length < 2) symbol = 'COIN';

    // Truncate long symbols to 10 chars max
    symbol = symbol.substring(0, 10);

    const existing = await this.prisma.client.token.findUnique({
      where: { symbol },
    });
    if (!existing) return symbol;

    for (let i = 2; i < 100000; i++) {
      const candidate = `${symbol.substring(0, 8)}${i}`;
      const check = await this.prisma.client.token.findUnique({
        where: { symbol: candidate },
      });
      if (!check) return candidate;
    }

    throw new Error(`Could not resolve unique symbol for base "${baseSymbol}"`);
  }

  /**
   * Derive a short symbol from a college name.
   * Takes uppercase initials of significant words (skips "of", "the", "and", etc.)
   */
  private deriveSymbolFromName(name: string): string {
    const skipWords = new Set(['of', 'the', 'and', 'for', 'in', 'at', 'a', 'an']);
    const words = name.split(/[\s\-\/]+/).filter(w => !skipWords.has(w.toLowerCase()));
    if (words.length === 0) return 'COIN';

    // Take first letter of each significant word, up to 6 chars
    let abbr = words
      .map(w => w.charAt(0))
      .join('')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 6);

    if (abbr.length < 2) {
      // Fallback: take first 4 chars of first word
      abbr = words[0].substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    }

    return abbr || 'COIN';
  }

  /**
   * Upsert a single college as a Token entry.
   * Returns { status: 'created' | 'updated' | 'skipped', symbol }.
   */
  private async upsertCollegeToken(
    college: CfcCollegeData,
  ): Promise<{ status: 'created' | 'updated'; symbol: string }> {
    const cfcId = college._id;

    // Check if token with this collegeCfcId already exists
    const existingToken = await this.prisma.client.token.findFirst({
      where: { collegeCfcId: cfcId },
    });

    if (existingToken) {
      // Update existing token with latest CFC data
      await this.prisma.client.token.update({
        where: { id: existingToken.id },
        data: {
          name: college.name,
          collegeCountry: college.country || null,
          collegeLogo: college.logo || null,
          collegeName: college.name,
          miningBaseRate: college.baseRate ?? 0.25,
          iconUrl: college.preferredIcon || existingToken.iconUrl,
        },
      });

      return { status: 'updated', symbol: existingToken.symbol };
    }

    // Create new token -- prefer ticker, then shortName, then derive from full name
    const rawTicker = college.ticker || college.shortName || this.deriveSymbolFromName(college.name);
    const symbol = await this.resolveUniqueSymbol(rawTicker);

    await this.prisma.client.token.create({
      data: {
        symbol,
        name: college.name,
        iconUrl: college.preferredIcon || null,
        isNative: true,
        isCollegeCoin: true,
        miningAllowed: true,
        collegeCfcId: cfcId,
        collegeName: college.name,
        collegeCountry: college.country || null,
        collegeLogo: college.logo || null,
        miningBaseRate: college.baseRate ?? 0.25,
        miningSessionHours: 24,
        allowBuy: false,
        allowSell: false,
        allowTradeUsdt: false,
        allowTradeUgx: false,
        allowTradeEth: false,
        allowTradeTuit: false,
        allowDeposit: false,
        allowWithdraw: false,
        allowP2P: false,
        isActive: true,
      },
    });

    return { status: 'created', symbol };
  }

  /**
   * Bulk import all colleges from CFC via HTTP API.
   * Calls GET /api/bridge/colleges on the CFC server.
   */
  async importCollegesFromCfc() {
    const cfcApiUrl = this.configService.get<string>('CFC_API_URL');
    const bridgeSecret = this.configService.get<string>('BRIDGE_SECRET');

    if (!cfcApiUrl) {
      throw new BadRequestException('CFC_API_URL is not configured');
    }

    if (!bridgeSecret) {
      throw new BadRequestException('BRIDGE_SECRET is not configured');
    }

    // Fetch colleges from CFC
    const response = await fetch(`${cfcApiUrl}/api/bridge/colleges`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Secret': bridgeSecret,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException(
        `Failed to fetch colleges from CFC: ${response.status} ${errorBody}`,
      );
    }

    const body = await response.json();
    const colleges: CfcCollegeData[] = body.data;

    if (!colleges || !Array.isArray(colleges)) {
      throw new BadRequestException('Invalid response from CFC colleges endpoint');
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const results: Array<{
      cfcId: string;
      name: string;
      symbol: string;
      status: string;
      error?: string;
    }> = [];

    for (const college of colleges) {
      try {
        const result = await this.upsertCollegeToken(college);
        if (result.status === 'created') created++;
        else updated++;

        results.push({
          cfcId: college._id,
          name: college.name,
          symbol: result.symbol,
          status: result.status,
        });

        this.logger.log(
          `[${result.status.toUpperCase()}] ${college.name} -> ${result.symbol} (CFC: ${college._id})`,
        );
      } catch (error) {
        failed++;
        results.push({
          cfcId: college._id,
          name: college.name,
          symbol: '',
          status: 'failed',
          error: error.message,
        });
        this.logger.error(
          `[FAILED] ${college.name} (CFC: ${college._id}): ${error.message}`,
        );
      }
    }

    this.logger.log(
      `College import complete: ${created} created, ${updated} updated, ${failed} failed out of ${colleges.length}`,
    );

    return {
      total: colleges.length,
      created,
      updated,
      failed,
      results,
    };
  }

  /**
   * Sync a single college from CFC (webhook-style).
   * Creates or updates the Token entry for the given college data.
   */
  async syncCollege(college: CfcCollegeData) {
    if (!college._id || !college.name) {
      throw new BadRequestException('College data must include _id and name');
    }

    const result = await this.upsertCollegeToken(college);

    this.logger.log(
      `College synced: ${college.name} -> ${result.symbol} (${result.status})`,
    );

    return {
      cfcId: college._id,
      name: college.name,
      symbol: result.symbol,
      status: result.status,
    };
  }
}
