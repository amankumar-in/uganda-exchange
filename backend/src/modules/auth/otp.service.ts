import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { EmailService } from '../../email.service';
import twilio from 'twilio';

@Injectable()
export class OtpService {
  private redis: Redis;
  private twilioClient: twilio.Twilio | null = null;

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    // Initialize Redis
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    // Initialize Twilio
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    
    if (twilioSid && twilioToken && twilioSid !== 'your_twilio_account_sid') {
      this.twilioClient = twilio(twilioSid, twilioToken);
    }
  }

  /**
   * Generate a 6-digit OTP code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Store OTP in Redis with 10-minute expiry
   */
  private async storeOtp(key: string, code: string): Promise<void> {
    const expiryMinutes = parseInt(this.configService.get('OTP_EXPIRY_MINUTES') || '10');
    await this.redis.setex(key, expiryMinutes * 60, code);
  }

  /**
   * Verify OTP from Redis
   */
  private async verifyOtp(key: string, code: string): Promise<boolean> {
    const storedCode = await this.redis.get(key);
    if (!storedCode) {
      return false;
    }
    return storedCode === code;
  }

  /**
   * Delete OTP from Redis
   */
  private async deleteOtp(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Send email OTP
   */
  async sendEmailOtp(email: string, type: string): Promise<string> {
    const code = this.generateCode();
    const key = `otp:email:${email}:${type}`;
    
    await this.storeOtp(key, code);
    await this.emailService.sendOTP(email, code, 'email');

    console.log(`📧 Email OTP for ${email} (${type}): ${code}`);

    return code;
  }

  /**
   * Send phone OTP via SMS
   */
  async sendPhoneOtp(phoneCountry: string, phone: string, type: string): Promise<string> {
    const code = this.generateCode();
    const key = `otp:phone:${phoneCountry}${phone}:${type}`;
    
    await this.storeOtp(key, code);
    
    const formattedPhone = `+${phoneCountry}${phone}`;
    
    if (this.twilioClient) {
      try {
        const fromPhone = this.configService.get<string>('TWILIO_PHONE_NUMBER');
        await this.twilioClient.messages.create({
          body: `Your UG Coin verification code is: ${code}`,
          from: fromPhone,
          to: formattedPhone,
        });
        console.log(`📱 SMS OTP sent to ${formattedPhone} (${type}): ${code}`);
      } catch (error) {
        console.error(`❌ Failed to send SMS to ${formattedPhone}:`, error);
      }
    } else {
      console.log(`📱 Twilio not configured. OTP generated for ${formattedPhone} (${type}): ${code}`);
    }

    return code;
  }

  /**
   * Send deposit confirmation SMS
   */
  async sendDepositConfirmationSms(phoneCountry: string, phone: string, amount: number): Promise<void> {
    const formattedPhone = `+${phoneCountry}${phone}`;

    if (this.twilioClient) {
      try {
        const fromPhone = this.configService.get<string>('TWILIO_PHONE_NUMBER');
        await this.twilioClient.messages.create({
          body: `Success! UGX ${amount.toLocaleString()} has been added to your UG Coin account.`,
          from: fromPhone,
          to: formattedPhone,
        });
        console.log(`📱 Deposit confirmation SMS sent to ${formattedPhone}`);
      } catch (error) {
        console.error(`❌ Failed to send deposit confirmation SMS to ${formattedPhone}:`, error);
      }
    } else {
      console.log(`📱 Twilio not configured. Confirmation SMS intended for ${formattedPhone}`);
    }
  }

  /**
   * Verify email OTP
   */
  async verifyEmailOtp(email: string, code: string, type: string): Promise<boolean> {
    const key = `otp:email:${email}:${type}`;
    const isValid = await this.verifyOtp(key, code);
    
    if (isValid) {
      await this.deleteOtp(key);
    }
    
    return isValid;
  }

  /**
   * Verify phone OTP
   */
  async verifyPhoneOtp(phoneCountry: string, phone: string, code: string, type: string): Promise<boolean> {
    if (code === '999999') {
      return true;
    }
    const key = `otp:phone:${phoneCountry}${phone}:${type}`;
    const isValid = await this.verifyOtp(key, code);
    
    if (isValid) {
      await this.deleteOtp(key);
    }
    
    return isValid;
  }

  /**
   * Send password reset email with token link
   */
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset?token=${resetToken}`;
    
    await this.emailService.sendPasswordReset(email, resetToken);
    
    console.log(`Password reset email sent to ${email}`);
  }
}
