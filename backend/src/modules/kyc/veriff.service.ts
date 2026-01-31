import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface VeriffSessionResponse {
  status: string;
  verification: {
    id: string;
    url: string;
    vendorData: string;
    host: string;
    status: string;
    sessionToken: string;
  };
}

interface VeriffDecision {
  id: string;
  status: string;
  code: number;
  reason: string | null;
  reasonCode: string | null;
  decisionTime: string;
  acceptanceTime: string;
  person: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string | null;
    idNumber: string | null;
    gender: string | null;
    addresses?: Array<{
      fullAddress?: string;
      parsedAddress?: {
        city?: string;
        state?: string;
        country?: string;
        postcode?: string;
        street?: string;
        houseNumber?: string;
      };
    }>;
  } | null;
  document: {
    number: string | null;
    type: string;
    country: string;
    state?: string | null;  // Document issuing state (for driver's licenses, state IDs)
    validFrom: string | null;
    validUntil: string | null;
  } | null;
}

export interface ExtractedLocation {
  country: string | null;
  state: string | null;
  source: 'document' | 'address' | null;
}

// Regular webhook payload (status events)
interface VeriffWebhookPayload {
  id: string;
  attemptId: string;
  feature: string;
  code: number;
  action: string;
  vendorData: string;
  status: string;
  reason: string | null;
  reasonCode: string | null;
  decisionTime: string | null;
  acceptanceTime: string | null;
}

// Fullauto webhook payload (decision events)
interface VeriffFullautoPayload {
  status: string; // "success" or "failed"
  eventType: string; // "fullauto"
  sessionId: string;
  attemptId: string;
  vendorData: string;
  time: string;
  acceptanceTime: string;
  data: {
    verification: {
      decision: string; // "approved", "declined", "resubmission_requested"
      decisionScore?: number;
      person?: {
        firstName?: { value: string | null };
        lastName?: { value: string | null };
        dateOfBirth?: { value: string | null };
      };
      document?: {
        type?: { value: string };
        country?: { value: string };
        number?: { value: string | null };
      };
    };
  };
}

// Normalized webhook data for internal use
export interface NormalizedWebhookData {
  sessionId: string;
  attemptId: string;
  status: string;
  code: number;
  reason: string | null;
  reasonCode: string | null;
  decisionTime: string | null;
  acceptanceTime: string | null;
  isFullauto: boolean;
}

@Injectable()
export class VeriffService {
  private readonly logger = new Logger(VeriffService.name);
  private readonly apiKey: string;
  private readonly sharedSecretKey: string;
  private readonly baseUrl = 'https://stationapi.veriff.com/v1';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VERIFF_API_KEY') || '';
    this.sharedSecretKey = this.configService.get<string>('VERIFF_SHARED_SECRET_KEY') || '';

