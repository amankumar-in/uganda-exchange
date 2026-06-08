import 'dotenv/config';

async function main() {
  const key = process.env.PESAPAL_CONSUMER_KEY;
  const secret = process.env.PESAPAL_CONSUMER_SECRET;
  
  if (!key || !secret) {
    console.error('❌ Missing PESAPAL_CONSUMER_KEY or PESAPAL_CONSUMER_SECRET in backend/.env');
    process.exit(1);
  }

  // Ensure user passed a URL
  const ipnUrl = process.argv[2];
  if (!ipnUrl) {
    console.error('❌ Please provide your webhook URL as an argument.');
    console.error('Usage: npx ts-node scripts/register-pesapal-ipn.ts <YOUR_URL>');
    console.error('Example: npx ts-node scripts/register-pesapal-ipn.ts https://my-render-app.onrender.com/api/webhooks/pesapal');
    process.exit(1);
  }

  console.log('🔑 Authenticating with Pesapal...');
  
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

  console.log(`📡 Registering IPN URL: ${ipnUrl} ...`);
  const registerRes = await fetch('https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      url: ipnUrl,
      ipn_notification_type: 'POST' // Usually POST for most modern webhooks
    })
  });

  if (!registerRes.ok) {
    console.error('❌ Failed to register IPN:', await registerRes.text());
    process.exit(1);
  }

  const response = await registerRes.json();
  
  console.log('\n=======================================');
  console.log('✅ IPN REGISTERED SUCCESSFULLY!');
  console.log('=======================================');
  console.log(`URL: ${response.url}`);
  console.log(`IPN ID: ${response.ipn_id}`);
  console.log('=======================================');
  console.log('\n👉 Add this IPN ID to your Render Environment Variables as: PESAPAL_IPN_ID\n');
}

main().catch(console.error);
