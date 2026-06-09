import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const LAND_LOCATIONS = [
  { symbol: 'KLA-L1', name: 'Kampala City Center Plot', address: 'Plot 10, Kampala Road, Kampala' },
  { symbol: 'EBB-L1', name: 'Entebbe Lakefront Estate', address: 'Block 4, Nakiwogo, Entebbe' },
  { symbol: 'JIN-L1', name: 'Jinja Industrial Acre', address: 'Plot 45, Walukuba, Jinja' },
  { symbol: 'GUL-L1', name: 'Gulu Commercial Center', address: 'Plot 22, Main Street, Gulu' },
  { symbol: 'MBR-L1', name: 'Mbarara Bypass Parcel', address: 'Block 2, Mbarara Bypass, Mbarara' },
  { symbol: 'MBL-L1', name: 'Mbale Highway Plot', address: 'Plot 8, Republic Street, Mbale' },
  { symbol: 'FPT-L1', name: 'Fort Portal Tourism Estate', address: 'Block 7, Boma, Fort Portal' },
  { symbol: 'LIR-L1', name: 'Lira Agrotech Park', address: 'Plot 14, Obote Avenue, Lira' },
  { symbol: 'MSK-L1', name: 'Masaka Highway Junction', address: 'Block 1, Nyendo, Masaka' },
  { symbol: 'ARU-L1', name: 'Arua Border Trade Plot', address: 'Plot 33, Transport Road, Arua' },
  { symbol: 'SOR-L1', name: 'Soroti Aviation Strip', address: 'Plot 11, Soroti Road, Soroti' },
  { symbol: 'KBL-L1', name: 'Kabale Highland Estate', address: 'Block 5, Makanga Hill, Kabale' },
  { symbol: 'HOI-L1', name: 'Hoima Oil District Plot', address: 'Plot 2, Kigorobya, Hoima' },
  { symbol: 'MKN-L1', name: 'Mukono Industrial Park', address: 'Block 11, Namanve, Mukono' },
  { symbol: 'WKS-L1', name: 'Wakiso Residential Acre', address: 'Plot 18, Nansana, Wakiso' },
  { symbol: 'TOR-L1', name: 'Tororo Mineral Hub', address: 'Plot 7, Tororo Road, Tororo' },
  { symbol: 'KSE-L1', name: 'Kasese Copper Estate', address: 'Block 3, Kilembe, Kasese' },
  { symbol: 'IGA-L1', name: 'Iganga Transit Center', address: 'Plot 12, Main Street, Iganga' },
  { symbol: 'BUS-L1', name: 'Busia Customs Plot', address: 'Plot 4, Customs Road, Busia' },
  { symbol: 'MRT-L1', name: 'Moroto Mining Reserve', address: 'Block 8, Karamoja District, Moroto' }
];

const LAND_TOKENS = LAND_LOCATIONS.map((land) => ({
  symbol: land.symbol,
  name: land.name,
  assetType: 'LAND' as const,
  landAddress: land.address,
  manualPrice: 5000 + (Math.random() * 15000), // Random base value between 5k and 20k
}));

