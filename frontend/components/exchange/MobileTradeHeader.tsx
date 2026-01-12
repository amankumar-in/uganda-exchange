'use client';

import React from 'react';
import { useRouter } from 'next/router';
import { theme } from 'antd';
import { LeftOutlined, CaretUpOutlined, CaretDownOutlined, DownOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import PriceFormatter from './PriceFormatter';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';

const { useToken } = theme;

interface MobileTradeHeaderProps {
  pair: string;
  price: number;
  priceChange: number;
  iconUrl?: string;
  onPairClick: () => void;
}

const MobileTradeHeader: React.FC<MobileTradeHeaderProps> = ({
  pair,
  price,
  priceChange,
  iconUrl,
  onPairClick,
}) => {
  const router = useRouter();
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [baseAsset] = pair.split('-');
  const isPositive = priceChange >= 0;

  const handleBack = () => {
    router.push('/overview');
  };

  return (
    <div
      style={{
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        background: isDark 
          ? 'rgba(15, 15, 26, 0.95)'
          : 'rgba(255, 255, 255, 0.98)',
      }}
    >
      {/* Pair Selector - Prominent like buy/sell, with price/change in same row */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={onPairClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginSM,
          padding: `${token.paddingSM}px ${token.paddingSM}px`,
          cursor: 'pointer',
          borderRadius: token.borderRadius,
          // Light mode: rich purple gradient background with white text
          // Dark mode: keep claymorphic style
          background: isDark
            ? `linear-gradient(145deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)`
            : `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
          boxShadow: isDark
            ? `
              4px 4px 12px rgba(0,0,0,0.4),
              -2px -2px 8px rgba(139, 92, 246, 0.15),
              inset 2px 2px 4px rgba(255,255,255,0.05),
              inset -2px -2px 4px rgba(0,0,0,0.2)
            `
            : `0 4px 16px rgba(102, 126, 234, 0.4)`,
          border: isDark 
            ? '1px solid rgba(139, 92, 246, 0.2)' 
            : 'none',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isDark) {
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDark) {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
          }
        }}
      >
        <img
          src={iconUrl || `https://assets.coincap.io/assets/icons/${baseAsset.toLowerCase()}@2x.png`}
          alt={baseAsset}
          width={40}
          height={40}
          style={{ 
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            border: `2px solid ${isDark ? 'transparent' : 'rgba(255, 255, 255, 0.4)'}`,
            flexShrink: 0,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseAsset}&background=667eea&color=fff&size=72`;
          }}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ 
            fontWeight: fontWeights.bold, 
            color: isDark ? token.colorText : '#ffffff', 
            fontSize: token.fontSizeLG 
          }}>
            {pair}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
            <span style={{ 
              fontSize: token.fontSize, 
              color: isDark ? token.colorTextTertiary : 'rgba(255, 255, 255, 0.9)', 
              fontWeight: fontWeights.medium,
            }}>
              <PriceFormatter 
                price={price} 
                style={{ 
                  fontSize: token.fontSize, 
                  color: isDark ? token.colorTextTertiary : 'rgba(255, 255, 255, 0.9)', 
                  fontWeight: fontWeights.medium,
                }} 
              />
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: isPositive 
                  ? (isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.2)')
                  : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.2)'),
                color: isPositive ? (isDark ? '#22C55E' : '#22C55E') : (isDark ? '#EF4444' : '#EF4444'),
                fontSize: token.fontSizeSM,
                fontWeight: fontWeights.bold,
              }}
            >
              {isPositive ? <CaretUpOutlined style={{ fontSize: 8 }} /> : <CaretDownOutlined style={{ fontSize: 8 }} />}
              {Math.abs(priceChange).toFixed(2)}%
            </div>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ 
            fontSize: token.fontSize, 
            color: isDark ? '#8B5CF6' : '#ffffff',
            fontWeight: fontWeights.bold,
          }}>
            Select
          </span>
          <DownOutlined style={{ 
            color: isDark ? '#8B5CF6' : '#ffffff', 
            fontSize: 18,
          }} />
        </div>
      </motion.div>
    </div>
  );
};

export default MobileTradeHeader;

