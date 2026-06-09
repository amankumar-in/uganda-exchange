import { Row, Col, Typography, theme, Grid } from "antd";
import {
  SwapOutlined,
  WalletOutlined,
  SafetyCertificateOutlined,
  LineChartOutlined,
  GlobalOutlined,
  CustomerServiceOutlined,
} from "@ant-design/icons";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { Title, Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const features = [
  {
    icon: <SwapOutlined />,
    title: "Instant Swaps",
    description: "Exchange traditional and real world assets for major cryptocurrencies in seconds with competitive rates and zero hidden fees.",
    color: "#3b82f6",
    colorLight: "#60a5fa",
    colorDark: "#1e40af",
  },
  {
    icon: <WalletOutlined />,
    title: "Secure Wallet",
    description: "Store your TUIT and other tokens safely with our multi-signature wallet infrastructure and cold storage.",
    color: "#10b981",
    colorLight: "#34d399",
    colorDark: "#047857",
  },
  {
    icon: <LineChartOutlined />,
    title: "Real-Time Markets",
    description: "Track live prices, charts, and market data for all tokenized assets with professional trading tools.",
    color: "#f59e0b",
    colorLight: "#fbbf24",
    colorDark: "#b45309",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "Bank-Grade Security",
    description: "Your assets are protected with industry-leading security measures, 2FA, and regular audits.",
    color: "#ef4444",
    colorLight: "#f87171",
    colorDark: "#991b1b",
  },
  {
    icon: <GlobalOutlined />,
    title: "Exclusive Assets",
    description: "Access premium assets across Africa. Invest, trade, or build your diversified portfolio.",
    color: "#8b5cf6",
    colorLight: "#a78bfa",
    colorDark: "#5b21b6",
  },
  {
    icon: <CustomerServiceOutlined />,
    title: "24/7 Support",
    description: "Our dedicated support team is always ready to help you with any questions or issues.",
    color: "#06b6d4",
    colorLight: "#22d3ee",
    colorDark: "#0e7490",
  },
];

export default function FeaturesSection() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === "dark";
  const isMobile = !screens.md;
  const isTablet = !screens.lg;

  const sectionStyle: React.CSSProperties = {
    padding: `${token.paddingXL * 3}px ${token.paddingLG}px`,
    position: "relative",
    overflow: "hidden",
    background: isDark
      ? `linear-gradient(180deg, #0a0a14 0%, #050510 50%, #0a0a14 100%)`
      : `linear-gradient(180deg, #ffffff 0%, #f1f5f9 50%, #ffffff 100%)`,
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: MAX_CONTENT_WIDTH,
    margin: "0 auto",
    position: "relative",
    zIndex: 2,
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: token.marginXL * 2,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: isMobile ? 32 : isTablet ? 40 : 48,
    fontWeight: 800,
    marginBottom: token.marginMD,
    color: isDark ? "#ffffff" : "#0f172a",
    letterSpacing: "-0.02em",
    textShadow: isDark ? "0 2px 20px rgba(0,0,0,0.5)" : "none",
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    fontSize: isMobile ? 16 : 18,
    color: isDark ? "rgba(255,255,255,0.75)" : "rgba(15,23,42,0.7)",
    display: "block",
    lineHeight: 1.6,
    maxWidth: 600,
    margin: "0 auto",
  };

  return (
    <section style={sectionStyle}>
      {/* Atmospheric background effects */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "10%",
          width: "40%",
          height: "40%",
          background: `radial-gradient(ellipse, rgba(59, 130, 246, 0.15) 0%, transparent 70%)`,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          right: "15%",
          width: "35%",
          height: "35%",
          background: `radial-gradient(ellipse, rgba(16, 185, 129, 0.12) 0%, transparent 70%)`,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div style={containerStyle}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          style={headerStyle}
        >
          <Title level={2} style={sectionTitleStyle}>
            The Premium Way To Trade
          </Title>
          <Text style={sectionSubtitleStyle}>
            The most trusted platform for trading Real World Assets with powerful features
            built for modern investors.
          </Text>
        </motion.div>

        {/* Mobile Layout - 3 in a row, icon + title only */}
        {isMobile ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: token.marginMD,
            }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                }}
              >
                {/* 3D Icon */}
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    marginBottom: token.marginSM,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    color: "#ffffff",
                    position: "relative",
                    background: `linear-gradient(145deg, ${feature.color} 0%, ${feature.colorDark} 100%)`,
                    boxShadow: isDark
                      ? `
                        6px 6px 16px rgba(0,0,0,0.5),
                        -2px -2px 8px ${feature.colorLight}20,
                        inset 2px 2px 6px rgba(255,255,255,0.15),
                        inset -2px -2px 6px rgba(0,0,0,0.3)
                      `
                      : `
                        4px 4px 12px rgba(0,0,0,0.15),
                        -2px -2px 8px rgba(255,255,255,0.8),
                        inset 2px 2px 6px rgba(255,255,255,0.2),
                        inset -2px -2px 6px rgba(0,0,0,0.1)
                      `,
                    border: `1px solid ${feature.colorLight}30`,
                  }}
                >
                  {feature.icon}
                  <div
                    style={{
                      position: "absolute",
                      top: 5,
                      left: 5,
                      width: "25%",
                      height: "25%",
                      borderRadius: "50%",
                      background: "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }}
                  />
                </motion.div>
                {/* Title only */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: fontWeights.semibold,
                    color: isDark ? "#ffffff" : "#0f172a",
                    lineHeight: 1.3,
                  }}
                >
                  {feature.title}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Desktop/Tablet Layout - Full Cards */
          <Row gutter={[token.marginLG, token.marginLG]}>
            {features.map((feature, index) => (
              <Col sm={12} lg={8} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  style={{
                    height: "100%",
                    position: "relative",
                  }}
                >
                  {/* Bold Claymorphic Card */}
                  <div
                    style={{
                      padding: token.paddingXL,
                      borderRadius: 28,
                      height: "100%",
                      position: "relative",
                      overflow: "hidden",
                      background: isDark
                        ? `linear-gradient(145deg, ${feature.color}20 0%, ${feature.colorDark}40 50%, ${feature.colorDark}60 100%)`
                        : `linear-gradient(145deg, #ffffff 0%, ${feature.color}08 100%)`,
                      boxShadow: isDark
                        ? `
                          12px 12px 32px rgba(0,0,0,0.6),
                          -4px -4px 16px ${feature.color}25,
                          inset 4px 4px 12px ${feature.color}30,
                          inset -4px -4px 12px rgba(0,0,0,0.4)
                        `
                        : `
                          8px 8px 24px rgba(0,0,0,0.08),
                          -4px -4px 16px rgba(255,255,255,0.8),
                          inset 2px 2px 8px rgba(255,255,255,0.5),
                          inset -2px -2px 8px ${feature.color}10
                        `,
                      border: `1px solid ${isDark ? feature.color + "40" : feature.color + "30"}`,
                      backdropFilter: "blur(10px)",
                    }}
                  >
                    {/* Glassmorphic overlay for depth */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "40%",
                        background: isDark
                          ? `linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)`
                          : `linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%)`,
                        pointerEvents: "none",
                      }}
                    />

                    {/* 3D Icon - Raised Clay Button Style */}
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 20,
                        marginBottom: token.marginLG,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 36,
                        color: "#ffffff",
                        position: "relative",
                        background: `linear-gradient(145deg, ${feature.color} 0%, ${feature.colorDark} 50%, ${feature.colorDark} 100%)`,
                        boxShadow: `
                          8px 8px 20px rgba(0,0,0,0.5),
                          -3px -3px 10px ${feature.colorLight}30,
                          inset 3px 3px 8px rgba(255,255,255,0.15),
                          inset -3px -3px 8px rgba(0,0,0,0.3)
                        `,
                        border: `1px solid ${feature.colorLight}40`,
                      }}
                    >
                      {feature.icon}
                      {/* Highlight shine */}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          width: "30%",
                          height: "30%",
                          borderRadius: "50%",
                          background: "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)",
                          pointerEvents: "none",
                        }}
                      />
                    </motion.div>

                    {/* Content */}
                    <Title
                      level={5}
                      style={{
                        fontSize: token.fontSizeHeading5,
                        fontWeight: fontWeights.bold,
                        marginBottom: token.marginSM,
                        color: isDark ? "#ffffff" : "#0f172a",
                        textShadow: isDark ? "0 2px 8px rgba(0,0,0,0.4)" : "none",
                      }}
                    >
                      {feature.title}
                    </Title>
                    <Text
                      style={{
                        fontSize: token.fontSize,
                        color: isDark ? "rgba(255,255,255,0.85)" : "rgba(15,23,42,0.7)",
                        lineHeight: token.lineHeightLG,
                        display: "block",
                        textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                      }}
                    >
                      {feature.description}
                    </Text>
                  </div>
                </motion.div>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </section>
  );
}
