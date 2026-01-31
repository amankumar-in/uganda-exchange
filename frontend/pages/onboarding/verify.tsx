import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button, message, theme, Alert, Grid } from 'antd';
import { CameraOutlined, IdcardOutlined, BulbOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import LoadingAnimation from '@/components/onboarding/animations/LoadingAnimation';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { createVeriffSession, checkVeriffDecision, ApiError } from '@/services/api/onboarding';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type VerifyState = 'prepare' | 'loading' | 'verifying' | 'waiting' | 'processing' | 'error';

// Theme colors
const themeColors = {
  primary: '#6366F1',
  light: '#A5B4FC',
  dark: '#4338CA',
};

// Warm palette for light mode buttons
const warmColors = {
  buttonText: '#3D2B1F',
  coral: '#E07A5F',
};

const tips = [
  { icon: <CameraOutlined />, text: 'Good lighting - find a well-lit area', emoji: '💡' },
  { icon: <IdcardOutlined />, text: 'Have your valid ID ready', emoji: '🪪' },
  { icon: <BulbOutlined />, text: 'Remove glasses & hats for selfie', emoji: '🧢' },
];

export default function VerifyPage() {
  const router = useRouter();
  const { token } = useToken();
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;
  
  const [state, setState] = useState<VerifyState>('prepare');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pollingCount, setPollingCount] = useState(0);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding');
      return;
    }
  }, [user, router]);

  // Poll for status updates when waiting or processing
  useEffect(() => {
    if (state !== 'waiting' && state !== 'processing') return;

    const pollInterval = setInterval(async () => {
      try {
        const decision = await checkVeriffDecision();

        if (decision.status === 'APPROVED') {
          clearInterval(pollInterval);
          message.success('Verification approved!');
          router.push('/onboarding/status');
        } else if (decision.status === 'REJECTED') {
          clearInterval(pollInterval);
          message.error('Verification was not successful');
          router.push('/onboarding/status');
        } else if (decision.status === 'SUBMITTED') {
          // User has submitted, switch to processing view
          setState('processing');
        } else if (pollingCount >= 60) {
          clearInterval(pollInterval);
          router.push('/onboarding/status');
        }

        setPollingCount((prev) => prev + 1);
      } catch {
        // Continue polling
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [state, pollingCount, router]);

  const startVerification = async () => {
    setState('loading');
    setErrorMessage('');

    try {
      const sessionData = await createVeriffSession();

      if (sessionData.sessionUrl) {
        // Redirect to Veriff in same tab - user will be redirected back to status page
        window.location.href = sessionData.sessionUrl;
        return;
      } else {
        try {
          const VeriffModule = await import('@veriff/js-sdk');
          const Veriff = VeriffModule.default;
          
          const veriff = Veriff({
            host: 'https://stationapi.veriff.com',
            apiKey: process.env.NEXT_PUBLIC_VERIFF_API_KEY || '704623a5-fd1c-4b51-aa07-af8af6921931',
            parentId: 'veriff-root',
            onSession: (err: Error | null) => {
              if (err) {
                console.error('Veriff session error:', err);
                setErrorMessage('Failed to start verification. Please try again.');
                setState('error');
                return;
              }
              setState('verifying');
            },
          });

          veriff.setParams({
            vendorData: user?.id || '',
          });

          veriff.mount({
            formLabel: {
              vendorData: 'User ID',
            },
          });

          const handleVeriffMessage = (event: MessageEvent) => {
            if (event.origin !== 'https://stationapi.veriff.com') return;
            const { msg } = event.data || {};
            
            if (msg === 'FINISHED') {
              setState('processing');
            } else if (msg === 'CANCELED') {
              setState('prepare');
              message.info('Verification cancelled. You can try again when ready.');
            }
          };

          window.addEventListener('message', handleVeriffMessage);
        } catch {
          setErrorMessage('Verification SDK not available. Please contact support.');
          setState('error');
        }
      }

    } catch (error) {
      const apiError = error as ApiError;
      setErrorMessage(apiError.message || 'Failed to start verification. Please try again.');
      setState('error');
    }
  };

  // Styles
  const getCardStyle = (): React.CSSProperties => ({
    background: isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(12px)',
    border: isDark
      ? '1px solid rgba(255,255,255,0.1)'
      : '1px solid rgba(255,255,255,0.3)',
    borderRadius: 16,
    padding: isMobile ? `${token.paddingSM}px ${token.paddingMD}px` : token.paddingMD,
    display: 'flex',
    alignItems: 'center',
    gap: token.marginMD,
    width: '100%',
  });

  const getButtonStyle = (primary = true): React.CSSProperties => ({
    background: primary
      ? (isDark
          ? `linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.dark} 100%)`
          : `linear-gradient(135deg, ${warmColors.coral} 0%, #C45C44 100%)`)
      : (isDark
          ? 'rgba(255,255,255,0.1)'
          : 'rgba(255,255,255,0.15)'),
    boxShadow: primary
      ? (isDark ? `0 4px 14px rgba(99, 102, 241, 0.4)` : `0 4px 14px rgba(224,122,95,0.4)`)
      : 'none',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.3)',
    borderRadius: 12,
    color: '#ffffff',
    fontWeight: fontWeights.bold,
    height: 52,
    fontSize: token.fontSizeLG,
  });

  const renderPrepare = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', gap: token.marginMD }}
    >
      {/* Tips */}
      <div style={{ 
        fontSize: token.fontSizeLG, 
        fontWeight: fontWeights.semibold, 
        color: '#ffffff',
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        marginBottom: token.marginXS,
      }}>
        Before you start
      </div>
      
      {tips.map((tip, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          style={getCardStyle()}
        >
          <span style={{ fontSize: 24 }}>{tip.emoji}</span>
          <span style={{ fontSize: token.fontSize, color: '#ffffff' }}>{tip.text}</span>
        </motion.div>
      ))}

      {/* Veriff container */}
      <div id="veriff-root" style={{ width: '100%' }} />

      {/* Buttons */}
      <div style={{ display: 'flex', gap: token.marginSM, marginTop: token.marginMD }}>
        <Button
          size="large"
          onClick={() => router.push('/onboarding/address')}
          style={{ ...getButtonStyle(false), flex: 1 }}
        >
          <ArrowLeftOutlined />
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={startVerification}
          style={{ ...getButtonStyle(), flex: 3 }}
        >
          <CameraOutlined /> Start Verification
        </Button>
      </div>

      <p style={{ 
        fontSize: token.fontSizeSM, 
        color: 'rgba(255,255,255,0.6)', 
        textAlign: 'center',
        marginTop: token.marginSM,
      }}>
        You'll take a photo of your ID and a quick selfie
      </p>
    </motion.div>
  );

  const renderLoading = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: token.paddingXL, textAlign: 'center' }}
    >
      <LoadingAnimation text="Starting verification..." />
    </motion.div>
  );

  const renderVerifying = () => (
    <div style={{ width: '100%', textAlign: 'center' }}>
      <div id="veriff-root" style={{ width: '100%', minHeight: 400 }} />
      <p style={{ fontSize: token.fontSize, color: 'rgba(255,255,255,0.7)', marginTop: token.marginLG }}>
        Complete the verification in the window above
      </p>
    </div>
  );

  const renderWaiting = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: token.paddingXL, textAlign: 'center' }}
    >
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(99, 102, 241, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        marginBottom: token.marginLG,
      }}>
        <CameraOutlined style={{ fontSize: 36, color: themeColors.light }} />
      </div>
      <h3 style={{
        fontSize: token.fontSizeLG,
        fontWeight: fontWeights.bold,
        color: '#ffffff',
        marginBottom: token.marginSM,
      }}>
        Complete in Other Tab
      </h3>
      <p style={{
        fontSize: token.fontSize,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: token.marginLG,
        maxWidth: 300,
        margin: `0 auto ${token.marginLG}px`,
      }}>
        A new tab has opened for identity verification. Complete the process there.
      </p>
      <Button
        type="text"
        onClick={() => {
          setState('prepare');
          message.info('You can restart verification when ready.');
        }}
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        I closed the tab - start over
      </Button>
    </motion.div>
  );

  const renderProcessing = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: token.paddingXL, textAlign: 'center' }}
    >
      <LoadingAnimation size={80} text="Processing your verification..." />
      <p style={{ 
        fontSize: token.fontSize, 
        color: 'rgba(255,255,255,0.7)', 
        marginTop: token.marginXL,
        maxWidth: 300,
        margin: `${token.marginXL}px auto 0`,
      }}>
        This usually takes less than a minute. You can wait here or check back later.
      </p>
      <Button
        type="link"
        onClick={() => router.push('/onboarding/status')}
        style={{ marginTop: token.marginMD, color: themeColors.light }}
      >
        Check status later →
      </Button>
    </motion.div>
  );

  const renderError = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ textAlign: 'center', padding: token.paddingLG }}
    >
      <Alert
        type="error"
        message="Verification Error"
        description={errorMessage}
        showIcon
        style={{ marginBottom: token.marginLG, textAlign: 'left' }}
      />
      <Button
        type="primary"
        icon={<ReloadOutlined />}
        onClick={() => {
          setState('prepare');
          setErrorMessage('');
        }}
        style={getButtonStyle()}
      >
        Try Again
      </Button>
    </motion.div>
  );

  return (
    <>
      <Head>
        <title>Verify Identity - InTuition Exchange</title>
        <meta name="description" content="Verify your identity with a photo ID and selfie" />
      </Head>

      <OnboardingLayout
        currentStep={3}
        title={
          state === 'processing' ? 'Processing...' :
          state === 'waiting' ? 'Verification in Progress' :
          'Identity Verification'
        }
        subtitle={
          state === 'processing' ? "We're reviewing your documents" :
          state === 'waiting' ? 'Complete verification in the other tab' :
          'Quick ID scan and selfie to verify you'
        }
        showBack={state === 'prepare'}
        onBack={() => router.push('/onboarding/address')}
      >
        {state === 'prepare' && renderPrepare()}
        {state === 'loading' && renderLoading()}
        {state === 'verifying' && renderVerifying()}
        {state === 'waiting' && renderWaiting()}
        {state === 'processing' && renderProcessing()}
        {state === 'error' && renderError()}
      </OnboardingLayout>
    </>
  );
}
