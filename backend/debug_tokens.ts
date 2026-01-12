
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const tokens = await prisma.token.findMany({
    where: {
      symbol: {
        contains: 'PEPE',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      symbol: true,
      name: true,
      coingeckoId: true,
      isActive: true,
    },
  });
  console.log(JSON.stringify(tokens, null, 2));
  await prisma.$disconnect();
}

main();
