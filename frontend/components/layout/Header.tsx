import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Drawer, Switch, theme } from "antd";
import {
  MenuOutlined,
  SwapOutlined,
  WalletOutlined,
  LineChartOutlined,
  LoginOutlined,
  SunOutlined,
  MoonOutlined,
  TeamOutlined,
  DollarOutlined,
  UserOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

const { useToken } = theme;

// Layout constants (not design tokens)
const HEADER_HEIGHT = 72;
const MAX_CONTENT_WIDTH = 1200;
const MOBILE_BREAKPOINT = 768;

const navItems = [
  { key: "buy-sell", label: "Buy & Sell", icon: <DollarOutlined />, href: "/buy-sell" },
  { key: "trade", label: "Trade", icon: <SwapOutlined />, href: "/trade" },
  { key: "p2p", label: "P2P", icon: <TeamOutlined />, href: "/p2p" },
  { key: "markets", label: "Markets", icon: <LineChartOutlined />, href: "/markets" },
  { key: "portfolio", label: "Portfolio", icon: <WalletOutlined />, href: "/portfolio" },
];

export default function Header() {
  const { token } = useToken();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { mode, toggleMode } = useThemeMode();
  const { user, isLoading } = useAuth();
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const isLoggedIn = !isLoading && !!user;

  const headerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: token.zIndexPopupBase,
    height: HEADER_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `0 ${token.paddingLG}px`,
    backgroundColor: mode === "dark" 
      ? `rgba(0, 0, 0, 0.8)` 
      : `rgba(255, 255, 255, 0.8)`,
    backdropFilter: "blur(12px)",
    borderBottom: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
  };

  const logoContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: token.marginSM,
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading4,
    fontWeight: fontWeights.bold,
    color: token.colorText,
  };

  const navStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: token.marginXS,
    padding: `${token.paddingXS}px`,
    borderRadius: token.borderRadiusLG,
    backgroundColor: token.colorPrimaryBg,
  };

  const getNavLinkStyle = (key: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: token.marginXS,
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    borderRadius: token.borderRadius,
    color: hoveredNav === key ? token.colorPrimary : token.colorTextSecondary,
    backgroundColor: hoveredNav === key ? token.colorPrimaryBg : "transparent",
    fontSize: token.fontSize,
    fontWeight: fontWeights.medium,
    textDecoration: "none",
    transition: "all 0.2s ease",
  });

  const rightSectionStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: token.marginSM,
  };

  const themeSwitchContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: token.controlHeight,
    height: token.controlHeight,
    borderRadius: token.borderRadius,
    backgroundColor: mode === "dark" ? token.colorBgLayout : token.colorPrimaryBg,
    cursor: "pointer",
  };

  const mobileMenuButtonStyle: React.CSSProperties = {
    display: "none",
    fontSize: token.fontSizeHeading4,
    color: token.colorText,
  };

  return (
    <>
      <header style={headerStyle}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={logoContainerStyle}>
            <Image
              src="/images/intuition-logo-no-text.svg"
              alt="InTuition Exchange"
              width={token.controlHeightLG}
              height={token.controlHeightLG}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={logoTextStyle}>InTuition Exchange</span>
              <span style={{ fontSize: token.fontSizeSM - 1, color: token.colorTextSecondary, lineHeight: 1, marginTop: -2 }}>Uganda</span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav style={navStyle} className="desktop-nav">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              style={getNavLinkStyle(item.key)}
              onMouseEnter={() => setHoveredNav(item.key)}
              onMouseLeave={() => setHoveredNav(null)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Section */}
        <div style={rightSectionStyle} className="desktop-nav">
          <div
            style={themeSwitchContainerStyle}
            onClick={toggleMode}
          >
            {mode === "dark" ? (
              <MoonOutlined style={{ color: token.colorPrimary }} />
            ) : (
              <SunOutlined style={{ color: token.colorPrimary }} />
            )}
          </div>
          {isLoggedIn ? (
            <Link href="/overview">
              <Button
                type="primary"
                icon={<AppstoreOutlined />}
                style={{
                  fontWeight: fontWeights.semibold,
                  paddingInline: token.paddingMD,
                }}
              >
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button
                  type="text"
                  style={{ 
                    color: token.colorText,
                    fontWeight: fontWeights.medium,
                  }}
                >
                  Log In
                </Button>
              </Link>
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
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(true)}
          style={mobileMenuButtonStyle}
          className="mobile-menu-btn"
        />
      </header>

      {/* Mobile Drawer - Claymorphic Style */}
      <Drawer
        title={null}
        placement="right"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={300}
        styles={{
          header: { display: "none" },
          body: { 
            padding: 0,
            background: mode === "dark"
              ? "linear-gradient(180deg, #0a0f1a 0%, #1e1b4b 100%)"
              : "linear-gradient(180deg, #f8fafc 0%, #e0e7ff 100%)",
          },
          wrapper: {},
        }}
        closeIcon={null}
      >
        {/* Custom Header */}
        <div
          style={{
            padding: `${token.paddingLG}px`,
            borderBottom: `1px solid ${mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: token.marginSM }}>
              <Image
                src="/images/intuition-logo-no-text.svg"
                alt="InTuition"
                width={36}
                height={36}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{
                  fontWeight: fontWeights.bold,
                  fontSize: token.fontSizeLG,
                  color: mode === "dark" ? "#ffffff" : "#0f172a",
                }}>
                  InTuition Exchange
                </span>
                <span style={{ fontSize: token.fontSizeSM - 1, color: mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", lineHeight: 1, marginTop: -2 }}>Uganda</span>
              </div>
            </div>
            <Button
              type="text"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                color: mode === "dark" ? "#ffffff" : "#0f172a",
              }}
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
          {navItems.map((item, index) => (
            <Link
              key={item.key}
              href={item.href}
              style={{ textDecoration: "none" }}
              onClick={() => setMobileMenuOpen(false)}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: token.marginMD,
                  padding: `${token.paddingXS + 2}px 0`,
                  marginBottom: 2,
                  transition: "all 0.2s",
                }}
              >
                {/* Icon with 3D effect */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    color: "#ffffff",
                    background: `linear-gradient(145deg, ${
                      ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4"][index % 5]
                    } 0%, ${
                      ["#1e40af", "#047857", "#5b21b6", "#b45309", "#0e7490"][index % 5]
                    } 100%)`,
                    boxShadow: `
                      4px 4px 10px rgba(0,0,0,0.3),
                      inset 2px 2px 4px rgba(255,255,255,0.15),
                      inset -2px -2px 4px rgba(0,0,0,0.2)
                    `,
                  }}
                >
                  {item.icon}
                </div>
                <span
                  style={{
                    fontWeight: fontWeights.semibold,
                    color: mode === "dark" ? "#ffffff" : "#0f172a",
                    fontSize: token.fontSizeLG,
                  }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            margin: `${token.paddingXS}px ${token.paddingMD}px`,
            background: mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
          }}
        />

        {/* Auth Section */}
        <div style={{ padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
          {isLoggedIn ? (
            <Link href="/overview" style={{ textDecoration: "none" }} onClick={() => setMobileMenuOpen(false)}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: token.marginSM,
                  padding: `${token.paddingMD}px`,
                  borderRadius: 14,
                  fontWeight: fontWeights.bold,
                  fontSize: token.fontSizeLG,
                  color: "#ffffff",
                  background: `linear-gradient(145deg, #3b82f6 0%, #1e40af 50%, #1e3a8a 100%)`,
                  boxShadow: `
                    6px 6px 16px rgba(0,0,0,0.4),
                    -2px -2px 8px rgba(96, 165, 250, 0.2),
                    inset 2px 2px 6px rgba(255,255,255,0.15),
                    inset -2px -2px 6px rgba(0,0,0,0.2)
                  `,
                  border: "1px solid rgba(96, 165, 250, 0.3)",
                }}
              >
                <AppstoreOutlined />
                Dashboard
              </div>
            </Link>
          ) : (
            <div style={{ display: "flex", gap: token.marginSM }}>
              <Link href="/login" style={{ flex: 1, textDecoration: "none" }} onClick={() => setMobileMenuOpen(false)}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: token.marginXS,
                    padding: `${token.paddingMD}px`,
                    borderRadius: 14,
                    fontWeight: fontWeights.semibold,
                    color: mode === "dark" ? "#ffffff" : "#0f172a",
                    background: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
                    border: mode === "dark" ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.1)",
                    boxShadow: mode === "dark"
                      ? "4px 4px 12px rgba(0,0,0,0.3)"
                      : "4px 4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  <LoginOutlined />
                  Log In
                </div>
              </Link>
              <Link href="/register" style={{ flex: 1, textDecoration: "none" }} onClick={() => setMobileMenuOpen(false)}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: token.marginXS,
                    padding: `${token.paddingMD}px`,
                    borderRadius: 14,
                    fontWeight: fontWeights.bold,
                    color: "#ffffff",
                    background: `linear-gradient(145deg, #3b82f6 0%, #1e40af 100%)`,
                    boxShadow: `
                      4px 4px 12px rgba(0,0,0,0.3),
                      inset 2px 2px 4px rgba(255,255,255,0.15)
                    `,
                    border: "1px solid rgba(96, 165, 250, 0.3)",
                  }}
                >
                  <UserOutlined />
                  Sign Up
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <div
          style={{
            margin: `${token.paddingSM}px ${token.paddingMD}px`,
            padding: token.paddingSM,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.6)",
            border: mode === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.05)",
          }}
        >
          <span
            style={{
              fontWeight: fontWeights.medium,
              color: mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)",
            }}
          >
            Dark Mode
          </span>
          <Switch
            checked={mode === "dark"}
            onChange={toggleMode}
            checkedChildren={<MoonOutlined />}
            unCheckedChildren={<SunOutlined />}
          />
        </div>
      </Drawer>

      <style jsx global>{`
        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}

export { HEADER_HEIGHT, MAX_CONTENT_WIDTH };
