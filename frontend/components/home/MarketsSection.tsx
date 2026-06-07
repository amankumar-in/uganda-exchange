import { useMemo } from "react";
import Link from "next/link";
import { Grid, theme, Skeleton } from "antd";
import {
  RiseOutlined,
  FallOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { motion } from "motion/react";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";
import { useThemeMode } from "@/context/ThemeContext";
import { useExchange } from "@/context/ExchangeContext";

const { useToken } = theme;
const { useBreakpoint } = Grid;

const formatVolume = (vol: number) => {
  if (vol >= 1e9) return `UGX ${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `UGX ${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `UGX ${(vol / 1e3).toFixed(0)}K`;
  return `UGX ${vol.toFixed(0)}`;
};

const formatPrice = (price: number) => {
  return price.toLocaleString("en-UG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 1 ? 4 : 2,
  });
};

export default function MarketsSection() {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const { pairs, isLoadingPairs } = useExchange();
  const screens = useBreakpoint();
  const isDark = mode === "dark";
  const isMobile = !screens.md;
  const isTablet = !screens.lg;

  // Get top 10 USD pairs sorted by volume (using _usdVolume from context)
  const topTokens = useMemo(() => {
    const usdPairs = pairs
      .filter((p) => p.quote === "UGX")
      .sort((a, b) => (b._usdVolume || 0) - (a._usdVolume || 0))
      .slice(0, 10);
    return usdPairs;
  }, [pairs]);

  return (
    <section
      style={{
        padding: `${token.paddingXL * 3}px ${token.paddingLG}px`,
        position: "relative",
        overflow: "hidden",
        background: isDark
          ? `linear-gradient(180deg, #0a0a14 0%, #050510 50%, #0a0a14 100%)`
          : `linear-gradient(180deg, #f8fafc 0%, #eef2ff 50%, #f8fafc 100%)`,
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: token.marginXL,
            flexWrap: "wrap",
            gap: token.marginMD,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: isMobile ? 32 : isTablet ? 40 : 48,
                fontWeight: 800,
                marginBottom: token.marginXS,
                color: isDark ? "#ffffff" : "#0f172a",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Top{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Markets
              </span>
            </h2>
            <p
              style={{
                fontSize: isMobile ? 14 : 16,
                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)",
                margin: 0,
              }}
            >
              Live prices from our exchange
            </p>
          </div>
          <Link href="/markets" style={{ textDecoration: "none" }}>
            <motion.div
              whileHover={{ x: 4 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: token.colorPrimary,
                fontWeight: fontWeights.semibold,
                fontSize: token.fontSize,
              }}
            >
              View All Markets
              <ArrowRightOutlined />
            </motion.div>
          </Link>
        </motion.div>

        {/* Markets Table/Grid */}
        {isLoadingPairs ? (
          <div style={{ display: "flex", flexDirection: "column", gap: token.marginSM }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton.Button
                key={i}
                active
                block
                style={{ height: 72, borderRadius: 16 }}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              borderRadius: 24,
              overflow: "hidden",
              // Glassmorphic container
              background: isDark
                ? "rgba(255,255,255,0.03)"
                : "rgba(255,255,255,0.7)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(102, 126, 234, 0.15)"}`,
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.4)"
                : "0 8px 32px rgba(102, 126, 234, 0.1)",
            }}
          >
            {/* Table Header - Desktop only */}
            {!isMobile && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 2fr 1fr 1fr 1fr",
                  gap: token.marginMD,
                  padding: `${token.paddingSM}px ${token.paddingLG}px`,
                  borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(102, 126, 234, 0.1)"}`,
                  background: isDark
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(102, 126, 234, 0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: "center",
                  }}
                >
                  #
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Token
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: "right",
                  }}
                >
                  Price
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: "right",
                  }}
                >
                  24h
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    textAlign: "right",
                  }}
                >
                  Volume
                </div>
              </div>
            )}

            {/* Rows */}
            {topTokens.map((pair, index) => {
              const isPositive = pair.change >= 0;

              return (
                <Link
                  key={pair.baseCurrency}
                  href={`/markets/${pair.baseCurrency}`}
                  style={{ textDecoration: "none" }}
                >
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(102, 126, 234, 0.05)",
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr auto"
                        : "40px 2fr 1fr 1fr 1fr",
                      gap: isMobile ? token.marginSM : token.marginMD,
                      padding: `${token.paddingMD}px ${token.paddingLG}px`,
                      borderBottom:
                        index < topTokens.length - 1
                          ? `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(102, 126, 234, 0.08)"}`
                          : "none",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {/* Rank - Desktop only */}
                    {!isMobile && (
                      <div
                        style={{
                          fontSize: token.fontSizeSM,
                          color:
                            index < 3
                              ? token.colorPrimary
                              : isDark
                                ? "rgba(255,255,255,0.4)"
                                : "rgba(15,23,42,0.4)",
                          fontWeight: index < 3 ? fontWeights.bold : fontWeights.medium,
                          textAlign: "center",
                        }}
                      >
                        {index + 1}
                      </div>
                    )}

                    {/* Token Info */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: token.marginSM,
                        minWidth: 0,
                      }}
                    >
                      {/* Icon with claymorphic effect */}
                      <div
                        style={{
                          position: "relative",
                          width: isMobile ? 40 : 44,
                          height: isMobile ? 40 : 44,
                          borderRadius: 12,
                          background: isDark
                            ? "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)"
                            : "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                          boxShadow: isDark
                            ? `
                              4px 4px 12px rgba(0,0,0,0.4),
                              -2px -2px 8px rgba(255,255,255,0.05),
                              inset 1px 1px 4px rgba(255,255,255,0.1)
                            `
                            : `
                              4px 4px 12px rgba(0,0,0,0.08),
                              -2px -2px 8px rgba(255,255,255,0.8),
                              inset 1px 1px 4px rgba(255,255,255,0.5)
                            `,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={pair.iconUrl}
                          alt={pair.baseCurrency}
                          width={isMobile ? 28 : 32}
                          height={isMobile ? 28 : 32}
                          style={{ borderRadius: "50%" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.baseCurrency}&background=667eea&color=fff&size=64`;
                          }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: fontWeights.bold,
                            color: isDark ? "#ffffff" : "#0f172a",
                            fontSize: isMobile ? token.fontSize : token.fontSizeLG,
                          }}
                        >
                          {pair.baseCurrency}
                        </div>
                        <div
                          style={{
                            fontSize: token.fontSizeSM,
                            color: isDark
                              ? "rgba(255,255,255,0.5)"
                              : "rgba(15,23,42,0.5)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {pair.name}
                        </div>
                      </div>
                    </div>

                    {/* Mobile: Price + Change */}
                    {isMobile ? (
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontWeight: fontWeights.bold,
                            color: isDark ? "#ffffff" : "#0f172a",
                            fontSize: token.fontSize,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          ${formatPrice(pair.price)}
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontSize: token.fontSizeSM,
                            color: isPositive ? "#16C47F" : "#fc6f03",
                            fontWeight: fontWeights.semibold,
                          }}
                        >
                          {isPositive ? <RiseOutlined /> : <FallOutlined />}
                          {isPositive ? "+" : ""}
                          {pair.change.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Price */}
                        <div
                          style={{
                            fontWeight: fontWeights.semibold,
                            color: isDark ? "#ffffff" : "#0f172a",
                            fontVariantNumeric: "tabular-nums",
                            textAlign: "right",
                          }}
                        >
                          ${formatPrice(pair.price)}
                        </div>

                        {/* Change */}
                        <div style={{ textAlign: "right" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: isPositive
                                ? "rgba(22, 196, 127, 0.15)"
                                : "rgba(252, 111, 3, 0.15)",
                              color: isPositive ? "#16C47F" : "#fc6f03",
                              fontWeight: fontWeights.semibold,
                              fontSize: token.fontSizeSM,
                            }}
                          >
                            {isPositive ? <RiseOutlined /> : <FallOutlined />}
                            {isPositive ? "+" : ""}
                            {pair.change.toFixed(2)}%
                          </span>
                        </div>

                        {/* Volume */}
                        <div
                          style={{
                            color: isDark
                              ? "rgba(255,255,255,0.6)"
                              : "rgba(15,23,42,0.6)",
                            fontSize: token.fontSizeSM,
                            fontVariantNumeric: "tabular-nums",
                            textAlign: "right",
                          }}
                        >
                          {formatVolume(pair._usdVolume || 0)}
                        </div>
                      </>
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}

