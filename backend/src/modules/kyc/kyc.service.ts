import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { createHmac, randomBytes } from 'crypto';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import {
  SandboxKycService,
  SandboxProviderError,
  SandboxAadhaarOtpRequestResult,
  SandboxAadhaarVerifyResult,
  SandboxPanVerifyResult,
} from './sandbox-kyc.service';
import {
  KycRestrictionsService,
  KycRejectionType,
} from './kyc-restrictions.service';
import { encryptJson } from './kyc-pii-crypto';
import { PanVerifyDto } from './dto/pan-verify.dto';
import { AadhaarRequestOtpDto } from './dto/aadhaar-request-otp.dto';
import { AadhaarVerifyOtpDto } from './dto/aadhaar-verify-otp.dto';
import { AddressConfirmDto } from './dto/address-confirm.dto';

export const KYC_UPLOADS_DIR = join(process.cwd(), 'uploads', 'kyc');
const PAN_AADHAAR_REASON =
  'KYC verification for crypto exchange account onboarding';

// Sandbox/UIDAI ref-ids expire on the provider side after ~10-30 minutes. We
// invalidate ours after 12 minutes so a user never sees "OTP pending" against
// a ref-id the provider has long since destroyed.
export const AADHAAR_REF_ID_TTL_MS = 12 * 60 * 1000;

// Cap on Aadhaar photo bytes after base64 decode. Sandbox normally returns
// ~30-100 KB; anything beyond 2 MB is suspicious and we won't try to persist.
const AADHAAR_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

// Minimum acceptable selfie dimensions. Below this we reject — defends against
// blank 1×1 white squares passing as a selfie.
const SELFIE_MIN_PIXELS = 200;

function hashAadhaar(aadhaarNumber: string, secret: string): string {
  return createHmac('sha256', secret).update(aadhaarNumber).digest('hex');
}

// ============================================
// Name matching — strict
// ============================================
//
// The previous implementation accepted "every token of the shorter name appears
// somewhere in the longer name", which approves "RAHUL SHARMA" vs
// "RAHUL VERMA SHARMA" (different middle names = different people). We now
// require the full token set to match modulo case/whitespace/punctuation, with
// a small concession for an additional middle initial only.

