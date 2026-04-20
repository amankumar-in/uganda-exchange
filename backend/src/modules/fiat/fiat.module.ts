import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FiatController } from './fiat.controller';
import { FiatService } from './fiat.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [FiatController],
  providers: [FiatService, PrismaService],
  exports: [FiatService],
})
export class FiatModule {}
