/**
 * Shared Auth Layout Component
 * Beautiful mobile-first layout for all auth pages
 */

import React, { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Typography, theme } from 'antd';
import { fontWeights } from '@/theme/themeConfig';

const { Title, Text } = Typography;
const { useToken } = theme;

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBackToHome?: boolean;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  showBackToHome = true,
}: AuthLayoutProps) {
  const { token } = useToken();

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: token.colorBgLayout,
  };

  const headerStyle: React.CSSProperties = {
    padding: `${token.paddingLG}px`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
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

  const mainStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${token.paddingLG}px`,
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    backgroundColor: token.colorBgContainer,
    borderRadius: token.borderRadiusLG,
    padding: `${token.paddingXL}px`,
    border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading2,
    fontWeight: fontWeights.bold,
    color: token.colorText,
    textAlign: 'center',
    marginBottom: subtitle ? token.marginXS : token.marginLG,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: token.fontSizeLG,
    color: token.colorTextSecondary,
    textAlign: 'center',
    marginBottom: token.marginLG,
    display: 'block',
    lineHeight: token.lineHeightLG,
  };

  const backLinkStyle: React.CSSProperties = {
    color: token.colorTextSecondary,
    fontSize: token.fontSize,
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: token.marginXS,
    transition: 'color 0.2s ease',
  };

  const footerStyle: React.CSSProperties = {
    padding: `${token.paddingLG}px`,
    textAlign: 'center',
  };

  const footerTextStyle: React.CSSProperties = {
    color: token.colorTextTertiary,
    fontSize: token.fontSize,
  };

  const footerLinkStyle: React.CSSProperties = {
    color: token.colorTextSecondary,
    textDecoration: 'none',
    marginLeft: token.marginXS,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <Link href="/" style={logoContainerStyle}>
          <Image
            src="/images/intuition-logo-no-text.svg"
            alt="UG Coin"
            width={token.controlHeightLG}
            height={token.controlHeightLG}
          />
          <span style={logoTextStyle}>UG Coin</span>
        </Link>

        {showBackToHome && (
          <Link href="/" style={backLinkStyle}>
            ← Back to Home
          </Link>
        )}
      </header>

      {/* Main Content */}
      <main style={mainStyle}>
        <div style={cardStyle}>
          <Title level={2} style={titleStyle}>
            {title}
          </Title>
          {subtitle && <Text style={subtitleStyle}>{subtitle}</Text>}
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer style={footerStyle}>
        <Text style={footerTextStyle}>
          © {new Date().getFullYear()} UG Coin
          <Link href="/terms" style={footerLinkStyle}>Terms</Link>
          <Link href="/privacy" style={{ ...footerLinkStyle, marginLeft: token.marginMD }}>Privacy</Link>
        </Text>
      </footer>
    </div>
  );
}

