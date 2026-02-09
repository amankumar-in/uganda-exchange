import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateGlobalSettingsDto } from './dto/update-global-settings.dto';

@Injectable()
export class GlobalSettingsService {
  private readonly logger = new Logger(GlobalSettingsService.name);

  constructor(private prisma: PrismaService) {}

  async getSettings() {
    // Upsert to ensure the singleton row always exists
    return this.prisma.client.globalAssetSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    });
  }

  async updateSettings(dto: UpdateGlobalSettingsDto) {
    const settings = await this.prisma.client.globalAssetSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...dto },
      update: dto,
    });

    this.logger.log('Global asset settings updated');
    return settings;
  }
}
