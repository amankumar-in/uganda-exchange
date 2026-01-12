import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { PublicOrdersController } from './public-orders.controller';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma.service';
import { CoinbaseModule } from '../coinbase/coinbase.module';
import { AssetsModule } from '../assets/assets.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [CoinbaseModule, AssetsModule, TokensModule],
  controllers: [OrdersController, PublicOrdersController],
  providers: [OrdersService, PrismaService],
  exports: [OrdersService],
})
export class OrdersModule {}
