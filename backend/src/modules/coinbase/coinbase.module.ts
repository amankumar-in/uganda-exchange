import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoinbaseService } from './coinbase.service';
import { CoinbaseController } from './coinbase.controller';
import { PriceCacheService } from './price-cache.service';
import { CoinbaseGateway } from './coinbase.gateway';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [ConfigModule, TokensModule],
  controllers: [CoinbaseController],
  providers: [CoinbaseService, PriceCacheService, CoinbaseGateway],
  exports: [CoinbaseService, PriceCacheService],
})
export class CoinbaseModule {}

