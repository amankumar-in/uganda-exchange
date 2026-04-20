import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FiatService } from './fiat.service';

@Controller('fiat')
@UseGuards(JwtAuthGuard)
export class FiatController {
  private readonly logger = new Logger(FiatController.name);

  constructor(private readonly fiatService: FiatService) {}

  /**
   * POST /fiat/deposit
   * Create a Razorpay order for an INR deposit.
   */
  @Post('deposit')
  async createDeposit(
    @Request() req: any,
    @Body() body: { amount: number },
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.fiatService.createDepositOrder(userId, Number(body.amount));
  }

  /**
   * POST /fiat/deposit/verify
   * Verify the Razorpay signature and credit the INR balance.
   */
  @Post('deposit/verify')
  async verifyDeposit(
    @Request() req: any,
    @Body()
    body: {
      orderId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    },
  ) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return this.fiatService.verifyDeposit(userId, body);
  }

  /**
   * GET /fiat/deposits
   * List the authenticated user's deposit transactions.
   */
  @Get('deposits')
  async getDeposits(@Request() req: any, @Query('limit') limit?: string) {
    const userId = req.user.userId || req.user.id || req.user.sub;
    return {
      deposits: await this.fiatService.getUserDeposits(userId, limit ? parseInt(limit) : 50),
    };
  }
}
