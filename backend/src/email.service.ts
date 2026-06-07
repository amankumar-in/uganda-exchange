import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendMailClient } from 'zeptomail';

@Injectable()
export class EmailService {
  private client: SendMailClient;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiToken = this.configService.get<string>('ZEPTOMAIL_API_TOKEN');
    this.fromEmail = this.configService.get<string>('FROM_EMAIL') || 'noreply@example.com';
    
    console.log('ZeptoMail Config:', {
      hasToken: !!apiToken,
      tokenLength: apiToken?.length,
      fromEmail: this.fromEmail,
    });
    
    if (apiToken && apiToken !== 'your_zeptomail_api_token_here') {
      // ZeptoMail expects the token with 'Zoho-enczapikey' prefix
      const formattedToken = apiToken.startsWith('Zoho-enczapikey') 
        ? apiToken 
        : `Zoho-enczapikey ${apiToken}`;
      
      this.client = new SendMailClient({ url: 'api.zeptomail.com/', token: formattedToken });
      console.log('✅ ZeptoMail client initialized');
    } else {
      console.warn('⚠️  ZeptoMail not configured - API token missing or placeholder');
    }
  }

  async sendOTP(to: string, otp: string, type: 'email' | 'phone' = 'email') {
    if (!this.client) {
      console.warn('ZeptoMail not configured, skipping email send');
      return;
    }

    const subject = type === 'email' ? 'Email Verification Code' : 'Phone Verification Code';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verification Code</h2>
        <p>Your verification code is:</p>
        <h1 style="background: #f4f4f4; padding: 20px; text-align: center; letter-spacing: 5px;">
          ${otp}
        </h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">General Exchange</p>
      </div>
    `;

    try {
      await this.client.sendMail({
        from: {
          address: this.fromEmail,
          name: 'General Exchange',
        },
        to: [
          {
            email_address: {
              address: to,
              name: '',
            },
          },
        ],
        subject,
        htmlbody: html,
      });
      console.log(`OTP email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendPasswordReset(to: string, resetToken: string) {
    if (!this.client) {
      console.warn('ZeptoMail not configured, skipping email send');
      return;
    }

    const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset?token=${resetToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="background: #f4f4f4; padding: 10px; word-break: break-all;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">General Exchange</p>
      </div>
    `;

    try {
      await this.client.sendMail({
        from: {
          address: this.fromEmail,
          name: 'General Exchange',
        },
        to: [
          {
            email_address: {
              address: to,
              name: '',
            },
          },
        ],
        subject: 'Password Reset Request',
        htmlbody: html,
      });
      console.log(`Password reset email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  async sendWelcome(to: string, name: string) {
    if (!this.client) {
      console.warn('ZeptoMail not configured, skipping email send');
      return;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to General Exchange!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for joining General Exchange. Your account has been successfully created.</p>
        <p>You can now:</p>
        <ul>
          <li>Complete your KYC verification</li>
          <li>Deposit funds via wire transfer or credit card</li>
          <li>Start trading cryptocurrencies</li>
          <li>Use our P2P marketplace</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${this.configService.get('FRONTEND_URL')}/onboarding" style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Complete KYC
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">General Exchange</p>
      </div>
    `;

    try {
      await this.client.sendMail({
        from: {
          address: this.fromEmail,
          name: 'General Exchange',
        },
        to: [
          {
            email_address: {
              address: to,
              name,
            },
          },
        ],
        subject: 'Welcome to General Exchange',
        htmlbody: html,
      });
      console.log(`Welcome email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}
