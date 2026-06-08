import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { theme, Grid, Button, Skeleton, Progress, message, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  StarOutlined,
  StarFilled,
  RiseOutlined,
  FallOutlined,
  GlobalOutlined,
  GithubOutlined,
  XOutlined,
  RedditOutlined,
  LinkOutlined,
  SwapOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Header, { HEADER_HEIGHT } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { MiniPriceChart } from '@/components/exchange';
import PriceFormatter from '@/components/exchange/PriceFormatter';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { useSidebar } from '@/context/SidebarContext';
import { getWatchlist, toggleWatchlist } from '@/services/api/watchlist';
import {
  getTokenDetails,
  getTokenDetailsById,
  getMarketsList,
  TokenMarketData,
  formatLargeNumber,
  formatSupply,
} from '@/services/api/coingecko';
import { getDemoCollegeCoin, DemoCollegeCoin, resolveUploadUrl } from '@/services/api/demo-college-coins';
import { TokensApi } from '@/services/api/tokens';
import { Token } from '@/types/token';

const { useToken } = theme;
const { useBreakpoint } = Grid;

// Format date helper
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Key stat item (no background, colored text)
const KeyStat = ({
  label,
  value,
  color,
  subValue,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
  subValue?: React.ReactNode;
}) => {
  const { token } = useToken();

  return (
    <div style={{ textAlign: 'center', padding: `${token.paddingSM}px 0` }}>
      <div style={{
        fontSize: 11,
        color: token.colorTextTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: token.fontSizeHeading4,
        fontWeight: fontWeights.bold,
        color: color,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {subValue && (
        <div style={{ marginTop: 4 }}>
          {subValue}
        </div>
      )}
    </div>
  );
};

// Price change badge
const PriceChangeBadge = ({ value, size = 'default' }: { value: number; size?: 'small' | 'default' | 'large' }) => {
  const { token } = useToken();
  const isPositive = value >= 0;
  const sizes = {
    small: { font: token.fontSizeSM, padding: '3px 8px', icon: 10 },
    default: { font: token.fontSize, padding: '6px 12px', icon: 12 },
    large: { font: token.fontSizeLG, padding: '8px 16px', icon: 14 },
  };
  const s = sizes[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: s.font,
      fontWeight: fontWeights.semibold,
      color: isPositive ? '#16C47F' : '#fc6f03',
      background: isPositive ? 'rgba(22, 196, 127, 0.15)' : 'rgba(252, 111, 3, 0.15)',
      padding: s.padding,
      borderRadius: 8,
    }}>
      {isPositive ? <RiseOutlined style={{ fontSize: s.icon }} /> : <FallOutlined style={{ fontSize: s.icon }} />}
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
};

// Social link button
const SocialLink = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (!href) return null;

  return (
    <motion.a
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.08)',
        borderRadius: 50,
        color: token.colorText,
        fontSize: token.fontSize,
        fontWeight: fontWeights.medium,
        textDecoration: 'none',
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </motion.a>
  );
};

