import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, Empty } from 'antd';
import {
  WalletOutlined,
  SwapOutlined,
  PlusOutlined,
  BankOutlined,
  RightOutlined,
  StarOutlined,
  StarFilled,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { getWatchlist, toggleWatchlist } from '@/services/api/watchlist';

const { useToken } = theme;
const { useBreakpoint } = Grid;

// Memoized Section component - moved outside to prevent recreation
const Section = memo(({ 
  children, 
  title, 
  action, 
  isMobile,
}: { 
  children: React.ReactNode; 
  title?: string; 
  action?: React.ReactNode;
  isMobile: boolean;
}) => {
  const { token } = useToken();
  
  return (
    <div style={{ marginBottom: token.marginLG }}>
      {title && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: token.marginSM,
          }}
        >
          <span
            style={{
              fontSize: isMobile ? token.fontSizeLG : token.fontSizeHeading5,
              fontWeight: fontWeights.semibold,
              color: token.colorText,
            }}
          >
            {title}
          </span>
          {action}
        </div>
      )}
      {children}
    </div>
  );
});
Section.displayName = 'Section';

// Memoized WatchlistRow component with Buy button
interface WatchlistRowProps {
  baseCurrency: string;
  name: string;
  iconUrl: string;
  price: number;
  change: number;
  onStarClick: () => void;
  onBuyClick: () => void;
  isMobile: boolean;
}

const WatchlistRow = memo(({ 
  baseCurrency, 
  name, 
  iconUrl, 
  price, 
  change, 
  onStarClick,
  onBuyClick,
  isMobile,
}: WatchlistRowProps) => {
  const { token } = useToken();
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: token.marginSM,
        padding: isMobile ? `${token.paddingSM}px 0` : `${token.paddingSM}px ${token.paddingMD}px`,
        background: isMobile ? 'transparent' : token.colorBgContainer,
        borderRadius: isMobile ? 0 : token.borderRadius,
        borderBottom: isMobile ? `1px solid ${token.colorBorderSecondary}` : 'none',
      }}
    >
      <img
        src={iconUrl}
        alt={baseCurrency}
        width={40}
        height={40}
        style={{ borderRadius: '50%' }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseCurrency}&background=667eea&color=fff`;
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: token.colorText }}>
          {baseCurrency}
        </div>
        <div
          style={{
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
      </div>
      <div style={{ textAlign: 'right', marginRight: token.marginSM }}>
        <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: token.colorText }}>
          UGX {price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}
        </div>
        <div
          style={{
            fontSize: token.fontSizeSM,
            fontWeight: fontWeights.medium,
            color: change >= 0 ? token.colorSuccess : token.colorError,
          }}
        >
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
      {/* Buy Button */}
      <button
        onClick={onBuyClick}
        style={{
          padding: `${token.paddingXS}px ${token.paddingMD}px`,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: token.borderRadius,
          color: '#fff',
          fontSize: token.fontSizeSM,
          fontWeight: fontWeights.semibold,
          cursor: 'pointer',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Buy
      </button>
      {/* Star Button */}
      <div
        onClick={onStarClick}
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f6d365',
          fontSize: token.fontSizeLG,
          cursor: 'pointer',
        }}
      >
        <StarFilled />
      </div>
    </div>
  );
});
WatchlistRow.displayName = 'WatchlistRow';

// Simple token row for market movers (no actions)
interface TokenRowProps {
  baseCurrency: string;
  name: string;
  iconUrl: string;
  price: number;
  change: number;
  onRowClick: () => void;
  isMobile: boolean;
}

const TokenRow = memo(({ 
  baseCurrency, 
  name, 
  iconUrl, 
  price, 
  change, 
  onRowClick,
  isMobile,
}: TokenRowProps) => {
  const { token } = useToken();
  
  return (
    <div
      onClick={onRowClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: token.marginSM,
        padding: isMobile ? `${token.paddingSM}px 0` : `${token.paddingSM}px ${token.paddingMD}px`,
        background: isMobile ? 'transparent' : token.colorBgContainer,
        borderRadius: isMobile ? 0 : token.borderRadius,
        borderBottom: isMobile ? `1px solid ${token.colorBorderSecondary}` : 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
    >
      <img
        src={iconUrl}
        alt={baseCurrency}
        width={36}
        height={36}
        style={{ borderRadius: '50%' }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseCurrency}&background=667eea&color=fff`;
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: token.colorText }}>
          {baseCurrency}
        </div>
        <div
          style={{
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: token.colorText }}>
          UGX {price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}
        </div>
        <div
          style={{
            fontSize: token.fontSizeSM,
            fontWeight: fontWeights.medium,
            color: change >= 0 ? token.colorSuccess : token.colorError,
          }}
        >
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
    </div>
  );
});
TokenRow.displayName = 'TokenRow';

