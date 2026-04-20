import { Module } from '@nestjs/common';
import { PriceCacheService } from './price-cache.service';
import { CoinbaseGateway } from './coinbase.gateway';
import { PrismaService } from '../../prisma.service';

/**
 * Keeps the WebSocket price gateway + CoinGecko-driven price cache.
 * Former Coinbase trade/orderbook/candle plumbing has been removed — pricing
 * comes from CoinGecko via PriceCacheService, and order execution is handled
 * entirely inside OrdersModule against the internal ledger.
 */
@Module({
  providers: [PriceCacheService, CoinbaseGateway, PrismaService],
  exports: [PriceCacheService],
})
export class CoinbaseModule {}
