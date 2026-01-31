import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { getReferenceStates } from './data/reference-states';
import {
  CreateCountryDto,
  UpdateCountryDto,
  CreateStateDto,
  UpdateStateDto,
} from './dto/kyc-restrictions.dto';

export type KycRejectionType = 'STATE_MISMATCH' | 'RESTRICTED_STATE' | 'RESTRICTED_COUNTRY' | 'COUNTRY_MISMATCH';

interface CreateRejectionLogDto {
  rejectionType: KycRejectionType;
  userProvidedCountry?: string;
  userProvidedState?: string;
  documentCountry?: string;
  documentState?: string;
  reason: string;
  veriffSessionId?: string;
}

@Injectable()
export class KycRestrictionsService {
  private readonly logger = new Logger(KycRestrictionsService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // COUNTRY MANAGEMENT
  // ============================================

  async getAllCountries() {
    return this.prisma.client.allowedCountry.findMany({
      include: {
        allowedStates: {
          orderBy: { stateName: 'asc' },
        },
      },
      orderBy: { countryName: 'asc' },
    });
  }

  async getCountryByCode(countryCode: string) {
    const country = await this.prisma.client.allowedCountry.findUnique({
      where: { countryCode: countryCode.toUpperCase() },
      include: {
        allowedStates: {
          orderBy: { stateName: 'asc' },
        },
      },
    });

    if (!country) {
      throw new NotFoundException(`Country ${countryCode} not found`);
    }

    return country;
  }

  async createCountry(dto: CreateCountryDto) {
    const countryCode = dto.countryCode.toUpperCase();

    const existing = await this.prisma.client.allowedCountry.findUnique({
      where: { countryCode },
    });

    if (existing) {
      throw new ConflictException(`Country ${countryCode} already exists`);
    }

    return this.prisma.client.allowedCountry.create({
      data: {
        countryCode,
        countryName: dto.countryName,
        isActive: dto.isActive ?? true,
        allowAllStates: dto.allowAllStates ?? false,
      },
      include: {
        allowedStates: true,
      },
    });
  }

  async updateCountry(countryCode: string, dto: UpdateCountryDto) {
    const code = countryCode.toUpperCase();

    const existing = await this.prisma.client.allowedCountry.findUnique({
      where: { countryCode: code },
    });

    if (!existing) {
      throw new NotFoundException(`Country ${code} not found`);
    }

    return this.prisma.client.allowedCountry.update({
      where: { countryCode: code },
      data: {
        ...(dto.countryName && { countryName: dto.countryName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.allowAllStates !== undefined && { allowAllStates: dto.allowAllStates }),
      },
      include: {
        allowedStates: true,
      },
    });
  }

  async deleteCountry(countryCode: string) {
    const code = countryCode.toUpperCase();

    const existing = await this.prisma.client.allowedCountry.findUnique({
      where: { countryCode: code },
    });

    if (!existing) {
      throw new NotFoundException(`Country ${code} not found`);
    }

    await this.prisma.client.allowedCountry.delete({
      where: { countryCode: code },
    });

    return { deleted: true };
  }

  async toggleCountry(countryCode: string, isActive: boolean) {
    return this.updateCountry(countryCode, { isActive });
  }

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  async getStatesForCountry(countryCode: string) {
    const country = await this.getCountryByCode(countryCode);
    return country.allowedStates;
  }

  async addStatesToCountry(countryCode: string, states: CreateStateDto[]) {
    const country = await this.getCountryByCode(countryCode);

    const createdStates = await this.prisma.client.$transaction(
      states.map((state) =>
        this.prisma.client.allowedState.upsert({
          where: {
            countryId_stateCode: {
              countryId: country.id,
              stateCode: state.stateCode.toUpperCase(),
            },
          },
          update: {
            stateName: state.stateName,
            isActive: state.isActive ?? true,
          },
          create: {
            countryId: country.id,
            stateCode: state.stateCode.toUpperCase(),
            stateName: state.stateName,
            isActive: state.isActive ?? true,
          },
        })
      )
    );

    return createdStates;
  }

  async updateState(stateId: string, dto: UpdateStateDto) {
    const existing = await this.prisma.client.allowedState.findUnique({
      where: { id: stateId },
    });

    if (!existing) {
      throw new NotFoundException(`State ${stateId} not found`);
    }

    return this.prisma.client.allowedState.update({
      where: { id: stateId },
      data: {
        ...(dto.stateName && { stateName: dto.stateName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteState(stateId: string) {
    const existing = await this.prisma.client.allowedState.findUnique({
      where: { id: stateId },
    });

    if (!existing) {
      throw new NotFoundException(`State ${stateId} not found`);
    }

    await this.prisma.client.allowedState.delete({
      where: { id: stateId },
    });

    return { deleted: true };
  }

  async toggleState(stateId: string, isActive: boolean) {
    return this.updateState(stateId, { isActive });
  }

  async bulkToggleStates(countryCode: string, stateCodes: string[], isActive: boolean) {
    const country = await this.getCountryByCode(countryCode);
    const upperCodes = stateCodes.map((c) => c.toUpperCase());

    await this.prisma.client.allowedState.updateMany({
      where: {
        countryId: country.id,
        stateCode: { in: upperCodes },
      },
      data: { isActive },
    });

    return { updated: true };
  }

  // ============================================
  // REFERENCE DATA
  // ============================================

  getReferenceStates(countryCode: string) {
    return getReferenceStates(countryCode);
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  async hasRestrictions(): Promise<boolean> {
    const count = await this.prisma.client.allowedCountry.count({
      where: { isActive: true },
    });
    return count > 0;
  }

  async isCountryAllowed(countryCode: string): Promise<boolean> {
    // Countries not in the list are always allowed (no restrictions)
    // Countries in the list must be active to be allowed
    const country = await this.prisma.client.allowedCountry.findUnique({
      where: { countryCode: countryCode.toUpperCase() },
    });

    // Not in list = no restrictions for this country = allowed
    if (!country) {
      return true;
    }

    // In list = must be active
    return country.isActive;
  }

  async isStateAllowed(
    countryCode: string,
    stateCode: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const code = countryCode.toUpperCase();
    const country = await this.prisma.client.allowedCountry.findUnique({
      where: { countryCode: code },
      include: { allowedStates: true },
    });

    // Country not in list = no restrictions = allowed
    if (!country) {
      return { allowed: true };
    }

    // Country in list but disabled = blocked
    if (!country.isActive) {
      return { allowed: false, reason: `Country ${code} is disabled` };
    }

    // If allow all states for this country
    if (country.allowAllStates) {
      return { allowed: true };
    }

    // No states configured = allow all states
    if (country.allowedStates.length === 0) {
      return { allowed: true };
    }

    // Check specific state
    const state = country.allowedStates.find(
      (s) => s.stateCode.toUpperCase() === stateCode.toUpperCase()
    );

    if (!state) {
      return { allowed: false, reason: `State ${stateCode} is not in the allowed list for ${code}` };
    }

    if (!state.isActive) {
      return { allowed: false, reason: `State ${stateCode} is disabled for ${code}` };
    }

    return { allowed: true };
  }

  // ============================================
  // REJECTION LOGGING
  // ============================================

  async logRejection(kycId: string, userId: string, data: CreateRejectionLogDto) {
    this.logger.warn(
      `KYC rejected: user=${userId}, type=${data.rejectionType}, reason=${data.reason}`
    );

    return this.prisma.client.kycRejectionLog.create({
      data: {
        kycId,
        userId,
        rejectionType: data.rejectionType,
        userProvidedCountry: data.userProvidedCountry,
        userProvidedState: data.userProvidedState,
        documentCountry: data.documentCountry,
        documentState: data.documentState,
        reason: data.reason,
        veriffSessionId: data.veriffSessionId,
      },
    });
  }

  async getRejectionLogs(userId: string) {
    return this.prisma.client.kycRejectionLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRejectionLogsForKyc(kycId: string) {
    return this.prisma.client.kycRejectionLog.findMany({
      where: { kycId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
