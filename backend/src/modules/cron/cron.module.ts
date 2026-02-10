import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SnapshotCronService } from './snapshot.cron.service';
import { PrismaService } from '../../prisma.service';
import { CoinbaseModule } from '../coinbase/coinbase.module';
import { DemoCollegeCoinsModule } from '../demo-college-coins/demo-college-coins.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CoinbaseModule,
    DemoCollegeCoinsModule,
  ],
  providers: [SnapshotCronService, PrismaService],
})
export class CronModule {}
