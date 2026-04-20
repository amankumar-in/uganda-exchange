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
const INVESTOR_CURRENCIES = ['INR', 'USDT', 'ETH', 'TUIT'];
// Learner mode shows Popular first, then Colleges
const LEARNER_CURRENCIES = ['Popular', 'Colleges'];

// mockPairs was static sample data from the US build; no longer referenced.
// Real pairs come from ExchangeContext via /api/tokens.
export const mockPairs: TradingPair[] = [];

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
  // Default to 'Popular' in learner mode, 'INR' in investor mode
  const isLearnerMode = user?.appMode === 'LEARNER';
  const router = useRouter();
  const [activeQuote, setActiveQuote] = useState(isLearnerMode ? 'Popular' : 'INR');
  const [hoveredPair, setHoveredPair] = useState<string | null>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  
  // Track if we've done the initial tab switch (to avoid switching when user manually browses)
  const hasInitializedTabRef = useRef(false);
  const lastUrlPairRef = useRef<string | null>(null);

  // Check if any demo college coins exist
  const hasCollegeCoins = useMemo(
    () => pairs.some((p) => p.isDemoCollegeCoin === true),
    [pairs]
  );

  // Get available currencies based on app mode; hide 'Colleges' when none exist
  const availableCurrencies = useMemo(() => {
    if (isLearnerMode) {
      return hasCollegeCoins ? LEARNER_CURRENCIES : LEARNER_CURRENCIES.filter((c) => c !== 'Colleges');
    }
    return INVESTOR_CURRENCIES;
  }, [isLearnerMode, hasCollegeCoins]);

  // If current tab isn't available (e.g. was 'Colleges' but none exist), fall back to first
  useEffect(() => {
    if (!availableCurrencies.includes(activeQuote) && availableCurrencies.length > 0) {
      setActiveQuote(availableCurrencies[0]);
    }
  }, [availableCurrencies, activeQuote]);

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
          // Show INR pairs that are NOT college coins
          matchesQuote = pair.quote === 'INR' && !pair.isDemoCollegeCoin;
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

  // Scroll the selected pair into view whenever it changes — covers direct loads
  // where the default (BTC-INR) is set programmatically without a URL query.
  useEffect(() => {
    if (!selectedItemRef.current) return;

    const rafId = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        const el = selectedItemRef.current;
        if (!el) return;

        const findScrollableParent = (element: HTMLElement | null): HTMLElement | null => {
          while (element && element !== document.body) {
            const style = window.getComputedStyle(element);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') return element;
            element = element.parentElement;
          }
          return null;
        };

        const scrollContainer = findScrollableParent(el.parentElement);
        if (!scrollContainer) return;

        const itemOffsetTop = el.offsetTop;
        const itemHeight = el.clientHeight;
        const containerHeight = scrollContainer.clientHeight;
        const scrollTarget = itemOffsetTop - containerHeight / 2 + itemHeight / 2;

        scrollContainer.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: 'smooth',
        });
      }, 100);
      (rafCleanup as any).timer = timer;
    });
    const rafCleanup = { rafId, timer: null as NodeJS.Timeout | null };

    return () => {
      cancelAnimationFrame(rafId);
      if (rafCleanup.timer) clearTimeout(rafCleanup.timer);
    };
  }, [selectedPair, filteredPairs]);

  const formatPrice = (priceInput: number | string, quote: string) => {
    const price = Number(priceInput);
    if (isNaN(price)) return '0.00';
    
    if (quote === 'ETH') return price.toFixed(6);
    if (price >= 1000) return price.toLocaleString('en-IN', { maximumFractionDigits: 2 });
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
