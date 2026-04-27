import {
  Injectable,
  Logger,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export interface SandboxAadhaarOtpRequestResult {
  referenceId: string;
  message: string;
  transactionId: string | null;
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
  transactionId: string | null;
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
  transactionId: string | null;
  raw: unknown;
}

export interface SandboxPanAadhaarLinkResult {
  // null when the check could not be performed (e.g. provider 5xx, network).
  // Distinct from `linked: false`. Callers should treat null as "unknown" and
  // route to manual review rather than auto-approving.
  linked: boolean | null;
  message: string | null;
  transactionId: string | null;
  raw: unknown;
  // Surfaced when the link check itself failed (transient/provider error). Used
  // by KycService to decide IN_REVIEW (manual) vs auto-approve.
  failedReason?: string;
}

// Provider error class — preserves status, transaction id, and a user-safe message
// distinct from the raw provider message. We expose the HTTP status via
// `httpStatus` (NOT `status`) so we don't shadow HttpException's private `status`.
export class SandboxProviderError extends HttpException {
  public readonly httpStatus: number;

  constructor(
    public readonly userMessage: string,
    public readonly providerMessage: string,
    public readonly transactionId: string | null,
    httpStatus: number = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message: userMessage,
        providerMessage,
        transactionId,
        statusCode: httpStatus,
      },
      httpStatus,
    );
    this.httpStatus = httpStatus;
  }
}

// Sandbox token cache key (Redis). Cache survives restart and is shared across
// all backend instances, so we don't 401-storm Sandbox on horizontal scale.
const TOKEN_CACHE_KEY = 'kyc:sandbox:access_token';

