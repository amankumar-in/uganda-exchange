'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { theme, Grid } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';

const { useToken } = theme;
const { useBreakpoint } = Grid;

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps?: number;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

// Professional indigo/purple theme colors (dark mode)
const themeColors = {
  primary: '#6366F1',
  light: '#A5B4FC',
  dark: '#4338CA',
  accent: '#818CF8',
};

// Warm palette for light mode
const warmColors = {
  sand: '#D4C4A8',
  coral: '#E07A5F',
  terracotta: '#B85C38',
  warmBrown: '#5D4037',
};

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  currentStep,
  totalSteps = 6, // 0..6 → 7 screens total (intro, pan, aadhaar#, otp, address, selfie, status)
  title,
  subtitle,
  showBack = false,
  onBack,
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;

  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  // Container with layered background
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: isDark
      ? `linear-gradient(160deg, #0f0a1e 0%, #1a1033 30%, #0f0a1e 60%, #1a0a2e 100%)`
      : `linear-gradient(145deg, #3D2B1F 0%, #4A3728 35%, #5D4037 65%, #4E342E 100%)`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  // Decorative background elements for light mode (soft warm glows)
  const renderBackgroundDecor = () => {
    if (isDark || isMobile) return null;
    
    return (
      <>
        {/* Soft coral glow - top right */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '45%',
          height: '50%',
          background: `radial-gradient(ellipse at center, ${warmColors.coral}25 0%, transparent 70%)`,
          pointerEvents: 'none',
          filter: 'blur(60px)',
        }} />
        
        {/* Soft sand glow - bottom left */}
        <div style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '50%',
          height: '55%',
          background: `radial-gradient(ellipse at center, ${warmColors.sand}20 0%, transparent 70%)`,
          pointerEvents: 'none',
          filter: 'blur(80px)',
        }} />
        
        {/* Subtle terracotta accent - center right */}
        <div style={{
          position: 'absolute',
          top: '40%',
          right: '5%',
          width: '25%',
          height: '30%',
          background: `radial-gradient(ellipse at center, ${warmColors.terracotta}15 0%, transparent 70%)`,
          pointerEvents: 'none',
          filter: 'blur(50px)',
        }} />
      </>
    );
  };

  // Header
  const headerStyle: React.CSSProperties = {
    padding: `${token.paddingMD}px ${token.paddingLG}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid rgba(255,255,255,0.1)`,
    width: '100%',
    maxWidth: 520,
  };

  // Main content
  const mainStyle: React.CSSProperties = {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    display: 'flex',
    flexDirection: 'column',
    padding: isMobile ? `${token.paddingMD}px` : `${token.paddingLG}px`,
    paddingBottom: isMobile ? token.paddingXL * 2 : token.paddingXL,
  };

  // Title area - compact inline style
  const titleContainerStyle: React.CSSProperties = {
    marginBottom: isMobile ? token.marginSM : token.marginMD,
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: token.marginSM,
    flexWrap: 'wrap',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: isMobile ? 18 : 22,
    fontWeight: fontWeights.bold,
    color: '#ffffff',
    margin: 0,
    textShadow: '0 1px 3px rgba(0,0,0,0.3)',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: isMobile ? token.fontSizeSM : token.fontSize,
    color: 'rgba(255,255,255,0.7)',
    margin: 0,
  };

  // Content area
  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <div style={containerStyle}>
      {/* Decorative background elements */}
      {renderBackgroundDecor()}
      
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
          {showBack && onBack ? (
            <div
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                fontSize: token.fontSize,
              }}
            >
              <ArrowLeftOutlined />
              {!isMobile && <span>Back</span>}
            </div>
          ) : (
            <Link href="/overview" style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, textDecoration: 'none' }}>
              <Image
                src="/images/intuition-logo-no-text.svg"
                alt="InTuition"
                width={32}
                height={32}
              />
              {!isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{
                    fontSize: token.fontSizeLG,
                    fontWeight: fontWeights.bold,
                    color: '#ffffff',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  }}>
                    InTuition
                  </span>
                  <span style={{ fontSize: token.fontSizeSM - 1, color: 'rgba(255,255,255,0.6)', lineHeight: 1, marginTop: -2 }}>Uganda</span>
                </div>
              )}
            </Link>
          )}
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
          <span style={{
            fontSize: token.fontSizeSM,
            color: 'rgba(255,255,255,0.7)',
          }}>
            {currentStep + 1} / {totalSteps + 1}
          </span>
          <div style={{
            width: isMobile ? 80 : 120,
            height: 8,
            background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)',
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: isDark
                  ? `linear-gradient(90deg, ${themeColors.accent} 0%, ${themeColors.light} 100%)`
                  : `linear-gradient(90deg, ${warmColors.sand} 0%, ${warmColors.coral} 100%)`,
                borderRadius: 4,
                boxShadow: isDark
                  ? `0 0 8px ${themeColors.accent}80`
                  : `0 0 8px ${warmColors.coral}60`,
              }}
            />
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={mainStyle}>
        {/* Title & Subtitle - inline compact */}
        {(title || subtitle) && (
          <div style={titleContainerStyle}>
            {title && <h1 style={titleStyle}>{title}</h1>}
            {title && subtitle && <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>}
            {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
          </div>
        )}

        {/* Content */}
        <div style={contentStyle}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default OnboardingLayout;
