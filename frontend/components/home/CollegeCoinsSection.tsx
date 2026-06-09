import { Grid, theme } from "antd";
import {
  CalendarOutlined,
  WalletOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const features = [
  {
    icon: <CalendarOutlined />,
    title: "Earn Before Enrollment",
    description:
      "Students accumulate coins from multiple universities through prep activities like AI tutoring, language tests, and document preparation - before even applying.",
    color: "#8b5cf6",
    colorLight: "#a78bfa",
    colorDark: "#5b21b6",
  },
  {
    icon: <WalletOutlined />,
    title: "Spend on Campus",
    description:
      "Use coins for tuition, housing, meals, books, and all campus services. Universities set their own exchange rates and pricing.",
    color: "#10b981",
    colorLight: "#34d399",
    colorDark: "#047857",
  },
  {
    icon: <SwapOutlined />,
    title: "Trade on UG Coin",
    description:
      "Convert coins to cash or other crypto through the UG Coin. Full liquidity for students, parents, and employers.",
    color: "#3b82f6",
    colorLight: "#60a5fa",
    colorDark: "#1e40af",
  },
];

const stats = [
  { value: "UGX 22 Lakh Cr", label: "Global annual scholarship market", color: "#f59e0b" },
  { value: "28%", label: "Average unclaimed scholarship funds", color: "#ef4444" },
  { value: "UGX 141 Lakh Cr", label: "Outstanding student loan debt", color: "#8b5cf6" },
  { value: "20K+", label: "Universities worldwide", color: "#10b981" },
];

export default function CollegeCoinsSection() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === "dark";
  const isMobile = !screens.md;
  const isTablet = !screens.lg;

  return (
    <section
      style={{
        padding: `${token.paddingXL * 3}px ${token.paddingLG}px`,
        position: "relative",
        overflow: "hidden",
        // Darker background for both modes
        background: isDark
          ? `linear-gradient(160deg, #030712 0%, #0c0a1d 50%, #030712 100%)`
          : `linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)`,
      }}
    >
      <div
        style={{
          maxWidth: MAX_CONTENT_WIDTH,
          margin: "0 auto",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Two column layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr",
            gap: token.marginXL * 2,
            alignItems: "center",
          }}
        >
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            {/* Title */}
            <h2
              style={{
                fontSize: isMobile ? 32 : isTablet ? 40 : 48,
                fontWeight: 800,
                marginBottom: token.marginLG,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              What are{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                College Coins?
              </span>
            </h2>

            {/* Description */}
            <p
              style={{
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.8)",
                marginBottom: token.marginXL,
                maxWidth: 520,
              }}
            >
              College Coins are university-specific digital tokens built on
              blockchain technology. Each university issues its own coin -
              creating a unique digital economy where students can earn, spend,
              and trade.
            </p>

            {/* Feature Items - Bold Claymorphic */}
            <div style={{ display: "flex", flexDirection: "column", gap: token.marginLG }}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  whileHover={{ x: 8 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: token.marginMD,
                  }}
                >
                  {/* 3D Icon - Raised Clay Button */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    style={{
                      position: "relative",
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      color: "#ffffff",
                      // Bold 3D raised effect
                      background: `linear-gradient(145deg, ${feature.color} 0%, ${feature.colorDark} 100%)`,
                      boxShadow: `
                        6px 6px 16px rgba(0,0,0,0.5),
                        -2px -2px 8px ${feature.colorLight}20,
                        inset 2px 2px 6px rgba(255,255,255,0.15),
                        inset -2px -2px 6px rgba(0,0,0,0.3)
                      `,
                      border: `1px solid ${feature.colorLight}30`,
                    }}
                  >
                    {feature.icon}
                    {/* Shine highlight */}
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        width: "25%",
                        height: "25%",
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%)",
                        pointerEvents: "none",
                      }}
                    />
                  </motion.div>

                  {/* Text Content */}
                  <div>
                    <h3
                      style={{
                        fontSize: token.fontSizeLG,
                        fontWeight: fontWeights.bold,
                        color: "#ffffff",
                        marginBottom: 4,
                        textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      style={{
                        fontSize: token.fontSize,
                        color: "rgba(255,255,255,0.75)",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Stats Grid */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: token.marginLG,
            }}
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -4 }}
                style={{
                  padding: isMobile ? token.paddingMD : token.paddingLG,
                  borderRadius: 20,
                  textAlign: "center",
                  background: isDark
                    ? `linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`
                    : `linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)`,
                  boxShadow: `
                    8px 8px 24px rgba(0,0,0,0.4),
                    -2px -2px 12px rgba(255,255,255,0.05),
                    inset 2px 2px 8px rgba(255,255,255,0.08),
                    inset -2px -2px 8px rgba(0,0,0,0.2)
                  `,
                  border: `1px solid ${stat.color}30`,
                }}
              >
                <div
                  style={{
                    fontSize: isMobile ? 28 : 36,
                    fontWeight: 800,
                    color: stat.color,
                    marginBottom: 8,
                    textShadow: `0 0 30px ${stat.color}50`,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 12 : 13,
                    color: "rgba(255,255,255,0.7)",
                    lineHeight: 1.4,
                  }}
                >
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

