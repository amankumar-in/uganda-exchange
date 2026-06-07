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
  { ticker: 'XIT',  name: 'Xenon Institute of Technology',       peggedToAsset: 'BTC',  peggedPercentage: 0.01,  description: 'Fictional ugandan tech institute coin — learner mode only.' },
  { ticker: 'DPU',  name: 'Demo Public University',              peggedToAsset: 'ETH',  peggedPercentage: 0.1,   description: 'Fictional ugandan public university coin — learner mode only.' },
  { ticker: 'VGU',  name: 'Vishnav Global University',           peggedToAsset: 'ETH',  peggedPercentage: 0.05,  description: 'Fictional ugandan global university coin — learner mode only.' },
  { ticker: 'BIST', name: 'Bharat Institute of Science & Tech',  peggedToAsset: 'SOL',  peggedPercentage: 1.0,   description: 'Fictional ugandan STEM institute coin — learner mode only.' },
  { ticker: 'SIIM', name: 'Sample ugandan Institute of Mgmt',     peggedToAsset: 'BTC',  peggedPercentage: 0.005, description: 'Fictional ugandan business school coin — learner mode only.' },
  { ticker: 'NICT', name: 'National Inst. of Commerce & Tech',   peggedToAsset: 'SOL',  peggedPercentage: 0.5,   description: 'Fictional ugandan commerce-tech institute coin — learner mode only.' },
  { ticker: 'MRIT', name: 'Modern Rural Institute of Tech',      peggedToAsset: 'POL',   peggedPercentage: 10,    description: 'Fictional ugandan rural tech institute coin — learner mode only.' },
  { ticker: 'HCU',  name: 'Heritage College of Uplands',         peggedToAsset: 'ADA',  peggedPercentage: 5,     description: 'Fictional ugandan heritage college coin — learner mode only.' },
  { ticker: 'GEST', name: 'Ganga Estuary School of Technology',  peggedToAsset: 'DOT',  peggedPercentage: 2,     description: 'Fictional ugandan technology school coin — learner mode only.' },
  { ticker: 'TIDC', name: 'Tech Innovation Delta College',       peggedToAsset: 'AVAX', peggedPercentage: 1,     description: 'Fictional ugandan innovation college coin — learner mode only.' },
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
