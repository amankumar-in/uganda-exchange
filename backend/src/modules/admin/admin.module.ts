import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma.service';
import { DemoCollegeCoinsModule } from '../demo-college-coins/demo-college-coins.module';
import { AuthModule } from '../auth/auth.module';
import { LearnerModule } from '../learner/learner.module';
import { KycModule } from '../kyc/kyc.module';

@Module({
  imports: [DemoCollegeCoinsModule, AuthModule, forwardRef(() => LearnerModule), KycModule],
  controllers: [AdminController],
  providers: [AdminService, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}

