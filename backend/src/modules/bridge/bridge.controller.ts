import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BridgeService } from './bridge.service';
import { BridgeSecretGuard } from './bridge.guard';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

@Controller('bridge')
export class BridgeController {
  constructor(
    private readonly bridgeService: BridgeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * User-facing: CFC redirects users here to authorize linking.
   * Redirects to the Exchange frontend authorize page.
   * No guard needed -- this is a browser redirect, not an API call.
   */
  @Get('authorize')
  authorize(
    @Query('state') state: string,
    @Query('callback') callback: string,
    @Query('cfcEmail') cfcEmail: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    let authorizePageUrl = `${frontendUrl}/bridge/authorize?state=${encodeURIComponent(state)}&callback=${encodeURIComponent(callback)}`;
    if (cfcEmail) {
      authorizePageUrl += `&cfcEmail=${encodeURIComponent(cfcEmail)}`;
    }
    return res.redirect(authorizePageUrl);
  }

  /**
   * User-facing: Exchange frontend calls this after user approves linking.
   * Protected by JwtAuthGuard -- user must be logged into Exchange.
   * Returns a base64-encoded auth code with userId+email+expiry.
   */
  @Post('generate-code')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async generateCode(@Req() req: any, @Body() body: { state: string }) {
    const code = await this.bridgeService.generateAuthCode(req.user.id, req.user.email, body.state);
    return { success: true, data: { code } };
  }

  @Post('exchange-code')
  @UseGuards(BridgeSecretGuard)
  @HttpCode(200)
  async exchangeCode(@Body() body: { code: string; state: string }) {
    const data = await this.bridgeService.exchangeCode(body.code, body.state);
    return { success: true, data };
  }

  @Post('revoke')
  @UseGuards(BridgeSecretGuard)
  @HttpCode(200)
  async revoke(@Body() body: { cfcUserId: string }) {
    const data = await this.bridgeService.revokeLink(body.cfcUserId);
    return { success: true, data };
  }

  @Post('migrate')
  @UseGuards(BridgeSecretGuard)
  @HttpCode(200)
  async migrate(
    @Body()
    body: {
      cfcUserId: string;
      wallets: Array<{
        cfcWalletId: string;
        collegeCfcId: string;
        tokenSymbol: string;
        amount: number;
      }>;
    },
  ) {
    const data = await this.bridgeService.migrateBalances(
      body.cfcUserId,
      body.wallets,
    );
    return { success: true, data };
  }

  @Get('check-link/:cfcUserId')
  @UseGuards(BridgeSecretGuard)
  async checkLink(@Param('cfcUserId') cfcUserId: string) {
    const data = await this.bridgeService.checkLink(cfcUserId);
    return { success: true, data };
  }

  @Post('colleges/import')
  @UseGuards(BridgeSecretGuard)
  @HttpCode(200)
  async importColleges() {
    const data = await this.bridgeService.importCollegesFromCfc();
    return { success: true, data };
  }

  @Post('colleges/sync')
  @UseGuards(BridgeSecretGuard)
  @HttpCode(200)
  async syncCollege(
    @Body()
    body: {
      college: {
        _id: string;
        name: string;
        shortName: string;
        country: string;
        logo: string | null;
        ticker: string;
        tokenName: string;
        preferredIcon: string | null;
        baseRate: number;
        status: string;
        stats: {
          totalMiners: number;
          activeMiners: number;
          totalTokensMined: number;
        };
      };
    },
  ) {
    const data = await this.bridgeService.syncCollege(body.college);
    return { success: true, data };
  }
}
