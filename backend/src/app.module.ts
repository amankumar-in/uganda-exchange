import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { EmailService } from './email.service';
import { TestController } from './test.controller';
import { AuthModule } from './modules/auth/auth.module';
import { KycModule } from './modules/kyc/kyc.module';
import { CoinbaseModule } from './modules/coinbase/coinbase.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AssetsModule } from './modules/assets/assets.module';
import { FiatModule } from './modules/fiat/fiat.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { CoinGeckoModule } from './modules/coingecko/coingecko.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LearnerModule } from './modules/learner/learner.module';
import { CollegeCoinsModule } from './modules/college-coins/college-coins.module';
import { AdminModule } from './modules/admin/admin.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { P2PModule } from './modules/p2p/p2p.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { CronModule } from './modules/cron/cron.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '900'), // 15 minutes
      limit: parseInt(process.env.RATE_LIMIT_MAX || '5'),
    }]),
    // Auth module
    AuthModule,
    // KYC / Onboarding module
    KycModule,
    // Coinbase trading module
    CoinbaseModule,
    // Internal orders module
    OrdersModule,
    // Assets/Balances module
    AssetsModule,
    // Fiat operations module
    FiatModule,
    // Watchlist module
    WatchlistModule,
    // CoinGecko token data module
    CoinGeckoModule,
    // User settings module
    SettingsModule,
    // Learner mode (virtual trading) module
    LearnerModule,
    // Demo college coins module
    CollegeCoinsModule,
    // Admin panel module
    AdminModule,
    // Public file serving for uploads
    UploadsModule,
    // P2P OTC marketplace module
    P2PModule,
    TokensModule,
    // Cron jobs
    CronModule,
  ],
  controllers: [AppController, TestController],
  providers: [AppService, PrismaService, EmailService],
})
export class AppModule {}
