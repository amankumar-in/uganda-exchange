/**
 * Seed 10 fictional ugandan demo college coins for learner mode practice trading.
 * Names are intentionally non-real (no IIT/IIM/BITS/etc.) to avoid trademark issues.
 *
 * Safe to re-run — upserts by ticker.
 *
 * Run: npx ts-node scripts/seed-uganda-demo-colleges.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface Seed {
  ticker: string;
  name: string;
  peggedToAsset: string;
  peggedPercentage: number; // 0.1 = 0.1% of reference price
  description: string;
}

const COLLEGES: Seed[] = [
  { ticker: 'MAK',  name: 'Makerere Institute of Technology',    peggedToAsset: 'BTC',  peggedPercentage: 0.01,  description: 'Fictional Ugandan tech institute coin — learner mode only.' },
  { ticker: 'KCA',  name: 'Kampala City Academy',                peggedToAsset: 'ETH',  peggedPercentage: 0.1,   description: 'Fictional Ugandan public university coin — learner mode only.' },
  { ticker: 'UGU',  name: 'Uganda Global University',            peggedToAsset: 'ETH',  peggedPercentage: 0.05,  description: 'Fictional Ugandan global university coin — learner mode only.' },
  { ticker: 'EIST', name: 'Entebbe Institute of Science & Tech', peggedToAsset: 'SOL',  peggedPercentage: 1.0,   description: 'Fictional Ugandan STEM institute coin — learner mode only.' },
  { ticker: 'UIM',  name: 'Uganda Institute of Management',      peggedToAsset: 'BTC',  peggedPercentage: 0.005, description: 'Fictional Ugandan business school coin — learner mode only.' },
  { ticker: 'NICT', name: 'National Inst. of Commerce & Tech',   peggedToAsset: 'SOL',  peggedPercentage: 0.5,   description: 'Fictional Ugandan commerce-tech institute coin — learner mode only.' },
  { ticker: 'VRI',  name: 'Victoria Rural Institute of Tech',    peggedToAsset: 'POL',  peggedPercentage: 10,    description: 'Fictional Ugandan rural tech institute coin — learner mode only.' },
  { ticker: 'NIL',  name: 'Nile Heritage College',               peggedToAsset: 'ADA',  peggedPercentage: 5,     description: 'Fictional Ugandan heritage college coin — learner mode only.' },
  { ticker: 'KEST', name: 'Kagera School of Technology',         peggedToAsset: 'DOT',  peggedPercentage: 2,     description: 'Fictional Ugandan technology school coin — learner mode only.' },
  { ticker: 'RWI',  name: 'Ruwenzori Innovation College',        peggedToAsset: 'AVAX', peggedPercentage: 1,     description: 'Fictional Ugandan innovation college coin — learner mode only.' },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const c of COLLEGES) {
    const existing = await prisma.demoCollegeCoin.findUnique({ where: { ticker: c.ticker } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.demoCollegeCoin.create({
      data: {
        ticker: c.ticker,
        name: c.name,
        peggedToAsset: c.peggedToAsset,
        peggedPercentage: c.peggedPercentage,
        isActive: true,
        description: c.description,
        categories: ['Demo', 'uganda', 'College'],
      },
    });
    created++;
  }

  console.log('Demo college seed complete.');
  console.log(`  created: ${created}`);
  console.log(`  skipped (already present): ${skipped}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
