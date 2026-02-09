import { Module } from '@nestjs/common';
import { GlobalSettingsService } from './global-settings.service';
import { GlobalSettingsController } from './global-settings.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [GlobalSettingsService, PrismaService],
  controllers: [GlobalSettingsController],
  exports: [GlobalSettingsService],
})
export class GlobalSettingsModule {}
