/**
 * One-time seed: pulls Coinbase's public product catalog, resolves a CoinGecko ID
 * for each base currency, and upserts into the tokens table with uganda defaults
 * (allowTradeInr=true, all trading enabled, isActive=true).
 *
 * Safe to re-run — upserts by symbol, doesn't touch rows that already exist
 * unless they're missing a coingeckoId.
 *
 * Run: npx ts-node scripts/seed-uganda-tokens.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const COINBASE_PRODUCTS = 'https://api.exchange.coinbase.com/products';
const COINGECKO_COINS_LIST = 'https://api.coingecko.com/api/v3/coins/list';
const COINGECKO_MARKETS = 'https://api.coingecko.com/api/v3/coins/markets';

interface CoinbaseProduct {
  id: string;
  base_currency: string;
  quote_currency: string;
  base_name?: string;
  display_name?: string;
  status?: string;
  trading_disabled?: boolean;
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
}

async function fetchCoinbaseProducts(): Promise<CoinbaseProduct[]> {
  const res = await fetch(COINBASE_PRODUCTS);
  if (!res.ok) throw new Error(`Coinbase /products failed: ${res.status}`);
  return await res.json();
}

const cgHeaders: Record<string, string> = process.env.COINGECKO_API_KEY 
  ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY } 
  : {};

async function fetchCoinGeckoList(): Promise<CoinGeckoCoin[]> {
  const res = await fetch(COINGECKO_COINS_LIST, { headers: cgHeaders });
  if (!res.ok) throw new Error(`CoinGecko /coins/list failed: ${res.status}`);
  return await res.json();
}

/**
 * Pull top-N coins by market cap from CoinGecko. These are the canonical IDs
 * for common symbols (BTC→bitcoin, ETH→ethereum) — so we match against these first
 * before falling back to the unranked full coins list.
 */
