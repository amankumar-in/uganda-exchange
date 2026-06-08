import "@/styles/globals.css";
import "antd/dist/reset.css";
import { ConfigProvider, theme as antdTheme } from "antd";
import type { AppProps } from "next/app";
import type { ReactElement, ReactNode } from "react";
import type { NextPage } from "next";
import { Inter } from "next/font/google";
import Head from "next/head";
import { useEffect } from "react";
import { useRouter } from "next/router";
import themeConfig from "@/theme/themeConfig";
import { ThemeProvider, useThemeMode } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ExchangeProvider } from "@/context/ExchangeContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { LayoutProvider } from "@/context/LayoutContext";
import ErrorBoundary from "@/components/ErrorBoundary";

// Support for persistent layouts
export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

function ThemedApp({ Component, pageProps }: AppPropsWithLayout) {
  const { mode } = useThemeMode();
  const router = useRouter();
  
  // Use page-level layout if available, otherwise render page directly
  const getLayout = Component.getLayout ?? ((page) => page);

  const darkModeTokens = mode === "dark" ? {
    // Slightly colored dark background (dark navy/indigo tint)
    colorBgBase: '#0f0f1a',
    colorBgContainer: '#16162a',
    colorBgElevated: '#1e1e38',
    colorBgLayout: '#0a0a14',
  } : {};

  const themeWithAlgorithm = {
    ...themeConfig,
    algorithm: mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...themeConfig.token,
      ...darkModeTokens,
    },
  };

  // Scroll to top on route change
  useEffect(() => {
    const handleRouteChange = () => {
      // Use instant behavior to bypass smooth scrolling
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      // Also scroll document element for cross-browser support
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Handle unhandled promise rejections
  // Prevent overlay for user-friendly errors (so we can test user messages)
  // Let overlay show for unexpected errors (actual bugs)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      // Check if this is a user-friendly/expected error
      if (error && typeof error === 'object') {
        const errorMessage = (error as any).message || '';
        const isUserFriendly = 
          errorMessage.includes('Unable to process') || 
          errorMessage.includes('Please try again') ||
          errorMessage.includes('Insufficient balance') ||
          errorMessage.includes('Unable to connect') ||
          errorMessage.includes('Unable to process trade');
        
        if (isUserFriendly) {
          // Prevent overlay for user-friendly errors so we can test user messages
          // The error will be caught by try/catch and shown via message.error()
          event.preventDefault();
          if (process.env.NODE_ENV === 'development') {
            console.warn('User-friendly error (will be shown as message):', errorMessage);
          }
        }
        // Let other errors show overlay (actual bugs need debugging)
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <ConfigProvider theme={themeWithAlgorithm}>
      <Head>
        {/* Note: maximum-scale=1 prevents pinch-zoom. Users can still zoom via iOS Accessibility settings */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <title>InTuition Exchange - Sandbox</title>
      </Head>
      {getLayout(<Component {...pageProps} />)}
    </ConfigProvider>
  );
}

export default function App(props: AppPropsWithLayout) {
  return (
    <ErrorBoundary>
      <main className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <ExchangeProvider>
              <SidebarProvider>
                <LayoutProvider>
                  <ThemedApp {...props} />
                </LayoutProvider>
              </SidebarProvider>
            </ExchangeProvider>
          </AuthProvider>
        </ThemeProvider>
      </main>
    </ErrorBoundary>
  );
}
