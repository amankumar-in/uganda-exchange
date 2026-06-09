import { Typography, theme } from "antd";
import {
  UserAddOutlined,
  TrophyOutlined,
  LinkOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { MAX_CONTENT_WIDTH } from "../layout/Header";
import { fontWeights } from "@/theme/themeConfig";

const { Title, Text } = Typography;
const { useToken } = theme;

const steps = [
  {
    number: "01",
    icon: <UserAddOutlined />,
    title: "Sign Up & Get Verified",
    description: "Create an account and complete KYC verification to instantly unlock the investor mode.",
  },
  {
    number: "02",
    icon: <LinkOutlined />,
    title: "Browse Premium Markets",
    description: "Explore exclusive asset classes including Real Estate, local Commodities, and Celebrity brand tokens.",
  },
  {
    number: "03",
    icon: <DollarOutlined />,
    title: "Invest & Trade",
    description: "Build your portfolio by investing in tokenized real-world assets alongside traditional cryptocurrencies using UGX.",
  },
  {
    number: "04",
    icon: <TrophyOutlined />,
    title: "Monetize Value",
    description: "Realize the value of brand power, demand, and ownership through a secure and liquid exchange platform.",
  },
];

export default function HowItWorksSection() {
  const { token } = useToken();

  const sectionStyle: React.CSSProperties = {
    padding: `${token.paddingXL * 2}px ${token.paddingLG}px`,
    backgroundColor: token.colorBgContainer,
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: MAX_CONTENT_WIDTH,
    margin: "0 auto",
  };

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: token.marginXL,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading2,
    fontWeight: fontWeights.bold,
    marginBottom: token.marginSM,
    color: token.colorText,
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    fontSize: token.fontSizeLG,
    color: token.colorTextSecondary,
    display: "block",
  };

  const stepsContainerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: token.marginLG,
  };

  const stepStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: token.marginLG,
    padding: token.paddingLG,
    borderRadius: token.borderRadiusLG,
    backgroundColor: token.colorBgLayout,
    border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
    position: "relative",
  };

  const stepNumberStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading1,
    fontWeight: fontWeights.bold,
    color: token.colorSuccess,
    lineHeight: token.lineHeightHeading1,
    minWidth: token.controlHeightLG + token.marginMD,
  };

  const stepIconStyle: React.CSSProperties = {
    width: token.controlHeightLG + token.marginXS,
    height: token.controlHeightLG + token.marginXS,
    borderRadius: token.borderRadius,
    backgroundColor: token.colorPrimary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: token.fontSizeHeading4,
    color: token.colorWhite,
    flexShrink: 0,
  };

  const stepContentStyle: React.CSSProperties = {
    flex: 1,
  };

  const stepTitleStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading5,
    fontWeight: fontWeights.semibold,
    marginBottom: token.marginXS,
    color: token.colorText,
  };

  const stepDescStyle: React.CSSProperties = {
    fontSize: token.fontSize,
    color: token.colorTextSecondary,
    lineHeight: token.lineHeightLG,
    margin: 0,
  };

  return (
    <section style={sectionStyle}>
      <div style={containerStyle}>
        {/* Section Header */}
        <div style={headerStyle}>
          <Title level={2} style={sectionTitleStyle}>
            How It Works
          </Title>
          <Text style={sectionSubtitleStyle}>
            Start trading real world assets in four simple steps
          </Text>
        </div>

        {/* Steps */}
        <div style={stepsContainerStyle}>
          {steps.map((step, index) => (
            <div key={index} style={stepStyle}>
              <span style={stepNumberStyle}>{step.number}</span>
              <div style={stepIconStyle}>{step.icon}</div>
              <div style={stepContentStyle}>
                <Title level={5} style={stepTitleStyle}>
                  {step.title}
                </Title>
                <Text style={stepDescStyle}>{step.description}</Text>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
