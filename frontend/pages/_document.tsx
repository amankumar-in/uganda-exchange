import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  const siteUrl = "https://intuitionexchange.com";
  const siteName = "InTuition Exchange";
  const siteDescription = "Learn crypto trading with virtual funds. Practice buying and selling Bitcoin, Ethereum, and more in a risk-free sandbox environment.";
  const metaImage = `${siteUrl}/images/meta-image-sandbox.jpg`;

  return (
    <Html lang="en">
      <Head>
        {/* Primary Meta Tags */}
        <meta charSet="utf-8" />
        <meta name="description" content={siteDescription} />
        <meta name="keywords" content="crypto trading, bitcoin, ethereum, learn trading, virtual trading, sandbox, practice trading, cryptocurrency education, InTuition Exchange" />
        <meta name="author" content="InTuition Exchange" />
        <meta name="robots" content="index, follow" />
        
        {/* Theme & App Colors */}
        <meta name="theme-color" content="#6366F1" />
        <meta name="msapplication-TileColor" content="#6366F1" />
        <meta name="msapplication-navbutton-color" content="#6366F1" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        
        {/* Favicon & Icons */}
        <link rel="icon" href="/images/favicon/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/images/favicon/favicon.svg" type="image/svg+xml" />
        <link rel="icon" type="image/png" sizes="96x96" href="/images/favicon/favicon-96x96.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/favicon/apple-touch-icon.png" />
        <link rel="mask-icon" href="/images/favicon/favicon.svg" color="#6366F1" />
        
        {/* PWA Manifest */}
        <link rel="manifest" href="/images/favicon/site.webmanifest" />
        
        {/* PWA Capabilities */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="InTuition" />
        <meta name="application-name" content="InTuition Exchange" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={siteName} />
        <meta property="og:description" content={siteDescription} />
        <meta property="og:image" content={metaImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="InTuition Exchange - Learn Crypto Trading" />
        <meta property="og:locale" content="en_US" />
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={siteUrl} />
        <meta name="twitter:title" content={siteName} />
        <meta name="twitter:description" content={siteDescription} />
        <meta name="twitter:image" content={metaImage} />
        <meta name="twitter:image:alt" content="InTuition Exchange - Learn Crypto Trading" />
        
        {/* iOS Splash Screens (optional - for full PWA experience) */}
        <link 
          rel="apple-touch-startup-image" 
          href="/images/favicon/web-app-manifest-512x512.png"
        />
        
        {/* Preconnect to external services */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.sandbox.intuitionexchange.com" />
        
        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="https://api.sandbox.intuitionexchange.com" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
