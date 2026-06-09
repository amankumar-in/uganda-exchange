import { Button, Grid, theme } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import Link from "next/link";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

export default function CTASection() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === "dark";
  const isMobile = !screens.md;

  return (
    <section
      style={{
        padding: `${token.paddingXL * 3}px ${token.paddingLG}px`,
        position: "relative",
        overflow: "hidden",
        background: isDark
          ? `linear-gradient(180deg, #0a0a14 0%, #0f172a 50%, #1e1b4b 100%)`
          : `linear-gradient(180deg, #f8fafc 0%, #e0e7ff 50%, #c7d2fe 100%)`,
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
        {/* Glassmorphic CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          style={{
            padding: isMobile ? token.paddingXL : token.paddingXL * 2,
            borderRadius: 32,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            // Glassmorphism
            background: isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(255,255,255,0.6)",
            backdropFilter: "blur(24px)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.1)"
              : "1px solid rgba(255,255,255,0.8)",
            // Bold claymorphic shadows
            boxShadow: isDark
              ? `
                12px 12px 40px rgba(0,0,0,0.5),
                -6px -6px 24px rgba(139, 92, 246, 0.1),
                inset 4px 4px 16px rgba(255,255,255,0.05),
                inset -4px -4px 16px rgba(0,0,0,0.2)
              `
              : `
                12px 12px 40px rgba(0,0,0,0.1),
                -6px -6px 24px rgba(255,255,255,0.8),
                inset 4px 4px 16px rgba(255,255,255,0.6),
                inset -4px -4px 16px rgba(0,0,0,0.05)
              `,
          }}
        >
          {/* Inner glow */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "50%",
              borderRadius: "32px 32px 0 0",
              background: isDark
                ? "linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          {/* Content */}
          <div style={{ position: "relative", zIndex: 2 }}>
            {/* Title */}
            <h2
              style={{
                fontSize: isMobile ? 28 : 40,
                fontWeight: 800,
                marginBottom: token.marginMD,
                color: isDark ? "#ffffff" : "#0f172a",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              Ready to Start Your
              <br />
              <span
                style={{
                  background: `linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Investment Journey?
              </span>
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontSize: isMobile ? 15 : 18,
                color: isDark ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)",
                lineHeight: 1.7,
                maxWidth: 500,
                margin: "0 auto",
                marginBottom: token.marginXL,
              }}
            >
              Create your free account today and start trading premium assets
              with the most trusted exchange in Uganda.
            </p>

            {/* CTA Button - 3D Claymorphic */}
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
                    height: isMobile ? 52 : 60,
                    paddingInline: isMobile ? 32 : 48,
                    fontSize: isMobile ? 16 : 18,
                    fontWeight: fontWeights.bold,
                    borderRadius: 18,
                    border: "1px solid rgba(96, 165, 250, 0.4)",
                    background: `linear-gradient(145deg, #3b82f6 0%, #1e40af 50%, #1e3a8a 100%)`,
                    boxShadow: `
                      8px 8px 24px rgba(0,0,0,0.4),
                      -3px -3px 12px rgba(96, 165, 250, 0.25),
                      inset 3px 3px 8px rgba(255,255,255,0.2),
                      inset -3px -3px 8px rgba(0,0,0,0.25)
                    `,
                  }}
                >
                  Create Free Account
                </Button>
                {/* Shine */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 16,
                    width: 24,
                    height: 14,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
