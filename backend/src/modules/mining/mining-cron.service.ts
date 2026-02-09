import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MiningService } from './mining.service';

@Injectable()
export class MiningCronService {
  private readonly logger = new Logger(MiningCronService.name);

  constructor(private miningService: MiningService) {}

  // Run every 5 minutes to stop expired sessions
  @Cron('*/5 * * * *')
  async handleExpiredSessions() {
    this.logger.log('Running expired mining sessions check...');
    try {
      const stoppedCount =
        await this.miningService.stopExpiredSessions();
      if (stoppedCount > 0) {
        this.logger.log(
          `Auto-stopped ${stoppedCount} expired mining sessions`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to stop expired sessions', error);
    }
  }
}
