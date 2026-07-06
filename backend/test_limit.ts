import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  const user = await prisma.user.findUnique({ where: { email: 'admin@ugcoin.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('User ID:', user.id);
  
  const depositHistory = await prisma.fiatTransaction.findMany({
    where: { userId: user.id, type: 'DEPOSIT' },
  });
  
  console.log('Total transactions:', depositHistory.length);
  
  let totalCompleted = 0;
  for (const tx of depositHistory) {
    console.log(`- Amount: ${tx.amount}, Status: ${tx.status}, Method: ${tx.method}, Date: ${tx.createdAt}`);
    if (tx.status === 'COMPLETED') {
      totalCompleted += Number(tx.amount);
    }
  }
  
  console.log('Total completed deposits:', totalCompleted);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => console.error(e));
