import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SandboxAadhaarOtpRequestResult {
  referenceId: string;
  message: string;
  raw: unknown;
}

export interface SandboxAadhaarAddress {
  country?: string;
  state?: string;
  district?: string;
  subdistrict?: string;
  vtc?: string;
  house?: string;
  street?: string;
  // Sandbox returns pincode as a number — we store it as a string.
  pincode?: string | number;
  post_office?: string;
  landmark?: string;
  care_of?: string;
}

export interface SandboxAadhaarVerifyResult {
  name: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  yearOfBirth: string | null;
  careOf: string | null;
  fullAddress: string | null;
  address: SandboxAadhaarAddress | null;
  photoBase64: string | null;
  mobileHash: string | null;
  emailHash: string | null;
  shareCode: string | null;
  raw: unknown;
}

export interface SandboxPanVerifyResult {
  valid: boolean;
  category: string | null;
  panStatus: string | null;
  fullName: string | null;
  nameMatch: boolean | null;
  dobMatch: boolean | null;
  aadhaarSeedingStatus: string | null;
  raw: unknown;
}

export interface SandboxPanAadhaarLinkResult {
  linked: boolean | null;
  message: string | null;
  raw: unknown;
}

interface CachedToken {
  token: string;
  fetchedAt: number;
}

@Injectable()
export class SandboxKycService {
  private readonly logger = new Logger(SandboxKycService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly apiVersion: string;
  // Token valid 24h — refresh every 23h to stay safe
  private static readonly TOKEN_TTL_MS = 23 * 60 * 60 * 1000;
  private cached: CachedToken | null = null;

  constructor(private configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('SANDBOX_API_BASE_URL') || 'https://api.sandbox.co.in').replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('SANDBOX_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('SANDBOX_API_SECRET') || '';
    this.apiVersion = this.configService.get<string>('SANDBOX_API_VERSION') || '1.0';

    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn('Sandbox API credentials not configured (SANDBOX_API_KEY / SANDBOX_API_SECRET)');
    }
  }

  /**
   * Get a valid access token, using in-memory cache.
   * Sandbox tokens are valid 24h — we refresh at 23h.
   */
  private async getAccessToken(): Promise<string> {
    if (this.cached && Date.now() - this.cached.fetchedAt < SandboxKycService.TOKEN_TTL_MS) {
      return this.cached.token;
    }

    const res = await fetch(`${this.baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'x-api-secret': this.apiSecret,
        'x-api-version': this.apiVersion,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Sandbox authenticate failed: ${res.status} ${body}`);
      throw new InternalServerErrorException('KYC provider authentication failed');
    }

    const data = (await res.json()) as { data?: { access_token?: string } };
    const token = data?.data?.access_token;
    if (!token) {
      this.logger.error(`Sandbox authenticate returned no access_token: ${JSON.stringify(data)}`);
      throw new InternalServerErrorException('KYC provider returned no token');
    }

