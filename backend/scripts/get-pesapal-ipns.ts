import 'dotenv/config';

async function main() {
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  
  if (!key || !secret) {
    console.error('❌ Missing PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET in backend/.env');
    process.exit(1);
  }

  console.log('🔑 Authenticating with Pesapal...');
  
  // 1. Get Auth Token
  const authRes = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: key, consumer_secret: secret }),
  });

  if (!authRes.ok) {
    console.error('❌ Auth failed:', await authRes.text());
    process.exit(1);
  }

  const { token } = await authRes.json();
  console.log('✅ Successfully authenticated!');

  // 2. Get IPN List
  console.log('📡 Fetching registered IPNs from Pesapal...');
  const ipnRes = await fetch('https://pay.pesapal.com/v3/api/URLSetup/GetIpnList', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!ipnRes.ok) {
    console.error('❌ Failed to fetch IPN list:', await ipnRes.text());
    process.exit(1);
  }

  const ipns = await ipnRes.json();
  
  console.log('\n=======================================');
  console.log('📋 YOUR REGISTERED IPN URLs:');
  console.log('=======================================');
  
  if (!Array.isArray(ipns) || ipns.length === 0) {
    console.log('No IPNs registered yet.');
  } else {
    ipns.forEach((ipn: any, index: number) => {
      console.log(`\n[${index + 1}] URL: ${ipn.url}`);
      console.log(`    IPN ID: ${ipn.ipn_id}`);
      console.log(`    Status: ${ipn.status === 1 ? 'Active (1)' : ipn.status}`);
    });
  }
  
  console.log('\n=======================================');
  console.log('👉 Copy the IPN ID for your Render URL and put it in your Render Environment Variables as PESAPAL_IPN_ID');
}

main().catch(console.error);
