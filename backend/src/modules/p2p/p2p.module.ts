import { Module } from '@nestjs/common';
import { P2PController } from './p2p.controller';
import { P2PService } from './p2p.service';
import { PrismaService } from '../../prisma.service';
import { KycVerifiedGuard } from './kyc.guard';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [TokensModule],
  controllers: [P2PController],
  providers: [P2PService, PrismaService, KycVerifiedGuard],
  exports: [P2PService],
})
export class P2PModule {}

