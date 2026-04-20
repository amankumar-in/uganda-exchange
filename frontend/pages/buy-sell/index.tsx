import React, { useEffect, useState, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton } from 'antd';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import BuySellForm from '@/components/exchange/BuySellForm';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;

const BuySellPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { asset } = router.query;
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : true;
  
  // Get initial asset from query parameter
  const initialAsset = typeof asset === 'string' ? asset.toUpperCase() : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/buy-sell');
        return;
      }
      // Allow access regardless of KYC - banner in DashboardLayout handles notification
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  // Don't render anything while checking auth or if not logged in
  if (isLoading || !user) {
    return null;
  }

  if (pageLoading) {
    return (
      <>
        <Head>
          <title>Buy & Sell - InTuition Exchange</title>
        </Head>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 200px)',
          padding: token.paddingLG,
        }}>
          <div style={{ width: '100%', maxWidth: 420 }}>
            <Skeleton active paragraph={{ rows: 12 }} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Buy & Sell - InTuition Exchange</title>
        <meta name="description" content="Buy and sell cryptocurrency instantly with INR" />
      </Head>

      {/* Background Pattern */}
      <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
        }}>
          {/* Gradient orbs */}
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '5%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: isDark 
              ? 'radial-gradient(circle, rgba(102, 126, 234, 0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(102, 126, 234, 0.06) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '20%',
            right: '10%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: isDark 
              ? 'radial-gradient(circle, rgba(22, 196, 127, 0.06) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(22, 196, 127, 0.05) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }} />
        </div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: isMobile ? 0 : token.paddingMD,
            marginTop: isMobile ? -(token.paddingMD - 10) : 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Form Widget */}
          <div
            style={{
              width: '100%',
              maxWidth: 420,
            }}
          >
            <BuySellForm initialAsset={initialAsset} />
          </div>

          {/* Info Text - hidden on mobile since it's in the sticky footer */}
          {!isMobile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                marginTop: token.marginXL,
                textAlign: 'center',
                maxWidth: 400,
              }}
            >
              <p style={{
                fontSize: token.fontSizeSM,
                color: token.colorTextTertiary,
                lineHeight: 1.6,
                margin: 0,
              }}>
                Trade instantly using your INR balance. Market orders execute at the best available price with a 0.5% fee.
              </p>
            </motion.div>
          )}
        </motion.div>
    </>
  );
};

// Persistent layout - keeps DashboardLayout mounted across page navigations
BuySellPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default BuySellPage;
