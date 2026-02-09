import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { PrismaService } from '../../prisma.service';
import { GlobalSettingsModule } from '../global-settings/global-settings.module';

@Module({
  imports: [GlobalSettingsModule],
  providers: [TokensService, PrismaService],
  controllers: [TokensController],
  exports: [TokensService],
})
export class TokensModule {}