    if (!this.apiKey || !this.sharedSecretKey) {
      this.logger.warn('Veriff API credentials not configured');
    }
  }

  /**
   * Create a new Veriff verification session
   */
  async createSession(
    userId: string,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
  ): Promise<VeriffSessionResponse> {
    // Build payload - only include callback if it's a valid HTTPS URL
    const callbackUrl = this.configService.get<string>('VERIFF_CALLBACK_URL');
    
    const verification: Record<string, unknown> = {
      person: {
        firstName,
        lastName,
        dateOfBirth, // YYYY-MM-DD format
      },
      vendorData: userId, // Store userId to identify user in webhook
      timestamp: new Date().toISOString(),
    };

    // Only add callback if it's HTTPS (Veriff requires HTTPS)
    if (callbackUrl && callbackUrl.startsWith('https://')) {
      verification.callback = callbackUrl;
    }

    const payload = { verification };

    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Veriff session creation failed: ${error}`);
      throw new Error(`Failed to create Veriff session: ${error}`);
    }

    const data = await response.json() as VeriffSessionResponse;
    this.logger.log(`Veriff session created: ${data.verification.id}`);
    return data;
  }

  /**
   * Get verification decision from Veriff
   */
  async getDecision(sessionId: string): Promise<VeriffDecision | null> {
    console.log(`[Veriff getDecision] Fetching decision for session: ${sessionId}`);

    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/decision`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': this.apiKey,
        'X-HMAC-SIGNATURE': this.generateSignature(sessionId),
      },
    });

    console.log(`[Veriff getDecision] Response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Veriff getDecision] 404 - Decision not yet available`);
        return null; // Decision not yet available
      }
      const error = await response.text();
      console.log(`[Veriff getDecision] Error response: ${error}`);
      this.logger.error(`Veriff decision fetch failed: ${error}`);
      throw new Error(`Failed to get Veriff decision: ${error}`);
    }

    const data = await response.json();
    console.log(`[Veriff getDecision] Success - status: ${data.verification?.status}, code: ${data.verification?.code}`);
    return data.verification as VeriffDecision;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!signature) {
      console.error('[Veriff] Missing signature header');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.sharedSecretKey)
      .update(payload)
      .digest('hex');

    // Debug logging (remove in production after debugging)
    console.log('[Veriff] Signature verification:');
    console.log('[Veriff]   Shared secret key prefix:', this.sharedSecretKey.substring(0, 8) + '...');
    console.log('[Veriff]   Received signature:', signature.substring(0, 16) + '...');
    console.log('[Veriff]   Expected signature:', expectedSignature.substring(0, 16) + '...');
    console.log('[Veriff]   Payload length:', payload.length);
    console.log('[Veriff]   Payload preview:', payload.substring(0, 100) + '...');

    // timingSafeEqual requires equal length buffers
    const sigBuffer = Buffer.from(signature.toLowerCase());
    const expectedBuffer = Buffer.from(expectedSignature.toLowerCase());

    if (sigBuffer.length !== expectedBuffer.length) {
      console.error('[Veriff] Signature length mismatch:', sigBuffer.length, 'vs', expectedBuffer.length);
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Generate HMAC signature for API requests
   */
  private generateSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.sharedSecretKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Parse webhook payload - handles both regular and fullauto formats
   */
  parseWebhookPayload(payload: unknown): NormalizedWebhookData {
    const p = payload as Record<string, unknown>;

    // Check if this is a fullauto webhook
    if (p.eventType === 'fullauto') {
      const fullauto = payload as VeriffFullautoPayload;
      const decision = fullauto.data?.verification?.decision || 'unknown';

      // Map fullauto decision to code
      let code = 0;
      if (decision === 'approved') {
        code = 9001;
      } else if (decision === 'declined') {
        code = 9102; // Generic decline
      } else if (decision === 'resubmission_requested') {
        code = 0; // Will be handled by status check
      }

      console.log(`[Veriff] Fullauto webhook: sessionId=${fullauto.sessionId}, decision=${decision}, code=${code}`);

      return {
        sessionId: fullauto.sessionId,
        attemptId: fullauto.attemptId,
        status: decision, // Use decision as status for fullauto
        code,
        reason: null,
        reasonCode: null,
        decisionTime: fullauto.time,
        acceptanceTime: fullauto.acceptanceTime,
        isFullauto: true,
      };
    }

    // Regular webhook format
    const regular = payload as VeriffWebhookPayload;
    console.log(`[Veriff] Regular webhook: id=${regular.id}, status=${regular.status}, code=${regular.code}`);

    return {
      sessionId: regular.id,
      attemptId: regular.attemptId,
      status: regular.status,
      code: regular.code || 0,
      reason: regular.reason,
      reasonCode: regular.reasonCode,
      decisionTime: regular.decisionTime,
      acceptanceTime: regular.acceptanceTime,
      isFullauto: false,
    };
  }

  /**
   * Map Veriff status to our KYC status
   */
  mapVeriffStatusToKycStatus(veriffStatus: string, code: number): 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' {
    // Veriff decision codes:
    // 9001 - Positive (approved)
    // 9102 - Negative: Person mismatch
    // 9103 - Negative: Document fraud
    // 9104 - Negative: Document expired
    // 9121 - Negative: Underage
    // etc.

    if (code === 9001) {
      return 'APPROVED';
    } else if (code >= 9100 && code < 9200) {
      return 'REJECTED';
    } else if (veriffStatus === 'resubmission_requested') {
      return 'PENDING';
    } else if (veriffStatus === 'submitted' || veriffStatus === 'started') {
      return 'SUBMITTED';
    }

    return 'PENDING';
  }

  /**
   * Extract location data from Veriff decision
   * Priority: document.state > person.addresses[0].parsedAddress.state
   */
  extractLocationFromDecision(decision: VeriffDecision): ExtractedLocation {
    // Priority 1: Document state (for driver's licenses, state IDs)
    if (decision.document?.state) {
      return {
        country: decision.document.country || null,
        state: decision.document.state,
        source: 'document',
      };
    }

    // Priority 2: Parsed address from document
    if (decision.person?.addresses?.length) {
      const firstAddress = decision.person.addresses[0];
      if (firstAddress.parsedAddress?.state) {
        return {
          country: firstAddress.parsedAddress.country || decision.document?.country || null,
          state: firstAddress.parsedAddress.state,
          source: 'address',
        };
      }
    }

    // No state information available (e.g., passport)
    return {
      country: decision.document?.country || null,
      state: null,
      source: null,
    };
  }

  /**
   * Get the document type from decision
   */
  getDocumentType(decision: VeriffDecision): string | null {
    return decision.document?.type || null;
  }
}