export default function TokenDetailsPage() {
  const router = useRouter();
  const { symbol } = router.query;
  const { token: themeToken } = useToken();
  const { user, isLoading } = useAuth();
  const { pairs, setSelectedPair, usdUgxRate } = useExchange();
  const { mode } = useThemeMode();
  const { isEffectiveDesktop, isEffectiveMobile } = useSidebar();

  const [pageLoading, setPageLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenMarketData | null>(null);
  const [collegeCoinData, setCollegeCoinData] = useState<DemoCollegeCoin | null>(null);
  const [customTokenData, setCustomTokenData] = useState<Token | null>(null);
  const [referenceTokenData, setReferenceTokenData] = useState<TokenMarketData | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const [sparklineData, setSparklineData] = useState<number[]>([]);
  const [loadingSparkline, setLoadingSparkline] = useState(true);

  const isDark = mode === 'dark';
  // Use effective breakpoints that account for sidebar width
  const isMobile = isEffectiveMobile;
  const isDesktop = isEffectiveDesktop;

  // Get live price from exchange context
  const pairData = useMemo(() => {
    if (!symbol || typeof symbol !== 'string') return null;
    return pairs.find((p) => p.baseCurrency === symbol.toUpperCase() && p.quote === 'UGX');
  }, [pairs, symbol]);


  const livePrice = collegeCoinData?.currentPrice || pairData?.price || 0 /* fallback removed to enforce single source of truth */;
  const liveChange = pairData?.change || tokenData?.market_data?.price_change_percentage_24h || 0;

  // Check if user is authenticated (for conditional layout)
  // Note: Layout is based only on authentication, not KYC status
  // KYC-incomplete users still see dashboard layout (with KYC banner in DashboardLayout)
  const isAuthenticated = !!user;


  // Page is ready once auth check is done (public access)
  useEffect(() => {
    if (!isLoading) {
      setPageLoading(false);
    }
  }, [isLoading]);

  // Fetch token data (public)
  // For college coins, fetch from backend; for regular tokens, fetch from CoinGecko
  useEffect(() => {
    if (!pageLoading && symbol && typeof symbol === 'string') {
      setLoadingToken(true);
      
      // First check if it's a college coin
      getDemoCollegeCoin(symbol.toUpperCase())
        .then((response) => {
          if (response.success && response.coin) {
            setCollegeCoinData(response.coin);
            setTokenData(null); // Not a regular token
            
            // Also fetch the reference token's data for stats
            if (response.coin.peggedToAsset) {
              getTokenDetails(response.coin.peggedToAsset.toUpperCase())
                .then((refData) => {
                  setReferenceTokenData(refData);
                  setLoadingToken(false);
                })
                .catch(() => {
                  setReferenceTokenData(null);
                  setLoadingToken(false);
                });
            } else {
              setLoadingToken(false);
            }
          } else {
            // Not a college coin, fetch from CoinGecko
            setCollegeCoinData(null);
            setReferenceTokenData(null);
            getTokenDetails(symbol.toUpperCase())
              .then((data) => { setTokenData(data); setLoadingToken(false); })
              .catch(() => setLoadingToken(false));
          }
        })
        .catch(() => {
          // Failed to check college coin, try Custom Token (Asset Manager)
          TokensApi.getBySymbol(symbol.toUpperCase())
            .then(async (token) => {
              if (token && token.isActive) {
                setCustomTokenData(token);
                
                let cgData: any = null;
                // If token has a coingeckoId, fetch rich metadata
                if (token.coingeckoId) {
                  try {
                    cgData = await getTokenDetailsById(token.coingeckoId);
                  } catch (e) {
                    console.error('Failed to fetch rich data for custom token:', e);
                  }
                }

                // Map Token to TokenMarketData shape, merging with CG data if available
                const mappedData: any = {
                  id: token.id,
                  symbol: token.symbol,
                  name: token.name,
                  image: {
                    thumb: token.iconUrl || cgData?.image?.thumb || '',
                    small: token.iconUrl || cgData?.image?.small || '',
                    large: token.iconUrl || cgData?.image?.large || '',
                  },
                  description: token.description || cgData?.description || '',
                  links: {
                    homepage: (token.website ? [token.website] : cgData?.links?.homepage) || [],
                    twitter_screen_name: token.twitter?.replace('https://twitter.com/', '') || cgData?.links?.twitter_screen_name || '',
                    chat_url: (token.discord ? [token.discord] : cgData?.links?.chat_url) || [],
                    whitepaper: token.whitepaper || cgData?.links?.whitepaper || '',
                    blockchain_site: cgData?.links?.blockchain_site || [],
                    official_forum_url: cgData?.links?.official_forum_url || [],
                    announcement_url: cgData?.links?.announcement_url || [],
                    subreddit_url: cgData?.links?.subreddit_url || '',
                    repos_url: cgData?.links?.repos_url || { github: [], bitbucket: [] },
                  },
                  market_data: {
                    current_price: { usd: ((token.currentPrice || 0) / usdUgxRate) || cgData?.market_data?.current_price?.usd || 0 },
                    price_change_percentage_24h: token.change24h || cgData?.market_data?.price_change_percentage_24h || 0,
                    market_cap: { usd: cgData?.market_data?.market_cap?.usd || 0 },
                    fully_diluted_valuation: { usd: cgData?.market_data?.fully_diluted_valuation?.usd || 0 },
                    total_volume: { usd: cgData?.market_data?.total_volume?.usd || 0 },
                    high_24h: { usd: cgData?.market_data?.high_24h?.usd || 0 },
                    low_24h: { usd: cgData?.market_data?.low_24h?.usd || 0 },
                    circulating_supply: cgData?.market_data?.circulating_supply || 0,
                    total_supply: cgData?.market_data?.total_supply || 0,
                    max_supply: cgData?.market_data?.max_supply || 0,
                    ath: { usd: cgData?.market_data?.ath?.usd || 0 },
                    ath_date: { inr: cgData?.market_data?.ath_date?.inr || '' },
                    ath_change_percentage: { inr: cgData?.market_data?.ath_change_percentage?.inr || 0 },
                    atl: { usd: cgData?.market_data?.atl?.usd || 0 },
                    atl_date: { inr: cgData?.market_data?.atl_date?.inr || '' },
                    atl_change_percentage: { inr: cgData?.market_data?.atl_change_percentage?.inr || 0 },
                  },
                  categories: cgData?.categories || [],
                  genesis_date: cgData?.genesis_date || null,
                  sentiment_votes_up_percentage: cgData?.sentiment_votes_up_percentage || 50,
                  sentiment_votes_down_percentage: cgData?.sentiment_votes_down_percentage || 50,
                  watchlist_portfolio_users: cgData?.watchlist_portfolio_users || 0,
                  last_updated: cgData?.last_updated || new Date().toISOString(),
                };
                
                setCollegeCoinData(null);
                setReferenceTokenData(null);
                setTokenData(mappedData);
                setLoadingToken(false);
              } else {
                setCustomTokenData(null);
                // Not a custom token, fetch from CoinGecko
                fallbackToCoinGecko();
              }
            })
            .catch(() => {
              setCustomTokenData(null);
              fallbackToCoinGecko();
            });
        });

      const fallbackToCoinGecko = () => {
        setCollegeCoinData(null);
        setReferenceTokenData(null);
        getTokenDetails(symbol.toUpperCase())
          .then((data) => { setTokenData(data); setLoadingToken(false); })
          .catch(() => setLoadingToken(false));
      };
    }
  }, [pageLoading, symbol]);

  // Fetch sparkline data for chart (public)
  // For college coins, fetch the pegged token's sparkline and scale it
  useEffect(() => {
    if (!pageLoading && symbol && typeof symbol === 'string') {
      setLoadingSparkline(true);
      
      // Determine which symbol or ID to fetch sparkline for
      const targetSymbol = collegeCoinData?.peggedToAsset || symbol;
      const targetId = customTokenData?.coingeckoId || tokenData?.id; // Use coingeckoId if we have it
      
      const scaleFactor = collegeCoinData?.peggedPercentage ? collegeCoinData.peggedPercentage / 100 : 1;
      
      // If we have a specific ID, fetch only that ID to ensure we get its sparkline (even if not top 100)
      const fetchIds = targetId && targetId !== symbol.toLowerCase() ? targetId : undefined;

      getMarketsList(1, 100, true, fetchIds)
        .then((markets) => {
          const market = markets.find(
            (m) => 
              (fetchIds && m.id === fetchIds) || 
              m.symbol.toUpperCase() === targetSymbol.toUpperCase()
          );
          if (market?.sparkline_in_7d?.price) {
            // Scale the sparkline data for college coins
            const scaledPrices = market.sparkline_in_7d.price.map(p => p * scaleFactor);
            setSparklineData(scaledPrices);
          }
          setLoadingSparkline(false);
        })
        .catch(() => setLoadingSparkline(false));
    }
  }, [pageLoading, symbol, collegeCoinData, customTokenData, tokenData]);

  // Fetch watchlist (only for authenticated users)
  useEffect(() => {
    if (!pageLoading && symbol && typeof symbol === 'string' && isAuthenticated) {
      getWatchlist()
        .then((items) => setIsWatchlisted(items.some((item) => item.asset === symbol.toUpperCase())))
        .catch(() => {});
    }
  }, [pageLoading, symbol, isAuthenticated]);

  const handleToggleWatchlist = useCallback(async () => {
    if (!symbol || typeof symbol !== 'string') return;
    // Require login for watchlist
    if (!isAuthenticated) {
      message.info('Please log in to add to watchlist');
      router.push(`/login?redirect=${encodeURIComponent(`/markets/${symbol}`)}`);
      return;
    }
    setIsTogglingWatchlist(true);
    try {
      await toggleWatchlist(symbol.toUpperCase());
      setIsWatchlisted((prev) => !prev);
      message.success(isWatchlisted ? 'Removed from watchlist' : 'Added to watchlist');
    } catch {
      message.error('Failed to update watchlist');
    } finally {
      setTimeout(() => setIsTogglingWatchlist(false), 300);
    }
  }, [symbol, isWatchlisted, isAuthenticated, router]);

  const handleBuy = useCallback(() => {
    if (!symbol || typeof symbol !== 'string') return;
    // Require login for buy
    if (!isAuthenticated) {
      message.info('Please log in to buy');
      router.push(`/login?redirect=${encodeURIComponent(`/buy-sell?asset=${symbol.toUpperCase()}`)}`);
      return;
    }
    setSelectedPair(`${symbol.toUpperCase()}-USD`);
    router.push(`/buy-sell?asset=${symbol.toUpperCase()}`);
  }, [symbol, router, setSelectedPair, isAuthenticated]);

  const supplyPercentage = useMemo(() => {
    if (!tokenData?.market_data) return 0;
    const { circulating_supply, max_supply, total_supply } = tokenData.market_data;
    const maxOrTotal = max_supply || total_supply;
    if (!maxOrTotal || maxOrTotal === 0) return 100;
    return (circulating_supply / maxOrTotal) * 100;
  }, [tokenData]);

  const cleanDescription = useMemo(() => {
    if (!tokenData?.description) return '';
    return tokenData.description.replace(/<[^>]*>/g, '').replace(/\n\n+/g, '\n\n').trim();
  }, [tokenData]);

  // Show nothing while auth is loading to prevent layout flash
  if (isLoading) {
    return null;
  }

  // Loading state with appropriate layout
  if (pageLoading || !symbol) {
    return (
      <>
        <Head><title>Buy Crypto in UGX — InTuition Exchange</title></Head>
        {isAuthenticated ? (
          <DashboardLayout activeKey="markets">
            <Skeleton active paragraph={{ rows: 12 }} />
          </DashboardLayout>
        ) : (
          <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: themeToken.colorBgLayout }}>
            <Header />
            <main style={{ flex: 1, paddingTop: HEADER_HEIGHT }}>
              <div style={{ maxWidth: 1400, margin: '0 auto', padding: themeToken.paddingLG }}>
                <Skeleton active paragraph={{ rows: 12 }} />
              </div>
            </main>
            <Footer />
          </div>
        )}
      </>
    );
  }

  const symbolStr = typeof symbol === 'string' ? symbol.toUpperCase() : '';
  const separatorColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.15)';

  // Page content - shared between layouts
  const pageContent = (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* Back link */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Link
              href="/markets"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: themeToken.colorPrimary,
                fontSize: themeToken.fontSizeSM,
                fontWeight: fontWeights.medium,
                marginBottom: themeToken.marginMD,
              }}
            >
              <ArrowLeftOutlined />
              Back to Markets
            </Link>
          </motion.div>

          {loadingToken ? (
            <Skeleton active paragraph={{ rows: 10 }} />
          ) : collegeCoinData ? (
            /* College Coin Details */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'grid',
                gridTemplateColumns: isDesktop ? '1fr 360px' : '1fr',
                gap: themeToken.marginLG,
              }}
            >
              {/* Main content */}
              <div>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: themeToken.marginMD,
                  marginBottom: themeToken.marginLG,
                }}>
                  <img
                    src={resolveUploadUrl(collegeCoinData.iconUrl) || `https://ui-avatars.com/api/?name=${collegeCoinData.ticker}&size=72&background=8E2DE2&color=fff`}
                    alt={collegeCoinData.name}
                    width={isMobile ? 56 : 72}
                    height={isMobile ? 56 : 72}
                    style={{ borderRadius: '50%' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${collegeCoinData.ticker}&size=72&background=8E2DE2&color=fff`;
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h1 style={{
                        fontSize: isMobile ? themeToken.fontSizeHeading3 : themeToken.fontSizeHeading2,
                        fontWeight: fontWeights.bold,
                        color: themeToken.colorText,
                        margin: 0,
                      }}>
                        {collegeCoinData.name}
                      </h1>
                      <span style={{
                        fontSize: themeToken.fontSizeSM,
                        color: themeToken.colorTextSecondary,
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(142, 45, 226, 0.1)',
                        padding: '3px 10px',
                        borderRadius: 50,
                        fontWeight: fontWeights.medium,
                      }}>
                        {collegeCoinData.ticker}
                      </span>
                      <span style={{
                        fontSize: themeToken.fontSizeSM,
                        color: '#fff',
                        background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                        padding: '3px 10px',
                        borderRadius: 50,
                        fontWeight: fontWeights.semibold,
                      }}>
                        College Token
                      </span>
                    </div>
                    {collegeCoinData.categories && collegeCoinData.categories.length > 0 && (
                      <div style={{
                        fontSize: themeToken.fontSizeSM,
                        color: themeToken.colorTextSecondary,
                        marginTop: 4,
                      }}>
                        {collegeCoinData.categories.slice(0, 2).join(' • ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price section - Two columns on desktop (matching regular tokens) */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  style={{
                    display: 'flex',
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: themeToken.marginMD,
                    marginBottom: themeToken.marginLG,
                  }}
                >
                  {/* Left - Price Card */}
                  <div
                    style={{
                      flex: isDesktop ? '1 1 50%' : '1 1 auto',
                      padding: isMobile ? themeToken.paddingLG : themeToken.paddingXL,
                      background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 50%, #667eea 100%)',
                      borderRadius: themeToken.borderRadiusLG,
                      color: '#fff',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minHeight: isDesktop ? 180 : 'auto',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: -30,
                      right: -30,
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.1)',
                      filter: 'blur(20px)',
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ fontSize: themeToken.fontSizeSM, opacity: 0.8, marginBottom: 4 }}>
                        Current Price
                      </div>
                      <PriceFormatter price={livePrice} style={{ fontSize: isMobile ? 28 : 32, fontWeight: fontWeights.bold, color: '#fff' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: themeToken.marginXS, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 50,
                          background: liveChange >= 0 ? 'rgba(22, 196, 127, 0.3)' : 'rgba(252, 111, 3, 0.3)',
                          fontWeight: fontWeights.semibold,
                          fontSize: themeToken.fontSizeSM,
                        }}>
                          {liveChange >= 0 ? <RiseOutlined /> : <FallOutlined />}
                          {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ marginTop: themeToken.marginXS, opacity: 0.8, fontSize: themeToken.fontSizeSM }}>
                        {collegeCoinData.peggedPercentage}% of {collegeCoinData.peggedToAsset}
                        {collegeCoinData.referencePrice && (
                          <span> (<PriceFormatter price={collegeCoinData.referencePrice} />)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right - Mini Chart (Desktop only) */}
                  {isDesktop && (
                    <div
                      style={{
                        flex: '1 1 50%',
                        padding: themeToken.paddingMD,
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                        borderRadius: themeToken.borderRadiusLG,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 180,
                      }}
                    >
                      <div style={{
                        fontSize: themeToken.fontSizeSM,
                        color: themeToken.colorTextSecondary,
                        marginBottom: themeToken.marginXS,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}>
                        <span>7 Day Price</span>
                        <span style={{
                          color: liveChange >= 0 ? '#16C47F' : '#fc6f03',
                          fontWeight: fontWeights.semibold,
                        }}>
                          {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                        <MiniPriceChart
                          prices={sparklineData}
                          isLoading={loadingSparkline}
                          isPositive={liveChange >= 0}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* About section */}
                {collegeCoinData.description && (
                  <div style={{
                    padding: themeToken.paddingLG,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    marginBottom: themeToken.marginLG,
                  }}>
                    <h3 style={{
                      fontSize: themeToken.fontSizeLG,
                      fontWeight: fontWeights.semibold,
                      color: themeToken.colorText,
                      margin: `0 0 ${themeToken.marginMD}px 0`,
                    }}>
                      About {collegeCoinData.name}
                    </h3>
                    <div style={{
                      color: themeToken.colorTextSecondary,
                      lineHeight: 1.7,
                      fontSize: themeToken.fontSize,
                    }}>
                      {collegeCoinData.description}
                    </div>
                    {collegeCoinData.genesisDate && (
                      <div style={{ marginTop: themeToken.marginMD, color: themeToken.colorTextTertiary, fontSize: themeToken.fontSizeSM }}>
                        <strong>Genesis:</strong> {formatDate(collegeCoinData.genesisDate)}
                      </div>
                    )}
                  </div>
                )}

                {/* Links */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: themeToken.marginSM }}>
                  {collegeCoinData.website && (
                    <SocialLink href={collegeCoinData.website} icon={<GlobalOutlined />} label="Website" />
                  )}
                  {collegeCoinData.whitepaper && (
                    <SocialLink href={collegeCoinData.whitepaper} icon={<LinkOutlined />} label="Whitepaper" />
                  )}
                  {collegeCoinData.twitter && (
                    <SocialLink href={collegeCoinData.twitter} icon={<XOutlined />} label="Twitter" />
                  )}
                  {collegeCoinData.discord && (
                    <SocialLink href={collegeCoinData.discord} icon={<LinkOutlined />} label="Discord" />
                  )}
                </div>
              </div>

              {/* Sidebar - Desktop */}
              {isDesktop && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginMD }}>
                  {/* Action card */}
                  <div style={{
                    padding: themeToken.paddingLG,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    position: 'sticky',
                    top: 100,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                      <Button
                        type="primary"
                        icon={<SwapOutlined />}
                        onClick={handleBuy}
                        block
                        size="large"
                        style={{
                          background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                          border: 'none',
                          height: 52,
                          borderRadius: themeToken.borderRadiusLG,
                          fontWeight: fontWeights.semibold,
                          fontSize: themeToken.fontSizeLG,
                        }}
                      >
                        Trade {collegeCoinData.ticker}
                      </Button>
                    </div>
                  </div>

                  {/* Price Reference */}
                  <div style={{
                    padding: themeToken.paddingMD,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                  }}>
                    <h3 style={{
                      fontSize: themeToken.fontSizeLG,
                      fontWeight: fontWeights.semibold,
                      color: themeToken.colorText,
                      margin: `0 0 ${themeToken.marginMD}px 0`,
                    }}>
                      Price Reference
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: themeToken.colorTextSecondary }}>Reference Token</span>
                        <span style={{ color: themeToken.colorText, fontWeight: fontWeights.semibold }}>{collegeCoinData.peggedToAsset}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: themeToken.colorTextSecondary }}>Percentage</span>
                        <span style={{ color: themeToken.colorPrimary, fontWeight: fontWeights.semibold }}>{collegeCoinData.peggedPercentage}%</span>
                      </div>
                      {collegeCoinData.referencePrice && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>{collegeCoinData.peggedToAsset} Price</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            ${collegeCoinData.referencePrice.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Performance - borrowed from reference token */}
                  {referenceTokenData && (
                    <div style={{
                      padding: themeToken.paddingMD,
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                      borderRadius: themeToken.borderRadiusLG,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    }}>
                      <h3 style={{
                        fontSize: themeToken.fontSizeLG,
                        fontWeight: fontWeights.semibold,
                        color: themeToken.colorText,
                        margin: `0 0 ${themeToken.marginMD}px 0`,
                      }}>
                        Performance
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>24h</span>
                          <PriceChangeBadge value={referenceTokenData.market_data.price_change_percentage_24h || 0} size="small" />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>7 Days</span>
                          <PriceChangeBadge value={referenceTokenData.market_data.price_change_percentage_7d || 0} size="small" />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>30 Days</span>
                          <PriceChangeBadge value={referenceTokenData.market_data.price_change_percentage_30d || 0} size="small" />
                        </div>
                      </div>
                      <div style={{ 
                        marginTop: themeToken.marginSM, 
                        fontSize: themeToken.fontSizeSM - 1, 
                        color: themeToken.colorTextTertiary 
                      }}>
                        Based on {collegeCoinData.peggedToAsset} performance
                      </div>
                    </div>
                  )}

                  {/* Market Stats - borrowed from reference token, scaled */}
                  {referenceTokenData && (
                    <div style={{
                      padding: themeToken.paddingMD,
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                      borderRadius: themeToken.borderRadiusLG,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    }}>
                      <h3 style={{
                        fontSize: themeToken.fontSizeLG,
                        fontWeight: fontWeights.semibold,
                        color: themeToken.colorText,
                        margin: `0 0 ${themeToken.marginMD}px 0`,
                      }}>
                        Simulated Stats
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>24h High</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            <PriceFormatter price={(((referenceTokenData.market_data.high_24h.usd * usdUgxRate) || 0) * (collegeCoinData.peggedPercentage / 100))} />
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>24h Low</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            <PriceFormatter price={(((referenceTokenData.market_data.low_24h.usd * usdUgxRate) || 0) * (collegeCoinData.peggedPercentage / 100))} />
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#16C47F', fontWeight: fontWeights.semibold }}>ATH (scaled)</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            <PriceFormatter price={(((referenceTokenData.market_data.ath.usd * usdUgxRate) || 0) * (collegeCoinData.peggedPercentage / 100))} />
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#fc6f03', fontWeight: fontWeights.semibold }}>ATL (scaled)</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            <PriceFormatter price={(((referenceTokenData.market_data.atl.usd * usdUgxRate) || 0) * (collegeCoinData.peggedPercentage / 100))} />
                          </span>
                        </div>
                      </div>
                      <div style={{ 
                        marginTop: themeToken.marginSM, 
                        fontSize: themeToken.fontSizeSM - 1, 
                        color: themeToken.colorTextTertiary 
                      }}>
                        Scaled from {collegeCoinData.peggedToAsset} at {collegeCoinData.peggedPercentage}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : !tokenData ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                textAlign: 'center',
                padding: themeToken.paddingXL * 2,
                background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                borderRadius: themeToken.borderRadiusLG,
              }}
            >
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: themeToken.marginLG,
              }}>
                <ThunderboltOutlined style={{ fontSize: 36, color: '#fff' }} />
              </div>
              <h2 style={{ color: themeToken.colorText, marginBottom: themeToken.marginSM, fontWeight: fontWeights.bold }}>
                {symbolStr}
              </h2>
              <p style={{ color: themeToken.colorTextSecondary, marginBottom: themeToken.marginLG }}>
                Detailed info unavailable, but you can still trade!
              </p>
              <Button
                type="primary"
                size="large"
                icon={<SwapOutlined />}
                onClick={handleBuy}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  height: 48,
                  borderRadius: 50,
                  paddingLeft: 32,
                  paddingRight: 32,
                }}
              >
                Buy {symbolStr}
              </Button>
            </motion.div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? '1fr 360px' : '1fr',
              gap: themeToken.marginLG,
            }}>
              {/* Main content */}
              <div>
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: themeToken.marginMD,
                    marginBottom: themeToken.marginLG,
                  }}
                >
                  <img
                    src={tokenData.image.large}
                    alt={tokenData.name}
                    width={isMobile ? 56 : 72}
                    height={isMobile ? 56 : 72}
                    style={{ borderRadius: '50%' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h1 style={{
                        fontSize: isMobile ? themeToken.fontSizeHeading3 : themeToken.fontSizeHeading2,
                        fontWeight: fontWeights.bold,
                        color: themeToken.colorText,
                        margin: 0,
                      }}>
                        {tokenData.name}
                      </h1>
                      <span style={{
                        fontSize: themeToken.fontSizeSM,
                        color: themeToken.colorTextSecondary,
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)',
                        padding: '3px 10px',
                        borderRadius: 50,
                        fontWeight: fontWeights.medium,
                      }}>
                        {symbolStr}
                      </span>
                      {tokenData.market_data.market_cap_rank && (
                        <Tooltip title="Market Cap Rank">
                          <span style={{
                            fontSize: themeToken.fontSizeSM,
                            color: '#fff',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            padding: '3px 10px',
                            borderRadius: 50,
                            fontWeight: fontWeights.semibold,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}>
                            <TrophyOutlined style={{ fontSize: 11 }} />
                            #{tokenData.market_data.market_cap_rank}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    {tokenData.categories && tokenData.categories.length > 0 && (
                      <div style={{
                        fontSize: themeToken.fontSizeSM,
                        color: themeToken.colorTextSecondary,
                        marginTop: 4,
                      }}>
                        {tokenData.categories.slice(0, 2).join(' • ')}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Price section - Two columns on desktop */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  style={{
                    display: 'flex',
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: themeToken.marginMD,
                    marginBottom: themeToken.marginLG,
                  }}
                >
                  {/* Left - Price Card */}
                  <div
                    style={{
                      flex: isDesktop ? '1 1 50%' : '1 1 auto',
                      padding: isMobile ? themeToken.paddingLG : themeToken.paddingXL,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                      borderRadius: themeToken.borderRadiusLG,
                      color: '#fff',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minHeight: isDesktop ? 180 : 'auto',
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: -30,
                      right: -30,
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.1)',
                      filter: 'blur(20px)',
                    }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ fontSize: themeToken.fontSizeSM, opacity: 0.8, marginBottom: 4 }}>
                        Current Price
                      </div>
                      <PriceFormatter price={livePrice} style={{ fontSize: isMobile ? 28 : 32, fontWeight: fontWeights.bold, color: '#fff' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: themeToken.marginXS, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 50,
                          background: liveChange >= 0 ? 'rgba(22, 196, 127, 0.3)' : 'rgba(252, 111, 3, 0.3)',
                          fontWeight: fontWeights.semibold,
                          fontSize: themeToken.fontSizeSM,
                        }}>
                          {liveChange >= 0 ? <RiseOutlined /> : <FallOutlined />}
                          {liveChange >= 0 ? '+' : ''}{liveChange.toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ marginTop: themeToken.marginXS, opacity: 0.8, fontSize: themeToken.fontSizeSM }}>
                        H: <PriceFormatter price={(tokenData.market_data.high_24h.usd * usdUgxRate)} /> · L: <PriceFormatter price={(tokenData.market_data.low_24h.usd * usdUgxRate)} />
                      </div>
                    </div>
                  </div>

                  {/* Right - Mini Chart (Desktop only) */}
                  {isDesktop && (
                    <div
                      style={{
                        flex: '1 1 50%',
                        padding: themeToken.paddingMD,
                        background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                        borderRadius: themeToken.borderRadiusLG,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 180,
                      }}
                    >
                      <div style={{
                        fontSize: themeToken.fontSizeSM,
                        color: themeToken.colorTextSecondary,
                        marginBottom: themeToken.marginXS,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}>
                        <span>7 Day Price</span>
                        <span style={{
                          color: (tokenData.market_data.price_change_percentage_7d || 0) >= 0 ? '#16C47F' : '#fc6f03',
                          fontWeight: fontWeights.semibold,
                        }}>
                          {(tokenData.market_data.price_change_percentage_7d || 0) >= 0 ? '+' : ''}{tokenData.market_data.price_change_percentage_7d?.toFixed(2) || '0.00'}%
                        </span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                        <MiniPriceChart
                          prices={sparklineData}
                          isLoading={loadingSparkline}
                          isPositive={(tokenData.market_data.price_change_percentage_7d || 0) >= 0}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Key Stats - no background cards, colored text with separators */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{
                    marginBottom: themeToken.marginLG,
                  }}
                >
                  {isMobile ? (
                    // Mobile: 2x2 grid with separators
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      position: 'relative',
                    }}>
                      {/* Vertical separator */}
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: separatorColor,
                      }} />
                      {/* Horizontal separator */}
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        right: 0,
                        height: 1,
                        background: separatorColor,
                      }} />
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                        <KeyStat
                          label={(tokenData.market_data.market_cap.usd * usdUgxRate) > 0 ? "Market Cap" : "FDV"}
                          value={formatLargeNumber((tokenData.market_data.market_cap.usd * usdUgxRate) || (tokenData.market_data.fully_diluted_valuation.usd * usdUgxRate))}
                          color="#11998e"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                        <KeyStat
                          label="24h Volume"
                          value={formatLargeNumber((tokenData.market_data.total_volume.usd * usdUgxRate))}
                          color="#4facfe"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                        <KeyStat
                          label={tokenData.market_data.circulating_supply > 0 ? "Circulating" : "Total Supply"}
                          value={formatSupply(tokenData.market_data.circulating_supply || tokenData.market_data.total_supply || tokenData.market_data.max_supply || 0)}
                          color="#fa709a"
                          subValue={
                            tokenData.market_data.max_supply && (
                              <Progress
                                percent={supplyPercentage}
                                size="small"
                                showInfo={false}
                                strokeColor="#fa709a"
                                trailColor={separatorColor}
                                style={{ maxWidth: 80, margin: '0 auto' }}
                              />
                            )
                          }
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80 }}>
                        <KeyStat
                          label="Max Supply"
                          value={tokenData.market_data.max_supply ? formatSupply(tokenData.market_data.max_supply) : '∞'}
                          color="#667eea"
                        />
                      </div>
                    </div>
                  ) : (
                    // Desktop: horizontal row with vertical separators
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <div style={{ flex: 1 }}>
                        <KeyStat
                          label={(tokenData.market_data.market_cap.usd * usdUgxRate) > 0 ? "Market Cap" : "FDV"}
                          value={formatLargeNumber((tokenData.market_data.market_cap.usd * usdUgxRate) || (tokenData.market_data.fully_diluted_valuation.usd * usdUgxRate))}
                          color="#11998e"
                        />
                      </div>
                      <div style={{ width: 1, height: 50, background: separatorColor }} />
                      <div style={{ flex: 1 }}>
                        <KeyStat
                          label="24h Volume"
                          value={formatLargeNumber((tokenData.market_data.total_volume.usd * usdUgxRate))}
                          color="#4facfe"
                        />
                      </div>
                      <div style={{ width: 1, height: 50, background: separatorColor }} />
                      <div style={{ flex: 1 }}>
                        <KeyStat
                          label={tokenData.market_data.circulating_supply > 0 ? "Circulating" : "Total Supply"}
                          value={formatSupply(tokenData.market_data.circulating_supply || tokenData.market_data.total_supply || tokenData.market_data.max_supply || 0)}
                          color="#fa709a"
                          subValue={
                            tokenData.market_data.max_supply && (
                              <Progress
                                percent={supplyPercentage}
                                size="small"
                                showInfo={false}
                                strokeColor="#fa709a"
                                trailColor={separatorColor}
                                style={{ maxWidth: 80, margin: '0 auto' }}
                              />
                            )
                          }
                        />
                      </div>
                      <div style={{ width: 1, height: 50, background: separatorColor }} />
                      <div style={{ flex: 1 }}>
                        <KeyStat
                          label="Max Supply"
                          value={tokenData.market_data.max_supply ? formatSupply(tokenData.market_data.max_supply) : '∞'}
                          color="#667eea"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Performance & ATH/ATL - Only on mobile (moved to sidebar on desktop) */}
                {!isDesktop && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                      gap: themeToken.marginMD,
                      marginBottom: themeToken.marginLG,
                    }}
                  >
                    {/* Performance */}
                    <div style={{
                      padding: themeToken.paddingMD,
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                      borderRadius: themeToken.borderRadiusLG,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    }}>
                      <h3 style={{
                        fontSize: themeToken.fontSizeLG,
                        fontWeight: fontWeights.semibold,
                        color: themeToken.colorText,
                        margin: `0 0 ${themeToken.marginMD}px 0`,
                      }}>
                        Performance
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>7 Days</span>
                          <PriceChangeBadge value={tokenData.market_data.price_change_percentage_7d} size="small" />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>30 Days</span>
                          <PriceChangeBadge value={tokenData.market_data.price_change_percentage_30d} size="small" />
                        </div>
                      </div>
                    </div>

                    {/* ATH/ATL */}
                    <div style={{
                      padding: themeToken.paddingMD,
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                      borderRadius: themeToken.borderRadiusLG,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    }}>
                      <h3 style={{
                        fontSize: themeToken.fontSizeLG,
                        fontWeight: fontWeights.semibold,
                        color: themeToken.colorText,
                        margin: `0 0 ${themeToken.marginMD}px 0`,
                      }}>
                        All-Time
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#16C47F', fontWeight: fontWeights.semibold }}>ATH</span>
                            <div style={{ fontSize: themeToken.fontSizeSM, color: themeToken.colorTextTertiary }}>
                              {formatDate(tokenData.market_data.ath_date.usd)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: fontWeights.semibold, color: themeToken.colorText }}>
                              <PriceFormatter price={(tokenData.market_data.ath.usd * usdUgxRate)} />
                            </div>
                            <PriceChangeBadge value={tokenData.market_data?.ath_change_percentage?.usd} size="small" />
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#fc6f03', fontWeight: fontWeights.semibold }}>ATL</span>
                            <div style={{ fontSize: themeToken.fontSizeSM, color: themeToken.colorTextTertiary }}>
                              {formatDate(tokenData.market_data.atl_date.usd)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: fontWeights.semibold, color: themeToken.colorText }}>
                              <PriceFormatter price={(tokenData.market_data.atl.usd * usdUgxRate)} />
                            </div>
                            <PriceChangeBadge value={tokenData.market_data?.atl_change_percentage?.usd} size="small" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* About section */}
                {cleanDescription && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{
                      padding: themeToken.paddingLG,
                      background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                      borderRadius: themeToken.borderRadiusLG,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                      marginBottom: themeToken.marginLG,
                    }}
                  >
                    <h3 style={{
                      fontSize: themeToken.fontSizeLG,
                      fontWeight: fontWeights.semibold,
                      color: themeToken.colorText,
                      margin: `0 0 ${themeToken.marginMD}px 0`,
                    }}>
                      About {tokenData.name}
                    </h3>
                    <div style={{
                      color: themeToken.colorTextSecondary,
                      lineHeight: 1.7,
                      fontSize: themeToken.fontSize,
                    }}>
                      {cleanDescription.length > 600 ? `${cleanDescription.substring(0, 600)}...` : cleanDescription}
                    </div>
                    {tokenData.genesis_date && (
                      <div style={{ marginTop: themeToken.marginMD, color: themeToken.colorTextTertiary, fontSize: themeToken.fontSizeSM }}>
                        <strong>Genesis:</strong> {formatDate(tokenData.genesis_date)}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Links */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: themeToken.marginSM }}
                >
                  {tokenData.links.homepage[0] && (
                    <SocialLink href={tokenData.links.homepage[0]} icon={<GlobalOutlined />} label="Website" />
                  )}
                  {tokenData.links.whitepaper && (
                    <SocialLink href={tokenData.links.whitepaper} icon={<LinkOutlined />} label="Whitepaper" />
                  )}
                  {tokenData.links.twitter_screen_name && (
                    <SocialLink href={`https://twitter.com/${tokenData.links.twitter_screen_name}`} icon={<XOutlined />} label="Twitter" />
                  )}
                  {tokenData.links.subreddit_url && (
                    <SocialLink href={tokenData.links.subreddit_url} icon={<RedditOutlined />} label="Reddit" />
                  )}
                  {tokenData.links.repos_url.github[0] && (
                    <SocialLink href={tokenData.links.repos_url.github[0]} icon={<GithubOutlined />} label="GitHub" />
                  )}
                </motion.div>
              </div>

              {/* Sidebar - Desktop */}
              {isDesktop && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginMD }}
                >
                  {/* Action card */}
                  <div style={{
                    padding: themeToken.paddingLG,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                    position: 'sticky',
                    top: 100,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                      <Button
                        type="primary"
                        icon={<SwapOutlined />}
                        onClick={handleBuy}
                        block
                        size="large"
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          border: 'none',
                          height: 52,
                          borderRadius: themeToken.borderRadiusLG,
                          fontWeight: fontWeights.semibold,
                          fontSize: themeToken.fontSizeLG,
                        }}
                      >
                        Buy {symbolStr}
                      </Button>
                      <Button
                        icon={isWatchlisted ? <StarFilled style={{ color: '#f6c343' }} /> : <StarOutlined />}
                        onClick={handleToggleWatchlist}
                        block
                        size="large"
                        style={{
                          height: 52,
                          borderRadius: themeToken.borderRadiusLG,
                          fontWeight: fontWeights.medium,
                        }}
                      >
                        {isWatchlisted ? 'Watching' : 'Add to Watchlist'}
                      </Button>
                    </div>
                  </div>

                  {/* Performance - Desktop sidebar */}
                  <div style={{
                    padding: themeToken.paddingMD,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                  }}>
                    <h3 style={{
                      fontSize: themeToken.fontSizeLG,
                      fontWeight: fontWeights.semibold,
                      color: themeToken.colorText,
                      margin: `0 0 ${themeToken.marginMD}px 0`,
                    }}>
                      Performance
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: themeToken.colorTextSecondary }}>7 Days</span>
                        <PriceChangeBadge value={tokenData.market_data.price_change_percentage_7d} size="small" />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: themeToken.colorTextSecondary }}>30 Days</span>
                        <PriceChangeBadge value={tokenData.market_data.price_change_percentage_30d} size="small" />
                      </div>
                    </div>
                  </div>

                  {/* ATH/ATL - Desktop sidebar */}
                  <div style={{
                    padding: themeToken.paddingMD,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                  }}>
                    <h3 style={{
                      fontSize: themeToken.fontSizeLG,
                      fontWeight: fontWeights.semibold,
                      color: themeToken.colorText,
                      margin: `0 0 ${themeToken.marginMD}px 0`,
                    }}>
                      All-Time
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginSM }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: '#16C47F', fontWeight: fontWeights.semibold }}>ATH</span>
                          <div style={{ fontSize: themeToken.fontSizeSM, color: themeToken.colorTextTertiary }}>
                            {formatDate(tokenData.market_data.ath_date.usd)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: fontWeights.semibold, color: themeToken.colorText }}>
                            <PriceFormatter price={(tokenData.market_data.ath.usd * usdUgxRate)} />
                          </div>
                          <PriceChangeBadge value={tokenData.market_data?.ath_change_percentage?.usd} size="small" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ color: '#fc6f03', fontWeight: fontWeights.semibold }}>ATL</span>
                          <div style={{ fontSize: themeToken.fontSizeSM, color: themeToken.colorTextTertiary }}>
                            {formatDate(tokenData.market_data.atl_date.usd)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: fontWeights.semibold, color: themeToken.colorText }}>
                            <PriceFormatter price={(tokenData.market_data.atl.usd * usdUgxRate)} />
                          </div>
                          <PriceChangeBadge value={tokenData.market_data?.atl_change_percentage?.usd} size="small" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Community stats */}
                  <div style={{
                    padding: themeToken.paddingMD,
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: themeToken.borderRadiusLG,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                  }}>
                    <div style={{
                      fontSize: 11,
                      color: themeToken.colorTextTertiary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: themeToken.marginSM,
                    }}>
                      Community
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: themeToken.marginXS }}>
                      {tokenData.community_data.twitter_followers > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>Twitter</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            {tokenData.community_data.twitter_followers.toLocaleString()} followers
                          </span>
                        </div>
                      )}
                      {tokenData.community_data.reddit_subscribers > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>Reddit</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            {tokenData.community_data.reddit_subscribers.toLocaleString()} members
                          </span>
                        </div>
                      )}
                      {tokenData.watchlist_portfolio_users > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>Watchlists</span>
                          <span style={{ color: themeToken.colorText, fontWeight: fontWeights.medium }}>
                            {tokenData.watchlist_portfolio_users.toLocaleString()} users
                          </span>
                        </div>
                      )}
                      {tokenData.sentiment_votes_up_percentage > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: themeToken.colorTextSecondary }}>Sentiment</span>
                          <span style={{ color: '#16C47F', fontWeight: fontWeights.medium }}>
                            {tokenData.sentiment_votes_up_percentage.toFixed(0)}% Bullish
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Mobile fixed bottom CTA - positioned above navbar */}
          {isMobile && tokenData && (
            <div style={{
              position: 'fixed',
              bottom: 115, // Above the navigation bar (nav height ~100px + spacing)
              left: 0,
              right: 0,
              padding: `0 ${themeToken.paddingMD}px`,
              zIndex: 100,
              display: 'flex',
              gap: themeToken.marginSM,
            }}>
              <motion.button
                onClick={handleToggleWatchlist}
                animate={{
                  scale: isTogglingWatchlist ? 0.85 : 1,
                  rotate: isTogglingWatchlist ? 360 : 0,
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.3 }}
                style={{ 
                  height: 52, 
                  width: 52, 
                  minWidth: 52,
                  borderRadius: themeToken.borderRadiusLG, 
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? themeToken.colorBgElevated : themeToken.colorBgContainer,
                  border: `1px solid ${themeToken.colorBorder}`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                }}
              >
                {isWatchlisted ? (
                  <StarFilled style={{ color: '#f6c343', fontSize: 24 }} />
                ) : (
                  <StarOutlined style={{ fontSize: 24, color: themeToken.colorTextSecondary }} />
                )}
              </motion.button>
              <Button
                type="primary"
                icon={<SwapOutlined />}
                onClick={handleBuy}
                size="large"
                block
                style={{
                  background: themeToken.colorSuccess,
                  border: 'none',
                  height: 52,
                  borderRadius: themeToken.borderRadiusLG,
                  fontWeight: fontWeights.semibold,
                  boxShadow: '0 4px 12px rgba(22, 196, 127, 0.3)',
                }}
              >
                Buy {symbolStr}
              </Button>
            </div>
          )}

          {/* Bottom padding for mobile CTA */}
          {isMobile && tokenData && <div style={{ height: 190 }} />}
        </div>
  );

  // Conditional layout based on authentication
  return (
    <>
      <Head>
        <title>{`Buy ${tokenData?.name || symbolStr} (${symbolStr}) in UGX — InTuition Exchange`}</title>
        <meta
          name="description"
          content={`Live ${tokenData?.name || symbolStr} (${symbolStr}) price in Ugandan Shillings. Buy, sell, and trade ${tokenData?.name || symbolStr} on General Exchange — Uganda's home for crypto and college coins.`}
        />
      </Head>

      {isAuthenticated ? (
        <DashboardLayout activeKey="markets">
          {pageContent}
        </DashboardLayout>
      ) : (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: themeToken.colorBgLayout }}>
          <Header />
          <main style={{ flex: 1, padding: `${HEADER_HEIGHT + themeToken.paddingLG}px ${themeToken.paddingLG}px ${themeToken.paddingLG}px` }}>
            {pageContent}
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}