const COMMODITIES = [
  { symbol: 'COFFEE', name: 'Uganda Premium Robusta Coffee', type: 'Coffee' },
  { symbol: 'GOLD', name: 'Karamoja Refined Gold', type: 'Gold' },
  { symbol: 'COTTON', name: 'Kasese Raw Cotton', type: 'Cotton' },
  { symbol: 'TEA', name: 'Fort Portal Green Tea', type: 'Tea' },
  { symbol: 'COPPER', name: 'Kilembe Industrial Copper', type: 'Copper' },
  { symbol: 'COBALT', name: 'Uganda Purified Cobalt', type: 'Cobalt' },
  { symbol: 'VANILLA', name: 'Mukono Bourbon Vanilla', type: 'Vanilla' },
  { symbol: 'COCOA', name: 'Bundibugyo Organic Cocoa', type: 'Cocoa' },
  { symbol: 'SUGAR', name: 'Kakira Refined Sugar', type: 'Sugar' },
  { symbol: 'SESAME', name: 'Northern Simsim (Sesame)', type: 'Sesame' },
  { symbol: 'TIN', name: 'Ankole Extracted Tin', type: 'Tin' },
  { symbol: 'WOLFRAM', name: 'Kigezi Wolfram (Tungsten)', type: 'Tungsten' },
  { symbol: 'TOBACCO', name: 'West Nile Cured Tobacco', type: 'Tobacco' },
  { symbol: 'FISH', name: 'Lake Victoria Nile Perch', type: 'Fish' },
  { symbol: 'MAIZE', name: 'Busoga Dried Maize', type: 'Maize' },
  { symbol: 'CEMENT', name: 'Tororo Portland Cement', type: 'Cement' },
  { symbol: 'TIMBER', name: 'Mabira Mahogany Timber', type: 'Timber' },
  { symbol: 'IRON', name: 'Muko High-Grade Iron Ore', type: 'Iron' },
  { symbol: 'JADE', name: 'Uganda Rare Jade', type: 'Jade' },
  { symbol: 'LIMESTONE', name: 'Hima Raw Limestone', type: 'Limestone' }
];

const COMMODITY_TOKENS = COMMODITIES.map((com) => ({
  symbol: com.symbol,
  name: com.name,
  assetType: 'COMMODITY' as const,
  commodityType: com.type,
  manualPrice: 10 + (Math.random() * 200),
}));

const CELEBRITIES = [
  { name: 'Henry Katabazi', symbol: 'HENRY' },
  { name: 'General of Uganda', symbol: 'GENUG' },
  { name: 'Stephen Kalonzo', symbol: 'KALONZO' },
  { name: 'Joshua Cheptegei', symbol: 'CHEP' },
  { name: 'Jacob Kiplimo', symbol: 'KIPLIMO' },
  { name: 'Eddy Kenzo', symbol: 'KENZO' },
  { name: 'Jose Chameleone', symbol: 'CHAME' },
  { name: 'Bobi Wine', symbol: 'BOBI' },
  { name: 'Bebe Cool', symbol: 'BCOOL' },
  { name: 'Juliana Kanyomozi', symbol: 'JULIA' },
  { name: 'Denis Onyango', symbol: 'DENIS' },
  { name: 'Quinn Abenakyo', symbol: 'QUINN' },
  { name: 'Sheebah Karungi', symbol: 'SHEEB' },
  { name: 'Vinka', symbol: 'VINKA' },
  { name: 'Spice Diana', symbol: 'SPICE' },
  { name: 'A Pass', symbol: 'APASS' },
  { name: 'John Blaq', symbol: 'BLAQ' },
  { name: 'Navio', symbol: 'NAVIO' },
  { name: 'Azawi', symbol: 'AZAWI' },
  { name: 'Fik Fameica', symbol: 'FAME' }
];

const CELEBRITY_TOKENS = CELEBRITIES.map((cel) => ({
  symbol: cel.symbol,
  name: `${cel.name} Official Token`,
  assetType: 'CELEBRITY' as const,
  celebrityName: cel.name,
  manualPrice: 10 + (Math.random() * 50),
}));

async function main() {
  console.log('Seeding Custom Assets...');

  const allTokens = [...LAND_TOKENS, ...COMMODITY_TOKENS, ...CELEBRITY_TOKENS];

  for (const token of allTokens) {
    await prisma.token.upsert({
      where: { symbol: token.symbol },
      update: {
        ...token,
        allowBuy: true,
        allowSell: true,
        allowTradeUgx: true,
        allowTradeUsdt: true,
        isActive: true,
        isNative: true,
      },
      create: {
        ...token,
        allowBuy: true,
        allowSell: true,
        allowTradeUgx: true,
        allowTradeUsdt: true,
        isActive: true,
        isNative: true,
      },
    });
  }

  console.log(`Seeded ${allTokens.length} custom assets.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