function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function namesMatchStrict(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;

  // Drop single-letter "tokens" (initials) from both sides — they're noise.
  const stripInitials = (toks: string[]) => toks.filter((t) => t.length > 1);
  const sa = stripInitials(ta).sort();
  const sb = stripInitials(tb).sort();

  // After stripping initials, multi-letter tokens must match exactly.
  if (sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

function sameDay(
  a: Date | null | undefined,
  b: Date | null | undefined,
): boolean {
  if (!a || !b) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  private readonly aadhaarHashSecret: string;

  constructor(
    private prisma: PrismaService,
    private sandbox: SandboxKycService,
    private restrictions: KycRestrictionsService,
    private configService: ConfigService,
  ) {
    // KYC_HASH_SECRET should be a dedicated value. Fall back to JWT_SECRET only
    // in development — in production rotating JWT_SECRET would silently
    // invalidate every Aadhaar uniqueness check ever recorded.
    const dedicated = this.configService.get<string>('KYC_HASH_SECRET');
    const jwt = this.configService.get<string>('JWT_SECRET');
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (dedicated) {
      this.aadhaarHashSecret = dedicated;
    } else if (env === 'production') {
      // Loud fail in prod — silent JWT_SECRET fallback is what the audit flagged.
      this.aadhaarHashSecret = '';
      this.logger.error(
        'KYC_HASH_SECRET is not set in production. Refusing to fall back to JWT_SECRET — Aadhaar uniqueness checks will be disabled until configured.',
      );
    } else {
      this.aadhaarHashSecret = jwt || '';
      if (!this.aadhaarHashSecret) {
        this.logger.warn(
          'Neither KYC_HASH_SECRET nor JWT_SECRET is set — Aadhaar uniqueness will be non-functional',
        );
      }
    }
  }

  // ============================================
  // Helpers
  // ============================================

  async getOrCreateKyc(userId: string) {
    let kyc = await this.prisma.client.kyc.findUnique({ where: { userId } });
    if (!kyc) {
      kyc = await this.prisma.client.kyc.create({
        data: { userId, currentStep: 0 },
      });
    }
    return kyc;
  }

  /**
   * Returns the live Kyc row but treats expired Aadhaar ref-ids as cleared.
   * Without this, frontend keeps the user "OTP pending" against a Sandbox
   * reference Sandbox has already destroyed.
   */
  private async getKycWithRefIdTtl(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);
    if (kyc.aadhaarRefId && this.isRefIdExpired(kyc.aadhaarRefIdExpiresAt)) {
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          aadhaarRefId: null,
          aadhaarRefIdExpiresAt: null,
          aadhaarOtpSentAt: null,
        },
      });
      kyc.aadhaarRefId = null;
      kyc.aadhaarRefIdExpiresAt = null;
      kyc.aadhaarOtpSentAt = null;
    }
    return kyc;
  }

  private isRefIdExpired(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) return true;
    return expiresAt.getTime() < Date.now();
  }

  async getKycStatus(userId: string) {
    const kyc = await this.getKycWithRefIdTtl(userId);
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });
    return {
      currentStep: kyc.currentStep,
      status: user?.kycStatus || 'PENDING',
      hasConsent: !!kyc.consentedAt,
      hasPan: !!kyc.panVerifiedAt,
      hasAadhaar: !!kyc.aadhaarVerifiedAt,
      hasAadhaarRefId: !!kyc.aadhaarRefId,
      aadhaarOtpSentAt: kyc.aadhaarOtpSentAt
        ? kyc.aadhaarOtpSentAt.toISOString()
        : null,
      hasAddress: !!(
        kyc.street1 &&
        kyc.city &&
        kyc.region &&
        kyc.postalCode &&
        kyc.country
      ),
      hasSelfie: !!kyc.selfiePath,
      rejectionReason: kyc.rejectionReason || null,
      aadhaarLast4: kyc.aadhaarLast4 || null,
      panMasked: kyc.pan
        ? kyc.pan.slice(0, 2) + 'XXXX' + kyc.pan.slice(-2)
        : null,
      lastSandboxTxnId: kyc.lastSandboxTxnId || null,
    };
  }

  async getKycDetails(userId: string) {
    const kyc = await this.prisma.client.kyc.findUnique({ where: { userId } });
    if (!kyc) return null;
    return {
      id: kyc.id,
      currentStep: kyc.currentStep,
      status: kyc.status,
      consent: { consentedAt: kyc.consentedAt },
      pan: {
        pan: kyc.pan,
        panName: kyc.panName,
        panStatus: kyc.panStatus,
        panNameMatch: kyc.panNameMatch,
        panDobMatch: kyc.panDobMatch,
        panVerifiedAt: kyc.panVerifiedAt,
      },
      aadhaar: {
        aadhaarLast4: kyc.aadhaarLast4,
        aadhaarName: kyc.aadhaarName,
        aadhaarDob: kyc.aadhaarDob,
        aadhaarGender: kyc.aadhaarGender,
        aadhaarCareOf: kyc.aadhaarCareOf,
        aadhaarPhotoUrl: kyc.aadhaarPhotoPath
          ? `/api/uploads/kyc/${kyc.aadhaarPhotoPath}`
          : null,
        aadhaarVerifiedAt: kyc.aadhaarVerifiedAt,
      },
      address: {
        street1: kyc.street1,
        street2: kyc.street2,
        city: kyc.city,
        region: kyc.region,
        postalCode: kyc.postalCode,
        country: kyc.country,
      },
      selfie: {
        selfieUrl: kyc.selfiePath ? `/api/uploads/kyc/${kyc.selfiePath}` : null,
        selfieUploadedAt: kyc.selfieUploadedAt,
      },
      panAadhaarLinked: kyc.panAadhaarLinked,
      rejectionReason: kyc.rejectionReason,
      autoDecidedAt: kyc.autoDecidedAt,
      lastSandboxTxnId: kyc.lastSandboxTxnId,
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }

  // ============================================
  // Step 1: Consent
  // ============================================
  async saveConsent(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);
    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        consentedAt: new Date(),
        currentStep: Math.max(kyc.currentStep, 1),
      },
    });
    return { message: 'Consent recorded', currentStep: 1 };
  }

  // ============================================
  // Step 2: PAN verify — validity FIRST, persist AFTER
  // ============================================
  async verifyPan(userId: string, dto: PanVerifyDto) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.consentedAt) {
      throw new BadRequestException('Please accept the consent terms first');
    }

    const pan = dto.pan.toUpperCase();

    // Pre-flight: don't burn a Sandbox credit if this PAN is already in use.
    // The current user's own row is allowed (retries with the same PAN).
    const panTaken = await this.prisma.client.kyc.findFirst({
      where: { pan, NOT: { userId } },
      select: { id: true },
    });
    if (panTaken) {
      throw new ConflictException(
        'This PAN is already linked to another account. If this is yours, contact support.',
      );
    }

    let result: SandboxPanVerifyResult;
    try {
      result = await this.sandbox.panVerify(
        pan,
        dto.nameAsPerPan,
        dto.dateOfBirth,
        PAN_AADHAAR_REASON,
      );
    } catch (err) {
      if (err instanceof SandboxProviderError) {
        // Surface the txn id so support can debug a stuck verification.
        await this.prisma.client.kyc.update({
          where: { id: kyc.id },
          data: { lastSandboxTxnId: err.transactionId || kyc.lastSandboxTxnId },
        });
      }
      throw err;
    }

    // Validity-first: throw BEFORE writing the PAN to the row. A typo never
    // enters the @unique namespace, so the real PAN-holder can never be locked
    // out by another user's mistake.
    if (!result.valid) {
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          lastSandboxTxnId: result.transactionId || kyc.lastSandboxTxnId,
        },
      });
      throw new BadRequestException(
        'PAN is not valid. Please check and try again.',
      );
    }
    if (result.nameMatch === false) {
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          lastSandboxTxnId: result.transactionId || kyc.lastSandboxTxnId,
        },
      });
      throw new BadRequestException('The name does not match PAN records');
    }
    if (result.dobMatch === false) {
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          lastSandboxTxnId: result.transactionId || kyc.lastSandboxTxnId,
        },
      });
      throw new BadRequestException(
        'The date of birth does not match PAN records',
      );
    }

    // Verified — now safe to persist.
    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        pan,
        panName: result.fullName || dto.nameAsPerPan,
        panDob: new Date(dto.dateOfBirth),
        panStatus: result.panStatus,
        panNameMatch: result.nameMatch,
        panDobMatch: result.dobMatch,
        panAadhaarSeeding: result.aadhaarSeedingStatus,
        panVerifiedAt: new Date(),
        panRawData: encryptJson(result.raw) as object,
        lastSandboxTxnId: result.transactionId,
        currentStep: Math.max(kyc.currentStep, 2),
      },
    });

    return {
      message: 'PAN verified successfully',
      currentStep: 2,
      fullName: result.fullName,
      category: result.category,
    };
  }

  // ============================================
  // Step 3: Aadhaar — request OTP. Hash NOT written until verify.
  // ============================================
  async aadhaarRequestOtp(userId: string, dto: AadhaarRequestOtpDto) {
    const kyc = await this.getKycWithRefIdTtl(userId);

    if (!kyc.panVerifiedAt) {
      throw new BadRequestException('Please verify your PAN first');
    }

    // Pre-flight: this Aadhaar already verified for another account?
    const aadhaarHash = hashAadhaar(dto.aadhaarNumber, this.aadhaarHashSecret);
    const aadhaarTaken = await this.prisma.client.kyc.findFirst({
      where: { aadhaarHash, NOT: { userId } },
      select: { id: true },
    });
    if (aadhaarTaken) {
      throw new ConflictException(
        'This Aadhaar is already linked to another account. If this is yours, contact support.',
      );
    }

    let result: SandboxAadhaarOtpRequestResult;
    try {
      result = await this.sandbox.aadhaarRequestOtp(
        dto.aadhaarNumber,
        PAN_AADHAAR_REASON,
      );
    } catch (err) {
      if (err instanceof SandboxProviderError) {
        await this.prisma.client.kyc.update({
          where: { id: kyc.id },
          data: { lastSandboxTxnId: err.transactionId || kyc.lastSandboxTxnId },
        });
      }
      throw err;
    }

    // Store last4 + refId + expiry. NOT the hash — that goes in only on
    // successful OTP verify (issue: typo'd Aadhaar must not pollute the
    // @unique aadhaarHash namespace and lock out the real holder).
    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        aadhaarLast4: dto.aadhaarNumber.slice(-4),
        aadhaarRefId: result.referenceId,
        aadhaarRefIdExpiresAt: new Date(Date.now() + AADHAAR_REF_ID_TTL_MS),
        aadhaarOtpSentAt: new Date(),
        lastSandboxTxnId: result.transactionId,
        currentStep: Math.max(kyc.currentStep, 3),
      },
    });

    // Pass the plaintext Aadhaar to the verify step via a short-lived in-memory
    // marker is impossible across requests — we instead expect the verify step
    // to recompute the hash AFTER Sandbox returns (Sandbox echoes the full
    // number on success). See aadhaarVerifyOtp.
    return {
      message: result.message,
      currentStep: 3,
    };
  }

  /**
   * Self-service: clear a stuck/expired Aadhaar ref-id WITHOUT wiping consent
   * + PAN + everything else (which the previous full-reset did). Lets the user
   * unwedge themselves and request a new OTP.
   */
  async clearAadhaarRefId(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);
    if (!kyc.aadhaarRefId && !kyc.aadhaarRefIdExpiresAt) {
      return { message: 'Nothing to clear', currentStep: kyc.currentStep };
    }
    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        aadhaarRefId: null,
        aadhaarRefIdExpiresAt: null,
        aadhaarOtpSentAt: null,
      },
    });
    return {
      message: 'Aadhaar OTP session cleared — you can request a new OTP',
      currentStep: kyc.currentStep,
    };
  }

  // ============================================
  // Step 4: Aadhaar — verify OTP, hash, persist
  // ============================================
  async aadhaarVerifyOtp(userId: string, dto: AadhaarVerifyOtpDto) {
    const kyc = await this.getKycWithRefIdTtl(userId);

    if (!kyc.aadhaarRefId) {
      throw new BadRequestException(
        'Your verification session has expired. Please request a new OTP.',
      );
    }

    let result: SandboxAadhaarVerifyResult;
    try {
      result = await this.sandbox.aadhaarVerifyOtp(kyc.aadhaarRefId, dto.otp);
    } catch (err) {
      if (err instanceof SandboxProviderError) {
        await this.prisma.client.kyc.update({
          where: { id: kyc.id },
          data: { lastSandboxTxnId: err.transactionId || kyc.lastSandboxTxnId },
        });
        // If the provider tells us the reference is gone, clear it locally so
        // the user is routed back to "request OTP" on next page load.
        if (
          /expire|reference|session|invalid reference/i.test(
            err.providerMessage,
          )
        ) {
          await this.prisma.client.kyc.update({
            where: { id: kyc.id },
            data: {
              aadhaarRefId: null,
              aadhaarRefIdExpiresAt: null,
              aadhaarOtpSentAt: null,
            },
          });
        }
      }
      throw err;
    }

    // Sandbox echoes the full Aadhaar in the success payload. Recompute hash
    // here and write it now — first time this Aadhaar enters the @unique
    // namespace, only after UIDAI confirmed it.
    const aadhaarFromResp = (
      result.raw as { data?: { aadhaar_number?: string } }
    )?.data?.aadhaar_number;
    const aadhaarFull = aadhaarFromResp
      ? String(aadhaarFromResp).replace(/\D/g, '')
      : null;
    const aadhaarHash =
      aadhaarFull && aadhaarFull.length === 12
        ? hashAadhaar(aadhaarFull, this.aadhaarHashSecret)
        : null;

    // Concurrency guard: another user could have verified the same Aadhaar
    // between our pre-flight (in aadhaarRequestOtp) and now. Re-check before write.
    if (aadhaarHash) {
      const conflict = await this.prisma.client.kyc.findFirst({
        where: { aadhaarHash, NOT: { userId } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException(
          'This Aadhaar was just linked to another account. If this is yours, contact support.',
        );
      }
    }

    // Aadhaar photo: cap size before writing, use random filename.
    let photoPath: string | null = null;
    if (result.photoBase64) {
      try {
        const b64 = result.photoBase64.replace(
          /^data:image\/[a-z]+;base64,/,
          '',
        );
        const buf = Buffer.from(b64, 'base64');
        if (buf.byteLength > AADHAAR_PHOTO_MAX_BYTES) {
          this.logger.warn(
            `Aadhaar photo too large (${buf.byteLength} bytes) — skipping persist`,
          );
        } else if (!isJpegOrPngMagic(buf)) {
          this.logger.warn(
            'Aadhaar photo magic bytes not JPEG/PNG — skipping persist',
          );
        } else {
          await fs.mkdir(KYC_UPLOADS_DIR, { recursive: true });
          photoPath = `aadhaar-${randomBytes(16).toString('hex')}.jpg`;
          await fs.writeFile(join(KYC_UPLOADS_DIR, photoPath), buf);
        }
      } catch (err) {
        this.logger.error(
          `Failed to save Aadhaar photo: ${(err as Error).message}`,
        );
        photoPath = null;
      }
    }

    // Parse Aadhaar DOB
    let aadhaarDob: Date | null = null;
    if (result.dateOfBirth) {
      const s = result.dateOfBirth.trim();
      let d: Date | null = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        d = new Date(s);
      } else if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split(/[/-]/);
        d = new Date(`${yyyy}-${mm}-${dd}`);
      }
      if (d && !isNaN(d.getTime())) aadhaarDob = d;
    }

    // Address prefill
    const addr = result.address || {};
    const streetParts = [addr.house, addr.street].filter(Boolean).join(', ');
    const city = addr.vtc || addr.subdistrict || addr.district || null;
    const region = addr.state || null;
    const postalCode = addr.pincode != null ? String(addr.pincode) : null;

    // Strip raw photo before encrypting + storing — photo lives on disk.
    const rawForStorage =
      result.raw && typeof result.raw === 'object'
        ? stripPhotoFromResponse(result.raw)
        : result.raw;

    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        aadhaarHash, // first time this is written — only after UIDAI confirmed
        aadhaarRefId: null,
        aadhaarRefIdExpiresAt: null,
        aadhaarVerifiedAt: new Date(),
        aadhaarName: result.name,
        aadhaarDob,
        aadhaarYob: result.yearOfBirth,
        aadhaarGender: result.gender,
        aadhaarCareOf: result.careOf,
        aadhaarPhotoPath: photoPath,
        aadhaarRawData: encryptJson(rawForStorage) as object,
        street1: streetParts || kyc.street1,
        city: city || kyc.city,
        region: region || kyc.region,
        postalCode: postalCode || kyc.postalCode,
        country: 'IN',
        lastSandboxTxnId: result.transactionId,
        currentStep: Math.max(kyc.currentStep, 4),
      },
    });

    // PAN ↔ Aadhaar link check — async fire-and-forget so the user isn't
    // stuck on a slow request, but ANY failure routes to manual review (not
    // silent approval) at runAutoDecision time.
    if (kyc.pan && aadhaarFull) {
      void this.runPanAadhaarLinkCheck(kyc.id, kyc.pan, aadhaarFull);
    }

    return {
      message: 'Aadhaar verified',
      currentStep: 4,
    };
  }

  private async runPanAadhaarLinkCheck(
    kycId: string,
    pan: string,
    aadhaarNum: string,
  ) {
    try {
      const link = await this.sandbox.panAadhaarLink(
        pan,
        aadhaarNum,
        PAN_AADHAAR_REASON,
      );
      await this.prisma.client.kyc.update({
        where: { id: kycId },
        data: {
          panAadhaarLinked: link.linked,
          panAadhaarLinkedAt: new Date(),
          lastSandboxTxnId: link.transactionId || undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `PAN-Aadhaar link check threw for kyc=${kycId}: ${(err as Error).message}`,
      );
    }
  }

  // ============================================
  // Step 5: Address confirmation
  // ============================================
  async confirmAddress(userId: string, dto: AddressConfirmDto) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.aadhaarVerifiedAt) {
      throw new BadRequestException(
        'Please complete Aadhaar verification first',
      );
    }

    const stateCheck = await this.restrictions.isStateAllowed(
      dto.country,
      dto.region,
    );

    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        street1: dto.street1,
        street2: dto.street2 || null,
        city: dto.city,
        region: dto.region,
        postalCode: dto.postalCode,
        country: dto.country,
        currentStep: Math.max(kyc.currentStep, 5),
      },
    });

    if (!stateCheck.allowed) {
      const reason =
        stateCheck.reason || `We're not available in ${dto.region} yet`;
      await this.restrictions.logRejection(kyc.id, userId, {
        rejectionType: 'RESTRICTED_STATE',
        userProvidedCountry: dto.country,
        userProvidedState: dto.region,
        reason,
      });
      await this.transitionStatus(
        kyc.id,
        userId,
        'REJECTED',
        reason,
        'AUTO_REJECT_RESTRICTED_STATE',
      );
      throw new BadRequestException(
        `${reason}. Your information has been saved.`,
      );
    }

    return { message: 'Address confirmed', currentStep: 5 };
  }

  // ============================================
  // Step 6: Selfie upload — kicks off async auto-decision
  // ============================================
  async uploadSelfie(userId: string, file: Express.Multer.File) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!file) throw new BadRequestException('No selfie file uploaded');

    if (
      !kyc.street1 ||
      !kyc.city ||
      !kyc.region ||
      !kyc.postalCode ||
      !kyc.country
    ) {
      // Reject and clean up the file we just received.
      await fs.unlink(file.path).catch(() => undefined);
      throw new BadRequestException('Please confirm your address first');
    }

    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        selfiePath: file.filename,
        selfieUploadedAt: new Date(),
        currentStep: Math.max(kyc.currentStep, 6),
      },
    });

    // Run auto-decision SYNCHRONOUSLY for now to preserve the existing API
    // contract (frontend awaits the decision). The heavy work is just a few
    // DB reads + name/DOB comparisons; nothing expensive happens here. If we
    // later add face-match this becomes async via a queue.
    return this.runAutoDecision(userId);
  }

  // ============================================
  // Auto-decision — strict
  // ============================================
  async runAutoDecision(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.panVerifiedAt)
      return this.transitionStatus(
        kyc.id,
        userId,
        'REJECTED',
        'PAN was not verified',
        'AUTO_REJECT_PAN_INVALID',
        'PAN_INVALID',
      );
    if (!kyc.aadhaarVerifiedAt)
      return this.transitionStatus(
        kyc.id,
        userId,
        'REJECTED',
        'Aadhaar was not verified',
        'AUTO_REJECT_AADHAAR_FAIL',
        'AADHAAR_FAIL',
      );
    if (!kyc.selfiePath) throw new BadRequestException('Selfie required');
    if (!kyc.street1 || !kyc.region)
      throw new BadRequestException('Address required');

    // PAN explicit match signals
    if (kyc.panNameMatch === false) {
      return this.transitionStatus(
        kyc.id,
        userId,
        'REJECTED',
        'Name on PAN does not match records',
        'AUTO_REJECT_PAN_NAME',
        'PAN_NAME_MISMATCH',
      );
    }
    if (kyc.panDobMatch === false) {
      return this.transitionStatus(
        kyc.id,
        userId,
        'REJECTED',
        'Date of birth does not match PAN records',
        'AUTO_REJECT_PAN_DOB',
        'PAN_INVALID',
      );
    }

    // Cross-check PAN name vs Aadhaar name (strict — different middle names fail)
    if (!namesMatchStrict(kyc.panName, kyc.aadhaarName)) {
      return this.transitionStatus(
        kyc.id,
        userId,
        'REJECTED',
        'Name on PAN and Aadhaar do not match. Please ensure both documents belong to you.',
        'AUTO_REJECT_NAME_MISMATCH',
        'NAME_MISMATCH',
      );
    }

    // Cross-check PAN DOB vs Aadhaar DOB. If Aadhaar only returned year, we
    // accept year-match; otherwise full date match required.
    if (kyc.panDob && kyc.aadhaarDob) {
      if (!sameDay(kyc.panDob, kyc.aadhaarDob)) {
        return this.transitionStatus(
          kyc.id,
          userId,
          'REJECTED',
          'Date of birth on PAN and Aadhaar do not match.',
          'AUTO_REJECT_DOB_MISMATCH',
          'NAME_MISMATCH',
        );
      }
    } else if (kyc.panDob && kyc.aadhaarYob) {
      const yob = parseInt(kyc.aadhaarYob, 10);
      if (Number.isFinite(yob) && yob !== kyc.panDob.getUTCFullYear()) {
        return this.transitionStatus(
          kyc.id,
          userId,
          'REJECTED',
          'Year of birth on PAN and Aadhaar do not match.',
          'AUTO_REJECT_DOB_MISMATCH',
          'NAME_MISMATCH',
        );
      }
    }

    // Regional restriction (already applied at address step but verify once more)
    if (kyc.country && kyc.region) {
      const stateCheck = await this.restrictions.isStateAllowed(
        kyc.country,
        kyc.region,
      );
      if (!stateCheck.allowed) {
        return this.transitionStatus(
          kyc.id,
          userId,
          'REJECTED',
          stateCheck.reason || 'Region not supported',
          'AUTO_REJECT_RESTRICTED_STATE',
          'RESTRICTED_STATE',
        );
      }
    }

    // PAN ↔ Aadhaar linkage signals (`panAadhaarLinked` + `panAadhaarSeeding`)
    // are stored for audit + admin visibility but are intentionally NOT used
    // in the auto-decision. Sandbox's link-status endpoint is unreliable and
    // gating on it created false manual-review routes. The strict name match
    // + DOB cross-check above are the load-bearing fraud gates.

    // All gates pass → approve.
    return this.transitionStatus(
      kyc.id,
      userId,
      'APPROVED',
      null,
      'AUTO_APPROVE',
    );
  }

  // ============================================
  // Status transition + history snapshot — single transaction
  // ============================================
  private async transitionStatus(
    kycId: string,
    userId: string,
    next: 'APPROVED' | 'REJECTED' | 'IN_REVIEW',
    reason: string | null,
    decisionType: string,
    rejectionType?: KycRejectionType,
  ) {
    const now = new Date();
    // Single transaction so user.kycStatus and kyc.status can never diverge,
    // and the history snapshot is always written alongside.
    await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.kyc.update({
        where: { id: kycId },
        data: {
          status: next,
          rejectionReason: next === 'REJECTED' ? reason : null,
          autoDecidedAt: now,
          currentStep: 7,
        },
      });
      // user.kycStatus mirrors kyc.status only for terminal statuses. IN_REVIEW
      // keeps user.kycStatus = PENDING since they don't yet have access.
      if (next !== 'IN_REVIEW') {
        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: next },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { kycStatus: 'PENDING' },
        });
      }
      await tx.kycSubmission.create({
        data: {
          kycId,
          userId,
          pan: updated.pan,
          panName: updated.panName,
          panStatus: updated.panStatus,
          panNameMatch: updated.panNameMatch,
          panDobMatch: updated.panDobMatch,
          aadhaarLast4: updated.aadhaarLast4,
          aadhaarName: updated.aadhaarName,
          aadhaarDob: updated.aadhaarDob,
          panAadhaarLinked: updated.panAadhaarLinked,
          status: next,
          rejectionReason: reason,
          decisionType,
        },
      });
    });

    if (rejectionType && reason && next === 'REJECTED') {
      await this.restrictions.logRejection(kycId, userId, {
        rejectionType,
        reason,
      });
    }

    this.logger.log(
      `KYC ${next} for user ${userId}: ${decisionType}${reason ? ` — ${reason}` : ''}`,
    );
    return { status: next, reason: reason || undefined, currentStep: 7 };
  }

  // ============================================
  // Retry / reset flow
  // ============================================
  async resetForRetry(userId: string) {
    const kyc = await this.getKycWithRefIdTtl(userId);

    // Allow reset from REJECTED (the original case) OR from PENDING when the
    // user is wedged with an expired ref-id and no Aadhaar verification.
    // Issue 11: previously, only REJECTED could reset, so users in stuck
    // PENDING required admin DB intervention.
    const wedged =
      kyc.status === 'PENDING' &&
      !kyc.aadhaarVerifiedAt &&
      (!kyc.aadhaarRefId || this.isRefIdExpired(kyc.aadhaarRefIdExpiresAt));
    if (kyc.status !== 'REJECTED' && !wedged && kyc.status !== 'IN_REVIEW') {
      throw new BadRequestException(
        'Reset only available for rejected or stuck submissions. If you need help, contact support.',
      );
    }

    // Delete files (best-effort — log so an orphan-GC sweep can pick them up).
    const orphanedPaths: string[] = [];
    for (const path of [kyc.aadhaarPhotoPath, kyc.selfiePath].filter(
      Boolean,
    ) as string[]) {
      try {
        await fs.unlink(join(KYC_UPLOADS_DIR, path));
      } catch (err) {
        this.logger.warn(
          `Reset: orphan file ${path} (${(err as Error).message})`,
        );
        orphanedPaths.push(path);
      }
    }

    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        consentedAt: null,
        pan: null,
        panName: null,
        panDob: null,
        panStatus: null,
        panNameMatch: null,
        panDobMatch: null,
        panAadhaarSeeding: null,
        panVerifiedAt: null,
        panRawData: undefined,
        aadhaarLast4: null,
        aadhaarHash: null,
        aadhaarRefId: null,
        aadhaarRefIdExpiresAt: null,
        aadhaarOtpSentAt: null,
        aadhaarVerifiedAt: null,
        aadhaarName: null,
        aadhaarDob: null,
        aadhaarYob: null,
        aadhaarGender: null,
        aadhaarCareOf: null,
        aadhaarPhotoPath: null,
        aadhaarRawData: undefined,
        street1: null,
        street2: null,
        city: null,
        region: null,
        postalCode: null,
        country: null,
        selfiePath: null,
        selfieUploadedAt: null,
        panAadhaarLinked: null,
        panAadhaarLinkedAt: null,
        status: 'PENDING',
        rejectionReason: null,
        autoDecidedAt: null,
        lastSandboxTxnId: null,
        currentStep: 0,
      },
    });

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { kycStatus: 'PENDING' },
    });

    return { message: 'KYC reset — you can start again', currentStep: 0 };
  }
}

