'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { theme, Input, Drawer } from 'antd';
import { SearchOutlined, SwapOutlined, CaretUpOutlined, CaretDownOutlined, StarOutlined, StarFilled } from '@ant-design/icons';
import PriceFormatter from './PriceFormatter';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const { useToken } = theme;

interface TradingPair {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  quote: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  iconUrl?: string;
  isDemoCollegeCoin?: boolean; // Flag for demo college coins
}

interface PairSelectorProps {
  pairs: TradingPair[];
  selectedPair: string;
  onSelectPair: (symbol: string) => void;
  isMobile?: boolean;
}

// Investor mode shows all currencies
const INVESTOR_CURRENCIES = ['USD', 'USDT', 'ETH', 'TUIT'];
// Learner mode shows Popular first, then Colleges
const LEARNER_CURRENCIES = ['Popular', 'Colleges'];

export const mockPairs: TradingPair[] = [
  { symbol: 'BTC-USD', name: 'Bitcoin', price: 90366.33, change: -2.05, volume: '5.4B', quote: 'USD' },
  { symbol: 'ETH-USD', name: 'Ethereum', price: 3089.72, change: 1.23, volume: '2.1B', quote: 'USD' },
  { symbol: 'SOL-USD', name: 'Solana', price: 132.69, change: 3.45, volume: '890M', quote: 'USD' },
  { symbol: 'XRP-USD', name: 'Ripple', price: 2.34, change: -0.78, volume: '1.2B', quote: 'USD' },
  { symbol: 'DOGE-USD', name: 'Dogecoin', price: 0.42, change: 5.67, volume: '450M', quote: 'USD' },
  { symbol: 'ADA-USD', name: 'Cardano', price: 1.12, change: -1.34, volume: '320M', quote: 'USD' },
  { symbol: 'AVAX-USD', name: 'Avalanche', price: 45.67, change: 2.89, volume: '280M', quote: 'USD' },
  { symbol: 'DOT-USD', name: 'Polkadot', price: 8.90, change: -0.45, volume: '190M', quote: 'USD' },
  { symbol: 'MATIC-USD', name: 'Polygon', price: 0.98, change: 1.56, volume: '210M', quote: 'USD' },
  { symbol: 'LINK-USD', name: 'Chainlink', price: 24.56, change: 4.12, volume: '340M', quote: 'USD' },
  { symbol: 'BTC-USDT', name: 'Bitcoin', price: 90350.00, change: -2.03, volume: '8.2B', quote: 'USDT' },
  { symbol: 'ETH-USDT', name: 'Ethereum', price: 3088.50, change: 1.25, volume: '4.5B', quote: 'USDT' },
  { symbol: 'SOL-USDT', name: 'Solana', price: 132.55, change: 3.48, volume: '1.2B', quote: 'USDT' },
  { symbol: 'XRP-USDT', name: 'Ripple', price: 2.33, change: -0.75, volume: '2.1B', quote: 'USDT' },
  { symbol: 'DOGE-USDT', name: 'Dogecoin', price: 0.419, change: 5.70, volume: '780M', quote: 'USDT' },
  { symbol: 'BTC-ETH', name: 'Bitcoin', price: 29.25, change: -3.12, volume: '120M', quote: 'ETH' },
  { symbol: 'SOL-ETH', name: 'Solana', price: 0.0429, change: 2.15, volume: '45M', quote: 'ETH' },
  { symbol: 'LINK-ETH', name: 'Chainlink', price: 0.00795, change: 2.89, volume: '28M', quote: 'ETH' },
  { symbol: 'BTC-TUIT', name: 'Bitcoin', price: 90366.33, change: -2.05, volume: '12M', quote: 'TUIT' },
  { symbol: 'ETH-TUIT', name: 'Ethereum', price: 3089.72, change: 1.23, volume: '8M', quote: 'TUIT' },
  { symbol: 'SOL-TUIT', name: 'Solana', price: 132.69, change: 3.45, volume: '5M', quote: 'TUIT' },
];

