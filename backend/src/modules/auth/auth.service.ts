import { Injectable, UnauthorizedException, BadRequestException, ConflictException, Inject, forwardRef, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { OtpService } from './otp.service';
import { LearnerService } from '../learner/learner.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

function splitFullName(primary?: string | null, fallback?: string | null): { firstName: string | null; lastName: string | null } {
  const name = (primary || fallback || '').trim();
  if (!name) return { firstName: null, lastName: null };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private configService: ConfigService,
    @Inject(forwardRef(() => LearnerService))
    private learnerService: LearnerService,
  ) {}

  /**
   * Register new user (2-step process)
   */
  async register(registerDto: RegisterDto) {
    const { phone, phoneCountry, password, otpEmail, otpPhone, country } = registerDto;
    // Normalize email to lowercase for case-insensitive matching
    const email = registerDto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.client.user.findFirst({
      where: {
        OR: [
          { email },
          { phone, phoneCountry },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException('Email or phone number already registered');
    }

    // Check for admin auto-registration (one-time, no OTP required)
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL')?.toLowerCase().trim();
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');
    const isAdminRegistration = adminEmail && adminPassword && email === adminEmail && password === adminPassword;

    if (isAdminRegistration) {
      this.logger.log('Admin registration detected - creating admin account without OTP');
      
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await this.prisma.client.user.create({
        data: {
          email,
          phone,
          phoneCountry,
          passwordHash,
          country,
          emailVerified: true,
          phoneVerified: true,
          role: 'ADMIN',
          kycStatus: 'APPROVED',
          appMode: 'INVESTOR',
        },
      });

      // Initialize learner account for admin as well
      try {
        await this.learnerService.initializeLearnerAccount(user.id);
        this.logger.log(`Initialized learner account for admin user ${user.id}`);
      } catch (error) {
        this.logger.error(`Failed to initialize learner account for admin ${user.id}`, error);
      }

      return {
        message: 'Admin account created successfully. Please login.',
      };
    }

    // Step 1: No OTPs provided - send both email + phone OTPs
    if (!otpEmail || !otpPhone) {
      await Promise.all([
        this.otpService.sendEmailOtp(email, 'REGISTER'),
        this.otpService.sendPhoneOtp(phoneCountry, phone, 'REGISTER'),
      ]);

      return {
        message: 'Verification codes sent to your email and phone',
      };
    }

    // Step 2: Both OTPs provided - verify and create account
    const [emailValid, phoneValid] = await Promise.all([
      this.otpService.verifyEmailOtp(email, otpEmail, 'REGISTER'),
      this.otpService.verifyPhoneOtp(phoneCountry, phone, otpPhone, 'REGISTER'),
    ]);

    if (!emailValid) {
      throw new BadRequestException('Invalid or expired email verification code');
    }

    if (!phoneValid) {
      throw new BadRequestException('Invalid or expired phone verification code');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    console.log(`[SIGNUP DEBUG] Step 1: Creating user ${email}`);
    const startCreate = Date.now();

    // Create user — auto-approve KYC, start in INVESTOR mode (no KYC required)
    const user = await this.prisma.client.user.create({
      data: {
        email,
        phone,
        phoneCountry,
        passwordHash,
        country,
        emailVerified: true,
        phoneVerified: true,
        role: 'USER',
        kycStatus: 'APPROVED',
        appMode: 'INVESTOR',
      },
    });

    console.log(`[SIGNUP DEBUG] Step 2: User created ${user.id} in ${Date.now() - startCreate}ms`);

    // Initialize learner account with $10,000 virtual balance
    try {
      console.log(`[SIGNUP DEBUG] Step 3: Starting learner account initialization for ${user.id}`);
      const startInit = Date.now();
      await this.learnerService.initializeLearnerAccount(user.id);
      console.log(`[SIGNUP DEBUG] Step 4: Learner account initialized for ${user.id} in ${Date.now() - startInit}ms`);
      this.logger.log(`Initialized learner account for new user ${user.id}`);
    } catch (error) {
      console.log(`[SIGNUP DEBUG] Step 4 FAILED: Learner init failed for ${user.id}`, error);
      this.logger.error(`Failed to initialize learner account for user ${user.id}`, error);
      // Don't fail registration if learner account initialization fails
      // It will be created on first learner mode access
    }

    console.log(`[SIGNUP DEBUG] Step 5: Returning success for ${user.id}, total time: ${Date.now() - startCreate}ms`);
    return {
      message: 'Account created successfully. Please login.',
    };
  }

  /**
   * Login user with email and password
   */
  async login(loginDto: LoginDto) {
    const { password } = loginDto;
    // Normalize email to lowercase for case-insensitive matching
    const email = loginDto.email.toLowerCase().trim();

    console.log(`[LOGIN DEBUG] Login attempt for email: ${email}`);

    // Find user with KYC data for name
    const user = await this.prisma.client.user.findUnique({
      where: { email },
      include: {
        kyc: {
          select: {
            aadhaarName: true,
            panName: true,
          },
        },
      },
    });

    if (!user) {
      console.log(`[LOGIN DEBUG] No user found for email: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    console.log(`[LOGIN DEBUG] Found user: id=${user.id}, email=${user.email}`);

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      console.log(`[LOGIN DEBUG] Invalid password for user: ${user.id}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate JWT token
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    console.log(`[LOGIN DEBUG] Login successful: id=${user.id}, email=${user.email}`);

    // Return user info (excluding sensitive data)
    return {
      message: 'Login successful',
      otp: '', // For compatibility with frontend
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        phoneCountry: user.phoneCountry,
        country: user.country,
        kycStatus: user.kycStatus,
        appMode: user.appMode,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        firstName: splitFullName(user.kyc?.aadhaarName, user.kyc?.panName).firstName,
        lastName: splitFullName(user.kyc?.aadhaarName, user.kyc?.panName).lastName,
      },
    };
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
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
        role: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        learnerWelcomeSeenAt: true,
        kyc: {
          select: {
            aadhaarName: true,
            panName: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Flatten kyc name fields into user object for convenience
    const { firstName, lastName } = splitFullName(user.kyc?.aadhaarName, user.kyc?.panName);
    return {
      ...user,
      firstName,
      lastName,
      kyc: undefined, // Remove nested kyc object
    };
  }

  /**
   * Mark the learner-mode WelcomeModal as seen for this user. Idempotent: only
   * writes if the flag is currently null, so re-clicks don't keep updating
   * the timestamp.
   */
  async markLearnerWelcomeSeen(userId: string) {
    await this.prisma.client.user.updateMany({
      where: { id: userId, learnerWelcomeSeenAt: null },
      data: { learnerWelcomeSeenAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Step 1: Request password reset - sends OTP to email
   */
  async forgotPassword(rawEmail: string) {
    const email = rawEmail.toLowerCase().trim();
    const user = await this.prisma.client.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists
      return {
        message: 'If an account exists with this email, a verification code has been sent.',
        nextStep: 'VERIFY',
        token: '',
      };
    }

    // Send OTP to email
    await this.otpService.sendEmailOtp(email, 'RESET');

    // Generate session token for this reset flow
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'password-reset-session' },
      { expiresIn: '1h' },
    );

    return {
      message: 'Verification code sent to your email.',
      nextStep: 'VERIFY',
      token,
    };
  }

  /**
   * Step 2: Verify OTP code
   */
  async verifyResetOtp(otp: string, token: string) {
    try {
      // Verify session token
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'password-reset-session') {
        throw new BadRequestException('Invalid session token');
      }

      // Verify OTP
      const isValid = await this.otpService.verifyEmailOtp(payload.email, otp, 'RESET');

      if (!isValid) {
        throw new BadRequestException('Invalid or expired verification code');
      }

      return {
        message: 'Verification successful. Please enter your new password.',
        nextStep: 'NEW_PASSWORD',
      };
    } catch (error) {
      throw new BadRequestException('Invalid or expired verification code');
    }
  }

  /**
   * Step 3: Set new password
   */
  async setNewPassword(password: string, token: string) {
    try {
      // Verify session token
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'password-reset-session') {
        throw new BadRequestException('Invalid session token');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update password
      await this.prisma.client.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      });

      return {
        message: 'Password changed successfully.',
        nextStep: 'FINISH',
      };
    } catch (error) {
      throw new BadRequestException('Invalid or expired session');
    }
  }
}
