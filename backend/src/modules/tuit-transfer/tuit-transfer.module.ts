import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TuitTransferController } from './tuit-transfer.controller';
import { TuitTransferService } from './tuit-transfer.service';
import { TuitContractService } from './tuit-contract.service';
import { PrismaService } from '../../prisma.service';
import { OtpService } from '../auth/otp.service';
import { EmailService } from '../../email.service';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [ConfigModule, AssetsModule],
  controllers: [TuitTransferController],
  providers: [
    TuitTransferService,
    TuitContractService,
    PrismaService,
    OtpService,
    EmailService,
  ],
  exports: [TuitTransferService, TuitContractService],
})
export class TuitTransferModule {}
