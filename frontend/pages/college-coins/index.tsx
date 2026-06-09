import React, { useEffect, useState, useMemo, useCallback, useRef, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Input, Skeleton, Empty, message, Modal, Drawer } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  BankOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { useExchange } from '@/context/ExchangeContext';
import {
  getMiningStatus,
  addMiningCollege,
  removeMiningCollege,
  startMining,
  stopMining,
  startAllMining,
  stopAllMining,
  MiningStatus,
} from '@/services/api/mining';
import { TokensApi } from '@/services/api/tokens';
import { useMiningSocket } from '@/hooks/useMiningSocket';
import type { NextPageWithLayout } from '../_app';

// Shows REAL college tokens (Token.isCollegeCoin) for mining.
// Demo/practice coins are managed at /admin/demo-college-coins and use TradingPair.isDemoCollegeCoin.

const { useToken } = theme;
const { useBreakpoint } = Grid;

type FilterTab = 'all' | 'my-colleges' | 'mining-active';

// Filter pill
const FilterPill = ({
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
};

// Redesigned College coin card
const CollegeCoinCard = ({
  college,
  session,
  balance,
  onCardClick,
  onStartMining,
  onStopMining,
  onRemove,
  isMining,
  compact,
}: {
  college: any;
  session: any;
  balance: number;
  onCardClick: () => void;
  onStartMining: () => void;
  onStopMining: () => void;
  onRemove: () => void;
  isMining: boolean;
  compact?: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const animationRef = useRef<number | null>(null);
  const yieldRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const breakdownRef = useRef<HTMLSpanElement>(null);

  // Live token counter — direct DOM updates, no setState, no re-renders
  const sessionStart = session?.startTime;
  const sessionRate = session?.earningRate;

  useEffect(() => {
    if (!isMining || !sessionStart || !sessionRate) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (yieldRef.current) yieldRef.current.textContent = '+0.0000';
      if (totalRef.current) totalRef.current.textContent = balance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      if (breakdownRef.current) breakdownRef.current.textContent = '';
      return;
    }

    const startMs = new Date(sessionStart).getTime();

    const tick = () => {
      const elapsed = (Date.now() - startMs) / (1000 * 60 * 60);
      const earned = Math.max(0, elapsed * sessionRate);
      if (yieldRef.current) yieldRef.current.textContent = `+${earned.toFixed(4)}`;
      if (totalRef.current) totalRef.current.textContent = (balance + earned).toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
      if (breakdownRef.current) breakdownRef.current.textContent = `Wallet: ${balance.toFixed(2)} + Mining: ${earned.toFixed(4)}`;
      animationRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isMining, sessionStart, sessionRate, balance]);

  const iconSrc = college.collegeLogo || college.iconUrl;
  const displayName = college.collegeName || college.name;

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
        border: `1px solid ${isMining
          ? (isDark ? 'rgba(82, 196, 26, 0.3)' : 'rgba(82, 196, 26, 0.2)')
          : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)')}`,
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Mining active top border */}
      {isMining && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #52c41a, #73d13d, #52c41a)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite linear',
        }} />
      )}

      {/* Status + Rate row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 6 : 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <motion.div
            animate={isMining ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isMining ? '#52c41a' : token.colorTextTertiary,
              flexShrink: 0,
            }}
          />
          <span style={{
            fontSize: compact ? 10 : 11,
            fontWeight: fontWeights.semibold,
            color: isMining ? '#52c41a' : token.colorTextTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {isMining ? 'Mining' : 'Idle'}
          </span>
        </div>
        <span style={{
          fontSize: compact ? 10 : 11,
          color: token.colorTextSecondary,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {college.miningBaseRate} t/hr
        </span>
      </div>

      {/* Identity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? token.marginXS : token.marginSM, marginBottom: compact ? 8 : 12 }}>
        <div style={{
          width: compact ? 36 : 44,
          height: compact ? 36 : 44,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: iconSrc ? 'transparent' : 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
          color: '#fff',
          fontWeight: fontWeights.bold,
          fontSize: compact ? 14 : 18,
        }}>
          {iconSrc ? (
            <img
              src={iconSrc}
              alt={college.symbol}
              width={compact ? 36 : 44}
              height={compact ? 36 : 44}
              style={{ objectFit: 'cover', borderRadius: '50%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  parent.style.background = 'linear-gradient(135deg, #8E2DE2, #4A00E0)';
                  parent.textContent = college.symbol?.charAt(0) || '?';
                }
              }}
            />
          ) : (
            college.symbol?.charAt(0) || '?'
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: compact ? token.fontSize : token.fontSizeLG,
            fontWeight: fontWeights.bold,
            color: token.colorText,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {college.symbol}
          </div>
          <div style={{
            fontSize: compact ? 11 : token.fontSizeSM,
            color: token.colorTextSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName}
          </div>
          {college.collegeCountry && !compact && (
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: token.colorTextTertiary,
            }}>
              {college.collegeCountry}
            </span>
          )}
        </div>
      </div>

      {/* Yield section (mining only) */}
      {isMining && session && (
        <div style={{
          padding: `${compact ? 6 : 10}px 0`,
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          marginBottom: compact ? 8 : 12,
        }}>
          <div style={{
            fontSize: 10,
            color: token.colorTextTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            marginBottom: 4,
          }}>
            Session Yield
          </div>
          <div
            ref={yieldRef}
            style={{
              fontSize: compact ? 20 : 26,
              fontWeight: fontWeights.bold,
              color: '#52c41a',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          />
          {/* Progress bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{
              height: 4,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{
                  width: `${Math.min(100, ((college.miningSessionHours - session.remainingHours) / college.miningSessionHours) * 100)}%`,
                }}
                transition={{ duration: 1 }}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #52c41a, #73d13d)',
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: 10,
              color: token.colorTextTertiary,
            }}>
              <span>@ {session.earningRate} t/hr</span>
              <span>{session.remainingHours.toFixed(1)}h left</span>
            </div>
          </div>
        </div>
      )}

      {/* Balance section (always visible) */}
      <div style={{ marginBottom: compact ? 8 : 12, flex: 1 }}>
        <div style={{
          fontSize: 10,
          color: token.colorTextTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          marginBottom: 2,
        }}>
          Total Balance
        </div>
        <div
          ref={totalRef}
          style={{
            fontSize: compact ? token.fontSizeLG : 20,
            fontWeight: fontWeights.bold,
            color: token.colorText,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.3,
          }}
        />
        {isMining && session && (
          <div style={{
            fontSize: compact ? 10 : 11,
            color: token.colorTextSecondary,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span ref={breakdownRef} />
          </div>
        )}
      </div>

      {/* Action button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={(e) => {
          e.stopPropagation();
          isMining ? onStopMining() : onStartMining();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          padding: `${compact ? token.paddingXS : token.paddingSM}px 0`,
          borderRadius: token.borderRadius,
          border: 'none',
          cursor: 'pointer',
          fontSize: compact ? token.fontSizeSM : token.fontSize,
          fontWeight: fontWeights.semibold,
          background: isMining
            ? (isDark ? 'rgba(255, 77, 79, 0.15)' : 'rgba(255, 77, 79, 0.08)')
            : (isDark ? 'rgba(82, 196, 26, 0.15)' : 'rgba(82, 196, 26, 0.08)'),
          color: isMining ? '#ff4d4f' : '#52c41a',
        }}
      >
        {isMining ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        {isMining ? 'Stop Mining' : 'Start Mining'}
      </motion.button>
    </motion.div>
  );
};

// Add College list item (shared between Modal and Drawer)
const AddCollegeItem = ({
  college,
  onAdd,
  loading,
  isDark,
  token,
}: {
  college: any;
  onAdd: () => void;
  loading: boolean;
  isDark: boolean;
  token: any;
}) => (
  <motion.div
    whileTap={{ scale: 0.98 }}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: token.marginSM,
      padding: token.paddingSM,
      borderRadius: token.borderRadius,
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    }}
  >
    <div style={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: (college.collegeLogo || college.iconUrl) ? 'transparent' : 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
      color: '#fff',
      fontWeight: fontWeights.bold,
    }}>
      {(college.collegeLogo || college.iconUrl) ? (
        <img
          src={college.collegeLogo || college.iconUrl}
          alt={college.symbol}
          width={40}
          height={40}
          style={{ objectFit: 'cover', borderRadius: '50%' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) {
              parent.style.background = 'linear-gradient(135deg, #8E2DE2, #4A00E0)';
              parent.textContent = college.symbol?.charAt(0) || '?';
            }
          }}
        />
      ) : (
        college.symbol?.charAt(0) || '?'
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
        {college.symbol}
      </div>
      <div style={{
        fontSize: token.fontSizeSM,
        color: token.colorTextSecondary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {college.collegeName || college.name}
      </div>
    </div>
    <div style={{
      fontSize: token.fontSizeSM,
      color: token.colorTextSecondary,
      textAlign: 'right',
      marginRight: token.marginSM,
    }}>
      {college.miningBaseRate} t/h
    </div>
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onAdd}
      disabled={loading}
      style={{
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        borderRadius: token.borderRadius,
        border: 'none',
        background: 'linear-gradient(135deg, #8E2DE2, #4A00E0)',
        color: '#fff',
        fontWeight: fontWeights.semibold,
        fontSize: token.fontSizeSM,
        cursor: 'pointer',
        opacity: loading ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <PlusOutlined /> Add
    </motion.button>
  </motion.div>
);

const CollegeCoinsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { mode } = useThemeMode();
  const { pairs } = useExchange();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [miningStatus, setMiningStatus] = useState<MiningStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [availableColleges, setAvailableColleges] = useState<any[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.sm : true;
  const isSmall = mounted ? screens.sm && !screens.md : false;
  const useCompactFilters = isMobile || isSmall;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/college-coins');
        return;
      }
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  const fetchMiningStatus = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoadingStatus(true);
      const res = await getMiningStatus();
      setMiningStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch mining status:', err);
    } finally {
      if (showLoading) setLoadingStatus(false);
    }
  }, []);

  const fetchAvailableColleges = useCallback(async () => {
    try {
      const tokens = await TokensApi.getAll();
      const colleges = tokens.filter((t: any) => t.isCollegeCoin && t.miningAllowed && t.isActive);
      setAvailableColleges(colleges);
    } catch (err) {
      console.error('Failed to fetch available colleges:', err);
    }
  }, []);

  useEffect(() => {
    if (!pageLoading && user) {
      fetchMiningStatus();
      fetchAvailableColleges();
    }
  }, [pageLoading, user, fetchMiningStatus, fetchAvailableColleges]);

  useMiningSocket({
    onMiningUpdate: () => fetchMiningStatus(),
    onSessionCompleted: (data) => {
      message.success(`Mining session completed! Earned ${data.tokensEarned.toFixed(4)} ${data.symbol}`);
      fetchMiningStatus();
    },
  });

  useEffect(() => {
    if (!pageLoading && user && miningStatus) {
      const interval = setInterval(() => fetchMiningStatus(false), 30000);
      return () => clearInterval(interval);
    }
  }, [pageLoading, user, miningStatus, fetchMiningStatus]);

  const myCollegeIds = useMemo(() => {
    return new Set(miningStatus?.miningColleges.map(c => c.tokenId) || []);
  }, [miningStatus]);

  const activeSessionMap = useMemo(() => {
    const map = new Map<string, any>();
    miningStatus?.activeSessions.forEach(s => {
      if (!s.isExpired) map.set(s.tokenId, s);
    });
    return map;
  }, [miningStatus]);

  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    miningStatus?.balances.forEach(b => map.set(b.tokenId, b.balance));
    return map;
  }, [miningStatus]);

  const filteredColleges = useMemo(() => {
    let colleges = miningStatus?.miningColleges || [];

    if (activeTab === 'mining-active') {
      colleges = colleges.filter(c => activeSessionMap.has(c.tokenId));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      colleges = colleges.filter(c =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.collegeName && c.collegeName.toLowerCase().includes(q))
      );
    }

    return colleges;
  }, [miningStatus, activeTab, searchQuery, activeSessionMap]);

  const addableColleges = useMemo(() => {
    let colleges = availableColleges.filter(c => !myCollegeIds.has(c.id));
    if (addSearch) {
      const q = addSearch.toLowerCase();
      colleges = colleges.filter(c =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.collegeName && c.collegeName.toLowerCase().includes(q))
      );
    }
    return colleges;
  }, [availableColleges, myCollegeIds, addSearch]);

  const handleAddCollege = async (tokenId: string) => {
    try {
      setActionLoading(tokenId);
      await addMiningCollege(tokenId);
      message.success('College added to mining list');
      await fetchMiningStatus();
      setAddModalVisible(false);
    } catch (err: any) {
      message.error(err.message || 'Failed to add college');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveCollege = async (tokenId: string) => {
    try {
      setActionLoading(tokenId);
      await removeMiningCollege(tokenId);
      message.success('College removed from mining list');
      await fetchMiningStatus();
    } catch (err: any) {
      message.error(err.message || 'Failed to remove college');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartMining = async (tokenId: string) => {
    try {
      setActionLoading(tokenId);
      await startMining(tokenId);
      message.success('Mining started');
      await fetchMiningStatus();
    } catch (err: any) {
      message.error(err.message || 'Failed to start mining');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopMining = async (tokenId: string) => {
    try {
      setActionLoading(tokenId);
      const res = await stopMining(tokenId);
      const earned = res.data?.tokensEarned || 0;
      message.success(`Mining stopped. Earned ${earned.toFixed(4)} tokens`);
      await fetchMiningStatus();
    } catch (err: any) {
      message.error(err.message || 'Failed to stop mining');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartAll = async () => {
    try {
      setActionLoading('start-all');
      const res = await startAllMining();
      message.success(res.message);
      await fetchMiningStatus();
    } catch (err: any) {
      message.error(err.message || 'Failed to start all mining');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopAll = async () => {
    try {
      setActionLoading('stop-all');
      const res = await stopAllMining();
      message.success(res.message);
      await fetchMiningStatus();
    } catch (err: any) {
      message.error(err.message || 'Failed to stop all mining');
    } finally {
      setActionLoading(null);
    }
  };

  const closeAddPanel = () => {
    setAddModalVisible(false);
    setAddSearch('');
  };

  if (isLoading || !user) return null;

  if (pageLoading) {
    return (
      <>
        <Head><title>College Coins — Buy, Trade & Spend on Campus | UG Coin</title></Head>
        <Skeleton active paragraph={{ rows: 12 }} />
      </>
    );
  }

  const activeMiningCount = activeSessionMap.size;
  const collegeCount = miningStatus?.miningColleges.length || 0;

  // Shared Add College content
  const addCollegeContent = (
    <>
      <div style={{ flexShrink: 0, padding: isMobile ? `${token.paddingSM}px` : 0, paddingBottom: token.paddingSM }}>
        <Input
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
          placeholder="Search available colleges..."
          value={addSearch}
          onChange={(e) => setAddSearch(e.target.value)}
          style={{ borderRadius: 50 }}
          allowClear
        />
      </div>
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as any,
        overscrollBehavior: 'contain' as any,
        ...(isMobile ? { padding: `0 ${token.paddingSM}px` } : {}),
      }}>
        {addableColleges.length === 0 ? (
          <Empty description={
            availableColleges.length === 0
              ? 'No college coins available for mining'
              : addSearch
              ? 'No colleges match your search'
              : 'You have already added all available colleges'
          } />
        ) : (
          addableColleges.map((college) => (
            <AddCollegeItem
              key={college.id}
              college={college}
              onAdd={() => handleAddCollege(college.id)}
              loading={actionLoading === college.id}
              isDark={isDark}
              token={token}
            />
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      <Head>
        <title>College Coins — Buy, Trade & Spend on Campus | UG Coin</title>
        <meta
          name="description"
          content="Discover, mine, and trade university-issued college coins on UG Coin. Earn TUIT, swap with crypto, and pay for tuition, housing, and campus services in INR."
        />
      </Head>

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: token.marginLG }}
        >
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: token.marginSM,
            marginBottom: token.marginMD,
          }}>
            <div>
              <h1 style={{
                fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading3,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                margin: 0,
              }}>
                College Coins
              </h1>
              <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, marginTop: 4 }}>
                {collegeCount}/10 colleges - {activeMiningCount} mining
              </div>
            </div>

            <div style={{ display: 'flex', gap: token.marginXS, flexWrap: 'wrap' }}>
              {activeMiningCount > 0 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStopAll}
                  disabled={actionLoading === 'stop-all'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                    borderRadius: token.borderRadius,
                    border: `1px solid ${isDark ? 'rgba(255, 77, 79, 0.3)' : 'rgba(255, 77, 79, 0.2)'}`,
                    background: isDark ? 'rgba(255, 77, 79, 0.08)' : 'rgba(255, 77, 79, 0.05)',
                    color: '#ff4d4f',
                    cursor: 'pointer',
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.semibold,
                    opacity: actionLoading === 'stop-all' ? 0.6 : 1,
                  }}
                >
                  <PauseCircleOutlined />
                  Stop All
                </motion.button>
              )}

              {collegeCount > 0 && activeMiningCount < collegeCount && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartAll}
                  disabled={actionLoading === 'start-all'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                    borderRadius: token.borderRadius,
                    border: 'none',
                    background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.semibold,
                    opacity: actionLoading === 'start-all' ? 0.6 : 1,
                  }}
                >
                  <PlayCircleOutlined />
                  Start All
                </motion.button>
              )}

              {collegeCount < 10 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAddModalVisible(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                    borderRadius: token.borderRadius,
                    border: 'none',
                    background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.semibold,
                  }}
                >
                  <PlusOutlined />
                  Add College
                </motion.button>
              )}
            </div>
          </div>

          {/* Search and filters */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: token.marginSM,
            alignItems: 'center',
          }}>
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Search colleges..."
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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginXS, flex: '1 1 auto' }}>
              <FilterPill
                active={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
                gradient="linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)"
                icon={<BankOutlined />}
                compact={useCompactFilters}
              >
                All ({collegeCount})
              </FilterPill>
              <FilterPill
                active={activeTab === 'mining-active'}
                onClick={() => setActiveTab('mining-active')}
                gradient="linear-gradient(135deg, #52c41a 0%, #73d13d 100%)"
                icon={<ThunderboltOutlined />}
                compact={useCompactFilters}
              >
                Mining ({activeMiningCount})
              </FilterPill>
            </div>
          </div>
        </motion.div>

        {/* Results */}
        {loadingStatus ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: token.marginMD,
          }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton.Button key={i} active block style={{ height: 220, borderRadius: token.borderRadiusLG }} />
            ))}
          </div>
        ) : filteredColleges.length === 0 ? (
          <div style={{ padding: token.paddingXL * 2, textAlign: 'center' }}>
            <Empty
              description={
                collegeCount === 0
                  ? "You haven't added any colleges yet. Click 'Add College' to start mining!"
                  : searchQuery
                  ? 'No colleges match your search'
                  : activeTab === 'mining-active'
                  ? 'No active mining sessions'
                  : 'No colleges found'
              }
            />
            {collegeCount === 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAddModalVisible(true)}
                style={{
                  marginTop: token.marginLG,
                  padding: `${token.paddingSM}px ${token.paddingLG}px`,
                  borderRadius: 50,
                  border: 'none',
                  background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                  color: '#fff',
                  fontWeight: fontWeights.semibold,
                  fontSize: token.fontSize,
                  cursor: 'pointer',
                }}
              >
                Add Your First College
              </motion.button>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? 'repeat(auto-fill, minmax(160px, 1fr))'
                : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: token.marginMD,
            }}
          >
            <AnimatePresence mode="popLayout">
              {filteredColleges.map((college) => (
                <CollegeCoinCard
                  key={college.tokenId}
                  college={college}
                  session={activeSessionMap.get(college.tokenId)}
                  balance={balanceMap.get(college.tokenId) || 0}
                  isMining={activeSessionMap.has(college.tokenId)}
                  onCardClick={() => router.push(`/college-coins/${college.symbol}`)}
                  onStartMining={() => handleStartMining(college.tokenId)}
                  onStopMining={() => handleStopMining(college.tokenId)}
                  onRemove={() => handleRemoveCollege(college.tokenId)}
                  compact={isMobile}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add College -- Drawer on mobile, Modal on desktop */}
      {isMobile ? (
        <Drawer
          title="Add College"
          placement="bottom"
          height="70vh"
          open={addModalVisible}
          onClose={closeAddPanel}
          zIndex={1100}
          styles={{
            wrapper: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
            header: { borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` },
            body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
          }}
        >
          {addCollegeContent}
        </Drawer>
      ) : (
        <Modal
          open={addModalVisible}
          onCancel={closeAddPanel}
          footer={null}
          title="Add College to Mining List"
          width={600}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {addCollegeContent}
          </div>
        </Modal>
      )}
    </>
  );
};

CollegeCoinsPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default CollegeCoinsPage;
