import { Module, forwardRef } from '@nestjs/common';
import { LearnerController } from './learner.controller';
import { LearnerService } from './learner.service';
import { PrismaService } from '../../prisma.service';
import { CoinbaseModule } from '../coinbase/coinbase.module';
import { CollegeCoinsModule } from '../college-coins/college-coins.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [CoinbaseModule, forwardRef(() => CollegeCoinsModule), TokensModule],
  controllers: [LearnerController],
  providers: [LearnerService, PrismaService],
  exports: [LearnerService],
})
export class LearnerModule {}


