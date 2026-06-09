import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Input, Skeleton, Empty, message } from 'antd';
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  RiseOutlined,
  FallOutlined,
  FireOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Header, { HEADER_HEIGHT } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { getWatchlist, toggleWatchlist } from '@/services/api/watchlist';
import PriceFormatter from '@/components/exchange/PriceFormatter';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type SortField = 'volume' | 'price' | 'change' | 'name';
type SortOrder = 'asc' | 'desc';
type FilterTab = 'all' | 'watchlist' | 'gainers' | 'losers' | 'colleges';

interface TradingPairExtended {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  quote: string;
  baseCurrency: string;
  quoteCurrency: string;
  iconUrl: string;
  _usdVolume?: number;
  isDemoCollegeCoin?: boolean;
}

// Filter pill component - responsive sizing
const FilterPill = memo(({
  active,
  onClick,
  children,
  gradient,
  icon,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  gradient: string;
  icon?: React.ReactNode;
  compact?: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        padding: compact 
          ? `${token.paddingXS}px ${token.paddingSM}px`
          : `${token.paddingSM}px ${token.paddingMD}px`,
        borderRadius: 50,
        border: 'none',
        cursor: 'pointer',
        fontSize: compact ? token.fontSizeSM : token.fontSize,
        fontWeight: fontWeights.semibold,
        transition: 'all 0.2s',
        background: active 
          ? gradient 
          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.08)',
        color: active ? '#fff' : token.colorText,
        boxShadow: active ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {icon}
      {children}
    </motion.button>
  );
});
FilterPill.displayName = 'FilterPill';

