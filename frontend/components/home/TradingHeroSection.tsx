import { Button, Grid, theme } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const TRADING_SCREEN = "/images/home/18bdae5aa5c55c7079759a3b3f0791a7ccf6b3e7-3528x1922.webp";

const stats = [
  { value: "UGX First", label: "Trade in local currency" },
  { value: "RWAs + Crypto", label: "Land, commodities & celebrities" },
  { value: "Secure Exchange", label: "Built for Uganda's market" },
];

export default function TradingHeroSection() {
  const { token } = useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = !screens.lg;

  const purple = "#5741d9";
  const darkBg = "#0c0c14";

  return (
    <section style={{ background: "#ffffff" }}>
      {/* Light hero — Kraken-style centered signup */}
      <div
        style={{
          maxWidth: MAX_CONTENT_WIDTH,
          margin: "0 auto",
          padding: `${isMobile ? token.paddingXL * 2 : token.paddingXL * 3}px ${token.paddingLG}px ${token.paddingXL}px`,
          textAlign: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1
            style={{
              fontSize: isMobile ? 36 : isTablet ? 48 : 56,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#0a0a0a",
              marginBottom: token.marginMD,
              maxWidth: 720,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Ownership, Brand Power, & Demand
          </h1>

          <p
            style={{
              fontSize: isMobile ? 16 : 18,
              lineHeight: 1.6,
              color: "rgba(0,0,0,0.55)",
              maxWidth: 560,
              margin: `0 auto ${token.marginXL * 2}px`,
            }}
          >
            Crypto, land, commodities, and celebrity tokens - Uganda&apos;s home for digital assets of the future.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
              gap: isMobile ? token.marginLG : 0,
              maxWidth: 800,
              margin: "0 auto",
              borderTop: isMobile ? "none" : "1px solid rgba(0,0,0,0.08)",
              paddingTop: isMobile ? 0 : token.paddingXL,
            }}
          >
            {stats.map((stat, i) => (
              <div
                key={stat.value}
                style={{
                  padding: isMobile ? 0 : `0 ${token.paddingLG}px`,
                  borderLeft: !isMobile && i > 0 ? "1px solid rgba(0,0,0,0.08)" : "none",
                }}
              >
                <div
                  style={{
                    fontSize: isMobile ? 18 : 20,
                    fontWeight: fontWeights.bold,
                    color: "#0a0a0a",
                    marginBottom: 4,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: 14, color: "rgba(0,0,0,0.5)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Dark trading hero — platform showcase */}
      <div
        style={{
          padding: `0 0 ${isMobile ? token.paddingXL : 0}`,
          background: "#ffffff",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{
            width: "90vw",
            maxWidth: "90vw",
            background: `linear-gradient(180deg, ${darkBg} 0%, #12121f 100%)`,
            borderRadius: isMobile ? 20 : 28,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              textAlign: "center",
              padding: `${isMobile ? token.paddingXL * 1.5 : token.paddingXL * 2.5}px ${token.paddingLG}px ${token.paddingMD}px`,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: token.marginSM,
                marginBottom: token.marginLG,
              }}
            >
              <Image
                src="/images/intuition-logo-no-text.svg"
                alt="UG Coin"
                width={28}
                height={28}
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: fontWeights.semibold,
                  color: "rgba(255,255,255,0.9)",
                  letterSpacing: "0.02em",
                }}
              >
                UG Coin Trade
              </span>
            </div>

            <h2
              style={{
                fontSize: isMobile ? 28 : isTablet ? 36 : 44,
                fontWeight: 800,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "#ffffff",
                marginBottom: token.marginMD,
                maxWidth: 640,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              The command center for active traders
            </h2>

            <Link href="/register">
              <Button
                type="primary"
                size="large"
                style={{
                  height: 48,
                  paddingInline: 32,
                  fontSize: 15,
                  fontWeight: fontWeights.semibold,
                  borderRadius: 12,
                  background: purple,
                  borderColor: purple,
                  boxShadow: "none",
                }}
              >
                Sign up now
              </Button>
            </Link>
          </div>

          {/* Trading screen — inset within dark box, bg stays 90vw */}
          <div
            style={{
              padding: `0 ${isMobile ? 16 : 48}px ${isMobile ? 24 : 48}px`,
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                maxWidth: MAX_CONTENT_WIDTH,
                margin: "0 auto",
                paddingTop: isMobile ? "45%" : "38%",
                marginTop: token.marginSM,
                overflow: "hidden",
                borderRadius: 12,
              }}
            >
              <Image
                src={TRADING_SCREEN}
                alt="UG Coin trading platform"
                fill
                priority
                sizes="(max-width: 768px) 90vw, 1200px"
                style={{
                  objectFit: "cover",
                  objectPosition: "top center",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(to bottom, transparent 60%, ${darkBg} 100%)`,
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick link to markets */}
      <div
        style={{
          textAlign: "center",
          padding: `${token.paddingLG}px ${token.paddingLG}px ${token.paddingXL * 2}px`,
          background: "#ffffff",
        }}
      >
        <Link href="/markets" style={{ color: purple, fontWeight: fontWeights.semibold, fontSize: 15 }}>
          Explore live markets <ArrowRightOutlined />
        </Link>
      </div>
    </section>
  );
}
