'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { theme, Spin, Empty } from 'antd';
import { useThemeMode } from '@/context/ThemeContext';
import { fontWeights } from '@/theme/themeConfig';
import { getPortfolioHistory, PortfolioSnapshot } from '@/services/api/learner';
import { getInvestorPortfolioHistory } from '@/services/api/assets';

const { useToken } = theme;

interface PortfolioGrowthChartProps {
  mode: 'learner' | 'investor';
  height?: number;
  hideHeader?: boolean;
  currentBalance?: number;
}

type TimeRange = '1D' | '1W' | '1M' | '6M' | '1Y';

const TIMEFRAMES: TimeRange[] = ['1D', '1W', '1M', '6M', '1Y'];

interface ChartDataPoint {
  date: string;
  timestamp: number;
  current: number;
  invested: number;
}

const PortfolioGrowthChart: React.FC<PortfolioGrowthChartProps> = ({
  mode,
  height = 300,
  hideHeader = false,
  currentBalance,
}) => {
  const { token } = useToken();
  const { mode: themeMode } = useThemeMode();
  const isDark = themeMode === 'dark';
  const isLearner = mode === 'learner';

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [data, setData] = useState<PortfolioSnapshot[]>([]);

  // Color schemes based on mode - contrasting colors
  const colors = isLearner
    ? {
        current: '#10B981', // Green for current (learner)
        currentGradient: 'rgba(16, 185, 129, 0.3)',
        invested: '#F59E0B', // Amber for invested
        investedGradient: 'rgba(245, 158, 11, 0.15)',
      }
    : {
        current: '#6366F1', // Indigo for current (investor)
        currentGradient: 'rgba(99, 102, 241, 0.3)',
        invested: '#F59E0B', // Amber for invested
        investedGradient: 'rgba(245, 158, 11, 0.15)',
      };

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

  // Transform data for Recharts
  const chartData: ChartDataPoint[] = React.useMemo(() => {
    // If we have no data AND no current balance, return empty
    if ((!data || data.length === 0) && typeof currentBalance === 'undefined') return [];
    
    const points = (data || []).map(d => ({
      date: new Date(d.snapshotDate).toLocaleDateString('en-UG', {
        month: 'short',
        day: 'numeric',
      }),
      timestamp: new Date(d.snapshotDate).getTime(),
      current: d.totalValue,
      invested: d.investedValue,
    }));

    // Add "Live" data point if we have a current balance
    if (typeof currentBalance !== 'undefined') {
      const lastInvested = points.length > 0 ? points[points.length - 1].invested : currentBalance; // Fallback to current if no history
      
      points.push({
        date: 'Live',
        timestamp: Date.now(),
        current: currentBalance,
        invested: lastInvested,
      });
    }

    return points.sort((a, b) => a.timestamp - b.timestamp);
  }, [data, currentBalance]);

  // Calculate performance metrics
  const performanceData = React.useMemo(() => {
    if (!data || data.length < 1) {
      return { currentValue: 0, investedValue: 0, change: 0, changePercent: 0 };
    }
    
    const latest = data[data.length - 1];
    const first = data[0];
    const change = latest.totalValue - first.totalValue;
    const changePercent = first.totalValue > 0 ? (change / first.totalValue) * 100 : 0;
    
    return {
      currentValue: latest.totalValue,
      investedValue: latest.investedValue,
      change,
      changePercent,
    };
  }, [data]);

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
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <p style={{ margin: 0, marginBottom: 8, fontWeight: 600, color: token.colorText }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              style={{
                margin: 0,
                marginBottom: 4,
                color: entry.color,
                fontSize: 13,
              }}
            >
              {entry.name}: ${entry.value.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height }}>
      {/* Header with metrics - optional */}
      {!hideHeader && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          padding: `${token.paddingSM}px 0`,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ 
              fontSize: token.fontSizeSM, 
              color: token.colorTextSecondary,
              marginBottom: 2,
            }}>
              Portfolio Value
            </div>
            <div style={{ 
              fontSize: token.fontSizeHeading4, 
              fontWeight: fontWeights.bold, 
              color: token.colorText,
            }}>
              ${performanceData.currentValue.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ 
              fontSize: token.fontSize, 
              fontWeight: fontWeights.medium,
              color: isPositive ? token.colorSuccess : token.colorError,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>{isPositive ? '+' : ''}{performanceData.change.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span>({isPositive ? '+' : ''}{performanceData.changePercent.toFixed(2)}%)</span>
            </div>
          </div>
          
          {/* Legend */}
          <div style={{ display: 'flex', gap: token.marginMD, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
              <div style={{ width: 16, height: 3, backgroundColor: colors.current, borderRadius: 2 }} />
              <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, fontWeight: fontWeights.medium }}>Current</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
              <div style={{ width: 16, height: 3, backgroundColor: colors.invested, borderRadius: 2, opacity: 0.8 }} />
              <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, fontWeight: fontWeights.medium }}>Invested</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Timeframe selector */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        padding: `${token.paddingXS}px 0`, 
        gap: token.marginXS, 
        flexShrink: 0,
      }}>
        {TIMEFRAMES.map((tf) => (
          <div
            key={tf}
            onClick={() => setTimeRange(tf)}
            style={{
              padding: `4px ${token.paddingXS}px`,
              fontSize: 12,
              fontWeight: timeRange === tf ? 600 : 400,
              color: timeRange === tf ? colors.current : token.colorTextTertiary,
              cursor: 'pointer',
              borderRadius: 4,
              backgroundColor: timeRange === tf ? `${colors.current}15` : 'transparent',
              transition: 'all 0.2s ease',
            }}
          >
            {tf}
          </div>
        ))}
      </div>

      {/* Chart container */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
          }}>
            <Spin size="small" />
          </div>
        )}
        {!loading && chartData.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Empty 
              image={Empty.PRESENTED_IMAGE_SIMPLE} 
              description={
                <span style={{ color: token.colorTextSecondary }}>
                  No portfolio history yet.
                  <br />
                  Start trading to see your growth!
                </span>
              }
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.current} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={colors.current} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.invested} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={colors.invested} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} 
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: token.colorTextTertiary }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: token.colorTextTertiary }}
                tickFormatter={(value) => `UGX ${(value / 1000).toFixed(1)}k`}
                dx={-5}
                width={50}
                domain={['dataMin', 'dataMax']}
                allowDataOverflow
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="invested"
                name="Invested"
                stroke={colors.invested}
                strokeWidth={2}
                fill="url(#investedGradient)"
                strokeDasharray="5 5"
              />
              <Area
                type="monotone"
                dataKey="current"
                name="Current"
                stroke={colors.current}
                strokeWidth={2}
                fill="url(#currentGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default PortfolioGrowthChart;
