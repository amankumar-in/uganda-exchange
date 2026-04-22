'use client';

import { theme, Grid } from 'antd';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';

const { useToken } = theme;
const { useBreakpoint } = Grid;

/**
 * Onboarding UI is rendered over a dark/warm gradient backdrop (see OnboardingLayout).
 * These colors are the palette used on top of that backdrop — white text, frosted-glass
 * cards, indigo CTA in dark mode, coral CTA in warm/light mode. They are part of the
 * design, not magic values scattered around pages.
 */
export const onboardingPalette = {
  indigo: { primary: '#6366F1', light: '#A5B4FC', dark: '#4338CA', accent: '#818CF8' },
  warm: { sand: '#D4C4A8', coral: '#E07A5F', terracotta: '#B85C38', brown: '#5D4037' },
  text: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.7)', tertiary: 'rgba(255,255,255,0.5)' },
  danger: '#FCA5A5',
  success: '#22C55E',
};

/**
 * Shared onboarding styles. One source of truth for Card/Button/Input/Label shapes.
 */
export function useOnboardingStyles() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;

  const card: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(12px)',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.3)',
    borderRadius: token.borderRadius,
    padding: isMobile ? token.paddingMD : token.paddingLG,
  };

  const input: React.CSSProperties = {
    background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)',
    border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.5)',
    borderRadius: token.borderRadiusLG,
    height: 48,
    fontSize: token.fontSize,
    color: isDark ? onboardingPalette.text.primary : '#1a1a2e',
  };

  const label: React.CSSProperties = {
    fontWeight: fontWeights.medium,
    fontSize: token.fontSize,
    color: onboardingPalette.text.primary,
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  };

  const buttonPrimary: React.CSSProperties = {
    background: isDark
      ? `linear-gradient(135deg, ${onboardingPalette.indigo.primary} 0%, ${onboardingPalette.indigo.dark} 100%)`
      : `linear-gradient(135deg, ${onboardingPalette.warm.coral} 0%, #C45C44 100%)`,
    boxShadow: isDark ? '0 4px 14px rgba(99, 102, 241, 0.4)' : '0 4px 14px rgba(224,122,95,0.4)',
    border: 'none',
    borderRadius: token.borderRadiusLG,
    color: onboardingPalette.text.primary,
    fontWeight: fontWeights.bold,
    height: 48,
    fontSize: token.fontSize,
  };

  const buttonSecondary: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
    boxShadow: 'none',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: token.borderRadiusLG,
    color: onboardingPalette.text.primary,
    fontWeight: fontWeights.bold,
    height: 48,
    fontSize: token.fontSize,
  };

  const buttonCta: React.CSSProperties = { ...buttonPrimary, height: 52, fontSize: token.fontSizeLG };

  const hint: React.CSSProperties = {
    fontSize: token.fontSizeSM,
    color: onboardingPalette.text.secondary,
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  };

  const titleLg: React.CSSProperties = {
    fontSize: isMobile ? 22 : 28,
    fontWeight: fontWeights.bold,
    color: onboardingPalette.text.primary,
    marginBottom: token.marginXS,
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  };

  // Form-level CSS for Ant Design error overrides + input placeholders
  const formErrorCss = isDark
    ? `
      .onboarding-form .ant-form-item-explain-error {
        color: ${onboardingPalette.danger} !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        font-weight: 500;
      }
      .onboarding-form .ant-form-item-has-error .ant-input,
      .onboarding-form .ant-form-item-has-error .ant-picker,
      .onboarding-form .ant-form-item-has-error .ant-select-selector {
        border-color: ${onboardingPalette.danger} !important;
      }
      .onboarding-form .ant-input::placeholder,
      .onboarding-form .ant-picker-input input::placeholder {
        color: rgba(255,255,255,0.4) !important;
      }
      .onboarding-form .ant-input-prefix { color: rgba(255,255,255,0.5) !important; }
      .onboarding-form .ant-select { height: 48px !important; }
      .onboarding-form .ant-select-selector {
        background: rgba(0,0,0,0.3) !important;
        border: 1px solid rgba(255,255,255,0.15) !important;
        border-radius: ${/* token.borderRadiusLG */ 12}px !important;
        height: 48px !important;
        min-height: 48px !important;
        padding: 0 11px !important;
      }
      .onboarding-form .ant-select-selection-search-input { height: 46px !important; }
      .onboarding-form .ant-select-selection-item {
        color: ${onboardingPalette.text.primary} !important;
        line-height: 46px !important;
      }
      .onboarding-form .ant-select-selection-placeholder {
        line-height: 46px !important;
        color: rgba(255,255,255,0.4) !important;
      }
      .onboarding-form .ant-select-arrow { color: rgba(255,255,255,0.5) !important; }
    `
    : `
      .onboarding-form .ant-form-item-explain-error {
        color: #FFE066 !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        font-weight: 500;
      }
      .onboarding-form .ant-form-item-has-error .ant-input,
      .onboarding-form .ant-form-item-has-error .ant-picker,
      .onboarding-form .ant-form-item-has-error .ant-select-selector {
        border-color: #FFE066 !important;
      }
      .onboarding-form .ant-input::placeholder {
        color: rgba(0,0,0,0.35) !important;
      }
      .onboarding-form .ant-select { height: 48px !important; }
      .onboarding-form .ant-select-selector {
        background: rgba(255,255,255,0.9) !important;
        border: 1px solid rgba(255,255,255,0.5) !important;
        border-radius: 12px !important;
        height: 48px !important;
        min-height: 48px !important;
        padding: 0 11px !important;
      }
      .onboarding-form .ant-select-selection-search-input { height: 46px !important; }
      .onboarding-form .ant-select-selection-item { line-height: 46px !important; color: #1a1a2e !important; }
      .onboarding-form .ant-select-selection-placeholder { line-height: 46px !important; color: rgba(0,0,0,0.35) !important; }
      .onboarding-form .ant-select-arrow { color: rgba(0,0,0,0.4) !important; }
    `;

  return {
    isDark,
    isMobile,
    token,
    card,
    input,
    label,
    buttonPrimary,
    buttonSecondary,
    buttonCta,
    hint,
    titleLg,
    formErrorCss,
    palette: onboardingPalette,
  };
}
