import { Grid, theme } from "antd";
import {
  TeamOutlined,
  GiftOutlined,
  ToolOutlined,
  ShopOutlined,
  BuildOutlined,
  RiseOutlined,
  FlagOutlined,
} from "@ant-design/icons";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const objectives = [
  {
    icon: <TeamOutlined />,
    title: "Mobilize Commercial Agriculture",
    description: "Engage households in productive farming to boost incomes.",
  },
  {
    icon: <GiftOutlined />,
    title: "Equitable Input Distribution",
    description: "Deliver seeds, livestock, and tools fairly and on time.",
  },
  {
    icon: <ToolOutlined />,
    title: "Rural Technology Upgrade",
    description: "Help smallholder farmers become small-scale industrialists.",
  },
  {
    icon: <ShopOutlined />,
    title: "Local Enterprise Growth",
    description: "Stimulate community enterprise development nationwide.",
  },
  {
    icon: <BuildOutlined />,
    title: "Rural Infrastructure",
    description: "Facilitate infrastructure development across rural areas.",
  },
  {
    icon: <RiseOutlined />,
    title: "Financial Inclusion",
    description: "Empower the 68% of Ugandans outside the money economy.",
  },
];

const phases = [
  { label: "Phase 1", title: "Mobilization", description: "Sensitize farmers and drive mindset change toward commercial agriculture." },
  { label: "Phase 2", title: "Stabilization", description: "Secure gains through policy reform and close systemic gaps." },
  { label: "Phase 3", title: "Consolidation", description: "Deepen adoption, attract investment, and build skilling institutions." },
];

export default function OWCSection() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === "dark";
  const isMobile = !screens.md;
  const isTablet = !screens.lg;

  const accent = isDark ? "#fbbf24" : "#b45309";
  const textColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.7)";

  return (
    <section
      style={{
        padding: `${token.paddingXL * 2.5}px ${token.paddingLG}px`,
        background: isDark
          ? "linear-gradient(180deg, #1a1408 0%, #0f0f0f 100%)"
          : "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)",
      }}
    >
      <div style={{ maxWidth: MAX_CONTENT_WIDTH, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: "center", marginBottom: token.marginXL * 2 }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: token.marginXS,
              padding: `${token.paddingXS}px ${token.paddingMD}px`,
              borderRadius: 50,
              marginBottom: token.marginMD,
              background: isDark ? "rgba(251, 191, 36, 0.12)" : "rgba(180, 83, 9, 0.08)",
              border: isDark ? "1px solid rgba(251, 191, 36, 0.25)" : "1px solid rgba(180, 83, 9, 0.15)",
            }}
          >
            <FlagOutlined style={{ color: accent, fontSize: 14 }} />
            <span style={{ fontSize: token.fontSizeSM, fontWeight: fontWeights.semibold, color: accent }}>
              National Programme
            </span>
          </div>

          <h2
            style={{
              fontSize: isMobile ? 28 : isTablet ? 36 : 42,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: isDark ? "#ffffff" : "#1c1917",
              marginBottom: token.marginMD,
            }}
          >
            Operation Wealth Creation
          </h2>

          <p
            style={{
              fontSize: isMobile ? 15 : 17,
              lineHeight: 1.7,
              color: textColor,
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            OG Coin builds on the successful Luwero-Rwenzori Triangle pilot supporting Civilian-Veterans.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr",
            gap: token.marginMD,
            marginBottom: token.marginXL * 2,
          }}
        >
          {objectives.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              style={{
                padding: token.paddingLG,
                borderRadius: token.borderRadiusLG,
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.8)",
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: token.marginSM,
                  fontSize: 18,
                  color: accent,
                  background: isDark ? "rgba(251, 191, 36, 0.12)" : "rgba(180, 83, 9, 0.08)",
                }}
              >
                {item.icon}
              </div>
              <div
                style={{
                  fontSize: token.fontSize,
                  fontWeight: fontWeights.semibold,
                  color: isDark ? "#ffffff" : "#1c1917",
                  marginBottom: 4,
                }}
              >
                {item.title}
              </div>
              <div style={{ fontSize: token.fontSizeSM, lineHeight: 1.5, color: textColor }}>
                {item.description}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
              gap: token.marginMD,
              marginBottom: token.marginLG,
            }}
          >
            {phases.map((phase) => (
              <div
                key={phase.label}
                style={{
                  padding: token.paddingMD,
                  borderRadius: token.borderRadius,
                  borderLeft: `3px solid ${accent}`,
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(180, 83, 9, 0.04)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {phase.label}
                </div>
                <div style={{ fontSize: token.fontSize, fontWeight: fontWeights.semibold, color: isDark ? "#fff" : "#1c1917", marginBottom: 4 }}>
                  {phase.title}
                </div>
                <div style={{ fontSize: token.fontSizeSM, lineHeight: 1.5, color: textColor }}>
                  {phase.description}
                </div>
              </div>
            ))}
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: token.fontSizeSM,
              color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
              margin: 0,
            }}
          >
            Officers deployed across all 112 districts and municipalities — distributing seeds, livestock, poultry, and mechanization equipment nationwide.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
