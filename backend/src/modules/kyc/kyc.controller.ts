import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Headers,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KycService } from './kyc.service';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { AddressDto } from './dto/address.dto';

interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller('onboarding')
export class KycController {
  constructor(private kycService: KycService) {}

  /**
   * Get current KYC status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Request() req: AuthRequest) {
    return this.kycService.getKycStatus(req.user.id);
  }

  /**
   * Get full KYC details
   */
  @Get('details')
  @UseGuards(JwtAuthGuard)
  async getDetails(@Request() req: AuthRequest) {
    return this.kycService.getKycDetails(req.user.id);
  }

  /**
   * Save personal details (Step 1)
   */
  @Post('personal')
  @UseGuards(JwtAuthGuard)
  async savePersonalDetails(
    @Request() req: AuthRequest,
    @Body() dto: PersonalDetailsDto,
  ) {
    return this.kycService.savePersonalDetails(req.user.id, dto);
  }

  /**
   * Save address (Step 2)
   */
  @Post('address')
  @UseGuards(JwtAuthGuard)
  async saveAddress(@Request() req: AuthRequest, @Body() dto: AddressDto) {
    return this.kycService.saveAddress(req.user.id, dto);
  }

  /**
   * Create Veriff session (Step 3)
   */
  @Post('veriff/session')
  @UseGuards(JwtAuthGuard)
  async createVeriffSession(@Request() req: AuthRequest) {
    return this.kycService.createVeriffSession(req.user.id);
  }

  /**
   * Check Veriff decision (polling fallback)
   */
  @Get('veriff/decision')
  @UseGuards(JwtAuthGuard)
  async checkVeriffDecision(@Request() req: AuthRequest) {
    return this.kycService.checkVeriffDecision(req.user.id);
  }

  /**
   * Veriff webhook handler
   * Note: This endpoint should NOT have auth guard - Veriff calls it
   */
  @Post('veriff/webhook')
  async handleVeriffWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hmac-signature') signature: string,
    @Body() payload: unknown,
  ) {
    // Raw body is required for HMAC signature verification
    const rawBodyBuffer = req.rawBody as Buffer;

    if (!rawBodyBuffer) {
      console.error('[Veriff Webhook] Missing raw body - signature verification will fail');
      console.error('[Veriff Webhook] req.rawBody type:', typeof req.rawBody);
      console.error('[Veriff Webhook] Headers:', JSON.stringify(req.headers, null, 2));
      throw new Error('Missing raw body for webhook signature verification');
    }

    const rawBody = rawBodyBuffer.toString('utf8');
    console.log(`[Veriff Webhook] Received webhook, signature: ${signature?.substring(0, 16)}...`);

    return this.kycService.handleVeriffWebhook(payload, signature, rawBody);
  }
}