export default function DashboardPage() {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const {
    pairs,
    isLoadingPairs,
    balances,
    isLoadingBalances,
    orders,
    isLoadingOrders,
  } = useExchange();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [watchlistAssets, setWatchlistAssets] = useState<string[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;
  const isTablet = mounted ? screens.md && !screens.lg : false;
  
  // Track if initial data has been fetched
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/dashboard');
        return;
      }
      // Allow access regardless of KYC status - KYC banner in DashboardLayout handles notification
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  // Fetch watchlist only once
  useEffect(() => {
    if (!pageLoading && user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      
      const fetchData = async () => {
        try {
          setLoadingWatchlist(true);
          const items = await getWatchlist();
          setWatchlistAssets(items.map((item) => item.asset));
        } catch (error) {
          console.error('Failed to fetch watchlist:', error);
          setWatchlistAssets([]);
        } finally {
          setLoadingWatchlist(false);
        }
      };
      
      fetchData();
    }
  }, [pageLoading, user]);

  // Calculate total portfolio value - memoized
  const portfolioData = useMemo(() => {
    const usdBalance = balances.find((b) => b.asset === 'UGX')?.balance || 0;
    
    let cryptoValue = 0;
    balances
      .filter((b) => b.asset !== 'UGX')
      .forEach((balance) => {
        const pair = pairs.find((p) => p.baseCurrency === balance.asset && p.quote === 'UGX');
        if (pair) {
          cryptoValue += balance.balance * pair.price;
        }
      });

    const totalValue = usdBalance + cryptoValue;
    
    return {
      totalValue,
      cashValue: usdBalance,
      cryptoValue,
      cryptoPercent: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
      cashPercent: totalValue > 0 ? (usdBalance / totalValue) * 100 : 0,
    };
  }, [balances, pairs]);

  // Get USD pairs for market data - memoized
  const usdPairs = useMemo(() => {
    return pairs.filter((p) => p.quote === 'UGX');
  }, [pairs]);

  // Watchlist tokens with price data - memoized
  const watchlistTokens = useMemo(() => {
    return watchlistAssets
      .map((asset) => {
        const pair = usdPairs.find((p) => p.baseCurrency === asset);
        return pair ? { ...pair, asset } : null;
      })
      .filter(Boolean) as typeof usdPairs;
  }, [watchlistAssets, usdPairs]);

  // Top gainers & losers - memoized
  const marketMovers = useMemo(() => {
    const sorted = [...usdPairs].sort((a, b) => b.change - a.change);
    return {
      gainers: sorted.slice(0, 4),
      losers: sorted.slice(-4).reverse(),
    };
  }, [usdPairs]);

  // Recent orders - memoized
  const recentOrders = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  // Stable callbacks
  const handleNavigateToExchange = useCallback(() => {
    router.push('/exchange');
  }, [router]);

  const handleNavigateToWatchlist = useCallback(() => {
    router.push('/dashboard/watchlist');
  }, [router]);

  const handleRemoveFromWatchlist = useCallback((asset: string) => {
    toggleWatchlist(asset).then(() => {
      setWatchlistAssets((prev) => prev.filter((a) => a !== asset));
    });
  }, []);

  const handleBuyAsset = useCallback((asset: string) => {
    router.push(`/exchange?pair=${asset}-UGX`);
  }, [router]);

  // Quick actions - memoized
  const quickActions = useMemo(() => [
    { key: 'deposit', icon: <PlusOutlined />, label: 'Deposit', color: token.colorSuccess, href: '/wallet?action=deposit' },
    { key: 'trade', icon: <SwapOutlined />, label: 'Trade', color: token.colorWarning, href: '/exchange' },
    { key: 'withdraw', icon: <BankOutlined />, label: 'Withdraw', color: token.colorError, href: '/wallet?action=withdraw' },
    { key: 'wallet', icon: <WalletOutlined />, label: 'Wallet', color: token.colorPrimary, href: '/wallet' },
  ], [token]);

  // Don't render anything while checking auth or if not logged in
  if (isLoading || !user) {
    return null;
  }

  if (pageLoading) {
    return (
      <>
        <Head>
          <title>Dashboard - InTuition Exchange</title>
        </Head>
        <DashboardLayout activeKey="dashboard">
          <Skeleton active paragraph={{ rows: 12 }} />
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - InTuition Exchange</title>
        <meta name="description" content="Your InTuition Exchange dashboard" />
      </Head>

      <DashboardLayout activeKey="dashboard">
        {/* Desktop: 2-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '1fr 360px',
            gap: token.marginLG,
          }}
        >
          {/* Main Column */}
          <div>
            {/* Portfolio Summary Card */}
            <Section isMobile={isMobile}>
              <motion.div
                initial={false}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                  borderRadius: token.borderRadiusLG,
                  padding: isMobile ? token.paddingLG : token.paddingXL,
                  color: '#fff',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Decorative circles */}
                <div
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    filter: 'blur(20px)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -30,
                    left: '30%',
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.08)',
                    filter: 'blur(15px)',
                  }}
                />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: token.fontSizeSM, opacity: 0.9, marginBottom: token.marginXS }}>
                    Total Portfolio Value
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? token.fontSizeHeading2 : token.fontSizeHeading1,
                      fontWeight: fontWeights.bold,
                      letterSpacing: '-0.02em',
                      marginBottom: token.marginMD,
                    }}
                  >
                    UGX {portfolioData.totalValue.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  {/* Allocation bar */}
                  <div
                    style={{
                      display: 'flex',
                      gap: token.marginXS,
                      marginBottom: token.marginSM,
                    }}
                  >
                    <div
                      style={{
                        flex: portfolioData.cryptoPercent || 1,
                        height: 6,
                        borderRadius: 3,
                        background: 'rgba(255, 255, 255, 0.9)',
                      }}
                    />
                    <div
                      style={{
                        flex: portfolioData.cashPercent || 1,
                        height: 6,
                        borderRadius: 3,
                        background: 'rgba(255, 255, 255, 0.4)',
                      }}
                    />
                  </div>

                  {/* Legend */}
                  <div style={{ display: 'flex', gap: token.marginLG, fontSize: token.fontSizeSM }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.9)' }} />
                      <span>Crypto UGX {portfolioData.cryptoValue.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.4)' }} />
                      <span>Cash UGX {portfolioData.cashValue.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Section>

            {/* Quick Actions */}
            <Section isMobile={isMobile}>
              <div
                style={{
                  display: 'flex',
                  gap: isMobile ? token.marginXS : token.marginMD,
                }}
              >
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => router.push(action.href)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: 'center',
                      justifyContent: isMobile ? 'center' : 'flex-start',
                      gap: isMobile ? token.marginXS : token.marginMD,
                      padding: isMobile ? token.paddingSM : `${token.paddingLG}px ${token.paddingXL}px`,
                      background: isMobile ? 'transparent' : token.colorBgContainer,
                      border: isMobile ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                      borderRadius: token.borderRadiusLG,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.borderColor = action.color;
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = `0 4px 12px ${action.color}20`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isMobile) {
                        e.currentTarget.style.borderColor = token.colorBorderSecondary;
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: isMobile ? 40 : 48,
                        height: isMobile ? 40 : 48,
                        borderRadius: '50%',
                        background: `${action.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: action.color,
                        fontSize: isMobile ? token.fontSizeLG : token.fontSizeXL,
                        flexShrink: 0,
                      }}
                    >
                      {action.icon}
                    </div>
                    <span
                      style={{
                        fontSize: isMobile ? token.fontSizeSM : token.fontSizeLG,
                        fontWeight: fontWeights.semibold,
                        color: token.colorText,
                      }}
                    >
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Watchlist Section */}
            <Section
              title="Watchlist"
              isMobile={isMobile}
              action={
                <button
                  onClick={handleNavigateToWatchlist}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginXXS,
                    background: 'none',
                    border: 'none',
                    color: token.colorPrimary,
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.medium,
                    cursor: 'pointer',
                    padding: `${token.paddingXS}px ${token.paddingSM}px`,
                    borderRadius: token.borderRadius,
                  }}
                >
                  <PlusOutlined />
                  Add
                </button>
              }
            >
              {loadingWatchlist ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : watchlistTokens.length === 0 ? (
                <div
                  onClick={handleNavigateToWatchlist}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: token.marginSM,
                    padding: token.paddingXL,
                    background: isMobile ? 'transparent' : token.colorBgContainer,
                    borderRadius: token.borderRadius,
                    cursor: 'pointer',
                    border: `2px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(102, 126, 234, 0.2)'}`,
                  }}
                >
                  <StarOutlined style={{ fontSize: 32, color: token.colorTextSecondary, opacity: 0.5 }} />
                  <span style={{ color: token.colorTextSecondary }}>Add tokens to your watchlist</span>
                </div>
              ) : (
                <div 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: isMobile ? 0 : token.marginXS,
                    background: isMobile ? 'transparent' : undefined,
                  }}
                >
                  {watchlistTokens.slice(0, 4).map((pair) => (
                    <WatchlistRow
                      key={pair.baseCurrency}
                      baseCurrency={pair.baseCurrency}
                      name={pair.name}
                      iconUrl={pair.iconUrl}
                      price={pair.price}
                      change={pair.change}
                      onStarClick={() => handleRemoveFromWatchlist(pair.baseCurrency)}
                      onBuyClick={() => handleBuyAsset(pair.baseCurrency)}
                      isMobile={isMobile}
                    />
                  ))}
                  {watchlistTokens.length > 4 && (
                    <button
                      onClick={handleNavigateToWatchlist}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: token.marginXS,
                        padding: token.paddingSM,
                        background: 'none',
                        border: 'none',
                        color: token.colorPrimary,
                        fontSize: token.fontSize,
                        fontWeight: fontWeights.medium,
                        cursor: 'pointer',
                      }}
                    >
                      View all {watchlistTokens.length} tokens
                      <RightOutlined />
                    </button>
                  )}
                </div>
              )}
            </Section>

            {/* Market Movers - Only on mobile/tablet */}
            {(isMobile || isTablet) && (
              <>
                {/* Top Gainers */}
                <Section title="Top Gainers" isMobile={isMobile}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 0 : token.marginXS }}>
                    {marketMovers.gainers.slice(0, 3).map((pair) => (
                      <TokenRow
                        key={pair.baseCurrency}
                        baseCurrency={pair.baseCurrency}
                        name={pair.name}
                        iconUrl={pair.iconUrl}
                        price={pair.price}
                        change={pair.change}
                        onRowClick={handleNavigateToExchange}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                </Section>

                {/* Top Losers */}
                <Section title="Top Losers" isMobile={isMobile}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 0 : token.marginXS }}>
                    {marketMovers.losers.slice(0, 3).map((pair) => (
                      <TokenRow
                        key={pair.baseCurrency}
                        baseCurrency={pair.baseCurrency}
                        name={pair.name}
                        iconUrl={pair.iconUrl}
                        price={pair.price}
                        change={pair.change}
                        onRowClick={handleNavigateToExchange}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>

          {/* Sidebar Column - Desktop only */}
          {!isMobile && !isTablet && (
            <div>
              {/* Market Movers */}
              <Section title="Market Movers" isMobile={isMobile}>
                <div
                  style={{
                    background: token.colorBgContainer,
                    borderRadius: token.borderRadius,
                    overflow: 'hidden',
                  }}
                >
                  {/* Gainers */}
                  <div style={{ padding: token.paddingMD }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginXS,
                        marginBottom: token.marginSM,
                        color: token.colorSuccess,
                        fontSize: token.fontSizeSM,
                        fontWeight: fontWeights.semibold,
                      }}
                    >
                      <RiseOutlined />
                      Top Gainers
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}>
                      {marketMovers.gainers.slice(0, 4).map((pair, index) => (
                        <div
                          key={pair.baseCurrency}
                          onClick={handleNavigateToExchange}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: token.marginSM,
                            cursor: 'pointer',
                            padding: `${token.paddingXS}px 0`,
                          }}
                        >
                          <span style={{ width: 16, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                            {index + 1}
                          </span>
                          <img
                            src={pair.iconUrl}
                            alt={pair.baseCurrency}
                            width={24}
                            height={24}
                            style={{ borderRadius: '50%' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.baseCurrency}&background=667eea&color=fff&size=24`;
                            }}
                          />
                          <span style={{ flex: 1, fontWeight: fontWeights.medium, color: token.colorText }}>
                            {pair.baseCurrency}
                          </span>
                          <span style={{ color: token.colorSuccess, fontWeight: fontWeights.semibold }}>
                            +{pair.change.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: token.colorBorderSecondary, margin: `0 ${token.paddingMD}px` }} />

                  {/* Losers */}
                  <div style={{ padding: token.paddingMD }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginXS,
                        marginBottom: token.marginSM,
                        color: token.colorError,
                        fontSize: token.fontSizeSM,
                        fontWeight: fontWeights.semibold,
                      }}
                    >
                      <FallOutlined />
                      Top Losers
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginXS }}>
                      {marketMovers.losers.slice(0, 4).map((pair, index) => (
                        <div
                          key={pair.baseCurrency}
                          onClick={handleNavigateToExchange}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: token.marginSM,
                            cursor: 'pointer',
                            padding: `${token.paddingXS}px 0`,
                          }}
                        >
                          <span style={{ width: 16, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                            {index + 1}
                          </span>
                          <img
                            src={pair.iconUrl}
                            alt={pair.baseCurrency}
                            width={24}
                            height={24}
                            style={{ borderRadius: '50%' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.baseCurrency}&background=667eea&color=fff&size=24`;
                            }}
                          />
                          <span style={{ flex: 1, fontWeight: fontWeights.medium, color: token.colorText }}>
                            {pair.baseCurrency}
                          </span>
                          <span style={{ color: token.colorError, fontWeight: fontWeights.semibold }}>
                            {pair.change.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Recent Activity */}
              <Section title="Recent Activity" isMobile={isMobile}>
                {isLoadingOrders ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : recentOrders.length === 0 ? (
                  <div
                    style={{
                      background: token.colorBgContainer,
                      borderRadius: token.borderRadius,
                      padding: token.paddingLG,
                      textAlign: 'center',
                    }}
                  >
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No recent activity"
                      style={{ margin: 0 }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      background: token.colorBgContainer,
                      borderRadius: token.borderRadius,
                      overflow: 'hidden',
                    }}
                  >
                    {recentOrders.map((order, index) => (
                      <div
                        key={order.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: token.marginSM,
                          padding: token.paddingMD,
                          borderBottom: index < recentOrders.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: order.side === 'BUY' ? `${token.colorSuccess}15` : `${token.colorError}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: order.side === 'BUY' ? token.colorSuccess : token.colorError,
                            fontSize: token.fontSize,
                          }}
                        >
                          {order.side === 'BUY' ? '↑' : '↓'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.medium, color: token.colorText }}>
                            {order.side} {order.asset}
                          </div>
                          <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: token.colorText }}>
                            UGX {order.totalValue.toFixed(2)}
                          </div>
                          <div
                            style={{
                              fontSize: token.fontSizeSM,
                              color: order.status === 'COMPLETED' ? token.colorSuccess : token.colorWarning,
                            }}
                          >
                            {order.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>

        {/* Recent Activity - Mobile/Tablet */}
        {(isMobile || isTablet) && (
          <Section title="Recent Activity" isMobile={isMobile}>
            {isLoadingOrders ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : recentOrders.length === 0 ? (
              <div
                style={{
                  background: token.colorBgContainer,
                  borderRadius: token.borderRadius,
                  padding: token.paddingLG,
                  textAlign: 'center',
                }}
              >
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No recent activity"
                  style={{ margin: 0 }}
                />
              </div>
            ) : (
              <div
                style={{
                  background: token.colorBgContainer,
                  borderRadius: token.borderRadius,
                  overflow: 'hidden',
                }}
              >
                {recentOrders.slice(0, 3).map((order, index) => (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: token.marginSM,
                      padding: token.paddingMD,
                      borderBottom: index < 2 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: order.side === 'BUY' ? `${token.colorSuccess}15` : `${token.colorError}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: order.side === 'BUY' ? token.colorSuccess : token.colorError,
                        fontSize: token.fontSize,
                      }}
                    >
                      {order.side === 'BUY' ? '↑' : '↓'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.medium, color: token.colorText }}>
                        {order.side} {order.asset}
                      </div>
                      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: token.colorText }}>
                        UGX {order.totalValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </DashboardLayout>
    </>
  );
}
