import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { PrismaService } from '../../prisma.service';

@Module({
  providers: [TokensService, PrismaService],
  controllers: [TokensController],
  exports: [TokensService],
})
export class TokensModule {}
