import React, { useEffect, useState, useCallback, useMemo, useRef, memo, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, Empty, Tag } from 'antd';
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
  ExperimentOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { getWatchlist, toggleWatchlist } from '@/services/api/watchlist';
import { markLearnerWelcomeSeen } from '@/services/api/auth';
import type { NextPageWithLayout } from '../_app';

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
        borderBottom: isMobile ? `1px solid ${token.colorBorder}` : 'none',
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
          ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}
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
        borderBottom: isMobile ? `1px solid ${token.colorBorder}` : 'none',
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
          ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}
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

const DashboardPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading, refreshUser } = useAuth();
  const {
    pairs,
    isLoadingPairs,
    balances,
    isLoadingBalances,
    orders,
    isLoadingOrders,
    appMode,
  } = useExchange();
  const isLearnerMode = appMode === 'learner';
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [watchlistAssets, setWatchlistAssets] = useState<string[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;  // < 768px
  const isMdOnly = mounted ? (screens.md && !screens.lg) : false;  // 768px - 991px
  const isLgOnly = mounted ? (screens.lg && !screens.xl) : false;  // 992px - 1199px
  const isTablet = isMdOnly || isLgOnly;  // 768px - 1199px (all middle sizes)
  
  // Track if initial data has been fetched
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !isLoadingBalances) {
      if (!user) {
        router.push('/login?redirect=/overview');
        return;
      }
      // Allow access to dashboard regardless of KYC status
      // KYC banner will be shown in DashboardLayout for non-verified users
      setPageLoading(false);
    }
  }, [user, isLoading, isLoadingBalances, router]);

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

  // Show welcome modal for first-time learner mode users. Gated on the
  // server-side `learnerWelcomeSeenAt` flag (User row), not localStorage —
  // dismissing on one device persists across phone/web/incognito/clear-data.
  useEffect(() => {
    if (!pageLoading && user && isLearnerMode && balances.length > 0 && pairs.length > 0) {
      if (!user.learnerWelcomeSeenAt) {
        setShowWelcomeModal(true);
      }
    }
  }, [pageLoading, user, isLearnerMode, balances.length, pairs.length]);

  const handleWelcomeModalClose = useCallback(() => {
    setShowWelcomeModal(false);
    // Fire-and-forget the server write + user refresh. We don't block the
    // close animation on the round-trip; if the call fails the modal will
    // simply show again next page load (acceptable degradation).
    void (async () => {
      try {
        await markLearnerWelcomeSeen();
        await refreshUser();
      } catch {
        // Non-fatal — leave the local UI closed; backend will retry on next dismiss.
      }
    })();
  }, [refreshUser]);

  // Calculate total portfolio value - memoized
  const portfolioData = useMemo(() => {
    const usdBalance = balances.find((b) => b.asset === 'INR')?.balance || 0;
    
    let cryptoValue = 0;
    balances
      .filter((b) => b.asset !== 'INR')
      .forEach((balance) => {
        const pair = pairs.find((p) => p.baseCurrency === balance.asset && p.quote === 'INR');
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
  // In investor mode: exclude college coins
  const usdPairs = useMemo(() => {
    let filtered = pairs.filter((p) => p.quote === 'INR');
    if (!isLearnerMode) {
      filtered = filtered.filter((p) => !p.isDemoCollegeCoin);
    }
    return filtered;
  }, [pairs, isLearnerMode]);

  // Watchlist tokens with price data - memoized
  // In investor mode: exclude college coins even if in watchlist
  const watchlistTokens = useMemo(() => {
    return watchlistAssets
      .map((asset) => {
        const pair = usdPairs.find((p) => p.baseCurrency === asset);
        // In investor mode, usdPairs already filters out college coins
        return pair ? { ...pair, asset } : null;
      })
      .filter(Boolean) as typeof usdPairs;
  }, [watchlistAssets, usdPairs]);

  // Top gainers & losers - memoized, sorted by volume
  // In learner mode: show 5 college coins + 5 other coins
  const marketMovers = useMemo(() => {
    if (isLearnerMode) {
      // Separate college coins and regular coins
      const collegeCoins = usdPairs.filter(p => p.isDemoCollegeCoin);
      const regularCoins = usdPairs.filter(p => !p.isDemoCollegeCoin);
      
      // Separate gainers and losers for each group
      const collegeGainers = collegeCoins.filter(p => p.change > 0);
      const collegeLosers = collegeCoins.filter(p => p.change < 0);
      const regularGainers = regularCoins.filter(p => p.change > 0);
      const regularLosers = regularCoins.filter(p => p.change < 0);
      
      // Sort college coins by change percentage (descending for gainers, ascending for losers)
      const sortCollegeByChange = (a: typeof usdPairs[0], b: typeof usdPairs[0], ascending: boolean = false) => {
        return ascending ? a.change - b.change : b.change - a.change;
      };
      
      // Sort regular coins by volume (descending)
      const sortByVolume = (a: typeof usdPairs[0], b: typeof usdPairs[0]) => {
        const aVol = (a as { _usdVolume?: number })._usdVolume || 0;
        const bVol = (b as { _usdVolume?: number })._usdVolume || 0;
        return bVol - aVol;
      };
      
      // Get top 5 from each group
      const topCollegeGainers = [...collegeGainers].sort((a, b) => sortCollegeByChange(a, b, false)).slice(0, 5);
      // For losers: get worst 5 college coins by change (ascending), even if all are positive
      const topCollegeLosers = [...collegeCoins].sort((a, b) => a.change - b.change).slice(0, 5);
      const topRegularGainers = [...regularGainers].sort(sortByVolume).slice(0, 5);
      const topRegularLosers = [...regularLosers].sort(sortByVolume).slice(0, 5);
      
      // Combine: college coins first, then regular coins
      return {
        gainers: [...topCollegeGainers, ...topRegularGainers],
        losers: [...topCollegeLosers, ...topRegularLosers],
      };
    } else {
      // Investor mode: original logic (no college coins)
      const gainers = usdPairs.filter(p => p.change > 0);
      const losers = usdPairs.filter(p => p.change < 0);
      
      // Sort each by volume (descending) - using _usdVolume if available
      const sortByVolume = (a: typeof usdPairs[0], b: typeof usdPairs[0]) => {
        const aVol = (a as { _usdVolume?: number })._usdVolume || 0;
        const bVol = (b as { _usdVolume?: number })._usdVolume || 0;
        return bVol - aVol;
      };
      
      return {
        gainers: [...gainers].sort(sortByVolume).slice(0, 10),
        losers: [...losers].sort(sortByVolume).slice(0, 10),
      };
    }
  }, [usdPairs, isLearnerMode]);

  // Recent orders - memoized
  const recentOrders = useMemo(() => {
    return orders.slice(0, 5);
  }, [orders]);

  // Stable callbacks
  const handleNavigateToExchange = useCallback((pairSymbol?: string) => {
    if (pairSymbol) {
      router.push(`/trade?pair=${pairSymbol}`);
    } else {
      router.push('/trade');
    }
  }, [router]);

  const handleNavigateToWatchlist = useCallback((tab: 'watchlist' | 'browse' = 'watchlist') => {
    router.push(`/overview/watchlist?tab=${tab}`);
  }, [router]);

  const handleRemoveFromWatchlist = useCallback((asset: string) => {
    toggleWatchlist(asset).then(() => {
      setWatchlistAssets((prev) => prev.filter((a) => a !== asset));
    });
  }, []);

  const handleBuyAsset = useCallback((asset: string) => {
    router.push(`/buy-sell?asset=${asset}`);
  }, [router]);

  // Quick actions - memoized
  const quickActions = useMemo(() => [
    { key: 'deposit', icon: <PlusOutlined />, label: 'Deposit', color: token.colorSuccess, href: '/portfolio?action=deposit' },
    { key: 'trade', icon: <SwapOutlined />, label: 'Trade', color: token.colorWarning, href: '/trade' },
    { key: 'withdraw', icon: <BankOutlined />, label: 'Withdraw', color: token.colorError, href: '/portfolio?action=withdraw' },
    { key: 'portfolio', icon: <WalletOutlined />, label: 'Portfolio', color: token.colorPrimary, href: '/portfolio' },
  ], [token]);

  // Don't render anything while checking auth or if not logged in (redirect in progress)
  if (isLoading || !user) {
    return null;
  }

  if (pageLoading) {
    return (
      <>
        <Head>
          <title>Overview - InTuition Exchange</title>
        </Head>
        <Skeleton active paragraph={{ rows: 12 }} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Overview - InTuition Exchange</title>
        <meta name="description" content="Your InTuition Exchange overview" />
      </Head>

      {/* Desktop: 2-column layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '7fr 3fr',
          gap: token.marginLG,
        }}
      >
          {/* Main Column */}
          <div style={{ minWidth: 0 }}>
            {/* Portfolio Summary Card */}
            <Section isMobile={isMobile}>
              <motion.div
                initial={false}
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, #1e1b2e 0%, #2d2640 40%, #352f4a 100%)'  // Deep charcoal with subtle indigo
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',  // Original light gradient
                  borderRadius: token.borderRadiusLG,
                  padding: isMobile ? token.paddingLG : isTablet ? token.paddingLG : token.paddingXL,
                  color: '#fff',
                  position: 'relative',
                  overflow: 'hidden',
                  border: isDark ? '1px solid rgba(139, 92, 246, 0.15)' : 'none',
                  boxShadow: isDark 
                    ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                    : '0 8px 24px rgba(102, 126, 234, 0.25)',
                }}
              >
                {/* Decorative circles - subtle glow for dark mode */}
                <div
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: isDark 
                      ? 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)'
                      : 'rgba(255, 255, 255, 0.1)',
                    filter: isDark ? 'blur(30px)' : 'blur(20px)',
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
                    background: isDark 
                      ? 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)'
                      : 'rgba(255, 255, 255, 0.08)',
                    filter: isDark ? 'blur(25px)' : 'blur(15px)',
                  }}
                />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Mode Badge */}
                  <div style={{ position: 'absolute', top: 0, right: 0 }}>
                    <Tag
                      icon={isLearnerMode ? <ExperimentOutlined /> : <RocketOutlined />}
                      style={{
                        background: isLearnerMode ? 'rgba(245, 158, 11, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: fontWeights.semibold,
                        fontSize: token.fontSizeSM,
                      }}
                    >
                      {isLearnerMode ? 'Learner Mode' : 'Investor Mode'}
                    </Tag>
                  </div>
                  <div style={{ fontSize: token.fontSizeSM, opacity: 0.9, marginBottom: token.marginXS }}>
                    Total Portfolio Value {isLearnerMode && '(Virtual)'}
                  </div>
                  <div
                    style={{
                      fontSize: isMobile ? token.fontSizeHeading2 : isTablet ? token.fontSizeHeading3 : token.fontSizeHeading1,
                      fontWeight: fontWeights.bold,
                      letterSpacing: '-0.02em',
                      marginBottom: token.marginMD,
                    }}
                  >
                    ₹{portfolioData.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                        background: isDark 
                          ? 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)'
                          : 'rgba(255, 255, 255, 0.9)',
                      }}
                    />
                    <div
                      style={{
                        flex: portfolioData.cashPercent || 1,
                        height: 6,
                        borderRadius: 3,
                        background: isDark 
                          ? 'rgba(139, 92, 246, 0.3)'
                          : 'rgba(255, 255, 255, 0.4)',
                      }}
                    />
                  </div>

                  {/* Legend */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: isTablet ? token.marginSM : token.marginLG, 
                    fontSize: isTablet ? 12 : token.fontSizeSM 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: isDark 
                          ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
                          : 'rgba(255, 255, 255, 0.9)' 
                      }} />
                      <span>Crypto ₹{portfolioData.cryptoValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: isDark 
                          ? 'rgba(139, 92, 246, 0.4)'
                          : 'rgba(255, 255, 255, 0.4)' 
                      }} />
                      <span>Cash ₹{portfolioData.cashValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                  flexWrap: 'wrap',
                  gap: '2%',
                }}
              >
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    onClick={() => router.push(action.href)}
                    style={{
                      flex: '1 1 20%',
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5em',
                      padding: '1em',
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
                        width: '2.5em',
                        height: '2.5em',
                        borderRadius: '50%',
                        background: `${action.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: action.color,
                        fontSize: '1.2em',
                        flexShrink: 0,
                      }}
                    >
                      {action.icon}
                    </div>
                    <span
                      style={{
                        fontSize: '0.9em',
                        fontWeight: fontWeights.semibold,
                        color: token.colorText,
                        whiteSpace: 'nowrap',
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
                  onClick={() => handleNavigateToWatchlist('browse')}
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
                  onClick={() => handleNavigateToWatchlist()}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: token.marginSM,
                    padding: token.paddingXL,
                    background: 'transparent',
                    borderRadius: token.borderRadius,
                    cursor: 'pointer',
                    border: isMobile ? 'none' : `2px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(102, 126, 234, 0.2)'}`,
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
                      onClick={() => handleNavigateToWatchlist('watchlist')}
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

            {/* Recent Activity - Desktop (below watchlist in main area) */}
            {!isMobile && !isTablet && (
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
                            ₹{order.totalValue.toFixed(2)}
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
            )}

            {/* Market Movers - Only on mobile/tablet */}
            {(isMobile || isTablet) && (
              <>
                {/* Top Gainers */}
                <Section title="Top Gainers" isMobile={isMobile}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 0 : token.marginXS }}>
                    {marketMovers.gainers.slice(0, isLearnerMode ? 10 : 5).map((pair) => (
                      <TokenRow
                        key={pair.baseCurrency}
                        baseCurrency={pair.baseCurrency}
                        name={pair.name}
                        iconUrl={pair.iconUrl}
                        price={pair.price}
                        change={pair.change}
                        onRowClick={() => handleNavigateToExchange(pair.symbol)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                </Section>

                {/* Top Losers */}
                <Section title="Top Losers" isMobile={isMobile}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 0 : token.marginXS }}>
                    {marketMovers.losers.slice(0, isLearnerMode ? 10 : 5).map((pair) => (
                      <TokenRow
                        key={pair.baseCurrency}
                        baseCurrency={pair.baseCurrency}
                        name={pair.name}
                        iconUrl={pair.iconUrl}
                        price={pair.price}
                        change={pair.change}
                        onRowClick={() => handleNavigateToExchange(pair.symbol)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>

          {/* Sidebar Column - Desktop only - Sticky with internal scroll */}
          {!isMobile && !isTablet && (
            <div
              style={{
                position: 'sticky',
                top: token.paddingXL,
                height: `calc(100vh - ${token.paddingXL * 2}px - 64px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: token.marginMD,
              }}
            >
              {/* Top Gainers */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  background: token.colorBgContainer,
                  borderRadius: token.borderRadius,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginXS,
                    padding: token.paddingMD,
                    paddingBottom: token.paddingSM,
                    color: token.colorSuccess,
                    fontSize: token.fontSizeSM,
                    fontWeight: fontWeights.semibold,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    flexShrink: 0,
                  }}
                >
                  <RiseOutlined />
                  Top Gainers (by Volume)
                </div>
                <div 
                  style={{ 
                    flex: 1,
                    overflowY: 'auto',
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {marketMovers.gainers.map((pair, index) => (
                      <div
                        key={pair.baseCurrency}
                        onClick={() => handleNavigateToExchange(pair.symbol)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: token.marginSM,
                          cursor: 'pointer',
                          padding: `${token.paddingXS}px 0`,
                          borderRadius: token.borderRadiusSM,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ width: 18, color: token.colorTextTertiary, fontSize: token.fontSizeSM, textAlign: 'center' }}>
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
                        <span style={{ flex: 1, fontWeight: fontWeights.medium, color: token.colorText, fontSize: token.fontSizeSM }}>
                          {pair.baseCurrency}
                        </span>
                        <span style={{ color: token.colorSuccess, fontWeight: fontWeights.semibold, fontSize: token.fontSizeSM }}>
                          +{pair.change.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                    {marketMovers.gainers.length === 0 && (
                      <div style={{ padding: token.paddingMD, textAlign: 'center', color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                        No gainers today
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Losers */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  background: token.colorBgContainer,
                  borderRadius: token.borderRadius,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginXS,
                    padding: token.paddingMD,
                    paddingBottom: token.paddingSM,
                    color: token.colorError,
                    fontSize: token.fontSizeSM,
                    fontWeight: fontWeights.semibold,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    flexShrink: 0,
                  }}
                >
                  <FallOutlined />
                  Top Losers (by Volume)
                </div>
                <div 
                  style={{ 
                    flex: 1,
                    overflowY: 'auto',
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {marketMovers.losers.map((pair, index) => (
                      <div
                        key={pair.baseCurrency}
                        onClick={() => handleNavigateToExchange(pair.symbol)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: token.marginSM,
                          cursor: 'pointer',
                          padding: `${token.paddingXS}px 0`,
                          borderRadius: token.borderRadiusSM,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ width: 18, color: token.colorTextTertiary, fontSize: token.fontSizeSM, textAlign: 'center' }}>
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
                        <span style={{ flex: 1, fontWeight: fontWeights.medium, color: token.colorText, fontSize: token.fontSizeSM }}>
                          {pair.baseCurrency}
                        </span>
                        <span style={{ color: token.colorError, fontWeight: fontWeights.semibold, fontSize: token.fontSizeSM }}>
                          {pair.change.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                    {marketMovers.losers.length === 0 && (
                      <div style={{ padding: token.paddingMD, textAlign: 'center', color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                        No losers today
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                  background: 'transparent',
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
                  background: 'transparent',
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
                      padding: isMobile ? `${token.paddingSM}px 0` : token.paddingMD,
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
                        ₹{order.totalValue.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Welcome Modal for first-time learner mode users */}
        <WelcomeModal
          visible={showWelcomeModal}
          onClose={handleWelcomeModalClose}
          balances={balances}
          pairs={pairs.map(p => ({
            baseCurrency: p.baseCurrency,
            name: p.name,
            iconUrl: p.iconUrl,
            price: p.price,
            isDemoCollegeCoin: p.isDemoCollegeCoin,
          }))}
        />
    </>
  );
};

// Persistent layout - keeps DashboardLayout mounted across page navigations
DashboardPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default DashboardPage;
