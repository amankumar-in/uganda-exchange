
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'eyeclik@gmail.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      fiatBalance: true,
      cryptoBalances: true,
      learnerFiatBalance: true,
      learnerCryptoBalances: true,
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