    this.cached = { token, fetchedAt: Date.now() };
    this.logger.log('Sandbox access token refreshed');
    return token;
  }

  private async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token, // NOTE: no "Bearer" prefix — per Sandbox docs
        'x-api-key': this.apiKey,
        'x-api-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      this.logger.error(`Sandbox ${path} failed: ${res.status} ${text}`);
      // Attempt to extract a user-readable message
      const p = parsed as { message?: string; data?: { message?: string } };
      const msg = p?.message || p?.data?.message || 'KYC provider error';
      throw new BadRequestException(msg);
    }

    return parsed as T;
  }

  /**
   * Step 1 of Aadhaar OKYC: request OTP to registered mobile.
   */
  async aadhaarRequestOtp(aadhaarNumber: string, reason: string): Promise<SandboxAadhaarOtpRequestResult> {
    const body = {
      '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
      aadhaar_number: aadhaarNumber,
      consent: 'Y',
      reason,
    };

    const data = await this.post<{
      data?: { reference_id?: number | string; message?: string };
    }>('/kyc/aadhaar/okyc/otp', body);

    const referenceId = data?.data?.reference_id;
    if (referenceId === undefined || referenceId === null) {
      throw new InternalServerErrorException('Aadhaar OTP request returned no reference_id');
    }

    return {
      referenceId: String(referenceId),
      message: data?.data?.message || 'OTP sent',
      raw: data,
    };
  }

  /**
   * Step 2 of Aadhaar OKYC: verify OTP, get user data.
   */
  async aadhaarVerifyOtp(referenceId: string, otp: string): Promise<SandboxAadhaarVerifyResult> {
    const body = {
      '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.request',
      reference_id: referenceId,
      otp,
    };

    const data = await this.post<{
      data?: {
        status?: string;
        message?: string;
        name?: string;
        gender?: string;
        date_of_birth?: string;
        // Sandbox returns year_of_birth as a number
        year_of_birth?: string | number;
        full_address?: string;
        care_of?: string;
        address?: SandboxAadhaarAddress;
        photo?: string; // base64
        mobile_hash?: string;
        email_hash?: string;
        share_code?: string | number;
      };
    }>('/kyc/aadhaar/okyc/otp/verify', body);

    const d = data?.data;

    // Sandbox returns HTTP 200 even for logical failures (e.g., "OTP expired").
    // Success is signalled by data.status === "VALID"; any other value (or missing
    // status field entirely) means the OTP was rejected. Use positive check so a
    // missing status field isn't silently accepted.
    const status = d?.status?.toString().toLowerCase();
    const isSuccess = status === 'valid' || status === 'success' || status === 'verified';
    if (!isSuccess) {
      const msg = d?.message || 'Aadhaar verification failed. Please request a new OTP.';
      throw new BadRequestException(msg);
    }

    // Normalise numeric fields Sandbox occasionally returns as ints → strings.
    const normalisedAddress: SandboxAadhaarAddress | null = d?.address
      ? { ...d.address, pincode: d.address.pincode != null ? String(d.address.pincode) : undefined }
      : null;

    return {
      name: d?.name ?? null,
      gender: d?.gender ?? null,
      dateOfBirth: d?.date_of_birth ?? null,
      yearOfBirth: d?.year_of_birth != null ? String(d.year_of_birth) : null,
      careOf: d?.care_of ?? null,
      fullAddress: d?.full_address ?? null,
      address: normalisedAddress,
      photoBase64: d?.photo ?? null,
      mobileHash: d?.mobile_hash ?? null,
      emailHash: d?.email_hash ?? null,
      shareCode: d?.share_code != null ? String(d.share_code) : null,
      raw: data,
    };
  }

  /**
   * Verify PAN details (name + DOB match + Aadhaar seeding status).
   */
  async panVerify(pan: string, nameAsPerPan: string, dateOfBirth: string, reason: string): Promise<SandboxPanVerifyResult> {
    const body = {
      '@entity': 'in.co.sandbox.kyc.pan_verification.request',
      pan,
      name_as_per_pan: nameAsPerPan,
      date_of_birth: dateOfBirth, // DD/MM/YYYY or YYYY-MM-DD depending on endpoint
      consent: 'Y',
      reason,
    };

    const data = await this.post<{
      data?: {
        status?: string;
        pan_status?: string;
        category?: string;
        full_name?: string;
        name_as_per_pan_match?: boolean | string;
        date_of_birth_match?: boolean | string;
        aadhaar_seeding_status?: string;
        message?: string;
      };
    }>('/kyc/pan/verify', body);

    const d = data?.data;
    const status = d?.status?.toString().toLowerCase();
    const panStatus = d?.pan_status?.toString().toLowerCase();

    const toBool = (v: unknown): boolean | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase();
      if (s === 'y' || s === 'yes' || s === 'true' || s === '1') return true;
      if (s === 'n' || s === 'no' || s === 'false' || s === '0') return false;
      return null;
    };

    // "valid" is the positive PAN status per Sandbox docs; treat others as invalid
    const valid = status === 'valid' || panStatus === 'valid' || status === 'success';

    return {
      valid,
      category: d?.category ?? null,
      panStatus: d?.pan_status ?? d?.status ?? null,
      fullName: d?.full_name ?? null,
      nameMatch: toBool(d?.name_as_per_pan_match),
      dobMatch: toBool(d?.date_of_birth_match),
      aadhaarSeedingStatus: d?.aadhaar_seeding_status ?? null,
      raw: data,
    };
  }

  /**
   * Check PAN ↔ Aadhaar link status (does NSDL have this PAN linked to this Aadhaar).
   */
  async panAadhaarLink(pan: string, aadhaarNumber: string, reason: string): Promise<SandboxPanAadhaarLinkResult> {
    const body = {
      '@entity': 'in.co.sandbox.kyc.pan_aadhaar.status',
      pan,
      aadhaar_number: aadhaarNumber,
      consent: 'Y',
      reason,
    };

    try {
      const data = await this.post<{
        data?: {
          aadhaar_seeding_status?: string;
          message?: string;
          link_status?: string;
        };
      }>('/kyc/pan-aadhaar/status', body);

      const d = data?.data;
      const raw = (d?.link_status || d?.aadhaar_seeding_status || '').toString().toLowerCase();
      let linked: boolean | null = null;
      if (raw) {
        linked = raw.includes('linked') && !raw.includes('not');
      }

      return {
        linked,
        message: d?.message ?? null,
        raw: data,
      };
    } catch (err) {
      // PAN-Aadhaar link is advisory; log but don't block decision
      this.logger.warn(`PAN-Aadhaar link check failed (non-fatal): ${(err as Error).message}`);
      return { linked: null, message: null, raw: null };
    }
  }
}
