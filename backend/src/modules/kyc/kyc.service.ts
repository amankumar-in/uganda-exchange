import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { VeriffService } from './veriff.service';
import { KycRestrictionsService, KycRejectionType } from './kyc-restrictions.service';
import { PersonalDetailsDto } from './dto/personal-details.dto';
import { AddressDto } from './dto/address.dto';
import { KycStatus, Kyc } from '@prisma/client';

interface StateValidationResult {
  valid: boolean;
  rejectionType?: KycRejectionType;
  reason?: string;
  documentCountry?: string | null;
  documentState?: string | null;
  documentType?: string | null;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private veriffService: VeriffService,
    private kycRestrictionsService: KycRestrictionsService,
  ) {}

  /**
   * Get or create KYC record for user
   */
  async getOrCreateKyc(userId: string) {
    let kyc = await this.prisma.client.kyc.findUnique({
      where: { userId },
    });

    if (!kyc) {
      kyc = await this.prisma.client.kyc.create({
        data: {
          userId,
          currentStep: 0,
        },
      });
    }

    return kyc;
  }

  /**
   * Get KYC status for user
   */
  async getKycStatus(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });

    return {
      currentStep: kyc.currentStep,
      status: user?.kycStatus || 'PENDING',
      veriffStatus: kyc.veriffStatus,
      veriffReason: kyc.veriffReason,
      hasPersonalDetails: !!(kyc.firstName && kyc.lastName && kyc.dateOfBirth),
      hasAddress: !!(kyc.street1 && kyc.city && kyc.region && kyc.postalCode && kyc.country),
      hasVeriffSession: !!kyc.veriffSessionId,
    };
  }

  /**
   * Save personal details (Step 1)
   */
  async savePersonalDetails(userId: string, dto: PersonalDetailsDto) {
    const kyc = await this.getOrCreateKyc(userId);

    const updated = await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        firstName: dto.firstName,
        middleName: dto.middleName || null,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        currentStep: Math.max(kyc.currentStep, 1),
      },
    });

    return {
      message: 'Personal details saved',
      currentStep: updated.currentStep,
    };
  }

  /**
   * Save address (Step 2)
   */
  async saveAddress(userId: string, dto: AddressDto) {
    const kyc = await this.getOrCreateKyc(userId);

    // Ensure personal details are completed first
    if (!kyc.firstName || !kyc.lastName || !kyc.dateOfBirth) {
      throw new BadRequestException('Please complete personal details first');
    }

    const updated = await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        street1: dto.street1,
        street2: dto.street2 || null,
        city: dto.city,
        region: dto.region,
        postalCode: dto.postalCode,
        country: dto.country,
        currentStep: Math.max(kyc.currentStep, 2),
      },
    });

    return {
      message: 'Address saved',
      currentStep: updated.currentStep,
    };
  }

  /**
   * Create Veriff session (Step 3)
   */
  async createVeriffSession(userId: string) {
    const kyc = await this.getOrCreateKyc(userId);

    // Ensure previous steps are completed
    if (!kyc.firstName || !kyc.lastName || !kyc.dateOfBirth) {
      throw new BadRequestException('Please complete personal details first');
    }
    if (!kyc.street1 || !kyc.city || !kyc.region || !kyc.postalCode || !kyc.country) {
      throw new BadRequestException('Please complete address details first');
    }

    // Check for existing session that can be reused
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const isStaleSession = kyc.veriffSessionId &&
      kyc.veriffStatus === 'created' &&
      kyc.updatedAt < new Date(Date.now() - SESSION_TIMEOUT_MS);

    // If there's an existing non-stale session, return it
    if (kyc.veriffSessionId && kyc.veriffStatus === 'created' && !isStaleSession) {
      this.logger.log(`Reusing existing Veriff session for user ${userId}: ${kyc.veriffSessionId}`);
      // We don't have the URL stored, so we need to create a new session
      // But first check if user is just returning - Veriff sessions are valid for a while
    }

    if (isStaleSession) {
      this.logger.log(`Clearing stale Veriff session for user ${userId}: ${kyc.veriffSessionId}`);
    }

    // Format date of birth for Veriff (YYYY-MM-DD)
    const dob = kyc.dateOfBirth ? kyc.dateOfBirth.toISOString().split('T')[0] : '';

    // Create new Veriff session
    const session = await this.veriffService.createSession(
      userId,
      kyc.firstName,
      kyc.lastName,
      dob,
    );

    // Save session details but DON'T set status to SUBMITTED yet
    // Status will be updated when Veriff webhook confirms actual submission
    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        veriffSessionId: session.verification.id,
        veriffStatus: 'created',
        veriffAttemptId: null,
        veriffReason: null,
        veriffDecisionTime: null,
        // Keep status as PENDING until Veriff confirms submission
        // currentStep stays at 2 until actual submission
      },
    });

    // Don't update user status - wait for webhook confirmation

    return {
      sessionId: session.verification.id,
      sessionUrl: session.verification.url,
      sessionToken: session.verification.sessionToken,
    };
  }

  /**
   * Handle Veriff webhook
   */
  async handleVeriffWebhook(payload: unknown, signature: string, rawBody: string) {
    // Verify signature
    if (!this.veriffService.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('Invalid Veriff webhook signature');
      throw new BadRequestException('Invalid signature');
    }

    const webhookData = this.veriffService.parseWebhookPayload(payload);
    const { id: sessionId, attemptId, status, code, reason, reasonCode } = webhookData;

    this.logger.log(`Veriff webhook received: session=${sessionId}, status=${status}, code=${code}`);

    // Find KYC by session ID
    const kyc = await this.prisma.client.kyc.findUnique({
      where: { veriffSessionId: sessionId },
    });

    if (!kyc) {
      this.logger.warn(`KYC not found for Veriff session: ${sessionId}`);
      return { received: true };
    }

    // Map Veriff status to our status
    let kycStatus = this.veriffService.mapVeriffStatusToKycStatus(status, code);

    // Handle session started - user opened Veriff but hasn't submitted yet
    if (status === 'started') {
      this.logger.log(`Veriff session started for user ${kyc.userId}`);

      // Just update veriffStatus, don't change KYC status yet
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          veriffStatus: status,
          veriffAttemptId: attemptId,
        },
      });

      return { received: true };
    }

    // Handle session submitted - user has actually completed and submitted documents
    if (status === 'submitted') {
      this.logger.log(`Veriff session submitted for user ${kyc.userId}`);

      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          veriffStatus: status,
          veriffAttemptId: attemptId,
          status: 'SUBMITTED',
          currentStep: 3,
        },
      });

      await this.prisma.client.user.update({
        where: { id: kyc.userId },
        data: { kycStatus: 'SUBMITTED' },
      });

      return { received: true };
    }

    // Handle resubmission requested - Veriff wants user to try again
    if (status === 'resubmission_requested') {
      this.logger.log(`Veriff resubmission requested for user ${kyc.userId}: ${reason || reasonCode}`);

      // Reset to allow retry
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          veriffStatus: status,
          veriffAttemptId: attemptId,
          veriffReason: reason || reasonCode || 'Resubmission requested',
          veriffSessionId: null, // Clear session to allow new one
          status: 'PENDING',
          currentStep: 2, // Back to address step so they can proceed to verify
        },
      });

      await this.prisma.client.user.update({
        where: { id: kyc.userId },
        data: { kycStatus: 'PENDING' },
      });

      return { received: true };
    }

    // Handle retriable rejection codes
    // 9104 - Document expired
    // 9151 - Physical document not used (photo of screen)
    // 9161 - Document damaged or not fully visible
    const RETRIABLE_CODES = [9104, 9151, 9161];
    if (code && RETRIABLE_CODES.includes(code)) {
      this.logger.log(`Veriff retriable rejection for user ${kyc.userId}: code=${code}, reason=${reason || reasonCode}`);

      // Reset to allow retry
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          veriffStatus: status,
          veriffAttemptId: attemptId,
          veriffReason: reason || reasonCode || `Rejected (code ${code}) - please try again`,
          veriffSessionId: null, // Clear session to allow new one
          status: 'PENDING',
          currentStep: 2,
        },
      });

      await this.prisma.client.user.update({
        where: { id: kyc.userId },
        data: { kycStatus: 'PENDING' },
      });

      return { received: true };
    }

    // For approved decisions, validate state restrictions
    if (code === 9001) {
      const decision = await this.veriffService.getDecision(sessionId);

      if (decision) {
        const validationResult = await this.validateStateRestrictions(kyc, decision);

        if (!validationResult.valid) {
          // Log rejection
          await this.kycRestrictionsService.logRejection(kyc.id, kyc.userId, {
            rejectionType: validationResult.rejectionType!,
            userProvidedCountry: kyc.country || undefined,
            userProvidedState: kyc.region || undefined,
            documentCountry: validationResult.documentCountry || undefined,
            documentState: validationResult.documentState || undefined,
            reason: validationResult.reason!,
            veriffSessionId: sessionId,
          });

          // Override to REJECTED
          kycStatus = 'REJECTED';

          // Update KYC with rejection and document data
          await this.prisma.client.kyc.update({
            where: { id: kyc.id },
            data: {
              veriffAttemptId: attemptId,
              veriffStatus: status,
              veriffReason: validationResult.reason,
              veriffDecisionTime: webhookData.decisionTime ? new Date(webhookData.decisionTime) : null,
              documentCountry: validationResult.documentCountry,
              documentState: validationResult.documentState,
              documentType: validationResult.documentType,
              stateValidated: false,
              status: 'REJECTED',
            },
          });

          await this.prisma.client.user.update({
            where: { id: kyc.userId },
            data: { kycStatus: 'REJECTED' },
          });

          this.logger.log(`KYC rejected for user ${kyc.userId}: ${validationResult.reason}`);
          return { received: true };
        }

        // Validation passed - store document data
        await this.prisma.client.kyc.update({
          where: { id: kyc.id },
          data: {
            veriffAttemptId: attemptId,
            veriffStatus: status,
            veriffReason: reason || reasonCode || null,
            veriffDecisionTime: webhookData.decisionTime ? new Date(webhookData.decisionTime) : null,
            documentCountry: validationResult.documentCountry,
            documentState: validationResult.documentState,
            documentType: validationResult.documentType,
            stateValidated: true,
            status: 'APPROVED',
            currentStep: 4,
          },
        });

        await this.prisma.client.user.update({
          where: { id: kyc.userId },
          data: { kycStatus: 'APPROVED' },
        });

        this.logger.log(`KYC approved for user ${kyc.userId}`);
        return { received: true };
      }
    }

    // For non-approved decisions, just update status
    await this.prisma.client.kyc.update({
      where: { id: kyc.id },
      data: {
        veriffAttemptId: attemptId,
        veriffStatus: status,
        veriffReason: reason || reasonCode || null,
        veriffDecisionTime: webhookData.decisionTime ? new Date(webhookData.decisionTime) : null,
        status: kycStatus,
        currentStep: kycStatus === 'APPROVED' ? 4 : kyc.currentStep,
      },
    });

    await this.prisma.client.user.update({
      where: { id: kyc.userId },
      data: { kycStatus },
    });

    this.logger.log(`KYC updated for user ${kyc.userId}: status=${kycStatus}`);

    return { received: true };
  }

  /**
   * Validate state restrictions against Veriff decision
   */
  private async validateStateRestrictions(
    kyc: Kyc,
    decision: Awaited<ReturnType<VeriffService['getDecision']>>
  ): Promise<StateValidationResult> {
    if (!decision) {
      return { valid: true };
    }

    const location = this.veriffService.extractLocationFromDecision(decision);
    const documentCountry = location.country;
    const documentState = location.state;
    const documentType = this.veriffService.getDocumentType(decision);

    // Check if any restrictions are configured
    const hasRestrictions = await this.kycRestrictionsService.hasRestrictions();
    if (!hasRestrictions) {
      // No restrictions configured = allow all
      return {
        valid: true,
        documentCountry,
        documentState,
        documentType,
      };
    }

    // 1. Check if country is allowed
    const countryAllowed = await this.kycRestrictionsService.isCountryAllowed(
      documentCountry || kyc.country || ''
    );
    if (!countryAllowed) {
      return {
        valid: false,
        rejectionType: 'RESTRICTED_COUNTRY',
        reason: `Country ${documentCountry || kyc.country} is not allowed for verification`,
        documentCountry,
        documentState,
        documentType,
      };
    }

    // 2. Check country mismatch (document vs user-provided)
    if (documentCountry && kyc.country && documentCountry.toUpperCase() !== kyc.country.toUpperCase()) {
      return {
        valid: false,
        rejectionType: 'COUNTRY_MISMATCH',
        reason: `Document country (${documentCountry}) does not match provided country (${kyc.country})`,
        documentCountry,
        documentState,
        documentType,
      };
    }

    // 3. If document has state info, validate it
    if (documentState) {
      // Check state mismatch (document vs user-provided)
      if (kyc.region && documentState.toUpperCase() !== kyc.region.toUpperCase()) {
        return {
          valid: false,
          rejectionType: 'STATE_MISMATCH',
          reason: `Document state (${documentState}) does not match provided state (${kyc.region})`,
          documentCountry,
          documentState,
          documentType,
        };
      }

      // Check if state is in allowed list
      const stateCheck = await this.kycRestrictionsService.isStateAllowed(
        documentCountry || kyc.country || '',
        documentState
      );
      if (!stateCheck.allowed) {
        return {
          valid: false,
          rejectionType: 'RESTRICTED_STATE',
          reason: stateCheck.reason || `State ${documentState} is not allowed for verification`,
          documentCountry,
          documentState,
          documentType,
        };
      }
    } else {
      // Document has no state (e.g., passport) - validate user-provided state
      if (kyc.region && kyc.country) {
        const stateCheck = await this.kycRestrictionsService.isStateAllowed(kyc.country, kyc.region);
        if (!stateCheck.allowed) {
          return {
            valid: false,
            rejectionType: 'RESTRICTED_STATE',
            reason: stateCheck.reason || `State ${kyc.region} is not allowed for verification`,
            documentCountry,
            documentState,
            documentType,
          };
        }
      }
    }

    return {
      valid: true,
      documentCountry,
      documentState,
      documentType,
    };
  }

  /**
   * Manually check Veriff decision (polling fallback)
   */
  async checkVeriffDecision(userId: string) {
    const kyc = await this.prisma.client.kyc.findUnique({
      where: { userId },
    });

    if (!kyc || !kyc.veriffSessionId) {
      throw new NotFoundException('No active verification session');
    }

    const decision = await this.veriffService.getDecision(kyc.veriffSessionId);

    if (!decision) {
      return {
        status: kyc.status || 'PENDING',
        veriffStatus: kyc.veriffStatus || null,
        reason: null,
      };
    }

    // Update if decision is available
    const kycStatus = this.veriffService.mapVeriffStatusToKycStatus(decision.status, decision.code);

    if (kycStatus !== kyc.status) {
      await this.prisma.client.kyc.update({
        where: { id: kyc.id },
        data: {
          veriffStatus: decision.status,
          veriffReason: decision.reason || decision.reasonCode || null,
          veriffDecisionTime: decision.decisionTime ? new Date(decision.decisionTime) : null,
          status: kycStatus,
          currentStep: kycStatus === 'APPROVED' ? 4 : kyc.currentStep,
        },
      });

      await this.prisma.client.user.update({
        where: { id: userId },
        data: { kycStatus },
      });
    }

    return {
      status: kycStatus,
      veriffStatus: decision.status,
      reason: decision.reason,
    };
  }

  /**
   * Get full KYC details (for admin or user profile)
   */
  async getKycDetails(userId: string) {
    const kyc = await this.prisma.client.kyc.findUnique({
      where: { userId },
    });

    if (!kyc) {
      return null;
    }

    return {
      id: kyc.id,
      currentStep: kyc.currentStep,
      status: kyc.status,
      personalDetails: {
        firstName: kyc.firstName,
        middleName: kyc.middleName,
        lastName: kyc.lastName,
        dateOfBirth: kyc.dateOfBirth,
      },
      address: {
        street1: kyc.street1,
        street2: kyc.street2,
        city: kyc.city,
        region: kyc.region,
        postalCode: kyc.postalCode,
        country: kyc.country,
      },
      verification: {
        sessionId: kyc.veriffSessionId,
        status: kyc.veriffStatus,
        reason: kyc.veriffReason,
        decisionTime: kyc.veriffDecisionTime,
      },
      createdAt: kyc.createdAt,
      updatedAt: kyc.updatedAt,
    };
  }
}