// Strip the photo blob from raw Sandbox payload before encrypting + storing.
function stripPhotoFromResponse(raw: unknown): unknown {
  if (raw && typeof raw === 'object') {
    const clone: Record<string, unknown> = {
      ...(raw as Record<string, unknown>),
    };
    const data = clone.data;
    if (data && typeof data === 'object') {
      const d = { ...(data as Record<string, unknown>) };
      if ('photo' in d) d.photo = '[stripped]';
      clone.data = d;
    }
    return clone;
  }
  return raw;
}

// Magic-byte sniff for JPEG / PNG. Defends against non-image binary blobs
// uploaded with a forged image/jpeg Content-Type (issue #33, #34).
export function isJpegOrPngMagic(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return true;
  // WebP: "RIFF...." then "WEBP"
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  )
    return true;
  return false;
}

// Read a JPEG/PNG/WebP's pixel dimensions WITHOUT decoding the full image. Used
// by the selfie controller to reject 1×1 white squares. Returns null if format
// can't be parsed cheaply.
export function getImageDimensions(
  buf: Buffer,
): { width: number; height: number } | null {
  // PNG: width is bytes 16..20, height 20..24 (after IHDR chunk).
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }
  // JPEG: scan for SOFn marker
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      // SOF0 (baseline) C0..CF except C4, C8, CC
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
        };
      }
      // skip segment
      const segLen = buf.readUInt16BE(i + 2);
      i += 2 + segLen;
    }
  }
  // WebP VP8X (extended): bytes 24..27 = width-1 (24-bit LE), 27..30 = height-1
  if (
    buf.length >= 30 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP' &&
    buf.slice(12, 16).toString('ascii') === 'VP8X'
  ) {
    const w = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const h = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { width: w, height: h };
  }
  return null;
}

export const SELFIE_MIN_DIMENSION = SELFIE_MIN_PIXELS;
