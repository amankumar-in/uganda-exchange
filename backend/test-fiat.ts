import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const agg = await prisma.fiatBalance.aggregate({
    _sum: { balance: true },
    _count: true,
  });
  console.log('agg:', JSON.stringify(agg, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
