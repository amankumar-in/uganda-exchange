import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer';

// Bundle analyzer configuration
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
  
  // Optimize for modern browsers - don't transpile Baseline features
  // SWC minification is enabled by default in Next.js 13+
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  
  // Configure experimental features for better modern browser support
  experimental: {
    // Use modern output format
    optimizePackageImports: ["antd", "recharts", "lightweight-charts"],
  },
  
  // Next.js 16 uses Turbopack by default which handles code splitting automatically
  // The optimizePackageImports above already optimizes large libraries
  // Turbopack provides better code splitting out of the box

  async rewrites() {
    return [
      {
        source: "/intuition-financials",
        destination: "/intuition-financials/index.html",
      },
    ];
  },
  
  async redirects() {
    return [
      {
        source: '/onboarding',
        destination: '/overview',
        permanent: false,
      },
      {
        source: '/onboarding/:path*',
        destination: '/overview',
        permanent: false,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
