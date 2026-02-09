import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MiningService } from './mining.service';

@Controller('mining')
@UseGuards(JwtAuthGuard)
export class MiningController {
  constructor(private readonly miningService: MiningService) {}

  // POST /api/mining/colleges/:tokenId - Add college to mining list
  @Post('colleges/:tokenId')
  async addCollege(@Request() req: any, @Param('tokenId') tokenId: string) {
    const entry = await this.miningService.addCollege(req.user.id, tokenId);
    return {
      success: true,
      message: 'College added to mining list',
      data: entry,
    };
  }

  // DELETE /api/mining/colleges/:tokenId - Remove college from mining list
  @Delete('colleges/:tokenId')
  async removeCollege(
    @Request() req: any,
    @Param('tokenId') tokenId: string,
  ) {
    await this.miningService.removeCollege(req.user.id, tokenId);
    return {
      success: true,
      message: 'College removed from mining list',
    };
  }

  // GET /api/mining/colleges - Get user's mining colleges
  @Get('colleges')
  async getUserColleges(@Request() req: any) {
    const colleges = await this.miningService.getUserColleges(req.user.id);
    return {
      success: true,
      data: colleges,
    };
  }

  // POST /api/mining/start/:tokenId - Start mining for a college
  @Post('start/:tokenId')
  async startMining(
    @Request() req: any,
    @Param('tokenId') tokenId: string,
  ) {
    const session = await this.miningService.startMining(
      req.user.id,
      tokenId,
    );
    return {
      success: true,
      message: 'Mining started successfully',
      data: session,
    };
  }

  // POST /api/mining/stop/:tokenId - Stop mining for a college
  @Post('stop/:tokenId')
  async stopMining(
    @Request() req: any,
    @Param('tokenId') tokenId: string,
  ) {
    const result = await this.miningService.stopMining(
      req.user.id,
      tokenId,
    );
    return {
      success: true,
      message: 'Mining stopped successfully',
      data: result,
    };
  }

  // POST /api/mining/stop-all - Stop all active mining sessions
  @Post('stop-all')
  async stopAllMining(@Request() req: any) {
    const result = await this.miningService.stopAllMining(req.user.id);
    return {
      success: true,
      message: `Stopped mining for ${result.stoppedCount} colleges`,
      data: result,
    };
  }

  // POST /api/mining/start-all - Start mining for all colleges
  @Post('start-all')
  async startAllMining(@Request() req: any) {
    const result = await this.miningService.startAllMining(req.user.id);
    return {
      success: true,
      message: `Started mining for ${result.startedCount} colleges`,
      data: result,
    };
  }

  // GET /api/mining/status - Get mining status for all colleges
  @Get('status')
  async getMiningStatus(@Request() req: any) {
    const status = await this.miningService.getMiningStatus(req.user.id);
    return {
      success: true,
      data: status,
    };
  }
}