async function fetchTopMarketCaps(pages = 4): Promise<CoinGeckoCoin[]> {
  const all: CoinGeckoCoin[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${COINGECKO_MARKETS}?vs_currency=inr&per_page=250&page=${page}&order=market_cap_desc`;
    const res = await fetch(url, { headers: cgHeaders });
    if (!res.ok) {
      console.warn(`  /coins/markets page ${page} returned ${res.status}`);
      // back off if rate-limited so we don't poison subsequent pages
      if (res.status === 429) await sleep(15_000);
      continue;
    }
    const data = await res.json();
    all.push(...data.map((c: any) => ({ id: c.id, symbol: c.symbol, name: c.name })));
    await sleep(1500); // CoinGecko free tier courtesy
  }
  return all;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Known canonical CoinGecko ids for popular symbols. This short-circuits the
 * heuristic search for the most common tokens where symbol collisions
 * (e.g. "BTC" resolving to a meme coin) would be catastrophic.
 */
const CANONICAL_COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  SHIB: 'shiba-inu',
  TRX: 'tron',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
  FIL: 'filecoin',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  NEAR: 'near',
  ETC: 'ethereum-classic',
  ALGO: 'algorand',
  ICP: 'internet-computer',
  VET: 'vechain',
  GRT: 'the-graph',
  AAVE: 'aave',
  MKR: 'maker',
  XTZ: 'tezos',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  EGLD: 'elrond-erd-2',
  HBAR: 'hedera-hashgraph',
  FTM: 'fantom',
  THETA: 'theta-token',
  CRV: 'curve-dao-token',
  COMP: 'compound-governance-token',
  SNX: 'havven',
  SUSHI: 'sushi',
  YFI: 'yearn-finance',
  DAI: 'dai',
  PEPE: 'pepe',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  JUP: 'jupiter-exchange-solana',
  SUI: 'sui',
  SEI: 'sei-network',
  TIA: 'celestia',
  INJ: 'injective-protocol',
  RNDR: 'render-token',
  IMX: 'immutable-x',
  STX: 'blockstack',
  CHZ: 'chiliz',
  FLOW: 'flow',
  EOS: 'eos',
};

/**
 * Pick the CoinGecko id for a given symbol. Priority:
 *   1. Symbol match within the top-market-cap list (canonical BTC→bitcoin, ETH→ethereum)
 *      with a preference for matching Coinbase base_name where available
 *   2. Symbol match within the full coins list, preferring name match
 *   3. Undefined (no guess — better no price than a wrong price)
 */
function resolveCoingeckoId(
  symbol: string,
  baseName: string | undefined,
  topList: CoinGeckoCoin[],
  fullList: CoinGeckoCoin[],
): string | undefined {
  // 1. Hardcoded canonical map — short-circuits the top-50-ish symbols where
  //    collisions on the CoinGecko list would otherwise pick junk (e.g. BTC→batcat).
  const canonical = CANONICAL_COINGECKO_IDS[symbol.toUpperCase()];
  if (canonical) return canonical;

  const lowerSym = symbol.toLowerCase();
  const lowerName = baseName?.toLowerCase();

  const pickBest = (matches: CoinGeckoCoin[]): string | undefined => {
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0].id;
    if (lowerName) {
      const byName = matches.find(c => c.name.toLowerCase() === lowerName);
      if (byName) return byName.id;
    }
    return matches[0].id; // top-ranked (caller preserves rank)
  };

  // 2. Top-market-cap list preserves market-cap order
  const topMatches = topList.filter(c => c.symbol.toLowerCase() === lowerSym);
  const topPick = pickBest(topMatches);
  if (topPick) return topPick;

  // 3. Full list — only take single or name-match to avoid guessing wrong
  const fullMatches = fullList.filter(c => c.symbol.toLowerCase() === lowerSym);
  if (fullMatches.length === 1) return fullMatches[0].id;
  if (fullMatches.length > 1 && lowerName) {
    const byName = fullMatches.find(c => c.name.toLowerCase() === lowerName);
    if (byName) return byName.id;
  }

  return undefined;
}

async function main() {
  console.log('Fetching Coinbase products...');
  const products = await fetchCoinbaseProducts();
  const liveProducts = products.filter(
    p => p.status === 'online' && !p.trading_disabled,
  );
  console.log(`  ${liveProducts.length} live products`);

  // Unique base currencies
  const uniqueBases = new Map<string, string>(); // symbol → name
  liveProducts.forEach(p => {
    const name = p.base_name || p.display_name?.split(' ')[0] || p.base_currency;
    if (!uniqueBases.has(p.base_currency)) {
      uniqueBases.set(p.base_currency, name);
    }
  });
  console.log(`  ${uniqueBases.size} unique base currencies`);

  console.log('Fetching CoinGecko top market-caps...');
  const topList = await fetchTopMarketCaps(4);
  console.log(`  ${topList.length} top-ranked CoinGecko coins`);

  console.log('Fetching CoinGecko full coin list...');
  const uniqueSymbols = new Set(Array.from(uniqueBases.keys()).map(k => k.toLowerCase()));
  const fullListRaw = await fetchCoinGeckoList();
  // Filter immediately to let V8 garbage collect the massive 15,000+ item array
  const fullList = fullListRaw.filter(c => uniqueSymbols.has(c.symbol.toLowerCase()));
  console.log(`  ${fullList.length} CoinGecko coins matched (freed memory for ${fullListRaw.length - fullList.length} unused)`);

  // Load global defaults once — fall back to hard defaults if singleton doesn't exist
  const defaults = await prisma.globalAssetSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      defaultAllowBuy: true,
      defaultAllowSell: true,
      defaultAllowP2P: true,
      defaultAllowDeposit: true,
      defaultAllowWithdraw: true,
      defaultAllowTradeInr: true,
      defaultAllowTradeUsdt: true,
      defaultAllowTradeEth: true,
      defaultAllowTradeTuit: false,
      defaultMinTransaction: 100,
      defaultMaxTransaction: 1000000,
    },
    update: {},
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [symbol, name] of uniqueBases) {
    const existing = await prisma.token.findUnique({ where: { symbol } });
    const coingeckoId = resolveCoingeckoId(symbol, name, topList, fullList);

    if (existing) {
      // Overwrite coingeckoId — earlier runs may have picked a wrong id
      if (coingeckoId && existing.coingeckoId !== coingeckoId) {
        await prisma.token.update({
          where: { symbol },
          data: { coingeckoId },
        });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.token.create({
      data: {
        symbol,
        name,
        coingeckoId,
        isActive: true,
        allowBuy: defaults.defaultAllowBuy,
        allowSell: defaults.defaultAllowSell,
        allowP2P: defaults.defaultAllowP2P,
        allowDeposit: defaults.defaultAllowDeposit,
        allowWithdraw: defaults.defaultAllowWithdraw,
        allowTradeInr: defaults.defaultAllowTradeInr,
        allowTradeUsdt: defaults.defaultAllowTradeUsdt,
        allowTradeEth: defaults.defaultAllowTradeEth,
        allowTradeTuit: defaults.defaultAllowTradeTuit,
        minTransactionAmount: Number(defaults.defaultMinTransaction),
        maxTransactionAmount: Number(defaults.defaultMaxTransaction),
        miningBaseRate: defaults.defaultMiningBaseRate,
        miningSessionHours: defaults.defaultMiningSessionHours,
      },
    });
    created++;
  }

  console.log('Seed complete.');
  console.log(`  created: ${created}`);
  console.log(`  filled coingeckoId on existing: ${updated}`);
  console.log(`  skipped (already present): ${skipped}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // CRITICAL: Close the pg pool so the process can exit, otherwise memory stacks up!
  });
