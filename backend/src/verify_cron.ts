
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SnapshotCronService } from './modules/cron/snapshot.cron.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const cronService = app.get(SnapshotCronService);
  const logger = new Logger('VerifyCron');

  try {
    logger.log('Manually triggering midnight snapshot job...');
    await cronService.handleMidnightSnapshots();
    logger.log('Job completed successfully.');
  } catch (error) {
    logger.error('Job failed', error);
  } finally {
    await app.close();
  }
}

bootstrap();
