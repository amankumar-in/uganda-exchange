
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'eyeclik@gmail.com';
  console.log(`Checking balances for ${email}...`);
  
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

  console.log('--- INVESTOR MODE (Live) ---');
  console.log('FiatBalance (table):', user.fiatBalance);
  console.log('CryptoBalance (table):', JSON.stringify(user.cryptoBalances, null, 2));

  console.log('\n--- LEARNER MODE (Virtual) ---');
  console.log('LearnerFiatBalance:', user.learnerFiatBalance);
  console.log('LearnerCryptoBalances:', JSON.stringify(user.learnerCryptoBalances, null, 2));
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
