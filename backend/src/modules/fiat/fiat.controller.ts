import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FiatService } from './fiat.service';

@Controller('fiat')
export class FiatController {
  private readonly logger = new Logger(FiatController.name);

  constructor(private readonly fiatService: FiatService) {}

  /**
   * POST /fiat/deposit
   * Create a Pesapal payment order for a UGX deposit.
   * Returns redirectUrl — frontend sends user there to complete payment.
   */
  @Post('deposit')
  @UseGuards(JwtAuthGuard)
  async createDeposit(
    @Request() req: any,
    @Body() body: { amount: number },
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    const userEmail = req.user.email;
    return this.fiatService.createDepositOrder(userId, Number(body.amount), userEmail);
  }

  /**
   * POST /fiat/dummy-deposit
   * Bypass external gateways to test deposits directly.
   */
  @Post('dummy-deposit')
  @UseGuards(JwtAuthGuard)
  async dummyDeposit(
    @Request() req: any,
    @Body() body: { amount: number, method?: string },
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.fiatService.dummyDeposit(userId, Number(body.amount), body.method);
  }

  /**
   * GET /fiat/deposit/status/:orderId
   * Poll for deposit status after returning from Pesapal callback.
   */
  @Get('deposit/status/:orderId')
  @UseGuards(JwtAuthGuard)
  async getDepositStatus(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.fiatService.getDepositStatus(userId, orderId);
  }

  /**
   * POST /fiat/ipn
   * Public endpoint — Pesapal IPN notification handler.
   * No JWT guard; Pesapal calls this server-to-server.
   */
  @Post('ipn')
  async handleIpn(@Body() body: any) {
    this.logger.log(`IPN received: ${JSON.stringify(body)}`);
    return this.fiatService.handleIpn(body);
  }

  /**
   * GET /fiat/deposits
   * List the authenticated user's deposit history.
   */
  @Get('deposits')
  @UseGuards(JwtAuthGuard)
  async getDeposits(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return {
      deposits: await this.fiatService.getUserDeposits(userId, limit ? parseInt(limit) : 50),
    };
  }
}
