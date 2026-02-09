import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { GlobalSettingsService } from './global-settings.service';
import { UpdateGlobalSettingsDto } from './dto/update-global-settings.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';

@Controller('api/admin/global-settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class GlobalSettingsController {
  constructor(private readonly globalSettingsService: GlobalSettingsService) {}

  @Get()
  async getSettings() {
    return this.globalSettingsService.getSettings();
  }

  @Patch()
  async updateSettings(@Body() dto: UpdateGlobalSettingsDto) {
    return this.globalSettingsService.updateSettings(dto);
  }
}
