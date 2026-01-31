'use client';

import React, { useState, useEffect } from 'react';
import { theme, Grid } from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';

const { useToken } = theme;
const { useBreakpoint } = Grid;

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  color?: string;
  gradient?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onDepositClick?: () => void;
  showDepositButton?: boolean;
  onSyncClick?: () => void;
  showSyncButton?: boolean;
  syncLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  gradient,
  trend,
  onDepositClick,
  showDepositButton = false,
  onSyncClick,
  showSyncButton = false,
  syncLoading = false,
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const bgColor = color || token.colorPrimary;
  const isDark = mode === 'dark';

  // Wait for client-side mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Responsive font size calculations
  const isMobile = mounted ? !screens.md : false;
  const isMdOnly = mounted ? (screens.md && !screens.lg) : false;  // 768px - 991px
  const isLgOnly = mounted ? (screens.lg && !screens.xl) : false;  // 992px - 1199px
  
  // Font size adjustments - more aggressive reduction for md sizes (768-991px)
  const titleFontSize = isMobile 
    ? token.fontSizeSM * 0.9   // 10.8px (from 12px)
    : isMdOnly 
    ? token.fontSizeSM * 0.9   // 10.8px - same as mobile
    : isLgOnly
    ? token.fontSizeSM * 0.95  // 11.4px
    : token.fontSizeSM;        // 12px

  const valueFontSize = isMobile
    ? token.fontSizeHeading1 * 0.75  // 36px (from 48px)
    : isMdOnly
    ? token.fontSizeHeading1 * 0.6   // 28.8px - significantly smaller for md
    : isLgOnly
    ? token.fontSizeHeading1 * 0.75  // 36px
    : token.fontSizeHeading1;        // 48px

  const subtitleFontSize = isMobile
    ? token.fontSize * 0.9   // 12.6px (from 14px)
    : isMdOnly
    ? token.fontSize * 0.85  // 11.9px - smaller for md
    : isLgOnly
    ? token.fontSize * 0.95  // 13.3px
    : token.fontSize;        // 14px

  const iconFontSize = isMobile
    ? token.fontSizeHeading3 * 0.85  // 20.4px (from 24px)
    : isMdOnly
    ? token.fontSizeHeading3 * 0.8   // 19.2px - smaller for md
    : isLgOnly
    ? token.fontSizeHeading3 * 0.9   // 21.6px
    : token.fontSizeHeading3;        // 24px
  
  // Gradient definitions for light/dark mode
  // Light mode: vibrant purple-pink gradient
  // Dark mode: sophisticated dark design with subtle depth and accent glow
  const lightModeGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)';
  // Dark mode: deep charcoal with subtle indigo undertones - rich but easy on eyes
  const darkModeGradient = 'linear-gradient(135deg, #1e1b2e 0%, #2d2640 40%, #352f4a 100%)';
  
  // Dark mode color-based gradients - sophisticated dark backgrounds with subtle color accents
  const getDarkModeColorGradient = (baseColor: string) => {
    // Map common colors to dark mode variants
    // Success (green) -> dark teal undertones
    if (baseColor.includes('52c41a') || baseColor === token.colorSuccess) {
      return 'linear-gradient(135deg, #1a2e1e 0%, #1e3a24 40%, #234a2a 100%)';
    }
    // Warning (yellow/orange) -> dark amber undertones
    if (baseColor.includes('faad14') || baseColor === token.colorWarning) {
      return 'linear-gradient(135deg, #2e2a1a 0%, #3a3520 40%, #4a4226 100%)';
    }
    // Error (red) -> dark crimson undertones
    if (baseColor.includes('ff4d4f') || baseColor === token.colorError) {
      return 'linear-gradient(135deg, #2e1a1a 0%, #3a1e1e 40%, #4a2424 100%)';
    }
    // Primary (blue/indigo) -> dark indigo undertones
    if (baseColor.includes('1677ff') || baseColor === token.colorPrimary) {
      return 'linear-gradient(135deg, #1a1e2e 0%, #1e243a 40%, #242c4a 100%)';
    }
    // Default dark gradient
    return darkModeGradient;
  };
  
  // Determine the card gradient
  const getCardGradient = () => {
    if (gradient) {
      // If the standard light gradient is passed, convert to dark mode version
      if (isDark && gradient.includes('#667eea') && gradient.includes('#764ba2')) {
        return darkModeGradient;
      }
      return gradient;
    }
    if (color) {
      if (isDark) {
        return getDarkModeColorGradient(bgColor);
      }
      return `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 100%)`;
    }
    // Default gradient based on theme
    return isDark ? darkModeGradient : lightModeGradient;
  };
  
  const cardGradient = getCardGradient();

  // Get accent color for dark mode based on the card's color
  const getDarkModeAccentColor = () => {
    if (color) {
      if (bgColor.includes('52c41a') || bgColor === token.colorSuccess) {
        return { primary: 'rgba(74, 222, 128, 0.15)', secondary: 'rgba(34, 197, 94, 0.12)', border: 'rgba(74, 222, 128, 0.15)' };
      }
      if (bgColor.includes('faad14') || bgColor === token.colorWarning) {
        return { primary: 'rgba(251, 191, 36, 0.15)', secondary: 'rgba(245, 158, 11, 0.12)', border: 'rgba(251, 191, 36, 0.15)' };
      }
      if (bgColor.includes('ff4d4f') || bgColor === token.colorError) {
        return { primary: 'rgba(248, 113, 113, 0.15)', secondary: 'rgba(239, 68, 68, 0.12)', border: 'rgba(248, 113, 113, 0.15)' };
      }
      if (bgColor.includes('1677ff') || bgColor === token.colorPrimary) {
        return { primary: 'rgba(96, 165, 250, 0.15)', secondary: 'rgba(59, 130, 246, 0.12)', border: 'rgba(96, 165, 250, 0.15)' };
      }
    }
    // Default purple accent
    return { primary: 'rgba(139, 92, 246, 0.15)', secondary: 'rgba(99, 102, 241, 0.12)', border: 'rgba(139, 92, 246, 0.15)' };
  };

  const darkAccent = getDarkModeAccentColor();

  const cardStyle: React.CSSProperties = {
    background: cardGradient,
    borderRadius: token.borderRadiusLG,
    padding: token.paddingXL,
    color: token.colorWhite,
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginMD,
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    minHeight: '160px',
    flex: 1,
    boxShadow: isDark 
      ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : `0 8px 24px ${bgColor}40`,
    border: isDark ? `1px solid ${darkAccent.border}` : 'none',
  };

  // Decorative background elements - subtle glow for dark mode
  const decorativeCircle1: React.CSSProperties = {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: isDark 
      ? `radial-gradient(circle, ${darkAccent.primary} 0%, transparent 70%)`
      : 'rgba(255, 255, 255, 0.1)',
    filter: isDark ? 'blur(30px)' : 'blur(20px)',
  };

  const decorativeCircle2: React.CSSProperties = {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: '50%',
    background: isDark 
      ? `radial-gradient(circle, ${darkAccent.secondary} 0%, transparent 70%)`
      : 'rgba(255, 255, 255, 0.08)',
    filter: isDark ? 'blur(25px)' : 'blur(15px)',
  };

  // Get icon background for dark mode based on card color
  const getDarkIconBackground = () => {
    if (color) {
      if (bgColor.includes('52c41a') || bgColor === token.colorSuccess) {
        return 'rgba(74, 222, 128, 0.2)';
      }
      if (bgColor.includes('faad14') || bgColor === token.colorWarning) {
        return 'rgba(251, 191, 36, 0.2)';
      }
      if (bgColor.includes('ff4d4f') || bgColor === token.colorError) {
        return 'rgba(248, 113, 113, 0.2)';
      }
      if (bgColor.includes('1677ff') || bgColor === token.colorPrimary) {
        return 'rgba(96, 165, 250, 0.2)';
      }
    }
    return 'rgba(139, 92, 246, 0.2)';
  };

  const iconContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: token.paddingLG,
    right: token.paddingLG,
    width: isMobile ? 56 : isMdOnly ? 48 : isLgOnly ? 56 : 64,
    height: isMobile ? 56 : isMdOnly ? 48 : isLgOnly ? 56 : 64,
    borderRadius: token.borderRadiusLG,
    background: isDark 
      ? getDarkIconBackground()
      : 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: iconFontSize,
    opacity: 0.9,
    boxShadow: isDark 
      ? '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
      : '0 4px 12px rgba(0, 0, 0, 0.1)',
    border: isDark ? `1px solid ${darkAccent.border.replace('0.15', '0.1')}` : 'none',
  };

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginXS,
    flex: 1,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: titleFontSize,
    fontWeight: fontWeights.medium,
    opacity: 0.95,
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: valueFontSize,
    fontWeight: fontWeights.bold,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: subtitleFontSize,
    opacity: 0.9,
    lineHeight: 1.4,
    marginTop: token.marginXXS,
  };

  const trendStyle: React.CSSProperties = {
    fontSize: token.fontSize,
    fontWeight: fontWeights.semibold,
    display: 'flex',
    alignItems: 'center',
    gap: token.marginXS,
    marginTop: token.marginXS,
    opacity: 0.95,
  };

  const depositButtonStyle: React.CSSProperties = {
    marginTop: token.marginSM,
    padding: `${token.paddingSM}px ${token.paddingMD}px`,
    borderRadius: token.borderRadiusLG,
    background: 'rgba(255, 255, 255, 0.25)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: token.colorWhite,
    fontSize: token.fontSizeSM,
    fontWeight: fontWeights.semibold,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: token.marginXS,
    transition: 'all 0.2s ease',
    width: 'fit-content',
  };

  // Mobile: Clean, matches app design language
  if (isMobile) {
    return (
      <div style={{
        background: token.colorBgContainer,
        borderRadius: token.borderRadius,
        padding: token.paddingMD,
        width: '100%',
      }}>
        {/* Top row: Icon badge + Title + Action */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginSM,
          marginBottom: token.marginSM,
        }}>
          {/* Small accent icon */}
          {icon && (
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}>
              {icon}
            </div>
          )}
          <span style={{
            fontSize: token.fontSizeSM,
            color: token.colorTextSecondary,
            fontWeight: fontWeights.medium,
            flex: 1,
          }}>
            {title}
          </span>
          {showDepositButton && onDepositClick && (
            <button
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
            </button>
          )}
          {showSyncButton && onSyncClick && (
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
              {syncLoading ? 'Syncing...' : 'Update'}
            </button>
          )}
        </div>

        {/* Value */}
        <div style={{
          fontSize: 32,
          fontWeight: fontWeights.bold,
          color: token.colorText,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}>
          {value}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{
            fontSize: token.fontSizeSM,
            color: token.colorTextTertiary,
            marginTop: token.marginXS,
          }}>
            {subtitle}
          </div>
        )}

        {trend && (
          <div style={{
            fontSize: token.fontSizeSM,
            color: trend.isPositive ? token.colorSuccess : token.colorError,
            marginTop: token.marginXS,
            fontWeight: fontWeights.medium,
          }}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
      </div>
    );
  }

  // Desktop: Original layout
  return (
    <div style={cardStyle}>
      {/* Decorative background circles */}
      <div style={decorativeCircle1} />
      <div style={decorativeCircle2} />
      
      {/* Icon */}
      {icon && (
        <div style={iconContainerStyle}>
          {icon}
        </div>
      )}
      
      {/* Content */}
      <div style={contentStyle}>
        <div style={titleStyle}>{title}</div>
        <div style={valueStyle}>{value}</div>
        {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
        {trend && (
          <div style={trendStyle}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
            <span style={{ opacity: 0.8, fontSize: token.fontSizeSM }}>vs last week</span>
          </div>
        )}
        {showDepositButton && onDepositClick && (
          <button
            onClick={onDepositClick}
            style={depositButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <PlusOutlined />
            <span>Deposit Cash</span>
          </button>
        )}
        {showSyncButton && onSyncClick && (
          <button
            onClick={onSyncClick}
            disabled={syncLoading}
            style={{
              ...depositButtonStyle,
              opacity: syncLoading ? 0.6 : 1,
              cursor: syncLoading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!syncLoading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <SyncOutlined spin={syncLoading} />
            <span>{syncLoading ? 'Syncing...' : 'Update Balance'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default StatCard;
