import Head from "next/head";
import Header, { HEADER_HEIGHT } from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import LandSection from "@/components/home/LandSection";
import CommoditySection from "@/components/home/CommoditySection";
import CelebritySection from "@/components/home/CelebritySection";
import EcosystemSection from "@/components/home/EcosystemSection";
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
        <title>UG Coin — The Exchange for Land, Commodities & Celebrities</title>
        <meta
          name="description"
          content="Buy and trade tokenized real estate, local commodities, and celebrity brand equity in UGX. UG Coin is Uganda's premier digital asset exchange."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div style={pageStyle}>
        <Header />
        <main style={mainStyle}>
          <HeroSection />
          <LandSection />
          <CommoditySection />
          <CelebritySection />
          <EcosystemSection />
          <FeaturesSection />
          <MarketsSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
}
