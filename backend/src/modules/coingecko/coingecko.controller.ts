import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CoinGeckoService } from './coingecko.service';

@Controller('coingecko')
export class CoinGeckoController {
  constructor(private readonly coinGeckoService: CoinGeckoService) {}

  /**
   * GET /coingecko/token/id/:id
   * Get detailed token information by CoinGecko ID
   */
  @Get('token/id/:id')
  async getTokenDetailsById(@Param('id') id: string) {
    try {
      const tokenData = await this.coinGeckoService.getTokenDetailsById(id);

      if (!tokenData) {
        throw new HttpException(
          `Token with ID ${id} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return { success: true, token: tokenData };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to fetch token details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coingecko/coins/:id/ohlc
   * Get OHLC data for a coin
   */
  @Get('coins/:id/ohlc')
  async getCoinOHLC(@Param('id') id: string, @Query('days') days: string) {
    try {
      const data = await this.coinGeckoService.getCoinOHLC(id, parseInt(days || '1'));
      return { success: true, data };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch OHLC data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coingecko/token/:symbol
   * Get detailed token information including description, links, and market data
   */
  @Get('token/:symbol')
  async getTokenDetails(@Param('symbol') symbol: string) {
    try {
      const tokenData = await this.coinGeckoService.getTokenDetails(symbol);

      if (!tokenData) {
        throw new HttpException(
          `Token ${symbol} not found`,
          HttpStatus.NOT_FOUND,
        );
      }

      return { success: true, token: tokenData };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to fetch token details',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coingecko/markets
   * Get market list with basic data for all major tokens
   */
  @Get('markets')
  async getMarketsList(
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('sparkline') sparkline?: string,
    @Query('ids') ids?: string,
  ) {
    try {
      const markets = await this.coinGeckoService.getMarketsList(
        page ? parseInt(page) : 1,
        perPage ? parseInt(perPage) : 100,
        sparkline === 'true',
        ids,
      );

      return { success: true, markets };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch markets',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coingecko/trending
   * Get trending coins
   */
  @Get('trending')
  async getTrending() {
    try {
      const trending = await this.coinGeckoService.getTrending();
      return { success: true, trending };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch trending',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coingecko/global
   * Get global market data
   */
  @Get('global')
  async getGlobalData() {
    try {
      const globalData = await this.coinGeckoService.getGlobalData();

      if (!globalData) {
        throw new HttpException(
          'Failed to fetch global data',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return { success: true, data: globalData };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        error.message || 'Failed to fetch global data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /coingecko/prices
   * Get simple prices for multiple tokens
   */
  @Get('prices')
  async getSimplePrices(@Query('symbols') symbols: string) {
    try {
      if (!symbols) {
        return { success: true, prices: {} };
      }

      const symbolList = symbols.split(',').map((s) => s.trim().toUpperCase());
      const prices = await this.coinGeckoService.getSimplePrices(symbolList);

      return { success: true, prices };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch prices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

