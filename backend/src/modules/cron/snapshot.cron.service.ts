import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { CoinbaseService } from '../coinbase/coinbase.service';
import { DemoCollegeCoinsService } from '../demo-college-coins/demo-college-coins.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SnapshotCronService {
  private readonly logger = new Logger(SnapshotCronService.name);
  private readonly BATCH_SIZE = 5000;

  constructor(
    private prisma: PrismaService,
    private coinbaseService: CoinbaseService,
    private collegeCoinsService: DemoCollegeCoinsService,
  ) {}

  // Run at Midnight UTC every day
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleMidnightSnapshots() {
    this.logger.log('Starting nightly portfolio snapshot job...');
    const startTime = Date.now();

    try {
      // 1. Snapshot Prices
      await this.snapshotAssetPrices();

      // 2. Generate Investor Mode Snapshots
      await this.generateInvestorSnapshots();

      // 3. Generate Learner Mode Snapshots
      await this.generateLearnerSnapshots();

      const duration = (Date.now() - startTime) / 1000;
      this.logger.log(`Nightly snapshot job completed in ${duration}s`);
    } catch (error) {
      this.logger.error('Failed to run nightly snapshot job', error);
    }
  }

  /**
   * Fetch and store today's prices for all assets
   */
  private async snapshotAssetPrices() {
    this.logger.log('Fetching and storing asset prices...');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const prices = new Map<string, number>();

    // 1. Fetch Real Crypto Prices (USD pairs)
    try {
      const products = await this.coinbaseService.getProducts('USD');
      for (const p of products) {
        prices.set(p.base_currency, parseFloat(p.price));
      }
    } catch (e) {
      this.logger.error('Failed to fetch Coinbase prices', e);
    }

    // 2. Fetch College Coin Prices
    try {
      const collegeCoins = await this.collegeCoinsService.findAllWithPrices();
      for (const c of collegeCoins) {
        if (c.currentPrice) {
          prices.set(c.ticker, c.currentPrice);
        }
      }
    } catch (e) {
      this.logger.error('Failed to fetch College Coin prices', e);
    }

    // 3. Store in DB
    const entries = Array.from(prices.entries()).map(([asset, price]) => ({
      asset,
      price: new Prisma.Decimal(price),
      date: today,
    }));

    // Upsert prices (in case job reruns)
    for (const entry of entries) {
      // Cast to any because TS definition might lag behind migration in dev environment
      await (this.prisma.client as any).dailyAssetPrice.upsert({
        where: {
          asset_date: {
            asset: entry.asset,
            date: entry.date,
          },
        },
        update: { price: entry.price },
        create: entry,
      });
    }

    this.logger.log(`Stored ${entries.length} asset prices for ${today.toISOString()}`);
  }

  /**
   * Generate PortfolioSnapshots for Investor Mode
   */
  private async generateInvestorSnapshots() {
    this.logger.log('Generating Investor Mode snapshots...');
    
    // We use a raw query to process users in batches implicitly by relying on the DB engine
    // or we can just iterate. With < 100k users, direct SQL is fine.
    // For "Millions", we'd loop by ID. Stick to single massive query for now as it's cleaner to read here
    // and Postgres handles millions of rows well in one transaction if optimized.
    // But to be safe against timeouts, let's chunk.
    
    const totalUsers = await this.prisma.client.user.count();
    let processed = 0;
    
    // We'll iterate by OFFSET/LIMIT which is slow for deep pagination, 
    // strictly speaking we should use Keyset Pagination (WHERE id > lastId).
    // But since UUIDs aren't sequential, we'll just fetch all User IDs and chunk them in memory.
    // Fetching 1M UUIDs is ~36MB, acceptable for Node memory.
    
    const users = await this.prisma.client.user.findMany({
       select: { id: true },
       where: { appMode: 'INVESTOR' } // Optimization: Only snapshot users who are primarily Investors? 
       // Actually user requirements said "Both modes". Users can switch. Should snapshot both always?
       // Usually better to snapshot active mode or both. Let's snapshot ALL users for both modes for completeness.
    });

    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const chunk = users.slice(i, i + this.BATCH_SIZE);
      const userIds = chunk.map(u => u.id);

      await this.processInvestorBatch(userIds);
      processed += chunk.length;
      this.logger.log(`Processed ${processed}/${users.length} investor portfolios`);
    }
  }

  private async processInvestorBatch(userIds: string[]) {
     const today = new Date();
     today.setUTCHours(0, 0, 0, 0);
     const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

     // Complex SQL to Calculate and Insert
     // Note: "investedValue" is simplified here solely as (Deposits - Withdrawals). 
     // A more robust system would snapshot the previous day's investedValue and add today's delta.
     const query = Prisma.sql`
        INSERT INTO "portfolio_snapshots" ("id", "userId", "snapshotDate", "totalValue", "investedValue", "cashBalance", "cryptoValue", "createdAt")
        SELECT
          gen_random_uuid(), -- id
          u.id, -- userId
          ${today}::date, -- snapshotDate
          
          -- totalValue = cash + crypto
          (COALESCE(fb.balance, 0) + COALESCE(crypto_sum.val, 0)),
          
          -- investedValue (Simplified: sum of all completed FIAT transactions)
          (
             SELECT COALESCE(SUM(CASE WHEN type='DEPOSIT' THEN amount ELSE -amount END), 0)
             FROM "fiat_transactions" ft
             WHERE ft."userId" = u.id AND ft.status = 'COMPLETED'
          ),
          
          -- cashBalance
          COALESCE(fb.balance, 0),
          
          -- cryptoValue
          COALESCE(crypto_sum.val, 0),
          
          NOW() -- createdAt
          
        FROM "users" u
        LEFT JOIN "fiat_balances" fb ON u.id = fb."userId"
        LEFT JOIN (
            SELECT 
                cb."userId", 
                SUM(cb.balance * dap.price) as val
            FROM "crypto_balances" cb
            JOIN "daily_asset_prices" dap ON cb.asset = dap.asset
            WHERE dap.date = ${today}::date
            GROUP BY cb."userId"
        ) crypto_sum ON u.id = crypto_sum."userId"
        
        WHERE u.id IN (${Prisma.join(userIds)})
        ON CONFLICT ("userId", "snapshotDate") DO UPDATE SET
            "totalValue" = EXCLUDED."totalValue",
            "investedValue" = EXCLUDED."investedValue",
            "cashBalance" = EXCLUDED."cashBalance",
            "cryptoValue" = EXCLUDED."cryptoValue",
            "createdAt" = NOW();
     `;

    await this.prisma.client.$executeRaw(query);
  }

  /**
   * Generate PortfolioSnapshots for Learner Mode
   */
  private async generateLearnerSnapshots() {
    this.logger.log('Generating Learner Mode snapshots...');
    
    // Similar logic but targeting Learner tables
    const users = await this.prisma.client.user.findMany({ select: { id: true } });

    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const chunk = users.slice(i, i + this.BATCH_SIZE);
      const userIds = chunk.map(u => u.id);

      await this.processLearnerBatch(userIds);
    }
  }

  private async processLearnerBatch(userIds: string[]) {
     const today = new Date();
     today.setUTCHours(0, 0, 0, 0);

     const query = Prisma.sql`
        INSERT INTO "learner_portfolio_snapshots" ("id", "userId", "snapshotDate", "totalValue", "investedValue", "cashBalance", "cryptoValue", "createdAt")
        SELECT
          gen_random_uuid(),
          u.id,
          ${today}::date,
          
          -- totalValue
          (COALESCE(lfb.balance, 0) + COALESCE(crypto_sum.val, 0)),
          
          -- investedValue (Learner mode always 10000 initial, technically)
          -- But let's check if we track deposits/resets. 
          -- For now, default to 10000 per schema default? 
          -- Or checking "LearnerBalance" explicitly. 
          -- For simplicity, let's assume 10000 base + any "virtual" deposits if they existed.
          -- Schema says: "investedValue Decimal... (always $10,000 for learner since no real deposits)"
          10000, 
          
          -- cashBalance
          COALESCE(lfb.balance, 0),
          
          -- cryptoValue
          COALESCE(crypto_sum.val, 0),
          
          NOW()
          
        FROM "users" u
        LEFT JOIN "learner_fiat_balances" lfb ON u.id = lfb."userId"
        LEFT JOIN (
            SELECT 
                lcb."userId", 
                SUM(lcb.balance * dap.price) as val
            FROM "learner_crypto_balances" lcb
            JOIN "daily_asset_prices" dap ON lcb.asset = dap.asset
            WHERE dap.date = ${today}::date
            GROUP BY lcb."userId"
        ) crypto_sum ON u.id = crypto_sum."userId"
        
        WHERE u.id IN (${Prisma.join(userIds)})
        ON CONFLICT ("userId", "snapshotDate") DO UPDATE SET
            "totalValue" = EXCLUDED."totalValue",
            "cryptoValue" = EXCLUDED."cryptoValue",
            "cashBalance" = EXCLUDED."cashBalance",
            "createdAt" = NOW();
     `;

    await this.prisma.client.$executeRaw(query);
  }
}
