import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DemoCollegeCoinsService } from './demo-college-coins.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('demo-college-coins')
export class DemoCollegeCoinsController {
  constructor(private readonly collegeCoinsService: DemoCollegeCoinsService) {}

  /**
   * Get list of reference tokens that can be used for pegging
   * Public endpoint
   */
  @Get('reference-tokens')
  getReferenceTokens() {
    return {
      success: true,
      tokens: this.collegeCoinsService.getReferenceTokens(),
    };
  }

  /**
   * Get all active demo college coins with calculated prices
   * Public endpoint (for markets page, etc.)
   */
  @Get()
  async findAll() {
    const coins = await this.collegeCoinsService.findAllWithPrices();
    return {
      success: true,
      coins,
    };
  }

  /**
   * Get a single demo college coin by ticker with calculated price
   * Public endpoint
   */
  @Get(':ticker')
  async findByTicker(@Param('ticker') ticker: string) {
    const coin = await this.collegeCoinsService.findByTicker(ticker);

    if (!coin) {
      return {
        success: false,
        message: `Demo college coin with ticker ${ticker} not found`,
      };
    }

    // Get calculated price
    const priceData = await this.collegeCoinsService.calculatePrice(ticker);

    return {
      success: true,
      coin: {
        ...coin,
        currentPrice: priceData?.collegeCoinPrice || 0,
        referencePrice: priceData?.referencePrice || 0,
      },
    };
  }

  /**
   * Check if a ticker is a demo college coin
   * Protected endpoint (for trade validation)
   */
  @Get('check/:ticker')
  @UseGuards(JwtAuthGuard)
  async checkTicker(@Param('ticker') ticker: string) {
    const isDemoCollegeCoin = await this.collegeCoinsService.isDemoCollegeCoin(ticker);
    return {
      success: true,
      isDemoCollegeCoin,
    };
  }
}