@Injectable()
export class SandboxKycService {
  private readonly logger = new Logger(SandboxKycService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly apiVersion: string;
  // Token valid 24h per Sandbox docs — refresh at 23h to stay safe.
  private static readonly TOKEN_TTL_SECONDS = 23 * 60 * 60;
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly RETRY_BASE_DELAY_MS = 250;
  // PAN DOB format: provider versions differ. Set SANDBOX_PAN_DOB_FORMAT=iso for
  // YYYY-MM-DD or =ddmmyyyy for DD/MM/YYYY (default — matches v1 endpoints).
  private readonly panDobFormat: 'iso' | 'ddmmyyyy';
  private readonly redis: Redis;
  // In-process LRU on top of Redis to avoid a hop on every request.
  private inProcessToken: { token: string; expiresAt: number } | null = null;

  constructor(private configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('SANDBOX_API_BASE_URL') ||
      'https://api.sandbox.co.in'
    ).replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('SANDBOX_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('SANDBOX_API_SECRET') || '';
    this.apiVersion =
      this.configService.get<string>('SANDBOX_API_VERSION') || '1.0';
    this.panDobFormat =
      (this.configService.get<string>('SANDBOX_PAN_DOB_FORMAT') ||
        'ddmmyyyy') === 'iso'
        ? 'iso'
        : 'ddmmyyyy';

    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });
    this.redis.on('error', (err) =>
      this.logger.warn(`Sandbox Redis error: ${err.message}`),
    );

    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Sandbox API credentials not configured (SANDBOX_API_KEY / SANDBOX_API_SECRET)',
      );
    }
  }

  /**
   * Format a YYYY-MM-DD ISO date for Sandbox PAN verification. Provider version
   * controls whether they expect DD/MM/YYYY or ISO — see SANDBOX_PAN_DOB_FORMAT.
   */
  formatPanDob(isoDate: string): string {
    const [yyyy, mm, dd] = isoDate.split('-');
    return this.panDobFormat === 'iso'
      ? `${yyyy}-${mm}-${dd}`
      : `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Get a valid access token. Reads from in-process cache → Redis → Sandbox
   * `/authenticate`. Multi-instance safe; restarts don't trigger a thundering
   * herd against Sandbox.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.inProcessToken && this.inProcessToken.expiresAt > now) {
      return this.inProcessToken.token;
    }

    // Try Redis (shared across instances)
    try {
      const cached = await this.redis.get(TOKEN_CACHE_KEY);
      if (cached) {
        const ttl = await this.redis.ttl(TOKEN_CACHE_KEY);
        if (ttl > 60) {
          this.inProcessToken = { token: cached, expiresAt: now + ttl * 1000 };
          return cached;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Redis read for sandbox token failed: ${(err as Error).message}`,
      );
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
      throw new InternalServerErrorException(
        'KYC provider authentication failed',
      );
    }

    const data = (await res.json()) as { data?: { access_token?: string } };
    const token = data?.data?.access_token;
    if (!token) {
      this.logger.error(
        `Sandbox authenticate returned no access_token: ${JSON.stringify(data)}`,
      );
      throw new InternalServerErrorException('KYC provider returned no token');
    }

    try {
      await this.redis.setex(
        TOKEN_CACHE_KEY,
        SandboxKycService.TOKEN_TTL_SECONDS,
        token,
      );
    } catch (err) {
      this.logger.warn(
        `Redis write for sandbox token failed: ${(err as Error).message}`,
      );
    }
    this.inProcessToken = {
      token,
      expiresAt: now + SandboxKycService.TOKEN_TTL_SECONDS * 1000,
    };
    this.logger.log('Sandbox access token refreshed');
    return token;
  }

  /**
   * POST with retries on 5xx + transient network errors. Maps non-2xx and
   * Sandbox logical-failure responses into `SandboxProviderError` carrying the
   * transaction_id so support / users can quote it.
   */
  /**
   * POST to Sandbox. Only retries on **network-level failures** (fetch threw —
   * the request never landed). Does NOT retry on 5xx responses, because the
   * server received the request and may have already mutated state — retrying
   * is dangerous on non-idempotent endpoints (UIDAI marks the OTP as consumed
   * even when their gateway returns 500, so a retry hits "ref-id expired").
   *
   * Cloudflare/Render add another wrinkle: a 502/504 from their edge can mean
   * the upstream did process the request but the response was lost. We treat
   * that as a hard failure and surface it to the user — better to ask them to
   * retry than to silently double-submit.
   */
  private async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    let lastNetworkErr: Error | null = null;
    for (
      let attempt = 0;
      attempt < SandboxKycService.RETRY_ATTEMPTS;
      attempt++
    ) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token, // NOTE: no "Bearer" prefix per Sandbox docs
            'x-api-key': this.apiKey,
            'x-api-version': this.apiVersion,
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        // Network-level failure (DNS, TCP reset, TLS, timeout). The request
        // never reached Sandbox, so retry is safe.
        lastNetworkErr = err as Error;
        const isLastAttempt = attempt === SandboxKycService.RETRY_ATTEMPTS - 1;
        if (isLastAttempt) break;
        this.logger.warn(
          `Sandbox ${path} network error on attempt ${attempt + 1}: ${lastNetworkErr.message} — retrying`,
        );
        await this.sleep(
          SandboxKycService.RETRY_BASE_DELAY_MS * Math.pow(2, attempt),
        );
        continue;
      }

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { raw: text };
      }

      if (!res.ok) {
        const txnId = extractTransactionId(parsed);
        const providerMsg =
          extractProviderMessage(parsed) ||
          `KYC provider error (HTTP ${res.status})`;
        const userMsg = mapProviderMessage(providerMsg, res.status);
        this.logger.error(
          `Sandbox ${path} failed: ${res.status} txn=${txnId ?? '-'} body=${text}`,
        );
        throw new SandboxProviderError(
          userMsg,
          providerMsg,
          txnId,
          res.status,
        );
      }

      return parsed as T;
    }

    throw new InternalServerErrorException(
      `KYC provider unreachable: ${lastNetworkErr?.message || 'unknown'}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Step 1 of Aadhaar OKYC: request OTP to registered mobile.
   *
   * Sandbox sometimes returns HTTP 200 with a *logical* failure (e.g. invalid
   * Aadhaar, mobile not linked at UIDAI, sandbox quota exhausted) and a body
   * shape that omits `reference_id`. Surface the provider's message + status +
   * txn id instead of a generic "no reference_id" error so the user sees the
   * real reason and support has the txn id to debug.
   */
  async aadhaarRequestOtp(
    aadhaarNumber: string,
    reason: string,
  ): Promise<SandboxAadhaarOtpRequestResult> {
    const body = {
      '@entity': 'in.co.sandbox.kyc.aadhaar.okyc.otp.request',
      aadhaar_number: aadhaarNumber,
      consent: 'Y',
      reason,
    };

    const data = await this.post<{
      code?: number | string;
      message?: string;
      data?: {
        reference_id?: number | string;
        message?: string;
        status?: string;
      };
      transaction_id?: string;
    }>('/kyc/aadhaar/okyc/otp', body);

    const referenceId = data?.data?.reference_id;
    if (referenceId === undefined || referenceId === null) {
      const txnId = extractTransactionId(data);
      const providerMsg =
        data?.data?.message ||
        data?.message ||
        `Sandbox returned no reference_id (status=${data?.data?.status ?? 'unknown'})`;
      const userMsg = mapProviderMessage(providerMsg, 400);
      this.logger.error(
        `Sandbox /kyc/aadhaar/okyc/otp returned no reference_id. txn=${txnId ?? '-'} body=${JSON.stringify(data)}`,
      );
      throw new SandboxProviderError(userMsg, providerMsg, txnId, 400);
    }

    return {
      referenceId: String(referenceId),
      message: data?.data?.message || 'OTP sent',
      transactionId: extractTransactionId(data),
      raw: data,
    };
  }

  /**
   * Step 2 of Aadhaar OKYC: verify OTP, get user data.
   */
  async aadhaarVerifyOtp(
    referenceId: string,
    otp: string,
  ): Promise<SandboxAadhaarVerifyResult> {
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
      transaction_id?: string;
    }>('/kyc/aadhaar/okyc/otp/verify', body);

    const d = data?.data;
    const txnId = extractTransactionId(data);

    // Sandbox returns HTTP 200 even for logical failures (e.g., "OTP expired").
    // Success is signalled by data.status === "VALID"; any other value (or missing
    // status field entirely) means the OTP was rejected.
    const status = d?.status?.toString().toLowerCase();
    const isSuccess =
      status === 'valid' || status === 'success' || status === 'verified';
    if (!isSuccess) {
      const providerMsg = d?.message || 'Aadhaar verification failed';
      const userMsg = mapProviderMessage(providerMsg, 400);
      throw new SandboxProviderError(userMsg, providerMsg, txnId, 400);
    }

    // Normalise numeric fields Sandbox occasionally returns as ints → strings.
    const normalisedAddress: SandboxAadhaarAddress | null = d?.address
      ? {
          ...d.address,
          pincode:
            d.address.pincode != null ? String(d.address.pincode) : undefined,
        }
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
      transactionId: txnId,
      raw: data,
    };
  }

  /**
   * Verify PAN details (name + DOB match + Aadhaar seeding status).
   */
  async panVerify(
    pan: string,
    nameAsPerPan: string,
    dateOfBirthIso: string,
    reason: string,
  ): Promise<SandboxPanVerifyResult> {
    const body = {
      '@entity': 'in.co.sandbox.kyc.pan_verification.request',
      pan,
      name_as_per_pan: nameAsPerPan,
      date_of_birth: this.formatPanDob(dateOfBirthIso),
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
      transaction_id?: string;
    }>('/kyc/pan/verify', body);

    const d = data?.data;
    const status = d?.status?.toString().toLowerCase();
    const panStatus = d?.pan_status?.toString().toLowerCase();

    const toBool = (v: unknown): boolean | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v;
      if (typeof v !== 'string' && typeof v !== 'number') return null;
      const s = String(v).toLowerCase();
      if (s === 'y' || s === 'yes' || s === 'true' || s === '1') return true;
      if (s === 'n' || s === 'no' || s === 'false' || s === '0') return false;
      return null;
    };

    const valid =
      status === 'valid' || panStatus === 'valid' || status === 'success';

    return {
      valid,
      category: d?.category ?? null,
      panStatus: d?.pan_status ?? d?.status ?? null,
      fullName: d?.full_name ?? null,
      nameMatch: toBool(d?.name_as_per_pan_match),
      dobMatch: toBool(d?.date_of_birth_match),
      aadhaarSeedingStatus: d?.aadhaar_seeding_status ?? null,
      transactionId: extractTransactionId(data),
      raw: data,
    };
  }

  /**
   * Check PAN ↔ Aadhaar link status. Returns linked=null with `failedReason`
   * set when the check itself errored — the caller treats that as "unknown"
   * and routes to manual review rather than silently approving.
   */
  async panAadhaarLink(
    pan: string,
    aadhaarNumber: string,
    reason: string,
  ): Promise<SandboxPanAadhaarLinkResult> {
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
        transaction_id?: string;
      }>('/kyc/pan-aadhaar/status', body);

      const d = data?.data;
      const raw = (d?.link_status || d?.aadhaar_seeding_status || '')
        .toString()
        .toLowerCase();
      let linked: boolean | null = null;
      if (raw) {
        linked = raw.includes('linked') && !raw.includes('not');
      }

      return {
        linked,
        message: d?.message ?? null,
        transactionId: extractTransactionId(data),
        raw: data,
      };
    } catch (err) {
      // Surface as "unknown" so the caller routes to manual review instead of
      // approving without a positive link signal.
      const providerMsg =
        err instanceof SandboxProviderError
          ? err.providerMessage
          : (err as Error).message;
      const txnId =
        err instanceof SandboxProviderError ? err.transactionId : null;
      this.logger.warn(
        `PAN-Aadhaar link check failed (treating as unknown): ${providerMsg}`,
      );
      return {
        linked: null,
        message: null,
        transactionId: txnId,
        raw: null,
        failedReason: providerMsg,
      };
    }
  }
}

// ============================================
// helpers
// ============================================

function extractTransactionId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as {
    transaction_id?: unknown;
    data?: { transaction_id?: unknown };
  };
  const t = p.transaction_id ?? p.data?.transaction_id;
  if (t == null) return null;
  if (typeof t === 'string') return t;
  if (typeof t === 'number') return String(t);
  return null;
}

function extractProviderMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { message?: string; data?: { message?: string } };
  return p.message || p.data?.message || null;
}

// Map Sandbox/UIDAI provider error messages to specific user-facing copy. The
// raw provider strings are inconsistent and sometimes leak internals, so we
// pattern-match on common substrings.
export function mapProviderMessage(
  providerMsg: string,
  httpStatus: number,
): string {
  const m = providerMsg.toLowerCase();

  if (
    httpStatus === 429 ||
    m.includes('rate limit') ||
    m.includes('too many')
  ) {
    return 'You are trying too fast. Please wait a minute and try again.';
  }
  if (m.includes('expire') || m.includes('expired')) {
    return 'The OTP / reference has expired. Please request a new one.';
  }
  if (
    m.includes('invalid otp') ||
    m.includes('wrong otp') ||
    m.includes('incorrect otp') ||
    m.includes('mismatch otp')
  ) {
    return 'The OTP you entered is incorrect. Please check and try again.';
  }
  if (
    m.includes('invalid aadhaar') ||
    m.includes('aadhaar number is invalid')
  ) {
    return 'The Aadhaar number could not be verified by UIDAI. Please double-check the digits.';
  }
  if (m.includes('locked') || m.includes('blocked')) {
    return 'Your Aadhaar appears to be locked at UIDAI. Please unlock it on the UIDAI portal and retry.';
  }
  if (
    m.includes('not linked') ||
    m.includes('mobile not registered') ||
    m.includes('no mobile')
  ) {
    return 'No mobile number is linked to this Aadhaar at UIDAI — UIDAI cannot send an OTP. Update your mobile at UIDAI and retry.';
  }
  if (
    m.includes('invalid pan') ||
    m.includes('pan not found') ||
    m.includes('pan does not exist')
  ) {
    return 'The PAN could not be found in NSDL records. Please check and try again.';
  }
  if (m.includes('reference') && m.includes('not found')) {
    return 'Your verification session has expired. Please request a new OTP.';
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return 'Verification is temporarily unavailable. Please try again in a moment.';
  }
  if (httpStatus >= 500) {
    return 'The verification service is unavailable. Please try again in a few minutes.';
  }
  // Fallback — surface the provider message but trim length so we don't leak internals.
  const trimmed =
    providerMsg.length > 160 ? providerMsg.slice(0, 157) + '…' : providerMsg;
  return trimmed || 'Could not verify. Please try again.';
}
