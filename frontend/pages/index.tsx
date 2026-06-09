import Head from "next/head";
import Header, { HEADER_HEIGHT } from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import CollegeCoinsSection from "@/components/home/CollegeCoinsSection";
import EcosystemSection from "@/components/home/EcosystemSection";
import LearningSection from "@/components/home/LearningSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import MarketsSection from "@/components/home/MarketsSection";
import CTASection from "@/components/home/CTASection";
import { theme } from "antd";

const { useToken } = theme;

export default function Home() {
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

  return (
    <>
      <Head>
        <title>UG Coin — Buy Crypto in INR & Trade College Coins</title>
        <meta
          name="description"
          content="Buy crypto in UGX, mine TUIT, and pay for tuition with college coins. UG Coin — Uganda's home for digital assets and campus money. Instant UGX deposits via Pesapal."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={pageStyle}>
        <Header />
        <main style={mainStyle}>
          <HeroSection />
          <CollegeCoinsSection />
          <EcosystemSection />
          <LearningSection />
          <FeaturesSection />
          <MarketsSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
}
