import { Grid, theme } from "antd";
import {
  BankOutlined,
  TeamOutlined,
  DollarOutlined,
  ArrowRightOutlined,
  ArrowDownOutlined,
} from "@ant-design/icons";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const ecosystemItems = [
  {
    step: "01",
    icon: <BankOutlined />,
    title: "Asset Tokenization",
    description:
      "Real estate, commodities, and celebrity brands are tokenized into digital assets securely stored on the blockchain.",
    color: "#8b5cf6",
  },
  {
    step: "02",
    icon: <TeamOutlined />,
    title: "Investors Trade & Build",
    description:
      "Investors buy, sell, and build portfolios with verified real-world assets directly alongside cryptocurrencies.",
    color: "#10b981",
  },
  {
    step: "03",
    icon: <DollarOutlined />,
    title: "Full Liquidity",
    description:
      "Trade assets for UGX, USD, or USDC. Instant settlement and global liquidity for all investors.",
    color: "#f59e0b",
  },
];

export default function EcosystemSection() {
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
        background: isDark
          ? `linear-gradient(180deg, #050510 0%, #0a0a1a 50%, #050510 100%)`
          : `linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%)`,
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: "center",
            marginBottom: token.marginXL * 2,
            maxWidth: 700,
            marginInline: "auto",
          }}
        >
          <h2
            style={{
              fontSize: isMobile ? 32 : isTablet ? 40 : 48,
              fontWeight: 800,
              marginBottom: token.marginMD,
              color: isDark ? "#ffffff" : "#0f172a",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            The Real World Assets{" "}
            <span
              style={{
                background: `linear-gradient(135deg, #10b981 0%, #3b82f6 50%, #8b5cf6 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Ecosystem
            </span>
          </h2>
          <p
            style={{
              fontSize: isMobile ? 16 : 18,
              color: isDark ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)",
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            An interconnected network of tokenized value on the blockchain.
          </p>
        </motion.div>

        {/* Flow Layout */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "stretch",
            justifyContent: "center",
            gap: 0,
          }}
        >
          {ecosystemItems.map((item, index) => (
            <div
              key={item.title}
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: "center",
                flex: 1,
              }}
            >
              {/* Step Item */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  flex: 1,
                  padding: isMobile ? token.paddingMD : token.paddingLG,
                }}
              >
                {/* Step Number */}
                <div
                  style={{
                    fontSize: isMobile ? 48 : 64,
                    fontWeight: 900,
                    color: item.color,
                    opacity: 0.2,
                    lineHeight: 1,
                    marginBottom: -20,
                    fontFamily: "monospace",
                  }}
                >
                  {item.step}
                </div>

                {/* Icon Circle */}
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  style={{
                    width: isMobile ? 80 : 100,
                    height: isMobile ? 80 : 100,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 32 : 40,
                    color: item.color,
                    background: `${item.color}15`,
                    border: `2px solid ${item.color}`,
                    marginBottom: token.marginMD,
                  }}
                >
                  {item.icon}
                </motion.div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: isMobile ? 16 : 18,
                    fontWeight: fontWeights.bold,
                    color: isDark ? "#ffffff" : "#0f172a",
                    marginBottom: token.marginXS,
                    lineHeight: 1.3,
                  }}
                >
                  {item.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: isMobile ? 13 : 14,
                    color: isDark ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)",
                    lineHeight: 1.6,
                    margin: 0,
                    maxWidth: 220,
                  }}
                >
                  {item.description}
                </p>
              </motion.div>

              {/* Arrow Connector */}
              {index < ecosystemItems.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.2 }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: isMobile ? `${token.paddingMD}px 0` : `0 ${token.paddingSM}px`,
                  }}
                >
                  <div
                    style={{
                      width: isMobile ? 2 : 60,
                      height: isMobile ? 40 : 2,
                      background: `linear-gradient(${isMobile ? "180deg" : "90deg"}, ${item.color}, ${ecosystemItems[index + 1].color})`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 20,
                      color: ecosystemItems[index + 1].color,
                    }}
                  >
                    {isMobile ? <ArrowDownOutlined /> : <ArrowRightOutlined />}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

