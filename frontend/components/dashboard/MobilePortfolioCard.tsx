'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { theme, Spin } from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { useThemeMode } from '@/context/ThemeContext';
import { fontWeights } from '@/theme/themeConfig';
import { getPortfolioHistory, PortfolioSnapshot } from '@/services/api/learner';
import { getInvestorPortfolioHistory } from '@/services/api/assets';

const { useToken } = theme;

interface MobilePortfolioCardProps {
  totalBalance: number;
  cryptoBalance: number;
  cashBalance: number;
  mode: 'learner' | 'investor';
  onDepositClick?: () => void;
  onSyncClick?: () => void;
  syncLoading?: boolean;
}

type TimeRange = '1D' | '1W' | '1M' | '6M' | '1Y';

const TIMEFRAMES: TimeRange[] = ['1D', '1W', '1M', '6M', '1Y'];

interface ChartDataPoint {
  date: string;
  timestamp: number;
  current: number;
  invested: number;
}

const MobilePortfolioCard: React.FC<MobilePortfolioCardProps> = ({
  totalBalance,
  cryptoBalance,
  cashBalance,
  mode,
  onDepositClick,
  onSyncClick,
  syncLoading = false,
}) => {
  const { token } = useToken();
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const isLearner = mode === 'learner';

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [data, setData] = useState<PortfolioSnapshot[]>([]);

  // Color scheme based on mode - contrasting colors
  const currentColor = isLearner ? '#10B981' : '#6366F1';  // Green for learner, Indigo for investor
  const investedColor = isLearner ? '#F59E0B' : '#F59E0B'; // Amber for invested (both modes)

  // Fetch portfolio history based on mode
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (isLearner) {
        const result = await getPortfolioHistory(timeRange);
        setData(result.history);
      } else {
        const result = await getInvestorPortfolioHistory(timeRange);
        setData(result.history);
      }
    } catch (error) {
      console.error('Failed to fetch portfolio history:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange, isLearner]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Transform data for chart
  const chartData: ChartDataPoint[] = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data
      .map(d => ({
        date: new Date(d.snapshotDate).toLocaleDateString('en-UG', {
          month: 'short',
          day: 'numeric',
        }),
        timestamp: new Date(d.snapshotDate).getTime(),
        current: d.totalValue,
        invested: d.investedValue,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  // Calculate change - compare current balance against first snapshot in range
  const performanceData = React.useMemo(() => {
    if (!data || data.length < 1) {
      return { change: 0, changePercent: 0 };
    }
    
    const first = data[0];
    const change = totalBalance - first.totalValue;
    const changePercent = first.totalValue > 0 ? (change / first.totalValue) * 100 : 0;
    
    return { change, changePercent };
  }, [data, totalBalance]);

  const isPositive = performanceData.change >= 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: isDark ? '#1f1f1f' : '#fff',
            border: `1px solid ${isDark ? '#333' : '#e5e5e5'}`,
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <p style={{ margin: 0, marginBottom: 4, fontWeight: 600, color: token.colorText, fontSize: 12 }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              style={{
                margin: 0,
                color: entry.color,
                fontSize: 11,
              }}
            >
              {entry.name}: UGX {entry.value.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      background: token.colorBgContainer,
      borderRadius: token.borderRadius,
      overflow: 'hidden',
      width: '100%',
    }}>
      {/* Top section: Value + Action */}
      <div style={{ padding: token.paddingMD }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: token.marginXS,
        }}>
          <div>
            <div style={{
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
              marginBottom: 2,
            }}>
              Total Balance
            </div>
            <div style={{
              fontSize: 32,
              fontWeight: fontWeights.bold,
              color: token.colorText,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              UGX {totalBalance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            {onSyncClick && (
              <button
                onClick={onSyncClick}
                disabled={syncLoading}
                style={{
                  background: token.colorWarningBg,
                  border: 'none',
                  borderRadius: token.borderRadius,
                  padding: `${token.paddingXS}px ${token.paddingSM}px`,
                  color: token.colorWarning,
                  fontSize: token.fontSizeSM,
                  fontWeight: fontWeights.semibold,
                  cursor: syncLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  opacity: syncLoading ? 0.6 : 1,
                }}
              >
                <SyncOutlined spin={syncLoading} style={{ fontSize: 11 }} />
                {syncLoading ? 'Syncing' : 'Update'}
              </button>
            )}
            {onDepositClick && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={onDepositClick}
                style={{
                  background: token.colorPrimaryBg,
                  border: 'none',
                  borderRadius: token.borderRadius,
                  padding: `${token.paddingXS}px ${token.paddingSM}px`,
                  color: token.colorPrimary,
                  fontSize: token.fontSizeSM,
                  fontWeight: fontWeights.semibold,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <PlusOutlined style={{ fontSize: 11 }} />
                Add Cash
              </motion.button>
            )}
          </div>
        </div>

        {/* Change indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginSM,
          marginBottom: token.marginSM,
        }}>
          <span style={{
            fontSize: token.fontSizeSM,
            fontWeight: fontWeights.medium,
            color: isPositive ? token.colorSuccess : token.colorError,
          }}>
            {isPositive ? '+' : ''}{performanceData.change.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}
            ({isPositive ? '+' : ''}{performanceData.changePercent.toFixed(2)}%)
          </span>
          <span style={{
            fontSize: 11,
            color: token.colorTextTertiary,
          }}>
            {timeRange === '1D' ? 'Today' : timeRange === '1W' ? 'This week' : timeRange === '1M' ? 'This month' : timeRange === '6M' ? '6 months' : 'This year'}
          </span>
        </div>

        {/* Balance breakdown - inline text */}
        <div style={{
          display: 'flex',
          gap: token.marginMD,
          fontSize: token.fontSizeSM,
          color: token.colorTextSecondary,
        }}>
          <span>
            Crypto: <span style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
              UGX {cryptoBalance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          <span>
            Cash: <span style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
              UGX {cashBalance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      </div>

      {/* Chart section */}
      <div style={{ 
        height: 140, 
        position: 'relative',
        marginTop: token.marginXS,
        padding: `0 ${token.paddingMD}px`,
      }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}>
            <Spin size="small" />
          </div>
        )}
        {!loading && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="mobileCurrentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={currentColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: token.colorTextTertiary }}
                dy={5}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={['dataMin', 'dataMax']} allowDataOverflow />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="invested"
                name="Invested"
                stroke={investedColor}
                strokeWidth={1.5}
                fill="none"
                strokeDasharray="4 4"
                opacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="current"
                name="Current"
                stroke={currentColor}
                strokeWidth={2}
                fill="url(#mobileCurrentGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!loading && chartData.length === 0 && (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: token.colorTextTertiary,
            fontSize: token.fontSizeSM,
          }}>
            Start trading to see chart
          </div>
        )}
      </div>

      {/* Footer: Timeframe + Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}>
        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TIMEFRAMES.map((tf) => (
            <div
              key={tf}
              onClick={() => setTimeRange(tf)}
              style={{
                padding: `4px 8px`,
                fontSize: 11,
                fontWeight: timeRange === tf ? fontWeights.semibold : fontWeights.medium,
                color: timeRange === tf ? currentColor : token.colorTextTertiary,
                cursor: 'pointer',
                borderRadius: 4,
                backgroundColor: timeRange === tf ? `${currentColor}15` : 'transparent',
              }}
            >
              {tf}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: token.marginMD, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 3, backgroundColor: currentColor, borderRadius: 2 }} />
            <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, fontWeight: fontWeights.medium }}>Current</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 3, backgroundColor: investedColor, borderRadius: 2, opacity: 0.8 }} />
            <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, fontWeight: fontWeights.medium }}>Invested</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobilePortfolioCard;