const PairSelector: React.FC<PairSelectorProps> = ({ 
  pairs, 
  selectedPair, 
  onSelectPair,
  isMobile = false,
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const { user } = useAuth();
  const isDark = mode === 'dark';
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Default to 'Popular' in learner mode, 'USD' in investor mode
  const isLearnerMode = user?.appMode === 'LEARNER';
  const router = useRouter();
  const [activeQuote, setActiveQuote] = useState(isLearnerMode ? 'Popular' : 'USD');
  const [hoveredPair, setHoveredPair] = useState<string | null>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  
  // Track if we've done the initial tab switch (to avoid switching when user manually browses)
  const hasInitializedTabRef = useRef(false);
  const lastUrlPairRef = useRef<string | null>(null);

  // Get available currencies based on app mode
  const availableCurrencies = useMemo(() => {
    return isLearnerMode ? LEARNER_CURRENCIES : INVESTOR_CURRENCIES;
  }, [isLearnerMode]);

  // Auto-switch to the correct tab ONLY when:
  // 1. Initially mounting with a URL pair parameter
  // 2. When URL pair parameter changes (navigating from another page)
  // This prevents the tab from switching when user is manually browsing
  useEffect(() => {
    const urlPair = router.query.pair as string | undefined;
    
    // Only auto-switch if:
    // - There's a URL pair parameter AND
    // - Either we haven't initialized OR the URL pair changed
    if (urlPair && (!hasInitializedTabRef.current || urlPair !== lastUrlPairRef.current)) {
      const currentPair = pairs.find(p => p.symbol === urlPair.toUpperCase());
      if (currentPair) {
        if (isLearnerMode) {
          if (currentPair.isDemoCollegeCoin) {
            setActiveQuote('Colleges');
          } else {
            setActiveQuote('Popular');
          }
        } else {
          if (INVESTOR_CURRENCIES.includes(currentPair.quote)) {
            setActiveQuote(currentPair.quote);
          }
        }
        lastUrlPairRef.current = urlPair;
      }
      hasInitializedTabRef.current = true;
    } else if (!hasInitializedTabRef.current && pairs.length > 0) {
      // No URL pair - just mark as initialized without switching
      hasInitializedTabRef.current = true;
    }
  }, [router.query.pair, pairs, isLearnerMode]);

  const filteredPairs = useMemo(() => {
    return pairs.filter(pair => {
      let matchesQuote = false;
      
      if (isLearnerMode) {
        if (activeQuote === 'Popular') {
          // Show USD pairs that are NOT college coins
          matchesQuote = pair.quote === 'USD' && !pair.isDemoCollegeCoin;
        } else if (activeQuote === 'Colleges') {
          // Show only college coins
          matchesQuote = pair.isDemoCollegeCoin === true;
        }
      } else {
        // Investor mode: filter by quote currency, but exclude college coins
        matchesQuote = pair.quote === activeQuote && !pair.isDemoCollegeCoin;
      }
      
      const matchesSearch = search === '' || 
        pair.symbol.toLowerCase().includes(search.toLowerCase()) ||
        pair.name.toLowerCase().includes(search.toLowerCase());
      return matchesQuote && matchesSearch;
    });
  }, [pairs, activeQuote, search, isLearnerMode]);

  // Scroll to the selected pair only when navigating from URL (not on every selection)
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    const urlPair = router.query.pair as string | undefined;
    
    // Only scroll if there's a URL pair and we haven't scrolled yet
    if (urlPair && !hasScrolledRef.current && selectedItemRef.current) {
      let rafId: number | null = null;
      let timer: NodeJS.Timeout | null = null;
      
      // Use requestAnimationFrame to batch layout reads and avoid forced reflows
      rafId = requestAnimationFrame(() => {
        // Small delay to ensure the DOM has updated after tab switch
        timer = setTimeout(() => {
          if (selectedItemRef.current) {
            // Find the scrollable parent container (the one with overflowY: auto)
            const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
              while (element && element !== document.body) {
                const style = window.getComputedStyle(element);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                  return element;
                }
                element = element.parentElement;
              }
              return null;
            };
            
            const scrollContainer = findScrollableParent(selectedItemRef.current.parentElement);
            if (scrollContainer && selectedItemRef.current) {
              // Batch all layout property reads together to avoid forced reflows
              // Read all layout properties in one batch before any writes
              const itemOffsetTop = selectedItemRef.current.offsetTop;
              const itemHeight = selectedItemRef.current.clientHeight;
              const containerHeight = scrollContainer.clientHeight;
              
              // Calculate scroll position to center the item in the container
              const scrollTarget = itemOffsetTop - (containerHeight / 2) + (itemHeight / 2);
              
              // Write operation (scroll) happens after all reads are complete
              scrollContainer.scrollTo({
                top: Math.max(0, scrollTarget),
                behavior: 'smooth',
              });
            }
            hasScrolledRef.current = true;
          }
        }, 150);
      });
      
      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (timer !== null) clearTimeout(timer);
      };
    }
  }, [router.query.pair, filteredPairs]);

  const formatPrice = (priceInput: number | string, quote: string) => {
    const price = Number(priceInput);
    if (isNaN(price)) return '0.00';
    
    if (quote === 'ETH') return price.toFixed(6);
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    if (price < 0.001) return price.toFixed(8);
    return price.toFixed(6);
  };

  const handlePairClick = (symbol: string) => {
    onSelectPair(symbol);
    if (isMobile) setDrawerOpen(false);
  };

  // Render a single pair item
  const renderPairItem = (pair: TradingPair) => {
    const isSelected = selectedPair === pair.symbol;
    const isPositive = pair.change >= 0;

    return (
      <div
        key={pair.symbol}
        ref={isSelected ? selectedItemRef : null}
        onClick={() => handlePairClick(pair.symbol)}
        onMouseEnter={() => setHoveredPair(pair.symbol)}
        onMouseLeave={() => setHoveredPair(null)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `${token.paddingXS}px ${token.paddingSM}px`,
          backgroundColor: isSelected 
            ? token.colorPrimary 
            : (hoveredPair === pair.symbol 
                ? (isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                : 'transparent'),
          borderRadius: token.borderRadiusSM,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          gap: token.marginXS,
        }}
      >
        <img
          src={pair.iconUrl || `https://assets.coincap.io/assets/icons/${pair.symbol.split('-')[0].toLowerCase()}@2x.png`}
          alt={pair.symbol.split('-')[0]}
          width={28}
          height={28}
          style={{
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : `${token.colorPrimary}10`,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.symbol.split('-')[0]}&size=28&background=${isSelected ? 'ffffff' : '799EFF'}&color=${isSelected ? '799EFF' : 'ffffff'}`;
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: token.fontSize,
            fontWeight: fontWeights.semibold,
            color: isSelected ? '#ffffff' : token.colorText,
            lineHeight: 1.5,
          }}>
            {pair.symbol.split('-')[0]}
            <span style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : token.colorTextTertiary, fontWeight: fontWeights.normal, fontSize: token.fontSizeSM }}>
              /{pair.quote}
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: token.fontSize,
            fontWeight: fontWeights.semibold,
            color: isSelected ? '#ffffff' : token.colorText,
            lineHeight: 1.5,
          }}>
            <PriceFormatter price={pair.price} quote={pair.quote} />
          </div>
          <div style={{
            fontSize: token.fontSizeSM,
            color: isSelected 
              ? 'rgba(255,255,255,0.9)' 
              : (isPositive ? '#52c41a' : '#ff4d4f'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 2,
            fontWeight: fontWeights.bold,
          }}>
            {isPositive ? <CaretUpOutlined style={{ fontSize: 10 }} /> : <CaretDownOutlined style={{ fontSize: 10 }} />}
            {Math.abs(pair.change).toFixed(2)}%
          </div>
        </div>
      </div>
    );
  };

  // Search input component
  const searchInput = (
    <Input
      prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
      placeholder="Search pairs..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      style={{ 
        marginBottom: token.marginSM,
      }}
    />
  );

  // Quote tabs component
  const quoteTabs = (
    <div style={{
      display: 'flex',
      gap: token.marginMD,
      marginBottom: token.marginSM,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    }}>
      {availableCurrencies.map((quote) => (
        <div
          key={quote}
          onClick={() => setActiveQuote(quote)}
          style={{
            padding: `${token.paddingXS}px 0`,
            fontSize: token.fontSize,
            fontWeight: activeQuote === quote ? fontWeights.bold : fontWeights.medium,
            color: activeQuote === quote ? token.colorPrimary : token.colorTextSecondary,
            borderBottom: activeQuote === quote ? `3px solid ${token.colorPrimary}` : '3px solid transparent',
            marginBottom: -2,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (activeQuote !== quote) {
              e.currentTarget.style.color = token.colorPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (activeQuote !== quote) {
              e.currentTarget.style.color = token.colorTextSecondary;
            }
          }}
        >
          {quote}
        </div>
      ))}
    </div>
  );

  // Pairs list
  const pairsList = (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {filteredPairs.length === 0 ? (
        <div style={{ padding: token.paddingSM, textAlign: 'center', color: token.colorTextTertiary }}>
          No pairs found
        </div>
      ) : (
        filteredPairs.map(renderPairItem)
      )}
    </div>
  );

  // Mobile view
  if (isMobile) {
    const currentPair = pairs.find(p => p.symbol === selectedPair);
    
    return (
      <>
        <div
          onClick={() => setDrawerOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${token.paddingXS}px 0`,
            cursor: 'pointer',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
            <SwapOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
            <span style={{ fontWeight: fontWeights.semibold, color: token.colorText, fontSize: token.fontSizeSM }}>
              {selectedPair}
            </span>
          </div>
          <div style={{ 
            color: (currentPair?.change ?? 0) >= 0 ? token.colorSuccess : token.colorError,
            fontWeight: fontWeights.medium,
            fontSize: token.fontSizeSM,
          }}>
            {currentPair ? <PriceFormatter price={currentPair.price} quote={currentPair.quote} /> : '—'}
          </div>
        </div>

        <Drawer
          title="Select Pair"
          placement="bottom"
          height="60vh"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          zIndex={token.zIndexPopupBase + 100}
          styles={{ body: { padding: token.paddingSM } }}
        >
          {searchInput}
          {quoteTabs}
          {pairsList}
        </Drawer>
      </>
    );
  }

  // Desktop view
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {searchInput}
      {quoteTabs}
      {pairsList}
    </div>
  );
};

export default PairSelector;
