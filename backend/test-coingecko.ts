
// Using native fetch (Node 18+)
async function testCoinGecko() {
  console.log('🔍 Testing CoinGecko API Connectivity...\n');

  try {
    // 1. Search for "pepe" to demonstrate multiple results
    console.log('1️⃣  Simulating "Smart Search Widget" (Query: "pepe")...');
    const searchRes = await fetch('https://api.coingecko.com/api/v3/search?query=pepe');
    
    if (!searchRes.ok) throw new Error(`Search API failed: ${searchRes.status}`);
    const searchData = await searchRes.json();
    
    console.log(`   Found ${searchData.coins.length} results. Showing top 5:\n`);
    
    // Show top 5 results
    searchData.coins.slice(0, 5).forEach((coin: any, index: number) => {
        console.log(`   [${index + 1}] ${coin.name} (${coin.symbol})`);
        console.log(`       ID: ${coin.id}`);
        console.log(`       Rank: ${coin.market_cap_rank}`);
        console.log(`       Thumb: ${coin.thumb}`);
        console.log('       -------------------');
    });

  } catch (e: any) {
    console.error('❌ API Error:', e.message);
  }
}

testCoinGecko();
