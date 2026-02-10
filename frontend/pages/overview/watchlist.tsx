import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, Input, message } from 'antd';
import { StarOutlined, StarFilled, SearchOutlined, ArrowLeftOutlined, AppstoreOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { getWatchlist, toggleWatchlist } from '@/services/api/watchlist';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type TabKey = 'watchlist' | 'browse';

export default function WatchlistPage() {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { pairs, isLoadingPairs, appMode } = useExchange();
  const isLearnerMode = appMode === 'learner';
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [watchlistItems, setWatchlistItems] = useState<string[]>([]);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [togglingAsset, setTogglingAsset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('watchlist');

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;

  // Read tab from query parameter on mount
  useEffect(() => {
    const tabParam = router.query.tab as string;
    if (tabParam === 'browse' || tabParam === 'watchlist') {
      setActiveTab(tabParam);
    }
  }, [router.query.tab]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/overview/watchlist');
        return;
      }
      // Allow access regardless of KYC status - KYC banner in DashboardLayout handles notification
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  // Fetch watchlist
  const fetchWatchlist = useCallback(async () => {
    try {
      setLoadingWatchlist(true);
      const items = await getWatchlist();
      setWatchlistItems(items.map((item) => item.asset));
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    } finally {
      setLoadingWatchlist(false);
    }
  }, []);

  useEffect(() => {
    if (!pageLoading && user) {
      fetchWatchlist();
    }
  }, [pageLoading, user, fetchWatchlist]);

  // Filter to USD pairs only, then extract unique base currencies
  // In investor mode: hide college coins completely
  // In learner mode: show college coins first, then regular tokens
  const usdTokens = useMemo(() => {
    let usdPairs = pairs.filter((pair) => pair.quote === 'USD');
    
    // In investor mode, filter out college coins
    if (!isLearnerMode) {
      usdPairs = usdPairs.filter((pair) => !pair.isDemoCollegeCoin);
    }
    
    // Deduplicate by base currency
    const uniqueTokens = new Map<string, typeof usdPairs[0]>();
    usdPairs.forEach((pair) => {
      if (!uniqueTokens.has(pair.baseCurrency)) {
        uniqueTokens.set(pair.baseCurrency, pair);
      }
    });

    return Array.from(uniqueTokens.values()).sort((a, b) => {
      // In learner mode: college coins first, then alphabetical
      if (isLearnerMode) {
        const aIsCollege = a.isDemoCollegeCoin ? 1 : 0;
        const bIsCollege = b.isDemoCollegeCoin ? 1 : 0;
        if (aIsCollege !== bIsCollege) {
          return bIsCollege - aIsCollege; // College coins first
        }
      }
      // Sort by name alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [pairs, isLearnerMode]);

  // Get watchlisted tokens only
  // In learner mode: college coins first
  // In investor mode: college coins already filtered out from usdTokens
  const watchlistedTokens = useMemo(() => {
    const filtered = usdTokens.filter((token) => watchlistItems.includes(token.baseCurrency));
    
    // In learner mode, sort with college coins first
    if (isLearnerMode) {
      return filtered.sort((a, b) => {
        const aIsCollege = a.isDemoCollegeCoin ? 1 : 0;
        const bIsCollege = b.isDemoCollegeCoin ? 1 : 0;
        if (aIsCollege !== bIsCollege) {
          return bIsCollege - aIsCollege; // College coins first
        }
        return a.name.localeCompare(b.name);
      });
    }
    
    return filtered;
  }, [usdTokens, watchlistItems, isLearnerMode]);

  // Filter tokens by search query and active tab
  const filteredTokens = useMemo(() => {
    // Start with the appropriate base list based on active tab
    const baseList = activeTab === 'watchlist' ? watchlistedTokens : usdTokens;
    
    if (!searchQuery.trim()) return baseList;
    
    const query = searchQuery.toLowerCase();
    return baseList.filter(
      (token) =>
        token.baseCurrency.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query)
    );
  }, [usdTokens, watchlistedTokens, searchQuery, activeTab]);

  // Handle toggle watchlist
  const handleToggle = async (asset: string) => {
    try {
      setTogglingAsset(asset);
      const result = await toggleWatchlist(asset);
      
      if (result.added) {
        setWatchlistItems((prev) => [...prev, asset]);
        message.success(`${asset} added to watchlist`);
      } else {
        setWatchlistItems((prev) => prev.filter((a) => a !== asset));
        message.success(`${asset} removed from watchlist`);
      }
    } catch (error) {
      message.error('Failed to update watchlist');
    } finally {
      setTogglingAsset(null);
    }
  };

  // Navigate to buy-sell page with the asset
  const handleBuy = (asset: string) => {
    router.push(`/buy-sell?asset=${asset}`);
  };

  // Don't render anything while checking auth or if not logged in
  if (isLoading || !user) {
    return null;
  }

  if (pageLoading || isLoadingPairs) {
    return (
      <>
        <Head>
          <title>Add to Watchlist - InTuition Exchange</title>
        </Head>
        <DashboardLayout activeKey="overview">
          <Skeleton active paragraph={{ rows: 12 }} />
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Add to Watchlist - InTuition Exchange</title>
        <meta name="description" content="Add cryptocurrencies to your watchlist" />
      </Head>

      <DashboardLayout activeKey="overview">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginMD,
            marginBottom: token.marginLG,
          }}
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(102, 126, 234, 0.1)',
              color: token.colorText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: token.fontSizeLG,
            }}
          >
            <ArrowLeftOutlined />
          </motion.button>
          <div>
            <h1
              style={{
                fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading3,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                margin: 0,
              }}
            >
              {activeTab === 'watchlist' ? 'My Watchlist' : 'Browse Tokens'}
            </h1>
            <p
              style={{
                fontSize: token.fontSize,
                color: token.colorTextSecondary,
                margin: 0,
              }}
            >
              {activeTab === 'watchlist' 
                ? `${watchlistedTokens.length} tokens in your watchlist`
                : `${usdTokens.length} tokens available`}
            </p>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          style={{
            display: 'flex',
            gap: token.marginXS,
            marginBottom: token.marginLG,
            background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            padding: 4,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveTab('watchlist');
              router.replace('/overview/watchlist?tab=watchlist', undefined, { shallow: true });
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: token.marginXS,
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              border: 'none',
              borderRadius: token.borderRadius,
              background: activeTab === 'watchlist' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'transparent',
              color: activeTab === 'watchlist' ? '#fff' : token.colorTextSecondary,
              fontSize: token.fontSize,
              fontWeight: fontWeights.semibold,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <StarFilled style={{ fontSize: token.fontSizeSM }} />
            My Watchlist ({watchlistedTokens.length})
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveTab('browse');
              router.replace('/overview/watchlist?tab=browse', undefined, { shallow: true });
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: token.marginXS,
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              border: 'none',
              borderRadius: token.borderRadius,
              background: activeTab === 'browse' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'transparent',
              color: activeTab === 'browse' ? '#fff' : token.colorTextSecondary,
              fontSize: token.fontSize,
              fontWeight: fontWeights.semibold,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <AppstoreOutlined style={{ fontSize: token.fontSizeSM }} />
            Browse All
          </motion.button>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{ marginBottom: token.marginLG }}
        >
          <Input
            placeholder={activeTab === 'watchlist' ? 'Search your watchlist...' : 'Search all tokens...'}
            prefix={<SearchOutlined style={{ color: token.colorTextSecondary }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="large"
            style={{
              borderRadius: token.borderRadiusLG,
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : token.colorBgContainer,
            }}
          />
        </motion.div>

        {/* Token List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: token.marginXS,
          }}
        >
          <AnimatePresence mode="popLayout">
            {filteredTokens.map((tokenData, index) => {
              const isInWatchlist = watchlistItems.includes(tokenData.baseCurrency);
              const isToggling = togglingAsset === tokenData.baseCurrency;

              return (
                <motion.div
                  key={tokenData.baseCurrency}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginMD,
                    padding: isMobile ? `${token.paddingSM}px 0` : token.paddingMD,
                    background: isMobile ? 'transparent' : token.colorBgContainer,
                    borderRadius: token.borderRadius,
                    borderBottom: isMobile ? `1px solid ${token.colorBorderSecondary}` : 'none',
                  }}
                >
                  {/* Token Icon */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={tokenData.iconUrl}
                      alt={tokenData.baseCurrency}
                      width={44}
                      height={44}
                      style={{ objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `https://ui-avatars.com/api/?name=${tokenData.baseCurrency}&background=667eea&color=fff&size=44`;
                      }}
                    />
                  </div>

                  {/* Token Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: token.fontSizeLG,
                        fontWeight: fontWeights.semibold,
                        color: token.colorText,
                      }}
                    >
                      {tokenData.baseCurrency}
                    </div>
                    <div
                      style={{
                        fontSize: token.fontSize,
                        color: token.colorTextSecondary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {tokenData.name}
                    </div>
                  </div>

                  {/* Price Info */}
                  <div style={{ textAlign: 'right', marginRight: token.marginSM }}>
                    <div
                      style={{
                        fontSize: token.fontSize,
                        fontWeight: fontWeights.semibold,
                        color: token.colorText,
                      }}
                    >
                      ${tokenData.price.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: tokenData.price < 1 ? 6 : 2,
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: token.fontSizeSM,
                        fontWeight: fontWeights.medium,
                        color: tokenData.change >= 0 ? token.colorSuccess : token.colorError,
                      }}
                    >
                      {tokenData.change >= 0 ? '+' : ''}{tokenData.change.toFixed(2)}%
                    </div>
                  </div>

                  {/* Buy Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuy(tokenData.baseCurrency);
                    }}
                    style={{
                      padding: `${token.paddingXS}px ${token.paddingMD}px`,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: token.borderRadius,
                      color: '#fff',
                      fontSize: token.fontSizeSM,
                      fontWeight: fontWeights.semibold,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    Buy
                  </motion.button>

                  {/* Star Button */}
                  <motion.div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(tokenData.baseCurrency);
                    }}
                    animate={{
                      scale: isToggling ? 0.8 : 1,
                      rotate: isToggling ? 360 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isInWatchlist
                        ? 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)',
                      color: isInWatchlist ? '#fff' : token.colorTextSecondary,
                      fontSize: token.fontSizeXL,
                      cursor: 'pointer',
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isInWatchlist ? <StarFilled /> : <StarOutlined />}
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredTokens.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                textAlign: 'center',
                padding: token.paddingXL * 2,
                color: token.colorTextSecondary,
              }}
            >
              {activeTab === 'watchlist' && watchlistedTokens.length === 0 ? (
                <>
                  <StarOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: token.marginMD }} />
                  <div style={{ fontSize: token.fontSizeLG, marginBottom: token.marginXS }}>Your watchlist is empty</div>
                  <div style={{ fontSize: token.fontSize, marginBottom: token.marginLG }}>Start tracking your favorite tokens</div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setActiveTab('browse');
                      router.replace('/overview/watchlist?tab=browse', undefined, { shallow: true });
                    }}
                    style={{
                      padding: `${token.paddingSM}px ${token.paddingLG}px`,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      borderRadius: token.borderRadius,
                      color: '#fff',
                      fontSize: token.fontSize,
                      fontWeight: fontWeights.semibold,
                      cursor: 'pointer',
                    }}
                  >
                    Browse Tokens
                  </motion.button>
                </>
              ) : (
                <>
                  <SearchOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: token.marginMD }} />
                  <div style={{ fontSize: token.fontSizeLG }}>No tokens found</div>
                  <div style={{ fontSize: token.fontSize }}>Try a different search term</div>
                </>
              )}
            </motion.div>
          )}
        </motion.div>
      </DashboardLayout>
    </>
  );
}

