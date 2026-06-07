import React from 'react';

interface PriceFormatterProps {
  price?: number | string | null;
  quote?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Formats low-value crypto prices using a compact subscript notation.
 * Example: $0.00000123 becomes $0.0₅123
 */
const PriceFormatter: React.FC<PriceFormatterProps> = ({ price: rawPrice, quote = 'UGX', className, style }) => {
  if (rawPrice === undefined || rawPrice === null) return null;
  const price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : Number(rawPrice);
  if (isNaN(price)) return null;
  const prefix = quote === 'UGX' ? 'UGX ' : '';
  const suffix = quote !== 'UGX' ? ` ${quote}` : '';

  if (price === 0) return <span className={className} style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>{prefix}0.00{suffix}</span>;

  // For prices >= 0.001, use standard formatting
  if (price >= 0.001) {
    return (
      <span className={className} style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>
        {prefix}
        {price.toLocaleString('en-UG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: price < 1 ? 6 : 2,
        })}
        {suffix}
      </span>
    );
  }

  // Handle very small numbers (sub-penny)
  // We use toFixed(20) and then trim trailing zeros to ensure we capture the precision
  const fullStr = price.toFixed(20);
  // Match leading zeros after the decimal point
  const match = fullStr.match(/^0\.0(0+)(\d+)/);

  if (match) {
    const zerosAfterFirst = match[1]; // Strings of zeros after the first '0' after the dot
    const significantDigits = match[2];
    const zeroCount = zerosAfterFirst.length + 1;

    // Only use subscript if there are 4 or more zeros after the decimal point
    if (zeroCount >= 4) {
      // Keep up to 4 significant digits for more compact display
      const displayedDigits = significantDigits.substring(0, 4);
      
      return (
        <span className={className} style={{ ...style, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'baseline' }}>
          {prefix}0.0
          <span style={{ 
            fontSize: '0.7em', 
            fontWeight: 800,
            transform: 'translateY(0.2em)',
            margin: '0 1px',
            opacity: 0.9
          }}>
            {zeroCount}
          </span>
          {displayedDigits}
          {suffix}
        </span>
      );
    }
  }

  // Fallback for prices < 0.001 but with few leading zeros
  return (
    <span className={className} style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>
      {prefix}
      {price.toLocaleString('en-UG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      })}
      {suffix}
    </span>
  );
};

export default PriceFormatter;
