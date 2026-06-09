import Head from "next/head";
import { ReactNode } from "react";
import { Typography, theme } from "antd";
import Header, { HEADER_HEIGHT, MAX_CONTENT_WIDTH } from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { fontWeights } from "@/theme/themeConfig";

const { Title, Text } = Typography;
const { useToken } = theme;

interface LegalPageLayoutProps {
  title: string;
  description: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPageLayout({
  title,
  description,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  const { token } = useToken();

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: token.colorBgLayout,
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    paddingTop: HEADER_HEIGHT,
  };

  const heroStyle: React.CSSProperties = {
    padding: `${token.paddingXL * 2}px ${token.paddingLG}px ${token.paddingLG}px`,
    borderBottom: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
  };

  const heroInnerStyle: React.CSSProperties = {
    maxWidth: MAX_CONTENT_WIDTH,
    margin: "0 auto",
  };

  const bodyStyle: React.CSSProperties = {
    padding: `${token.paddingXL}px ${token.paddingLG}px ${token.paddingXL * 2}px`,
  };

  const bodyInnerStyle: React.CSSProperties = {
    maxWidth: 820,
    margin: "0 auto",
    color: token.colorText,
    fontSize: token.fontSizeLG,
    lineHeight: token.lineHeightLG,
  };

  return (
    <>
      <Head>
        <title>{`${title} — UG Coin`}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={pageStyle}>
        <Header />
        <main style={mainStyle}>
          <section style={heroStyle}>
            <div style={heroInnerStyle}>
              <Title
                level={1}
                style={{
                  margin: 0,
                  fontSize: token.fontSizeHeading2,
                  fontWeight: fontWeights.bold,
                  letterSpacing: "-0.02em",
                }}
              >
                {title}
              </Title>
              <Text
                style={{
                  display: "block",
                  marginTop: token.marginSM,
                  color: token.colorTextSecondary,
                  fontSize: token.fontSize,
                }}
              >
                Last updated: {lastUpdated} · UG Coin
              </Text>
            </div>
          </section>
          <section style={bodyStyle}>
            <article style={bodyInnerStyle} className="legal-content">
              {children}
            </article>
          </section>
        </main>
        <Footer />
      </div>
      <style jsx global>{`
        .legal-content h2 {
          font-size: ${token.fontSizeHeading3}px;
          font-weight: ${fontWeights.semibold};
          letter-spacing: -0.01em;
          margin: ${token.marginXL}px 0 ${token.marginSM}px;
          color: ${token.colorText};
        }
        .legal-content h3 {
          font-size: ${token.fontSizeHeading5}px;
          font-weight: ${fontWeights.semibold};
          margin: ${token.marginLG}px 0 ${token.marginXS}px;
          color: ${token.colorText};
        }
        .legal-content p {
          margin: 0 0 ${token.marginMD}px;
          color: ${token.colorText};
        }
        .legal-content ul,
        .legal-content ol {
          margin: 0 0 ${token.marginMD}px;
          padding-left: ${token.paddingLG}px;
          color: ${token.colorText};
        }
        .legal-content li {
          margin-bottom: ${token.marginXS}px;
        }
        .legal-content li::marker {
          color: ${token.colorTextTertiary};
        }
        .legal-content strong {
          font-weight: ${fontWeights.semibold};
          color: ${token.colorText};
        }
        .legal-content a {
          color: ${token.colorPrimary};
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .legal-content .legal-callout {
          margin: ${token.marginLG}px 0;
          padding: ${token.paddingMD}px ${token.paddingLG}px;
          background-color: ${token.colorBgContainer};
          border: ${token.lineWidth}px solid ${token.colorBorderSecondary};
          border-radius: ${token.borderRadius}px;
        }
        .legal-content .legal-callout p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </>
  );
}
