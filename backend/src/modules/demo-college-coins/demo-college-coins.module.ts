import { Module } from '@nestjs/common';
import { DemoCollegeCoinsService } from './demo-college-coins.service';
import { DemoCollegeCoinsController } from './demo-college-coins.controller';
import { PrismaService } from '../../prisma.service';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [TokensModule],
  controllers: [DemoCollegeCoinsController],
  providers: [DemoCollegeCoinsService, PrismaService],
  exports: [DemoCollegeCoinsService],
})
export class DemoCollegeCoinsModule {}
