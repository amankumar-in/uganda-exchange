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
    const { applyToExisting, ...settingsData } = dto;

    const settings = await this.prisma.client.globalAssetSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...settingsData },
      update: settingsData,
    });

    if (applyToExisting) {
      const tokenUpdate: Record<string, any> = {};
      if (settingsData.defaultAllowBuy !== undefined) tokenUpdate.allowBuy = settingsData.defaultAllowBuy;
      if (settingsData.defaultAllowSell !== undefined) tokenUpdate.allowSell = settingsData.defaultAllowSell;
      if (settingsData.defaultAllowP2P !== undefined) tokenUpdate.allowP2P = settingsData.defaultAllowP2P;
      if (settingsData.defaultAllowDeposit !== undefined) tokenUpdate.allowDeposit = settingsData.defaultAllowDeposit;
      if (settingsData.defaultAllowWithdraw !== undefined) tokenUpdate.allowWithdraw = settingsData.defaultAllowWithdraw;
      if (settingsData.defaultAllowTradeUsd !== undefined) tokenUpdate.allowTradeUsd = settingsData.defaultAllowTradeUsd;
      if (settingsData.defaultAllowTradeUsdt !== undefined) tokenUpdate.allowTradeUsdt = settingsData.defaultAllowTradeUsdt;
      if (settingsData.defaultAllowTradeEth !== undefined) tokenUpdate.allowTradeEth = settingsData.defaultAllowTradeEth;
      if (settingsData.defaultAllowTradeTuit !== undefined) tokenUpdate.allowTradeTuit = settingsData.defaultAllowTradeTuit;
      if (settingsData.defaultMinTransaction !== undefined) tokenUpdate.minTransactionAmount = Number(settingsData.defaultMinTransaction);
      if (settingsData.defaultMaxTransaction !== undefined) tokenUpdate.maxTransactionAmount = Number(settingsData.defaultMaxTransaction);
      if (settingsData.defaultMiningBaseRate !== undefined) tokenUpdate.miningBaseRate = settingsData.defaultMiningBaseRate;
      if (settingsData.defaultMiningSessionHours !== undefined) tokenUpdate.miningSessionHours = settingsData.defaultMiningSessionHours;

      if (Object.keys(tokenUpdate).length > 0) {
        const result = await this.prisma.client.token.updateMany({ data: tokenUpdate });
        this.logger.log(`Global settings applied to ${result.count} existing tokens`);
      }
    }

    this.logger.log('Global asset settings updated');
    return settings;
  }
}
