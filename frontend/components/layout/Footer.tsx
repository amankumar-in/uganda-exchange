import Link from "next/link";
import Image from "next/image";
import { Row, Col, Typography, Space, theme } from "antd";
import {
  TwitterOutlined,
  LinkedinOutlined,
  GithubOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { MAX_CONTENT_WIDTH } from "./Header";
import { fontWeights } from "@/theme/themeConfig";

const { Text, Title } = Typography;
const { useToken } = theme;

const footerLinks = {
  platform: {
    title: "Platform",
    links: [
      { label: "Trade", href: "/trade" },
      { label: "Markets", href: "/markets" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "P2P Trading", href: "/p2p" },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API", href: "/api" },
      { label: "Fees", href: "/fees" },
      { label: "Support", href: "/support" },
    ],
  },
  company: {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  legal: {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Disclaimer", href: "/disclaimer" },
      { label: "AML Policy", href: "/aml" },
    ],
  },
};

const socialLinks = [
  { icon: <TwitterOutlined />, href: "https://twitter.com", label: "Twitter" },
  { icon: <LinkedinOutlined />, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: <GithubOutlined />, href: "https://github.com", label: "GitHub" },
  { icon: <MailOutlined />, href: "mailto:info@intuitionexchange.com", label: "Email" },
];

export default function Footer() {
  const { token } = useToken();

  const footerStyle: React.CSSProperties = {
    backgroundColor: token.colorBgContainer,
    borderTop: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
    padding: `${token.paddingXL}px ${token.paddingLG}px ${token.paddingLG}px`,
    marginTop: "auto",
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: MAX_CONTENT_WIDTH,
    margin: "0 auto",
  };

  const linkStyle: React.CSSProperties = {
    color: token.colorTextSecondary,
    textDecoration: "none",
    fontSize: token.fontSize,
    display: "block",
    paddingBlock: token.paddingXXS,
  };

  const sectionTitleStyle: React.CSSProperties = {
    color: token.colorText,
    fontWeight: fontWeights.semibold,
    fontSize: token.fontSize,
    display: "block",
    marginBottom: token.marginMD,
  };

  const socialIconStyle: React.CSSProperties = {
    fontSize: token.fontSizeLG,
    color: token.colorTextSecondary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: token.controlHeight,
    height: token.controlHeight,
    borderRadius: token.borderRadius,
    backgroundColor: token.colorBgLayout,
  };

  const bottomBarStyle: React.CSSProperties = {
    marginTop: token.marginXL,
    paddingTop: token.paddingLG,
    borderTop: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: token.marginMD,
  };

  const linkColumnStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };

  return (
    <footer style={footerStyle}>
      <div style={containerStyle}>
        <Row gutter={[token.marginXL, token.marginLG]}>
          {/* Brand Column */}
          <Col xs={24} sm={24} md={8} lg={8}>
            <div style={{ display: "flex", flexDirection: "column", gap: token.marginMD }}>
              <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: token.marginSM }}>
                <Image
                  src="/images/intuition-logo-no-text.svg"
                  alt="InTuition Exchange"
                  width={token.controlHeight}
                  height={token.controlHeight}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <Title level={4} style={{ margin: 0, color: token.colorText }}>
                    InTuition Exchange
                  </Title>
                  <Text style={{ fontSize: token.fontSizeSM - 1, color: token.colorTextSecondary, lineHeight: 1, marginTop: -2 }}>India</Text>
                </div>
              </Link>
              <Text style={{ color: token.colorTextSecondary, display: "block", lineHeight: token.lineHeightLG }}>
                The Campus For College Coins. Trade university-issued tokens with instant
                settlement and transparent pricing.
              </Text>
              <div style={{ display: "flex", gap: token.marginSM }}>
                {socialLinks.map((social) => (
                  <Link key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">
                    <span style={socialIconStyle}>{social.icon}</span>
                  </Link>
                ))}
              </div>
            </div>
          </Col>

          {/* Link Columns */}
          {Object.values(footerLinks).map((section) => (
            <Col xs={12} sm={6} md={4} lg={4} key={section.title}>
              <div style={linkColumnStyle}>
                <Text style={sectionTitleStyle}>{section.title}</Text>
                {section.links.map((link) => (
                  <Link key={link.label} href={link.href} style={linkStyle}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </Col>
          ))}
        </Row>

        {/* Bottom Bar */}
        <div style={bottomBarStyle}>
          <Text style={{ color: token.colorTextTertiary, fontSize: token.fontSize }}>
            © {new Date().getFullYear()} InTuition Exchange. All rights reserved.
          </Text>
          <Space size="middle">
            <Link href="/privacy" style={{ color: token.colorTextSecondary, fontSize: token.fontSize, textDecoration: "none" }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ color: token.colorTextSecondary, fontSize: token.fontSize, textDecoration: "none" }}>
              Terms
            </Link>
            <Link href="/cookies" style={{ color: token.colorTextSecondary, fontSize: token.fontSize, textDecoration: "none" }}>
              Cookies
            </Link>
          </Space>
        </div>
      </div>
    </footer>
  );
}