// Sort pill
const SortPill = memo(({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <button
      onClick={onClick}
      style={{
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        borderRadius: token.borderRadiusSM,
        border: 'none',
        cursor: 'pointer',
        fontSize: token.fontSizeSM,
        fontWeight: active ? fontWeights.semibold : fontWeights.medium,
        background: active 
          ? (isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.15)')
          : 'transparent',
        color: active ? token.colorPrimary : token.colorTextSecondary,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
});
SortPill.displayName = 'SortPill';

// Market card component - mobile and small screens
const MarketCard = memo(({
  baseCurrency,
  name,
  iconUrl,
  price,
  change,
  volume,
  isWatchlisted,
  onCardClick,
  onStarClick,
  compact,
}: {
  baseCurrency: string;
  name: string;
  iconUrl: string;
  price: number;
  change: number;
  volume: string;
  isWatchlisted: boolean;
  onCardClick: () => void;
  onStarClick: () => void;
  compact?: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const isPositive = change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(102, 126, 234, 0.15)' }}
      onClick={onCardClick}
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%)'
          : 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)',
        borderRadius: token.borderRadiusLG,
        padding: compact ? token.paddingSM : token.paddingMD,
        cursor: 'pointer',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)'}`,
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >

      {/* Top row: icon + name + star */}
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? token.marginXS : token.marginSM, marginBottom: compact ? token.marginXS : token.marginSM }}>
        <img
          src={iconUrl}
          alt={baseCurrency}
          width={compact ? 32 : 40}
          height={compact ? 32 : 40}
          style={{ borderRadius: '50%', flexShrink: 0 }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseCurrency}&background=667eea&color=fff&size=64`;
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: compact ? token.fontSize : token.fontSizeLG,
            fontWeight: fontWeights.bold,
            color: token.colorText,
          }}>
            {baseCurrency}
          </div>
          <div style={{
            fontSize: compact ? 11 : token.fontSizeSM,
            color: token.colorTextSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
        </div>
        <div
          onClick={(e) => { e.stopPropagation(); onStarClick(); }}
          style={{
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isWatchlisted ? '#f6c343' : token.colorTextTertiary,
            fontSize: compact ? 14 : 18,
            cursor: 'pointer',
            borderRadius: '50%',
            transition: 'all 0.2s',
          }}
        >
          {isWatchlisted ? <StarFilled /> : <StarOutlined />}
        </div>
      </div>

      {/* Price and change */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: compact ? token.fontSize : token.fontSizeHeading4,
            fontWeight: fontWeights.bold,
            color: token.colorText,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <PriceFormatter price={price} />
          </div>
          <div style={{
            fontSize: compact ? 10 : token.fontSizeSM,
            color: token.colorTextTertiary,
            marginTop: 2,
          }}>
            Vol {volume}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 2 : 4,
          color: isPositive ? '#16C47F' : '#fc6f03',
          fontWeight: fontWeights.semibold,
          fontSize: compact ? token.fontSizeSM : token.fontSize,
        }}>
          {isPositive ? <RiseOutlined /> : <FallOutlined />}
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
    </motion.div>
  );
});
MarketCard.displayName = 'MarketCard';

// Market row for list view - responsive columns
const MarketRow = memo(({
  baseCurrency,
  name,
  iconUrl,
  price,
  change,
  volume,
  isWatchlisted,
  onRowClick,
  onStarClick,
  rank,
  showVolume,
}: {
  baseCurrency: string;
  name: string;
  iconUrl: string;
  price: number;
  change: number;
  volume: string;
  isWatchlisted: boolean;
  onRowClick: () => void;
  onStarClick: () => void;
  rank: number;
  showVolume: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const isPositive = change >= 0;

  // Responsive grid: hide volume column on medium screens
  const gridColumns = showVolume 
    ? '40px 1.5fr 1fr 1fr 1fr 40px'
    : '40px 1.5fr 1fr 1fr 40px';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(102, 126, 234, 0.03)' }}
      onClick={onRowClick}
      style={{
        display: 'grid',
        gridTemplateColumns: gridColumns,
        alignItems: 'center',
        gap: token.marginSM,
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
    >
      {/* Rank */}
      <div style={{
        fontSize: token.fontSizeSM,
        color: rank <= 3 ? token.colorPrimary : token.colorTextTertiary,
        fontWeight: rank <= 3 ? fontWeights.bold : fontWeights.medium,
        textAlign: 'center',
      }}>
        {rank}
      </div>

      {/* Token */}
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, minWidth: 0 }}>
        <img
          src={iconUrl}
          alt={baseCurrency}
          width={36}
          height={36}
          style={{ borderRadius: '50%', flexShrink: 0 }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseCurrency}&background=667eea&color=fff&size=64`;
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
            {baseCurrency}
          </div>
          <div style={{
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {name}
          </div>
        </div>
      </div>

      {/* Price */}
      <div style={{
        fontWeight: fontWeights.semibold,
        color: token.colorText,
        fontVariantNumeric: 'tabular-nums',
        fontSize: token.fontSize,
      }}>
        <PriceFormatter price={price} />
      </div>

      {/* Change */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: 6,
        background: isPositive ? 'rgba(22, 196, 127, 0.12)' : 'rgba(252, 111, 3, 0.12)',
        color: isPositive ? '#16C47F' : '#fc6f03',
        fontWeight: fontWeights.semibold,
        fontSize: token.fontSizeSM,
        width: 'fit-content',
      }}>
        {isPositive ? <RiseOutlined /> : <FallOutlined />}
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </div>

      {/* Volume - only if showVolume */}
      {showVolume && (
        <div style={{
          color: token.colorTextSecondary,
          fontSize: token.fontSizeSM,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {volume}
        </div>
      )}

      {/* Star */}
      <div
        onClick={(e) => { e.stopPropagation(); onStarClick(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isWatchlisted ? '#f6c343' : token.colorTextTertiary,
          fontSize: 16,
          cursor: 'pointer',
        }}
      >
        {isWatchlisted ? <StarFilled /> : <StarOutlined />}
      </div>
    </motion.div>
  );
});
MarketRow.displayName = 'MarketRow';

export default function MarketsPage() {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { pairs, isLoadingPairs } = useExchange();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlistAssets, setWatchlistAssets] = useState<string[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const isDark = mode === 'dark';
  
  // More granular breakpoint checks for responsive design
  const isMobile = mounted ? !screens.sm : true;
  const isSmall = mounted ? screens.sm && !screens.md : false;
  const isMedium = mounted ? screens.md && !screens.lg : false;
  
  // Use card view on mobile and small screens, list view on md+
  const useCardView = isMobile || isSmall;
  // Show volume column only on lg+ screens
  const showVolumeColumn = mounted ? !!screens.lg : true;
  // Use compact filter pills on mobile and small-medium screens
  const useCompactFilters = isMobile || isSmall || isMedium;

  // Check if user is authenticated (for conditional layout)
  // Note: Layout is based only on authentication, not KYC status
  // KYC-incomplete users still see dashboard layout (with KYC banner in DashboardLayout)
  const isAuthenticated = !!user;

  useEffect(() => { setMounted(true); }, []);

  // Page is ready once auth check is done (we don't redirect unauthenticated users anymore)
  useEffect(() => {
    if (!isLoading) {
      setPageLoading(false);
    }
  }, [isLoading]);

  // Fetch watchlist only for authenticated users
  useEffect(() => {
    if (!pageLoading && isAuthenticated) {
      const fetchWatchlist = async () => {
        try {
          setLoadingWatchlist(true);
          const items = await getWatchlist();
          setWatchlistAssets(items.map((item) => item.asset));
        } catch {
          setWatchlistAssets([]);
        } finally {
          setLoadingWatchlist(false);
        }
      };
      fetchWatchlist();
    } else if (!isAuthenticated) {
      setLoadingWatchlist(false);
    }
  }, [pageLoading, isAuthenticated]);

  // Filter to USD pairs, separating college coins
  const usdPairs = useMemo(() => pairs.filter((p) => p.quote === 'UGX' && !(p as TradingPairExtended).isDemoCollegeCoin), [pairs]);
  const collegePairs = useMemo(() => pairs.filter((p) => (p as TradingPairExtended).isDemoCollegeCoin === true), [pairs]);

  const filteredPairs = useMemo(() => {
    // For colleges filter, use college pairs
    let result = activeTab === 'colleges' ? [...collegePairs] : [...usdPairs];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.baseCurrency.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
      );
    }

    if (activeTab === 'watchlist') {
      result = result.filter((p) => watchlistAssets.includes(p.baseCurrency));
    } else if (activeTab === 'gainers') {
      result = result.filter((p) => p.change > 0);
    } else if (activeTab === 'losers') {
      result = result.filter((p) => p.change < 0);
    }
    // 'colleges' filter is handled above by using collegePairs as base

    result.sort((a, b) => {
      let comparison = 0;
      const aVolume = (a as TradingPairExtended)._usdVolume || 0;
      const bVolume = (b as TradingPairExtended)._usdVolume || 0;

      switch (sortField) {
        case 'volume': comparison = bVolume - aVolume; break;
        case 'price': comparison = b.price - a.price; break;
        case 'change': comparison = b.change - a.change; break;
        case 'name': comparison = a.name.localeCompare(b.name); break;
      }

      return sortOrder === 'desc' ? comparison : -comparison;
    });

    return result;
  }, [usdPairs, collegePairs, searchQuery, activeTab, watchlistAssets, sortField, sortOrder]);

  // Require login for watchlist actions
  const handleToggleWatchlist = useCallback(async (asset: string) => {
    if (!isAuthenticated) {
      message.info('Please log in to add to watchlist');
      router.push(`/login?redirect=/markets`);
      return;
    }
    try {
      await toggleWatchlist(asset);
      setWatchlistAssets((prev) =>
        prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
      );
    } catch (error) {
      console.error('Failed to toggle watchlist:', error);
    }
  }, [isAuthenticated, router]);

  // Navigate to token detail page - public access
  const handleNavigateToToken = useCallback((symbol: string) => {
    router.push(`/markets/${symbol}`);
  }, [router]);

  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `UGX ${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `UGX ${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `UGX ${(vol / 1e3).toFixed(0)}K`;
    return `UGX ${vol.toFixed(0)}`;
  };

  // Show nothing while auth is loading to prevent layout flash
  if (isLoading) {
    return null;
  }

  // Show loading state with appropriate layout
  if (pageLoading) {
    return (
      <>
        <Head><title>Crypto Markets — Live INR Prices | UG Coin</title></Head>
        {isAuthenticated ? (
          <DashboardLayout activeKey="markets">
            <Skeleton active paragraph={{ rows: 12 }} />
          </DashboardLayout>
        ) : (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: token.colorBgLayout }}>
            <Header />
            <main style={{ flex: 1, paddingTop: HEADER_HEIGHT }}>
              <div style={{ maxWidth: 1400, margin: '0 auto', padding: token.paddingLG }}>
                <Skeleton active paragraph={{ rows: 12 }} />
              </div>
            </main>
            <Footer />
          </div>
        )}
      </>
    );
  }

  // Table header grid columns - responsive
  const headerGridColumns = showVolumeColumn 
    ? '40px 1.5fr 1fr 1fr 1fr 40px'
    : '40px 1.5fr 1fr 1fr 40px';

  // Market content - shared between both layouts
  const marketContent = (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Search and filters - wraps at all sizes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: token.marginSM,
              marginBottom: token.marginLG,
              alignItems: 'center',
            }}
          >
            {/* Search - responsive width */}
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: isMobile ? '1 1 100%' : '0 1 260px',
                minWidth: isMobile ? '100%' : 200,
                maxWidth: isMobile ? '100%' : 300,
                borderRadius: 50,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.05)',
              }}
              size={useCompactFilters ? 'middle' : 'large'}
              allowClear
            />

            {/* Filter pills - wrap instead of scroll */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: token.marginXS,
              flex: '1 1 auto',
            }}>
              <FilterPill
                active={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                icon={<FireOutlined />}
                compact={useCompactFilters}
              >
                All
              </FilterPill>
              {/* Watchlist only available for authenticated users */}
              {isAuthenticated && (
                <FilterPill
                  active={activeTab === 'watchlist'}
                  onClick={() => setActiveTab('watchlist')}
                  gradient="linear-gradient(135deg, #f6d365 0%, #fda085 100%)"
                  icon={<StarFilled />}
                  compact={useCompactFilters}
                >
                  Watchlist
                </FilterPill>
              )}
              <FilterPill
                active={activeTab === 'gainers'}
                onClick={() => setActiveTab('gainers')}
                gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
                icon={<RiseOutlined />}
                compact={useCompactFilters}
              >
                Gainers
              </FilterPill>
              <FilterPill
                active={activeTab === 'losers'}
                onClick={() => setActiveTab('losers')}
                gradient="linear-gradient(135deg, #fc6f03 0%, #ff9966 100%)"
                icon={<FallOutlined />}
                compact={useCompactFilters}
              >
                Losers
              </FilterPill>
              {/* Colleges filter - only show when college coins exist */}
              {collegePairs.length > 0 && (
                <FilterPill
                  active={activeTab === 'colleges'}
                  onClick={() => setActiveTab('colleges')}
                  gradient="linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)"
                  icon={<BankOutlined />}
                  compact={useCompactFilters}
                >
                  Colleges
                </FilterPill>
              )}
            </div>
          </motion.div>

          {/* Sort options - show on non-mobile, wraps naturally */}
          {!useCardView && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: token.marginXS,
                marginBottom: token.marginMD,
              }}
            >
              <span style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, marginRight: token.marginXS }}>
                Sort by:
              </span>
              <SortPill active={sortField === 'volume'} onClick={() => { setSortField('volume'); setSortOrder('desc'); }}>
                Volume
              </SortPill>
              <SortPill active={sortField === 'price'} onClick={() => { setSortField('price'); setSortOrder('desc'); }}>
                Price
              </SortPill>
              <SortPill active={sortField === 'change'} onClick={() => { setSortField('change'); setSortOrder('desc'); }}>
                24h Change
              </SortPill>
              <SortPill active={sortField === 'name'} onClick={() => { setSortField('name'); setSortOrder('asc'); }}>
                Name
              </SortPill>
            </motion.div>
          )}

          {/* Results */}
          {isLoadingPairs || loadingWatchlist ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: useCardView 
                ? 'repeat(auto-fill, minmax(160px, 1fr))' 
                : '1fr', 
              gap: token.marginMD 
            }}>
              {[...Array(8)].map((_, i) => (
                <Skeleton.Button key={i} active block style={{ height: useCardView ? 140 : 60, borderRadius: token.borderRadiusLG }} />
              ))}
            </div>
          ) : filteredPairs.length === 0 ? (
            <div style={{
              padding: token.paddingXL * 2,
              textAlign: 'center',
            }}>
              <Empty
                description={
                  activeTab === 'watchlist'
                    ? "You haven't added any tokens to your watchlist yet"
                    : searchQuery
                    ? 'No tokens match your search'
                    : 'No markets found'
                }
              />
              {activeTab === 'watchlist' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab('all')}
                  style={{
                    marginTop: token.marginLG,
                    padding: `${token.paddingSM}px ${token.paddingLG}px`,
                    borderRadius: 50,
                    border: 'none',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    fontWeight: fontWeights.semibold,
                    fontSize: token.fontSize,
                    cursor: 'pointer',
                  }}
                >
                  Browse Markets
                </motion.button>
              )}
            </div>
          ) : (
            <>
              {/* Card view for mobile/small screens */}
              {useCardView ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: token.marginSM,
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {filteredPairs.map((pair) => (
                      <MarketCard
                        key={pair.baseCurrency}
                        baseCurrency={pair.baseCurrency}
                        name={pair.name}
                        iconUrl={pair.iconUrl}
                        price={pair.price}
                        change={pair.change}
                        volume={formatVolume((pair as TradingPairExtended)._usdVolume || 0)}
                        isWatchlisted={watchlistAssets.includes(pair.baseCurrency)}
                        onCardClick={() => handleNavigateToToken(pair.baseCurrency)}
                        onStarClick={() => handleToggleWatchlist(pair.baseCurrency)}
                        compact={isMobile}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                /* Table/List view for md+ screens */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Header - responsive columns */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: headerGridColumns,
                    gap: token.marginSM,
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                    borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)'}`,
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(102, 126, 234, 0.03)',
                  }}>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' }}>#</div>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Token</div>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price</div>
                    <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>24h</div>
                    {showVolumeColumn && (
                      <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Volume</div>
                    )}
                    <div />
                  </div>

                  {/* Rows */}
                  <AnimatePresence mode="popLayout">
                    {filteredPairs.map((pair, index) => (
                      <MarketRow
                        key={pair.baseCurrency}
                        baseCurrency={pair.baseCurrency}
                        name={pair.name}
                        iconUrl={pair.iconUrl}
                        price={pair.price}
                        change={pair.change}
                        volume={formatVolume((pair as TradingPairExtended)._usdVolume || 0)}
                        isWatchlisted={watchlistAssets.includes(pair.baseCurrency)}
                        onRowClick={() => handleNavigateToToken(pair.baseCurrency)}
                        onStarClick={() => handleToggleWatchlist(pair.baseCurrency)}
                        rank={index + 1}
                        showVolume={showVolumeColumn}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </>
          )}
        </div>
  );

  // Conditional layout based on authentication
  return (
    <>
      <Head>
        <title>Crypto Markets — Live UGX Prices | UG Coin</title>
        <meta
          name="description"
          content="Live UGX prices for Bitcoin, Ethereum, and 300+ crypto assets. Buy, sell, and trade crypto and college coins on UG Coin — Uganda's home for digital assets."
        />
      </Head>

      {isAuthenticated ? (
        <DashboardLayout activeKey="markets">
          {marketContent}
        </DashboardLayout>
      ) : (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: token.colorBgLayout }}>
          <Header />
          <main style={{ flex: 1, paddingTop: HEADER_HEIGHT, padding: `${HEADER_HEIGHT + token.paddingLG}px ${token.paddingLG}px ${token.paddingLG}px` }}>
            {marketContent}
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}
