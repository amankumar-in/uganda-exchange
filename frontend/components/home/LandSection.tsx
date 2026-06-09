import { Grid, theme } from "antd";
import { motion } from "motion/react";
import { HomeOutlined, SafetyCertificateOutlined, GlobalOutlined } from "@ant-design/icons";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const features = [
  {
    icon: <HomeOutlined />,
    title: "Verified Deeds",
    description: "Every token is backed by a physical property deed registered in Uganda.",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "Secure Ownership",
    description: "Immutable records on the blockchain guarantee your ownership rights.",
  },
  {
    icon: <GlobalOutlined />,
    title: "Global Liquidity",
    description: "Buy and sell local property to a global market of investors instantly.",
  },
];

export default function LandSection() {
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
          ? `linear-gradient(160deg, #022c22 0%, #064e3b 50%, #022c22 100%)`
          : `linear-gradient(160deg, #ecfdf5 0%, #d1fae5 50%, #ecfdf5 100%)`,
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
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2
              style={{
                fontSize: isMobile ? 32 : isTablet ? 40 : 48,
                fontWeight: 800,
                marginBottom: token.marginLG,
                color: isDark ? "#ffffff" : "#064e3b",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Invest In{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Tokenized Land
              </span>
            </h2>

            <p
              style={{
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.7,
                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(6, 78, 59, 0.8)",
                marginBottom: token.marginXL,
                maxWidth: 520,
              }}
            >
              Secure your piece of Uganda with tokenized property deeds. We bring traditional real estate onto the blockchain, allowing for fractional ownership, instant transfers, and transparent history.
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
                      background: `linear-gradient(135deg, #10b981 0%, #059669 100%)`,
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: isDark ? "#ffffff" : "#064e3b", marginBottom: 4 }}>
                      {feature.title}
                    </h3>
                    <p style={{ fontSize: token.fontSize, color: isDark ? "rgba(255,255,255,0.75)" : "rgba(6, 78, 59, 0.75)", margin: 0 }}>
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column - Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              height: 400,
              borderRadius: 24,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(16, 185, 129, 0.1)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(16, 185, 129, 0.2)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden"
            }}
          >
             <img src="/images/home/land.jpg" alt="Tokenized Land" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
             <div style={{
                 position: 'absolute',
                 bottom: 20,
                 left: 20,
                 right: 20,
                 padding: 20,
                 background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                 backdropFilter: 'blur(10px)',
                 borderRadius: 16,
                 border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.2)'}`,
                 zIndex: 1
             }}>
                 <div style={{ color: isDark ? '#fff' : '#064e3b', fontWeight: 'bold', fontSize: 18 }}>Kampala Prime Estate</div>
                 <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: 24, marginTop: 8 }}>UGX 5,000,000 / share</div>
             </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
