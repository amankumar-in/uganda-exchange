import { Module } from '@nestjs/common';
import { MiningController } from './mining.controller';
import { MiningService } from './mining.service';
import { MiningCronService } from './mining-cron.service';
import { MiningGateway } from './mining.gateway';
import { PrismaService } from '../../prisma.service';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AssetsModule],
  controllers: [MiningController],
  providers: [MiningService, MiningCronService, MiningGateway, PrismaService],
  exports: [MiningService],
})
export class MiningModule {}
