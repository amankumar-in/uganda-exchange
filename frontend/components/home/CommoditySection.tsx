import { Grid, theme } from "antd";
import { motion } from "motion/react";
import { CoffeeOutlined, ShopOutlined, TransactionOutlined } from "@ant-design/icons";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const features = [
  {
    icon: <CoffeeOutlined />,
    title: "Agricultural Wealth",
    description: "Trade fractional shares of Uganda's world-class coffee and tea exports.",
  },
  {
    icon: <ShopOutlined />,
    title: "Mineral Assets",
    description: "Invest directly in local mineral commodities like Jade without physical storage.",
  },
  {
    icon: <TransactionOutlined />,
    title: "Market Access",
    description: "Gain direct exposure to physical supply chains through liquid digital markets.",
  },
];

export default function CommoditySection() {
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
          ? `linear-gradient(160deg, #451a03 0%, #78350f 50%, #451a03 100%)`
          : `linear-gradient(160deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)`,
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr",
            gap: token.marginXL * 2,
            alignItems: "center",
          }}
        >
          {/* Left Column - Visual (Reversed for alternate layout) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              height: 400,
              borderRadius: 24,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(217, 119, 6, 0.1)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(217, 119, 6, 0.2)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
              order: isTablet ? 2 : 1
            }}
          >
             <img src="/images/home/coffee.webp" alt="Coffee Commodity" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
             <div style={{
                 position: 'absolute',
                 bottom: 20,
                 left: 20,
                 right: 20,
                 padding: 20,
                 background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                 backdropFilter: 'blur(10px)',
                 borderRadius: 16,
                 border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(217, 119, 6, 0.2)'}`,
                 zIndex: 1
             }}>
                 <div style={{ color: isDark ? '#fff' : '#78350f', fontWeight: 'bold', fontSize: 18 }}>Premium Bugisu Arabica</div>
                 <div style={{ color: '#d97706', fontWeight: 'bold', fontSize: 24, marginTop: 8 }}>UGX 12,500 / kg</div>
             </div>
          </motion.div>

          {/* Right Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            style={{ order: isTablet ? 1 : 2 }}
          >
            <h2
              style={{
                fontSize: isMobile ? 32 : isTablet ? 40 : 48,
                fontWeight: 800,
                marginBottom: token.marginLG,
                color: isDark ? "#ffffff" : "#78350f",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Trade Local{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Commodities
              </span>
            </h2>

            <p
              style={{
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.7,
                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(120, 53, 15, 0.8)",
                marginBottom: token.marginXL,
                maxWidth: 520,
              }}
            >
              Invest in the physical goods that power our economy. Trade tokenized agricultural products and minerals securely, bringing local demand directly to the blockchain.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: token.marginLG }}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: token.marginMD,
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      color: "#fff",
                      background: `linear-gradient(135deg, #f59e0b 0%, #d97706 100%)`,
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: isDark ? "#ffffff" : "#78350f", marginBottom: 4 }}>
                      {feature.title}
                    </h3>
                    <p style={{ fontSize: token.fontSize, color: isDark ? "rgba(255,255,255,0.75)" : "rgba(120, 53, 15, 0.75)", margin: 0 }}>
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
