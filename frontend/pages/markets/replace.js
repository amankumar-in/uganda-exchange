const fs = require('fs');

const file = '/Users/amankumar/Dev/coinsforcollege/uganda-exchange/frontend/pages/markets/[symbol].tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Change tokenData fallback in livePrice
content = content.replace(
  /tokenData\?\.market_data\?\.current_price\?\.inr \|\| 0/g,
  '0 /* fallback removed to enforce single source of truth */'
);

// 2. Change p.quote === 'USD' to p.quote === 'UGX'
content = content.replace(
  /p\.quote === 'USD'/g,
  "p.quote === 'UGX'"
);

// 3. Fix the context extraction to include usdUgxRate
content = content.replace(
  /const { pairs, setSelectedPair } = useExchange\(\);/g,
  'const { pairs, setSelectedPair, usdUgxRate } = useExchange();'
);

// 4. Dates don't need multiplication
content = content.replace(/\.inr \? "Market Cap" : "FDV"/g, '.usd > 0 ? "Market Cap" : "FDV"');
content = content.replace(/\.ath_date\.inr/g, '.ath_date.usd');
content = content.replace(/\.atl_date\.inr/g, '.atl_date.usd');

// 5. Replace other metrics with ( .usd * usdUgxRate )
const metrics = [
  'current_price', 'market_cap', 'fully_diluted_valuation', 'total_volume',
  'high_24h', 'low_24h', 'ath', 'atl', 'ath_change_percentage', 'atl_change_percentage'
];

for (const metric of metrics) {
  const regex = new RegExp(`\\.market_data\\.?${metric}\\.?inr`, 'g');
  // If it's a change percentage, we don't multiply by exchange rate!
  if (metric.includes('percentage')) {
    content = content.replace(regex, `.market_data?.${metric}?.usd`);
  } else {
    // For price values, we multiply
    // Special handling for the cgData mock block around line 288
    content = content.replace(new RegExp(`current_price: \\{ inr: token\\.currentPrice \\|\\| cgData\\?\\.market_data\\?\\.current_price\\?\\.inr \\|\\| 0 \\}`, 'g'),
      `current_price: { usd: (token.currentPrice / usdUgxRate) || cgData?.market_data?.current_price?.usd || 0 }`);
      
    content = content.replace(new RegExp(`${metric}: \\{ inr: cgData\\?\\.market_data\\?\\.${metric}\\?\\.inr \\|\\| 0 \\}`, 'g'),
      `${metric}: { usd: cgData?.market_data?.${metric}?.usd || 0 }`);
      
    content = content.replace(new RegExp(`tokenData\\.market_data\\.${metric}\\.inr`, 'g'),
      `(tokenData.market_data.${metric}.usd * usdUgxRate)`);
      
    content = content.replace(new RegExp(`referenceTokenData\\.market_data\\.${metric}\\.inr`, 'g'),
      `(referenceTokenData.market_data.${metric}.usd * usdUgxRate)`);
  }
}

// 6. Fix title
content = content.replace(/Buy Crypto in INR/g, 'Buy Crypto in UGX');
content = content.replace(/in INR —/g, 'in UGX —');

fs.writeFileSync(file, content);
console.log('Replacements complete');
