import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SnapshotCronService } from './snapshot.cron.service';
import { PrismaService } from '../../prisma.service';
import { CoinbaseModule } from '../coinbase/coinbase.module';
import { CollegeCoinsModule } from '../college-coins/college-coins.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoinbaseModule,
    CollegeCoinsModule,
  ],
  providers: [SnapshotCronService, PrismaService],
})
export class CronModule {}
