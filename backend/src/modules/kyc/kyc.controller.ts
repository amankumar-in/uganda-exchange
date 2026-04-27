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
import { Throttle, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  KycService,
  KYC_UPLOADS_DIR,
  isJpegOrPngMagic,
  getImageDimensions,
  SELFIE_MIN_DIMENSION,
} from './kyc.service';
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
@UseGuards(ThrottlerGuard)
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
  // dto is bound to enforce class-validator on the body but its content is not
  // read — saveConsent only needs the userId.
  async saveConsent(
    @Request() req: AuthRequest,
    @Body() dto: ConsentDto,
  ): Promise<{ message: string; currentStep: number }> {
    void dto;
    return this.kyc.saveConsent(req.user.id);
  }

  // 5 attempts per 10 minutes per IP. PAN verify burns Sandbox credits and is
  // a brute-force surface (attacker iterating PANs against a name+DOB pair).
  @Post('pan/verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(600) } })
  async verifyPan(@Request() req: AuthRequest, @Body() dto: PanVerifyDto) {
    return this.kyc.verifyPan(req.user.id, dto);
  }

  // 3 OTP requests per 10 minutes. Each burns a credit and counts against
  // UIDAI's own per-Aadhaar throttle.
  @Post('aadhaar/otp/request')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: seconds(600) } })
  async aadhaarRequestOtp(
    @Request() req: AuthRequest,
    @Body() dto: AadhaarRequestOtpDto,
  ) {
    return this.kyc.aadhaarRequestOtp(req.user.id, dto);
  }

  // 5 verify attempts per 10 minutes. UIDAI rate-limits independently; this is
  // the local guard against scripted OTP brute-force.
  @Post('aadhaar/otp/verify')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(600) } })
  async aadhaarVerifyOtp(
    @Request() req: AuthRequest,
    @Body() dto: AadhaarVerifyOtpDto,
  ) {
    return this.kyc.aadhaarVerifyOtp(req.user.id, dto);
  }

  // Surgical clear: drop only aadhaarRefId + expiry. Lets a user with an
  // expired ref-id request a new OTP without losing PAN/consent state.
  @Post('aadhaar/refid/clear')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(600) } })
  async clearAadhaarRefId(@Request() req: AuthRequest) {
    return this.kyc.clearAadhaarRefId(req.user.id);
  }

  @Post('address')
  @UseGuards(JwtAuthGuard)
  async confirmAddress(
    @Request() req: AuthRequest,
    @Body() dto: AddressConfirmDto,
  ) {
    return this.kyc.confirmAddress(req.user.id, dto);
  }

  // 5 selfie uploads per hour. Without this a single user could fill the
  // disk one 5 MB upload at a time.
  @Post('selfie')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(3600) } })
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: diskStorage({
        destination: KYC_UPLOADS_DIR,
        filename: (_req, file, cb) => {
          // Crypto-strength random name. Predictable selfie-${userId}-${ts}
          // pattern would let anyone discovering the URL pattern brute-force
          // other users' selfies.
          const ext = (
            extname(file.originalname || '.jpg').toLowerCase() || '.jpg'
          ).replace(/[^.a-z0-9]/g, '');
          cb(null, `selfie-${randomBytes(16).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: MAX_SELFIE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_SELFIE_MIME.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Only JPG, PNG, or WebP images are allowed',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadSelfie(
    @Request() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No selfie file uploaded');
    }

    // Magic-byte verification: client-supplied MIME is not trusted.
    let buf: Buffer;
    try {
      buf = await fs.readFile(join(KYC_UPLOADS_DIR, file.filename));
    } catch {
      throw new BadRequestException('Could not read uploaded file');
    }

    if (!isJpegOrPngMagic(buf)) {
      await fs
        .unlink(join(KYC_UPLOADS_DIR, file.filename))
        .catch(() => undefined);
      throw new BadRequestException(
        'Uploaded file is not a valid JPG, PNG, or WebP image',
      );
    }

    const dims = getImageDimensions(buf);
    if (!dims) {
      await fs
        .unlink(join(KYC_UPLOADS_DIR, file.filename))
        .catch(() => undefined);
      throw new BadRequestException('Could not read image dimensions');
    }
    if (
      dims.width < SELFIE_MIN_DIMENSION ||
      dims.height < SELFIE_MIN_DIMENSION
    ) {
      await fs
        .unlink(join(KYC_UPLOADS_DIR, file.filename))
        .catch(() => undefined);
      throw new BadRequestException(
        `Selfie too small (${dims.width}×${dims.height}). Please use a clearer photo.`,
      );
    }

    // NOTE: A full selfie ↔ Aadhaar-photo face match would be the real check.
    // That requires a face-recognition service (Rekognition / face-api.js
    // server-side / Sandbox's own face-match endpoint when available). The
    // dimension + magic-byte gates above are the minimum viable defense
    // against blank/non-photo uploads. TODO: integrate face-match before live.

    return this.kyc.uploadSelfie(req.user.id, file);
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: seconds(3600) } })
  async reset(@Request() req: AuthRequest) {
    return this.kyc.resetForRetry(req.user.id);
  }
}
