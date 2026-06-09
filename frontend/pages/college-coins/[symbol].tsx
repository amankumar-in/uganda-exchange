import React, { useEffect, useState, useCallback, useRef, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, message, Button } from 'antd';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  DeleteOutlined,
  WalletOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import {
  getMiningStatus,
  startMining,
  stopMining,
  addMiningCollege,
  removeMiningCollege,
  MiningStatus,
} from '@/services/api/mining';
import { TokensApi } from '@/services/api/tokens';
import { useMiningSocket } from '@/hooks/useMiningSocket';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;

const CollegeCoinDetailPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { symbol } = router.query;
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [miningStatus, setMiningStatus] = useState<MiningStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : true;

  // Live counter ref for smooth animation
  const [liveTokens, setLiveTokens] = useState(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push(`/login?redirect=/college-coins/${symbol}`);
        return;
      }
      setPageLoading(false);
    }
  }, [user, isLoading, router, symbol]);

  const fetchData = useCallback(async () => {
    if (!symbol || typeof symbol !== 'string') return;
    try {
      const [tokenRes, statusRes] = await Promise.all([
        TokensApi.getBySymbol(symbol),
        getMiningStatus(),
      ]);
      setTokenData(tokenRes);
      setMiningStatus(statusRes.data);
    } catch (err) {
      console.error('Failed to fetch detail data:', err);
    }
  }, [symbol]);

  useEffect(() => {
    if (!pageLoading && user && symbol) {
      fetchData();
    }
  }, [pageLoading, user, symbol, fetchData]);

  // Find current college info from mining status
  const college = miningStatus?.miningColleges.find(c => c.symbol === symbol);
  const session = miningStatus?.activeSessions.find(s => s.symbol === symbol && !s.isExpired);
  const balanceInfo = miningStatus?.balances.find(b => b.symbol === symbol);
  const balance = balanceInfo?.balance || 0;
  const isMining = !!session;
  const isInList = !!college;

  // Live token counter animation
  useEffect(() => {
    if (!session) {
      setLiveTokens(0);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const startTime = new Date(session.startTime).getTime();
    const rate = session.earningRate;

    const tick = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / (1000 * 60 * 60);
      setLiveTokens(Math.max(0, elapsed * rate));
      animationRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [session]);

  // WebSocket updates
  useMiningSocket({
    onMiningUpdate: () => fetchData(),
    onSessionCompleted: (data) => {
      if (data.symbol === symbol) {
        message.success(`Mining completed! Earned ${data.tokensEarned.toFixed(4)} ${data.symbol}`);
        fetchData();
      }
    },
  });

  const handleStartMining = async () => {
    if (!tokenData) return;
    try {
      setActionLoading(true);
      await startMining(tokenData.id);
      message.success('Mining started');
      await fetchData();
    } catch (err: any) {
      message.error(err.message || 'Failed to start mining');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopMining = async () => {
    if (!tokenData) return;
    try {
      setActionLoading(true);
      const res = await stopMining(tokenData.id);
      const earned = res.data?.tokensEarned || 0;
      message.success(`Mining stopped. Earned ${earned.toFixed(4)} tokens`);
      await fetchData();
    } catch (err: any) {
      message.error(err.message || 'Failed to stop mining');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCollege = async () => {
    if (!tokenData) return;
    try {
      setActionLoading(true);
      await addMiningCollege(tokenData.id);
      message.success('College added to mining list');
      await fetchData();
    } catch (err: any) {
      message.error(err.message || 'Failed to add college');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveCollege = async () => {
    if (!tokenData) return;
    try {
      setActionLoading(true);
      await removeMiningCollege(tokenData.id);
      message.success('College removed from mining list');
      await fetchData();
    } catch (err: any) {
      message.error(err.message || 'Failed to remove college');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading || !user) return null;

  if (pageLoading || !tokenData) {
    return (
      <>
        <Head><title>College Coin — Buy & Trade on UG Coin</title></Head>
        <Skeleton active paragraph={{ rows: 12 }} />
      </>
    );
  }

  const displayName = tokenData.collegeName || tokenData.name;
  const iconSrc = tokenData.collegeLogo || tokenData.iconUrl;
  const sessionHours = tokenData.miningSessionHours || 24;
  const baseRate = tokenData.miningBaseRate || 0.25;

  // Progress calculation
  const progressPct = session
    ? Math.min(100, ((sessionHours - session.remainingHours) / sessionHours) * 100)
    : 0;

  const cardStyle: React.CSSProperties = {
    background: isDark
      ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%)'
      : 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)',
    borderRadius: token.borderRadiusLG,
    padding: token.paddingLG,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)'}`,
  };

  return (
    <>
      <Head>
        <title>{`Buy ${symbol} College Coin in UGX — UG Coin`}</title>
        <meta
          name="description"
          content={`Buy and trade ${symbol} on UG Coin. Earn ${symbol} through mining, swap with crypto, and pay for campus services. Uganda's college-coin marketplace.`}
        />
      </Head>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ marginBottom: token.marginLG }}
        >
          <div
            onClick={() => router.push('/college-coins')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: token.marginXS,
              cursor: 'pointer',
              color: token.colorTextSecondary,
              fontSize: token.fontSize,
              fontWeight: fontWeights.medium,
            }}
          >
            <ArrowLeftOutlined />
            Back to College Coins
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginMD,
            marginBottom: token.marginXL,
          }}
        >
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: iconSrc ? 'transparent' : 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
            color: '#fff',
            fontWeight: fontWeights.bold,
            fontSize: 28,
          }}>
            {iconSrc ? (
              <img
                src={iconSrc}
                alt={tokenData.symbol}
                width={64}
                height={64}
                style={{ objectFit: 'cover', borderRadius: '50%' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    parent.style.background = 'linear-gradient(135deg, #8E2DE2, #4A00E0)';
                    parent.textContent = tokenData.symbol?.charAt(0) || '?';
                  }
                }}
              />
            ) : (
              tokenData.symbol?.charAt(0) || '?'
            )}
          </div>
          <div>
            <h1 style={{
              fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading3,
              fontWeight: fontWeights.bold,
              color: token.colorText,
              margin: 0,
            }}>
              {tokenData.symbol}
            </h1>
            <div style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
              {displayName}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: token.marginXS }}>
            {isMining && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: `${token.paddingXS}px ${token.paddingSM}px`,
                borderRadius: 50,
                background: isDark ? 'rgba(82, 196, 26, 0.15)' : 'rgba(82, 196, 26, 0.1)',
                color: '#52c41a',
                fontWeight: fontWeights.semibold,
                fontSize: token.fontSizeSM,
              }}>
                <ThunderboltOutlined />
                Mining Active
              </div>
            )}
          </div>
        </motion.div>

        {/* Two column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: token.marginLG,
        }}>
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginLG }}>
            {/* College Info Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={cardStyle}
            >
              <div style={{
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                marginBottom: token.marginMD,
              }}>
                College Information
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: token.marginMD }}>
                <div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Token Symbol
                  </div>
                  <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: token.colorText }}>
                    {tokenData.symbol}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Country
                  </div>
                  <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.semibold, color: token.colorText }}>
                    {tokenData.collegeCountry || 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Mining Rate
                  </div>
                  <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: '#8E2DE2' }}>
                    {baseRate} tokens/hr
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Session Duration
                  </div>
                  <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.semibold, color: token.colorText }}>
                    {sessionHours}h
                  </div>
                </div>
              </div>

              {tokenData.description && (
                <div style={{ marginTop: token.marginMD }}>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>
                    About
                  </div>
                  <div style={{ fontSize: token.fontSize, color: token.colorTextSecondary, lineHeight: 1.6 }}>
                    {tokenData.description}
                  </div>
                </div>
              )}

              {tokenData.website && (
                <div style={{ marginTop: token.marginMD }}>
                  <a
                    href={tokenData.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: token.colorPrimary,
                      fontSize: token.fontSize,
                    }}
                  >
                    <GlobalOutlined /> Visit Website
                  </a>
                </div>
              )}
            </motion.div>

            {/* Mining Control Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                ...cardStyle,
                border: isMining
                  ? `2px solid ${isDark ? 'rgba(82, 196, 26, 0.3)' : 'rgba(82, 196, 26, 0.2)'}`
                  : cardStyle.border,
              }}
            >
              <div style={{
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                marginBottom: token.marginMD,
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
              }}>
                <ThunderboltOutlined style={{ color: isMining ? '#52c41a' : token.colorTextSecondary }} />
                Mining Control
              </div>

              {/* Live yield counter */}
              {isMining && (
                <div style={{
                  textAlign: 'center',
                  padding: `${token.paddingLG}px 0`,
                  marginBottom: token.marginMD,
                }}>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Tokens Earned This Session
                  </div>
                  <div style={{
                    fontSize: isMobile ? 36 : 48,
                    fontWeight: fontWeights.bold,
                    color: '#52c41a',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1.2,
                  }}>
                    {liveTokens.toFixed(6)}
                  </div>
                  <div style={{
                    fontSize: token.fontSizeSM,
                    color: token.colorTextSecondary,
                    marginTop: 4,
                  }}>
                    {tokenData.symbol}
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {isMining && session && (
                <div style={{ marginBottom: token.marginLG }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: token.fontSizeSM }}>
                    <span style={{ color: token.colorTextSecondary }}>Session Progress</span>
                    <span style={{ color: token.colorText, fontWeight: fontWeights.medium }}>
                      {progressPct.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{
                    height: 8,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #52c41a, #73d13d)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 6,
                    fontSize: 12,
                    color: token.colorTextTertiary,
                  }}>
                    <span>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      {session.remainingHours.toFixed(1)}h remaining
                    </span>
                    <span>
                      {baseRate} tokens/hr
                    </span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: token.marginSM }}>
                {!isInList ? (
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={handleAddCollege}
                    loading={actionLoading}
                    style={{
                      height: 48,
                      fontWeight: fontWeights.semibold,
                      background: 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
                      border: 'none',
                    }}
                  >
                    Add to Mining List
                  </Button>
                ) : isMining ? (
                  <Button
                    block
                    size="large"
                    onClick={handleStopMining}
                    loading={actionLoading}
                    danger
                    icon={<PauseCircleOutlined />}
                    style={{
                      height: 48,
                      fontWeight: fontWeights.semibold,
                    }}
                  >
                    Stop Mining
                  </Button>
                ) : (
                  <>
                    <Button
                      type="primary"
                      block
                      size="large"
                      onClick={handleStartMining}
                      loading={actionLoading}
                      icon={<PlayCircleOutlined />}
                      style={{
                        height: 48,
                        fontWeight: fontWeights.semibold,
                        background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                        border: 'none',
                      }}
                    >
                      Start Mining
                    </Button>
                    <Button
                      size="large"
                      onClick={handleRemoveCollege}
                      loading={actionLoading}
                      icon={<DeleteOutlined />}
                      danger
                      style={{
                        height: 48,
                        fontWeight: fontWeights.semibold,
                      }}
                    />
                  </>
                )}
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginLG }}>
            {/* Mining Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={cardStyle}
            >
              <div style={{
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                marginBottom: token.marginMD,
              }}>
                Mining Stats
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginMD }}>
                {/* Balance */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: token.paddingSM,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(102, 126, 234, 0.03)',
                  borderRadius: token.borderRadius,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                    <WalletOutlined style={{ fontSize: 20, color: '#8E2DE2' }} />
                    <div>
                      <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase' }}>
                        Total Balance
                      </div>
                      <div style={{
                        fontSize: token.fontSizeHeading4,
                        fontWeight: fontWeights.bold,
                        color: token.colorText,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {balance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: token.fontSizeSM,
                    color: token.colorTextSecondary,
                    fontWeight: fontWeights.medium,
                  }}>
                    {tokenData.symbol}
                  </div>
                </div>

                {/* Earning rate */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: token.paddingSM,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(102, 126, 234, 0.03)',
                  borderRadius: token.borderRadius,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                    <ThunderboltOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    <div>
                      <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase' }}>
                        Earning Rate
                      </div>
                      <div style={{
                        fontSize: token.fontSizeHeading4,
                        fontWeight: fontWeights.bold,
                        color: '#52c41a',
                      }}>
                        {baseRate} / hr
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: token.fontSizeSM,
                    color: token.colorTextSecondary,
                  }}>
                    {(baseRate * 24).toFixed(2)} / day
                  </div>
                </div>

                {/* Session duration */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: token.paddingSM,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(102, 126, 234, 0.03)',
                  borderRadius: token.borderRadius,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                    <FieldTimeOutlined style={{ fontSize: 20, color: token.colorWarning }} />
                    <div>
                      <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase' }}>
                        Session Duration
                      </div>
                      <div style={{
                        fontSize: token.fontSizeHeading4,
                        fontWeight: fontWeights.bold,
                        color: token.colorText,
                      }}>
                        {sessionHours} hours
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: token.fontSizeSM,
                    color: token.colorTextSecondary,
                  }}>
                    Max {(baseRate * sessionHours).toFixed(2)} tokens
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Status / Session info card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              style={cardStyle}
            >
              <div style={{
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                marginBottom: token.marginMD,
              }}>
                Session Status
              </div>

              {isMining && session ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: token.colorTextSecondary }}>Status</span>
                    <span style={{ color: '#52c41a', fontWeight: fontWeights.semibold }}>Active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: token.colorTextSecondary }}>Started</span>
                    <span style={{ color: token.colorText }}>
                      {new Date(session.startTime).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: token.colorTextSecondary }}>Ends</span>
                    <span style={{ color: token.colorText }}>
                      {new Date(session.endTime).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: token.colorTextSecondary }}>Rate</span>
                    <span style={{ color: token.colorText }}>{session.earningRate} tokens/hr</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: token.paddingLG,
                  color: token.colorTextSecondary,
                }}>
                  <ClockCircleOutlined style={{ fontSize: 32, marginBottom: token.marginSM, opacity: 0.5 }} />
                  <div>No active mining session</div>
                  {isInList && (
                    <div style={{ fontSize: token.fontSizeSM, marginTop: 4 }}>
                      Click "Start Mining" to begin earning tokens
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};

CollegeCoinDetailPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default CollegeCoinDetailPage;
