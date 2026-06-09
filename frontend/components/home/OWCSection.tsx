import { Grid, theme } from "antd";
import { motion } from "motion/react";
import { TeamOutlined, GiftOutlined, RiseOutlined } from "@ant-design/icons";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const themeColor = {
  heading: "#1e1b4b",
  headingDark: "#ffffff",
  body: "rgba(30, 27, 75, 0.8)",
  bodyDark: "rgba(255,255,255,0.8)",
  bodyMuted: "rgba(30, 27, 75, 0.75)",
  bodyMutedDark: "rgba(255,255,255,0.75)",
  gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  accent: "#667eea",
};

const features = [
  {
    icon: <TeamOutlined />,
    title: "Commercial Agriculture",
    description: "Mobilize households into productive farming.",
  },
  {
    icon: <GiftOutlined />,
    title: "Equitable Inputs",
    description: "Seeds, livestock, and tools distributed nationwide.",
  },
  {
    icon: <RiseOutlined />,
    title: "Rural Prosperity",
    description: "Reach communities across all 112 districts.",
  },
];

const highlights = [
  { value: "July 2013", label: "Programme launched" },
  { value: "112", label: "Districts covered" },
  { value: "68%", label: "Target population reached" },
];

export default function OWCSection() {
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
          ? "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)"
          : "linear-gradient(160deg, #eef2ff 0%, #e0e7ff 50%, #eef2ff 100%)",
      }}
    >
      <div style={{ maxWidth: MAX_CONTENT_WIDTH, margin: "0 auto", position: "relative", zIndex: 2 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr",
            gap: token.marginXL * 2,
            alignItems: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <h2
              style={{
                fontSize: isMobile ? 32 : isTablet ? 40 : 48,
                fontWeight: 800,
                marginBottom: token.marginLG,
                color: isDark ? themeColor.headingDark : themeColor.heading,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Building on{" "}
              <span
                style={{
                  display: "inline-block",
                  color: "transparent",
                  backgroundImage: themeColor.gradient,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Operation Wealth Creation
              </span>
            </h2>

            <p
              style={{
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.7,
                color: isDark ? themeColor.bodyDark : themeColor.body,
                marginBottom: token.marginXL,
                maxWidth: 520,
              }}
            >
              A national programme to raise household incomes by transforming subsistence farmers into commercial producers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: token.marginLG }}>
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  style={{ display: "flex", alignItems: "flex-start", gap: token.marginMD }}
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
                      background: themeColor.gradient,
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: token.fontSizeLG,
                        fontWeight: fontWeights.bold,
                        color: isDark ? themeColor.headingDark : themeColor.heading,
                        marginBottom: 4,
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      style={{
                        fontSize: token.fontSize,
                        color: isDark ? themeColor.bodyMutedDark : themeColor.bodyMuted,
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

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              height: isMobile ? 280 : 400,
              borderRadius: 24,
              background: isDark ? "rgba(255,255,255,0.05)" : "rgba(102, 126, 234, 0.1)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(102, 126, 234, 0.2)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: token.paddingXL,
            }}
          >
            <div
              style={{
                width: "100%",
                padding: token.paddingLG,
                background: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.85)",
                backdropFilter: "blur(10px)",
                borderRadius: 16,
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(102, 126, 234, 0.2)"}`,
              }}
            >
              <div
                style={{
                  fontSize: token.fontSizeSM,
                  fontWeight: fontWeights.semibold,
                  color: themeColor.accent,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: token.marginMD,
                }}
              >
                National Programme
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: token.marginMD }}>
                {highlights.map((item) => (
                  <div key={item.label}>
                    <div
                      style={{
                        fontSize: isMobile ? 24 : 28,
                        fontWeight: fontWeights.bold,
                        color: isDark ? "#fff" : themeColor.heading,
                        lineHeight: 1,
                      }}
                    >
                      {item.value}
                    </div>
                    <div
                      style={{
                        fontSize: token.fontSize,
                        color: isDark ? themeColor.bodyMutedDark : themeColor.bodyMuted,
                        marginTop: 4,
                      }}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
