import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OtpService } from '../auth/otp.service';
import { UpdateNotificationPreferencesDto } from './dto/notification-preferences.dto';
import { AppMode } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private otpService: OtpService,
  ) {}

  /**
   * Get user settings including KYC details and notification preferences
   */
  async getUserSettings(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        phoneCountry: true,
        country: true,
        kycStatus: true,
        appMode: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        kyc: {
          select: {
            pan: true,
            panName: true,
            aadhaarLast4: true,
            aadhaarName: true,
            aadhaarDob: true,
            aadhaarGender: true,
            street1: true,
            street2: true,
            city: true,
            region: true,
            postalCode: true,
            country: true,
            status: true,
            rejectionReason: true,
            panAadhaarLinked: true,
            currentStep: true,
          },
        },
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return user;
  }

  /**
   * Update user's app mode (LEARNER or INVESTOR)
   */
  async updateAppMode(userId: string, mode: AppMode) {
    // If switching to INVESTOR mode, verify KYC is approved
    if (mode === 'INVESTOR') {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.kycStatus !== 'APPROVED') {
        throw new BadRequestException('Complete identity verification to enable Investor mode');
      }
    }

    const updatedUser = await this.prisma.client.user.update({
      where: { id: userId },
      data: { appMode: mode },
      select: { appMode: true },
    });

    return {
      appMode: updatedUser.appMode,
      message: mode === 'INVESTOR' 
        ? 'Switched to Investor mode - Real trading enabled'
        : 'Switched to Learner mode - Demo trading with virtual funds',
    };
  }

  /**
   * Request password change - sends OTP to user's email
   */
  async requestPasswordChange(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Send OTP to email
    await this.otpService.sendEmailOtp(user.email, 'RESET');

    return {
      message: 'Verification code sent to your email',
    };
  }

  /**
   * Change password with OTP verification
   */
  async changePassword(userId: string, otp: string, newPassword: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Verify OTP
    const isValid = await this.otpService.verifyEmailOtp(user.email, otp, 'RESET');

    if (!isValid) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId: string) {
    let preferences = await this.prisma.client.notificationPreferences.findUnique({
      where: { userId },
    });

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await this.prisma.client.notificationPreferences.create({
        data: { userId },
      });
    }

    return preferences;
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    // Upsert preferences (create if not exists, update if exists)
    const preferences = await this.prisma.client.notificationPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...dto,
      },
      update: dto,
    });

    return preferences;
  }
}

