import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma.service';
import { SandboxKycService } from './sandbox-kyc.service';
import {
  KycRestrictionsService,
  KycRejectionType,
} from './kyc-restrictions.service';
import { PanVerifyDto } from './dto/pan-verify.dto';
import { AadhaarRequestOtpDto } from './dto/aadhaar-request-otp.dto';
import { AadhaarVerifyOtpDto } from './dto/aadhaar-verify-otp.dto';
import { AddressConfirmDto } from './dto/address-confirm.dto';

export const KYC_UPLOADS_DIR = join(process.cwd(), 'uploads', 'kyc');
const PAN_AADHAAR_REASON = 'KYC verification for crypto exchange account onboarding';

// Normalize name for fuzzy matching: lowercase, collapse whitespace, strip punctuation
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two names "match" — one contains all tokens of the other or vice versa
function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = na.split(' ').filter(Boolean);
  const tb = nb.split(' ').filter(Boolean);
  if (ta.length === 0 || tb.length === 0) return false;
  // Every token of the shorter name must appear in the longer name
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.every((t) => long.includes(t));
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private sandbox: SandboxKycService,
    private restrictions: KycRestrictionsService,
  ) {}

  async getOrCreateKyc(userId: string) {
    let kyc = await this.prisma.client.kyc.findUnique({ where: { userId } });
    if (!kyc) {
      kyc = await this.prisma.client.kyc.create({
        data: { userId, currentStep: 0 },
      });
    }
    return kyc;
  }

  async getKycStatus(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);
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
      hasAddress: !!(kyc.street1 && kyc.city && kyc.region && kyc.postalCode && kyc.country),
      hasSelfie: !!kyc.selfiePath,
      rejectionReason: kyc.rejectionReason || null,
      // Masked Aadhaar last4 for display ("XXXX XXXX 1234")
      aadhaarLast4: kyc.aadhaarLast4 || null,
      panMasked: kyc.pan ? kyc.pan.slice(0, 2) + 'XXXX' + kyc.pan.slice(-2) : null,
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
        aadhaarPhotoUrl: kyc.aadhaarPhotoPath ? `/api/uploads/kyc/${kyc.aadhaarPhotoPath}` : null,
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
  // Step 2: PAN verify
  // ============================================
  async verifyPan(userId: string, dto: PanVerifyDto) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.consentedAt) {
      throw new BadRequestException('Please accept the consent terms first');
    }

    const pan = dto.pan.toUpperCase();

    // Sandbox PAN verify expects date in DD/MM/YYYY per most of their older endpoints.
    // Their newer ones accept YYYY-MM-DD. We send DD/MM/YYYY to be safe.
    const [yyyy, mm, dd] = dto.dateOfBirth.split('-');
    const dobDdMmYyyy = `${dd}/${mm}/${yyyy}`;

    const result = await this.sandbox.panVerify(pan, dto.nameAsPerPan, dobDdMmYyyy, PAN_AADHAAR_REASON);

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
        panRawData: result.raw as object,
        currentStep: Math.max(kyc.currentStep, 2),
      },
    });

    if (!result.valid) {
      throw new BadRequestException('PAN is not valid. Please check and try again.');
    }
    if (result.nameMatch === false) {
      throw new BadRequestException('The name does not match PAN records');
    }
    if (result.dobMatch === false) {
      throw new BadRequestException('The date of birth does not match PAN records');
    }

    return {
      message: 'PAN verified successfully',
      currentStep: 2,
      fullName: result.fullName,
      category: result.category,
    };
  }

  // ============================================
  // Step 3: Aadhaar — request OTP
  // ============================================
  async aadhaarRequestOtp(userId: string, dto: AadhaarRequestOtpDto) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.panVerifiedAt) {
      throw new BadRequestException('Please verify your PAN first');
    }

    const result = await this.sandbox.aadhaarRequestOtp(dto.aadhaarNumber, PAN_AADHAAR_REASON);

    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        aadhaarLast4: dto.aadhaarNumber.slice(-4),
        aadhaarRefId: result.referenceId,
        aadhaarOtpSentAt: new Date(),
        currentStep: Math.max(kyc.currentStep, 3),
      },
    });

    return {
      message: result.message,
      currentStep: 3,
    };
  }

  // ============================================
  // Step 4: Aadhaar — verify OTP, pull data, run PAN↔Aadhaar link check
  // ============================================
  async aadhaarVerifyOtp(userId: string, dto: AadhaarVerifyOtpDto) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.aadhaarRefId) {
      throw new BadRequestException('Please request an OTP first');
    }

    const result = await this.sandbox.aadhaarVerifyOtp(kyc.aadhaarRefId, dto.otp);

    // Save Aadhaar photo if present — decode base64 and write JPEG
    let photoPath: string | null = null;
    if (result.photoBase64) {
      try {
        photoPath = `aadhaar-${kyc.id}-${Date.now()}.jpg`;
        await fs.mkdir(KYC_UPLOADS_DIR, { recursive: true });
        // Strip data URI prefix if present
        const b64 = result.photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        await fs.writeFile(join(KYC_UPLOADS_DIR, photoPath), Buffer.from(b64, 'base64'));
      } catch (err) {
        this.logger.error(`Failed to save Aadhaar photo: ${(err as Error).message}`);
        photoPath = null;
      }
    }

    // Parse Aadhaar DOB (format varies — YYYY-MM-DD or DD-MM-YYYY from Sandbox)
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

    // Derive address from Aadhaar (prefill for the next step — user can edit)
    const addr = result.address || {};
    const streetParts = [addr.house, addr.street].filter(Boolean).join(', ');
    const city = addr.vtc || addr.subdistrict || addr.district || null;
    const region = addr.state || null;
    // Sandbox sometimes returns pincode as a number — coerce to string for Prisma.
    const postalCode = addr.pincode != null ? String(addr.pincode) : null;

    // Strip photo from rawData before storing (photo is already on disk)
    const rawDataForStorage =
      result.raw && typeof result.raw === 'object'
        ? stripPhotoFromResponse(result.raw)
        : result.raw;

    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        aadhaarRefId: null, // invalidate after successful verify
        aadhaarVerifiedAt: new Date(),
        aadhaarName: result.name,
        aadhaarDob,
        aadhaarYob: result.yearOfBirth,
        aadhaarGender: result.gender,
        aadhaarCareOf: result.careOf,
        aadhaarPhotoPath: photoPath,
        aadhaarRawData: rawDataForStorage as object,
        // Prefill address (user can override on the next step)
        street1: streetParts || kyc.street1,
        city: city || kyc.city,
        region: region || kyc.region,
        postalCode: postalCode || kyc.postalCode,
        country: 'IN',
        currentStep: Math.max(kyc.currentStep, 4),
      },
    });

    // Run PAN ↔ Aadhaar link check in the background — don't fail the flow if it errors
    if (kyc.pan && kyc.aadhaarLast4) {
      const aadhaarFromRefFull = (result.raw as { data?: { aadhaar_number?: string } })?.data?.aadhaar_number;
      const aadhaarNum = aadhaarFromRefFull || null;
      if (aadhaarNum) {
        const link = await this.sandbox.panAadhaarLink(kyc.pan, aadhaarNum, PAN_AADHAAR_REASON);
        await this.prisma.client.kyc.update({
          where: { id: kyc.id },
          data: {
            panAadhaarLinked: link.linked,
            panAadhaarLinkedAt: new Date(),
          },
        });
      }
    }

    return {
      message: 'Aadhaar verified',
      currentStep: 4,
    };
  }

  // ============================================
  // Step 5: Address confirmation
  // ============================================
  async confirmAddress(userId: string, dto: AddressConfirmDto) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!kyc.aadhaarVerifiedAt) {
      throw new BadRequestException('Please complete Aadhaar verification first');
    }

    // Geographic restriction check
    const stateCheck = await this.restrictions.isStateAllowed(dto.country, dto.region);

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
      const reason = stateCheck.reason || `We're not available in ${dto.region} yet`;
      await this.restrictions.logRejection(kyc.id, userId, {
        rejectionType: 'RESTRICTED_STATE',
        userProvidedCountry: dto.country,
        userProvidedState: dto.region,
        reason,
      });
      await this.rejectKyc(kyc.id, userId, reason);
      throw new BadRequestException(`${reason}. Your information has been saved.`);
    }

    return { message: 'Address confirmed', currentStep: 5 };
  }

  // ============================================
  // Step 6: Selfie upload — triggers auto-decision
  // ============================================
  async uploadSelfie(userId: string, file: Express.Multer.File) {
    const kyc = await this.getOrCreateKyc(userId);

    if (!file) throw new BadRequestException('No selfie file uploaded');

    if (!kyc.street1 || !kyc.city || !kyc.region || !kyc.postalCode || !kyc.country) {
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

    // Auto-decide
    return this.runAutoDecision(userId);
  }

  // ============================================
  // Auto-decision
  // ============================================
  async runAutoDecision(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);

    // Gate: all steps complete
    if (!kyc.panVerifiedAt) return this.reject(kyc.id, userId, 'PAN_INVALID', 'PAN was not verified');
    if (!kyc.aadhaarVerifiedAt) return this.reject(kyc.id, userId, 'AADHAAR_FAIL', 'Aadhaar was not verified');
    if (!kyc.selfiePath) throw new BadRequestException('Selfie required');
    if (!kyc.street1 || !kyc.region) throw new BadRequestException('Address required');

    // 1. PAN explicit match signals
    if (kyc.panNameMatch === false) {
      return this.reject(kyc.id, userId, 'PAN_NAME_MISMATCH', 'Name on PAN does not match records');
    }
    if (kyc.panDobMatch === false) {
      return this.reject(kyc.id, userId, 'PAN_INVALID', 'Date of birth does not match PAN records');
    }

    // 2. Cross-check PAN name vs Aadhaar name
    if (!namesMatch(kyc.panName, kyc.aadhaarName)) {
      return this.reject(
        kyc.id,
        userId,
        'NAME_MISMATCH',
        'Name on PAN and Aadhaar do not match. Please ensure both documents belong to you.',
      );
    }

    // 3. Regional restrictions (already checked in address step, but verify once more)
    if (kyc.country && kyc.region) {
      const stateCheck = await this.restrictions.isStateAllowed(kyc.country, kyc.region);
      if (!stateCheck.allowed) {
        return this.reject(kyc.id, userId, 'RESTRICTED_STATE', stateCheck.reason || 'Region not supported');
      }
    }

    // All checks pass → approve
    return this.approve(kyc.id, userId);
  }

  private async approve(kycId: string, userId: string) {
    const now = new Date();
    await this.prisma.client.kyc.update({
      where: { id: kycId },
      data: {
        status: 'APPROVED',
        autoDecidedAt: now,
        rejectionReason: null,
        currentStep: 7,
      },
    });
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { kycStatus: 'APPROVED' },
    });
    this.logger.log(`KYC auto-approved for user ${userId}`);
    return { status: 'APPROVED' as const, currentStep: 7 };
  }

  private async reject(kycId: string, userId: string, type: KycRejectionType, reason: string) {
    const now = new Date();
    await this.prisma.client.kyc.update({
      where: { id: kycId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        autoDecidedAt: now,
        currentStep: 7,
      },
    });
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { kycStatus: 'REJECTED' },
    });
    await this.restrictions.logRejection(kycId, userId, {
      rejectionType: type,
      reason,
    });
    this.logger.log(`KYC auto-rejected for user ${userId}: ${type} — ${reason}`);
    return { status: 'REJECTED' as const, reason, currentStep: 7 };
  }

  // External (used when address step rejects directly)
  private async rejectKyc(kycId: string, userId: string, reason: string) {
    await this.prisma.client.kyc.update({
      where: { id: kycId },
      data: { status: 'REJECTED', rejectionReason: reason, autoDecidedAt: new Date(), currentStep: 7 },
    });
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { kycStatus: 'REJECTED' },
    });
  }

  // ============================================
  // Retry flow (user wants to start over after REJECTED)
  // ============================================
  async resetForRetry(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);
    if (kyc.status !== 'REJECTED') {
      throw new BadRequestException('Only rejected KYC submissions can be reset');
    }

    // Delete stored files
    const deletions: Promise<void>[] = [];
    if (kyc.aadhaarPhotoPath) {
      deletions.push(fs.unlink(join(KYC_UPLOADS_DIR, kyc.aadhaarPhotoPath)).catch(() => undefined));
    }
    if (kyc.selfiePath) {
      deletions.push(fs.unlink(join(KYC_UPLOADS_DIR, kyc.selfiePath)).catch(() => undefined));
    }
    await Promise.all(deletions);

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
        aadhaarRefId: null,
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

// Sandbox returns Aadhaar photo as base64 in the response. We save it to disk so we
// don't persist a giant blob in Postgres. Strip it before storing raw for audit.
function stripPhotoFromResponse(raw: unknown): unknown {
  if (raw && typeof raw === 'object') {
    const clone: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
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
