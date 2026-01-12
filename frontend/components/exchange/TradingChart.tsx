'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ColorType, AreaSeries } from 'lightweight-charts';
import { theme, Spin } from 'antd';
import { useThemeMode } from '@/context/ThemeContext';

const { useToken } = theme;

interface CoinbaseCandle {
  start: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface TradingChartProps {
  candles: CoinbaseCandle[];
  isLoading: boolean;
  granularity: string;
  onGranularityChange: (gran: string) => void;
}

const TIMEFRAMES = ['1M', '5M', '15M', '1H', '4H', '1D'];

const TradingChart: React.FC<TradingChartProps> = ({
  candles,
  isLoading,
  granularity,
  onGranularityChange,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: token.colorPrimary, width: 1, style: 2, labelBackgroundColor: token.colorPrimary },
        horzLine: { color: token.colorPrimary, width: 1, style: 2, labelBackgroundColor: token.colorPrimary },
      },
      rightPriceScale: { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8, // Fixed bar spacing - candles won't stretch
        rightOffset: 5, // Some padding on the right
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Add area series with gradient fill
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#667eea',
      topColor: 'rgba(102, 126, 234, 0.4)',
      bottomColor: 'rgba(102, 126, 234, 0.02)',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: '#667eea',
      crosshairMarkerBackgroundColor: '#ffffff',
      priceFormat: {
        type: 'custom',
        minMove: 0.00000001,
        formatter: (price: number) => {
          if (price < 0.001) return price.toFixed(8);
          if (price < 1) return price.toFixed(6);
          return price.toFixed(2);
        },
      },
    });

    // Transform and set data (area uses close price)
    if (candles && candles.length > 0) {
      const chartData = candles
        .map(c => ({
          time: parseInt(c.start) as any,
          value: parseFloat(c.close),
        }))
        .sort((a, b) => a.time - b.time);

      areaSeries.setData(chartData);
      // Scroll to show most recent data (right side)
      chart.timeScale().scrollToRealTime();
    }

    // Handle resize using ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          chart.applyOptions({ width });
        }
      }
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [isDark, token, candles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Interval selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: `${token.paddingXS}px 0`, gap: token.marginXS, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: token.colorTextTertiary, marginRight: token.marginXS }}>Interval</span>
        {TIMEFRAMES.map((tf) => (
          <div
            key={tf}
            onClick={() => onGranularityChange(tf)}
            style={{
              padding: `2px ${token.paddingXS}px`,
              fontSize: 11,
              fontWeight: granularity === tf ? 600 : 400,
              color: granularity === tf ? token.colorPrimary : token.colorTextTertiary,
              cursor: 'pointer',
              borderRadius: 4,
              backgroundColor: granularity === tf ? `${token.colorPrimary}10` : 'transparent',
            }}
          >
            {tf}
          </div>
        ))}
      </div>
      
      {/* Chart container */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {isLoading && (
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
        <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default TradingChart;
