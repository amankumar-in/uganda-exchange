
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { CreateTokenDto } from './dto/create-token.dto';
import { UpdateTokenDto } from './dto/update-token.dto';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Post()
  create(@Body() createTokenDto: CreateTokenDto) {
    return this.tokensService.create(createTokenDto);
  }

  @Get()
  async findAll(@Query('includePrices') includePrices: string) {
    if (includePrices === 'true') {
      return this.tokensService.fetchPrices();
    }
    return this.tokensService.findAll();
  }

  @Get('search-coingecko')
  searchCoinGecko(@Query('query') query: string) {
    return this.tokensService.searchCoinGecko(query);
  }

  @Get('symbol/:symbol')
  findBySymbol(@Param('symbol') symbol: string) {
    return this.tokensService.findBySymbol(symbol);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tokensService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateTokenDto: UpdateTokenDto) {
    return this.tokensService.update(id, updateTokenDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tokensService.remove(id);
  }
}
