import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { execSync } from 'child_process';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Checking if database needs seeding...');

  // Ensure all custom assets are properly flagged as native
  await prisma.token.updateMany({
    where: { 
      assetType: { in: ['LAND', 'COMMODITY', 'CELEBRITY'] },
      isNative: false
    },
    data: { isNative: true }
  });

  const totalTokens = await prisma.token.count();
  const customCount = await prisma.token.count({
    where: {
      assetType: { in: ['LAND', 'COMMODITY', 'CELEBRITY'] }
    }
  });

  const standardCount = totalTokens - customCount;

  // 1. Check basic crypto tokens (seeded from CoinGecko API)
  // We skip this if they exist because we don't want to hit CoinGecko API limits on every deploy
  if (standardCount < 10) {
    console.log('Seeding Uganda Tokens (hitting CoinGecko API)...');
    execSync('npx ts-node scripts/seed-uganda-tokens.ts', { stdio: 'inherit' });
  } else {
    console.log(`✓ Uganda Tokens already seeded (${standardCount} found). Skipping CoinGecko fetch.`);
  }

  // 2. Always ensure custom assets are seeded/updated (Instant, no API calls)
  console.log('Seeding Custom Assets (using local upsert)...');
  execSync('npx ts-node scripts/seed-custom-assets.ts', { stdio: 'inherit' });

}

main()
  .catch(e => {
    console.error('Seeding check failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
