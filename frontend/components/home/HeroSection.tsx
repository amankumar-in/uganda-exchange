import { Button, Grid, theme } from "antd";
import { RocketOutlined, ArrowRightOutlined } from "@ant-design/icons";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH, HEADER_HEIGHT } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

export default function HeroSection() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === "dark";
  const isMobile = !screens.md;
  const isTablet = !screens.lg;

  // Deep, rich color palette - not generic
  const colors = {
    deepNavy: "#0a0f1a",
    richIndigo: "#1e1b4b",
    electricBlue: "#3b82f6",
    vibrantCyan: "#06b6d4",
    warmAmber: "#f59e0b",
    softGold: "#fcd34d",
  };

  return (
    <section
      style={{
        minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: isTablet ? "flex-start" : "center",
        // Rich gradient background - not generic purple
        background: isDark
          ? `linear-gradient(135deg, ${colors.deepNavy} 0%, #0f172a 40%, #1e1b4b 70%, #0f172a 100%)`
          : `linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #fef3c7 100%)`,
      }}
    >
      {/* Atmospheric glow effects - subtle, not generic */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "-10%",
          width: "60%",
          height: "60%",
          background: isDark
            ? `radial-gradient(ellipse, ${colors.electricBlue}15 0%, transparent 70%)`
            : `radial-gradient(ellipse, ${colors.electricBlue}20 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "0%",
          right: "-5%",
          width: "50%",
          height: "50%",
          background: isDark
            ? `radial-gradient(ellipse, ${colors.warmAmber}12 0%, transparent 70%)`
            : `radial-gradient(ellipse, ${colors.warmAmber}25 0%, transparent 70%)`,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Main container */}
      <div
        style={{
          maxWidth: MAX_CONTENT_WIDTH,
          width: "100%",
          margin: "0 auto",
          padding: `${token.paddingXL * 2}px ${token.paddingLG}px`,
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr",
          alignItems: "center",
          gap: token.marginXL * 2,
          position: "relative",
          zIndex: isTablet ? 5 : 2,
        }}
      >
        {/* Left side - Text content */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            textAlign: isTablet ? "center" : "left",
            position: "relative",
            zIndex: isTablet ? 5 : 1,
          }}
        >
          {/* Badge - claymorphic style */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: token.marginXS,
              padding: `${token.paddingXS + 2}px ${token.paddingSM + 4}px`,
              borderRadius: 50,
              marginBottom: token.marginLG,
              // Glassmorphism badge
              background: isDark
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(59, 130, 246, 0.12)",
              backdropFilter: "blur(12px)",
              border: isDark
                ? "1px solid rgba(59, 130, 246, 0.3)"
                : "1px solid rgba(59, 130, 246, 0.25)",
              boxShadow: isDark
                ? "0 4px 20px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
                : "0 4px 20px rgba(59, 130, 246, 0.15)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 8px #22c55e",
              }}
            />
            <span
              style={{
                fontSize: token.fontSize,
                fontWeight: fontWeights.medium,
                color: isDark ? colors.vibrantCyan : colors.electricBlue,
              }}
            >
              Real World Assets & Crypto
            </span>
          </motion.div>

          {/* Main heading - bold, impactful */}
          <h1
            style={{
              fontSize: isMobile ? 36 : isTablet ? 48 : 64,
              fontWeight: 800,
              lineHeight: 1.1,
              marginBottom: token.marginMD,
              color: isDark ? "#ffffff" : colors.deepNavy,
              letterSpacing: "-0.02em",
              textShadow: isTablet
                ? isDark
                  ? "0 2px 20px rgba(0,0,0,0.8)"
                  : "0 2px 20px rgba(255,255,255,0.9)"
                : undefined,
            }}
          >
            Uganda's
            <br />
            <span
              style={{
                // Bold gradient text - matching page theme
                background: `linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Land, Commodity, & Celebrity
            </span>
            <br />
            Coin Marketplace
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: isMobile ? 15 : 18,
              lineHeight: 1.6,
              color: isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)",
              maxWidth: 520,
              marginTop: 0,
              marginBottom: token.marginMD,
              marginLeft: isTablet ? "auto" : 0,
              marginRight: isTablet ? "auto" : 0,
              textShadow: isTablet
                ? isDark
                  ? "0 1px 12px rgba(0,0,0,0.8)"
                  : "0 1px 12px rgba(255,255,255,0.95)"
                : undefined,
            }}
          >
            Access traditional cryptocurrencies alongside exclusive tokenized Real World Assets. Monetize brand power (Celebrities), trade local demand (Commodities), and securely own property (Land) through Uganda's leading digital exchange.
          </p>

          {/* CTA Buttons - claymorphic style */}
          <div
            style={{
              display: "flex",
              gap: token.marginSM,
              flexWrap: "nowrap",
              justifyContent: isTablet ? "center" : "flex-start",
              marginBottom: token.marginMD,
            }}
          >
            <Link href="/register">
              <motion.div 
                whileHover={{ scale: 1.03, y: -2 }} 
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-block",
                  position: "relative",
                }}
              >
                <Button
                  type="primary"
                  size="large"
                  icon={<RocketOutlined />}
                  style={{
                    height: isMobile ? 48 : 56,
                    paddingInline: isMobile ? 24 : 32,
                    fontSize: isMobile ? 15 : 16,
                    fontWeight: fontWeights.bold,
                    borderRadius: 16,
                    border: "1px solid rgba(96, 165, 250, 0.4)",
                    // Bold 3D gradient like CollegeCoins icons
                    background: `linear-gradient(145deg, #3b82f6 0%, #1e40af 50%, #1e3a8a 100%)`,
                    // Bold claymorphic shadows
                    boxShadow: `
                      8px 8px 24px rgba(0,0,0,0.5),
                      -3px -3px 12px rgba(96, 165, 250, 0.25),
                      inset 3px 3px 8px rgba(255,255,255,0.2),
                      inset -3px -3px 8px rgba(0,0,0,0.25)
                    `,
                  }}
                >
                  Start Trading
                </Button>
                {/* Shine highlight like icons */}
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    left: 12,
                    width: 20,
                    height: 12,
                    borderRadius: "50%",
                    background: "radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
              </motion.div>
            </Link>

            <Link href="https://coinsforcollege.org" target="_blank">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="large"
                  icon={<ArrowRightOutlined />}
                  style={{
                    height: isMobile ? 48 : 56,
                    paddingInline: isMobile ? 24 : 32,
                    fontSize: isMobile ? 15 : 16,
                    fontWeight: fontWeights.semibold,
                    borderRadius: 16,
                    background: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(12px)",
                    border: isDark
                      ? "1px solid rgba(255,255,255,0.15)"
                      : "1px solid rgba(0,0,0,0.1)",
                    color: isDark ? "#ffffff" : colors.deepNavy,
                    boxShadow: isDark
                      ? "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
                      : "0 4px 20px rgba(0,0,0,0.08)",
                  }}
                >
                  Learn More
                </Button>
              </motion.div>
            </Link>
          </div>

        </motion.div>

      </div>

      {/* Scrim gradient for text contrast on mobile/tablet */}
      {isTablet && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 4,
            pointerEvents: "none",
            background: isDark
              ? `linear-gradient(
                  to bottom,
                  rgba(10, 15, 26, 0.98) 0%,
                  rgba(10, 15, 26, 0.92) 30%,
                  rgba(10, 15, 26, 0.65) 50%,
                  transparent 70%
                )`
              : `linear-gradient(
                  to bottom,
                  rgba(248, 250, 252, 0.98) 0%,
                  rgba(248, 250, 252, 0.92) 30%,
                  rgba(248, 250, 252, 0.65) 50%,
                  transparent 70%
                )`,
          }}
        />
      )}

      {/* Hand with phone emerging from bottom edge - positioned to section */}
      <Image
        src="/images/hero/layer01.png"
        alt="UG Coin App"
        width={500}
        height={600}
        priority
        unoptimized
        style={{
          position: "absolute",
          bottom: 0,
          right: isTablet ? "50%" : "15%",
          transform: isTablet ? "translateX(50%)" : "none",
          zIndex: 3,
          filter: `drop-shadow(0 -10px 40px rgba(0,0,0,${isDark ? 0.4 : 0.2}))`,
          width: isMobile ? 320 : isTablet ? 400 : 500,
          height: "auto",
          display: "block",
        }}
      />

      {/* Bottom gradient fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: isDark
            ? "linear-gradient(to top, #0f172a 0%, transparent 100%)"
            : "linear-gradient(to top, #f8fafc 0%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
    </section>
  );
}
