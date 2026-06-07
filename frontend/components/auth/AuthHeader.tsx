/**
 * AuthHeader - State-aware header for auth pages
 * Shows opposite action link (Sign In on register, Sign Up on login)
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, theme } from 'antd';
import { useRouter } from 'next/router';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';

const { useToken } = theme;

export default function AuthHeader() {
  const { token } = useToken();
  const { mode, toggleMode } = useThemeMode();
  const router = useRouter();
  
  // Determine current page and show opposite action
  const isLoginPage = router.pathname === '/login';
  const isRegisterPage = router.pathname === '/register';
  const isResetPage = router.pathname === '/reset';

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${token.paddingMD}px ${token.paddingLG}px`,
    backgroundColor: 'transparent',
  };

  const logoContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginSM,
    textDecoration: 'none',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading4,
    fontWeight: fontWeights.bold,
    color: token.colorText,
  };

  const rightSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginSM,
  };

  const themeSwitchStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: token.controlHeight,
    height: token.controlHeight,
    borderRadius: token.borderRadius,
    backgroundColor: mode === 'dark' ? token.colorBgElevated : token.colorPrimaryBg,
    cursor: 'pointer',
  };

  return (
    <header style={headerStyle}>
      <Link href="/" style={logoContainerStyle}>
        <Image
          src="/images/intuition-logo-no-text.svg"
          alt="InTuition"
          width={token.controlHeightLG}
          height={token.controlHeightLG}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={logoTextStyle}>InTuition</span>
          <span style={{ fontSize: token.fontSizeSM - 1, color: token.colorTextSecondary, lineHeight: 1, marginTop: -2 }}>Uganda</span>
        </div>
      </Link>

      <div style={rightSectionStyle}>
        <div style={themeSwitchStyle} onClick={toggleMode}>
          {mode === 'dark' ? (
            <MoonOutlined style={{ color: token.colorPrimary }} />
          ) : (
            <SunOutlined style={{ color: token.colorPrimary }} />
          )}
        </div>

        {/* State-aware auth link */}
        {isLoginPage && (
          <Link href="/register">
            <Button
              type="primary"
              style={{
                fontWeight: fontWeights.semibold,
                paddingInline: token.paddingMD,
              }}
            >
              Sign Up
            </Button>
          </Link>
        )}

        {isRegisterPage && (
          <Link href="/login">
            <Button
              type="primary"
              style={{
                fontWeight: fontWeights.semibold,
                paddingInline: token.paddingMD,
              }}
            >
              Sign In
            </Button>
          </Link>
        )}

        {isResetPage && (
          <Link href="/login">
            <Button
              type="primary"
              style={{
                fontWeight: fontWeights.semibold,
                paddingInline: token.paddingMD,
              }}
            >
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}

