import { Grid, theme } from "antd";
import { motion } from "motion/react";
import { StarOutlined, RocketOutlined, RiseOutlined } from "@ant-design/icons";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const features = [
  {
    icon: <StarOutlined />,
    title: "Brand Equity",
    description: "Invest in the tokenized brand power of Uganda's biggest stars and public figures.",
  },
  {
    icon: <RocketOutlined />,
    title: "Exclusive Perks",
    description: "Token holders gain access to VIP events, merchandise, and direct interactions.",
  },
  {
    icon: <RiseOutlined />,
    title: "Grow Together",
    description: "As the celebrity's influence and career grows, the value of their token rises.",
  },
];

export default function CelebritySection() {
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
          ? `linear-gradient(160deg, #312e81 0%, #1e1b4b 50%, #312e81 100%)`
          : `linear-gradient(160deg, #e0e7ff 0%, #c7d2fe 50%, #e0e7ff 100%)`,
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
                color: isDark ? "#ffffff" : "#312e81",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Invest In{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Celebrity Tokens
              </span>
            </h2>

            <p
              style={{
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.7,
                color: isDark ? "rgba(255,255,255,0.8)" : "rgba(49, 46, 129, 0.8)",
                marginBottom: token.marginXL,
                maxWidth: 520,
              }}
            >
              Partner with the future. Celebrity tokens allow fans and investors to own a stake in the brand power of top athletes, musicians, and public figures in Uganda.
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
                      background: `linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)`,
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: isDark ? "#ffffff" : "#312e81", marginBottom: 4 }}>
                      {feature.title}
                    </h3>
                    <p style={{ fontSize: token.fontSize, color: isDark ? "rgba(255,255,255,0.75)" : "rgba(49, 46, 129, 0.75)", margin: 0 }}>
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
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(99, 102, 241, 0.1)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(99, 102, 241, 0.2)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden"
            }}
          >
             <img src="/images/home/henry.png" alt="Henry Katabazi" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 0 }} />
             <div style={{
                 position: 'absolute',
                 bottom: 20,
                 left: 20,
                 right: 20,
                 padding: 20,
                 background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                 backdropFilter: 'blur(10px)',
                 borderRadius: 16,
                 border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(99, 102, 241, 0.2)'}`,
                 zIndex: 1
             }}>
                 <div style={{ color: isDark ? '#fff' : '#312e81', fontWeight: 'bold', fontSize: 18 }}>Henry Katabazi</div>
                 <div style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 24, marginTop: 8 }}>Market Cap: UGX 800M</div>
             </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
