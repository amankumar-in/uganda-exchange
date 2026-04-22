import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KycService, KYC_UPLOADS_DIR } from './kyc.service';
import { ConsentDto } from './dto/consent.dto';
import { PanVerifyDto } from './dto/pan-verify.dto';
import { AadhaarRequestOtpDto } from './dto/aadhaar-request-otp.dto';
import { AadhaarVerifyOtpDto } from './dto/aadhaar-verify-otp.dto';
import { AddressConfirmDto } from './dto/address-confirm.dto';

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

const ALLOWED_SELFIE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SELFIE_BYTES = 5 * 1024 * 1024; // 5 MB

@Controller('onboarding')
export class KycController {
  constructor(private kyc: KycService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Request() req: AuthRequest) {
    return this.kyc.getKycStatus(req.user.id);
  }

  @Get('details')
  @UseGuards(JwtAuthGuard)
  async getDetails(@Request() req: AuthRequest) {
    return this.kyc.getKycDetails(req.user.id);
  }

  @Post('consent')
  @UseGuards(JwtAuthGuard)
  async saveConsent(@Request() req: AuthRequest, @Body() _dto: ConsentDto) {
    return this.kyc.saveConsent(req.user.id);
  }

  @Post('pan/verify')
  @UseGuards(JwtAuthGuard)
  async verifyPan(@Request() req: AuthRequest, @Body() dto: PanVerifyDto) {
    return this.kyc.verifyPan(req.user.id, dto);
  }

  @Post('aadhaar/otp/request')
  @UseGuards(JwtAuthGuard)
  async aadhaarRequestOtp(@Request() req: AuthRequest, @Body() dto: AadhaarRequestOtpDto) {
    return this.kyc.aadhaarRequestOtp(req.user.id, dto);
  }

  @Post('aadhaar/otp/verify')
  @UseGuards(JwtAuthGuard)
  async aadhaarVerifyOtp(@Request() req: AuthRequest, @Body() dto: AadhaarVerifyOtpDto) {
    return this.kyc.aadhaarVerifyOtp(req.user.id, dto);
  }

  @Post('address')
  @UseGuards(JwtAuthGuard)
  async confirmAddress(@Request() req: AuthRequest, @Body() dto: AddressConfirmDto) {
    return this.kyc.confirmAddress(req.user.id, dto);
  }

  @Post('selfie')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: diskStorage({
        destination: KYC_UPLOADS_DIR,
        filename: (req, file, cb) => {
          const userId = (req as unknown as AuthRequest).user?.id || 'unknown';
          const ext = extname(file.originalname || '.jpg').toLowerCase() || '.jpg';
          cb(null, `selfie-${userId}-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SELFIE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_SELFIE_MIME.includes(file.mimetype)) {
          cb(new BadRequestException('Only JPG, PNG, or WebP images are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadSelfie(@Request() req: AuthRequest, @UploadedFile() file: Express.Multer.File) {
    return this.kyc.uploadSelfie(req.user.id, file);
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard)
  async reset(@Request() req: AuthRequest) {
    return this.kyc.resetForRetry(req.user.id);
  }
}
