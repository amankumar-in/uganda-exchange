import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { BridgeSecretGuard } from './bridge.guard';
import { PrismaService } from '../../prisma.service';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [BridgeController],
  providers: [BridgeService, BridgeSecretGuard, PrismaService],
  exports: [BridgeService],
})
export class BridgeModule {}
