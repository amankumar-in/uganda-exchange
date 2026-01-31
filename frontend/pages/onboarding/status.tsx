import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button, theme, Grid, Skeleton, Alert } from 'antd';
import { CloseCircleOutlined, ClockCircleOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import SuccessAnimation from '@/components/onboarding/animations/SuccessAnimation';
import LoadingAnimation from '@/components/onboarding/animations/LoadingAnimation';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { getKycStatus, checkVeriffDecision, KycStatus } from '@/services/api/onboarding';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type StatusType = 'loading' | 'approved' | 'pending' | 'rejected' | 'retry' | 'incomplete' | 'error';

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

export default function StatusPage() {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading: authLoading } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;

  const [status, setStatus] = useState<StatusType>('loading');
  const [kycData, setKycData] = useState<KycStatus | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    if (!user) {
      router.push('/login?redirect=/onboarding');
      return;
    }

    const checkStatus = async () => {
      try {
        const kycStatus = await getKycStatus();
        setKycData(kycStatus);

        // If already decided, show result
        if (kycStatus.status === 'APPROVED') {
          setStatus('approved');
          return;
        } else if (kycStatus.status === 'REJECTED') {
          setStatus('rejected');
          setRejectReason(kycStatus.veriffReason);
          return;
        }

        // If there's a session, check with Veriff directly before deciding what to show
        // This handles cases where webhook is delayed or didn't arrive
        if (kycStatus.hasVeriffSession) {
          try {
            const decision = await checkVeriffDecision();
            if (decision.status === 'APPROVED') {
              setStatus('approved');
              return;
            } else if (decision.status === 'REJECTED') {
              setStatus('rejected');
              setRejectReason(decision.reason);
              return;
            } else if (decision.status === 'SUBMITTED') {
              // User actually submitted, waiting for decision
              setStatus('pending');
              return;
            }
            // Still PENDING after checking - show pending, not incomplete
            // (Veriff may be processing)
            setStatus('pending');
            return;
          } catch {
            // If Veriff check fails, fall through to show based on local status
          }
        }

        // No session cases
        if (kycStatus.veriffReason && !kycStatus.hasVeriffSession) {
          // Had a retriable rejection - show retry screen with reason
          setStatus('retry');
          setRejectReason(kycStatus.veriffReason);
        } else if (kycStatus.status === 'SUBMITTED') {
          setStatus('pending');
        } else {
          router.push('/onboarding');
        }
      } catch {
        setStatus('error');
      }
    };

    checkStatus();
  }, [user, authLoading, router]);

  // Poll for updates if pending
  useEffect(() => {
    if (status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const decision = await checkVeriffDecision();
        
        if (decision.status === 'APPROVED') {
          setStatus('approved');
          clearInterval(pollInterval);
        } else if (decision.status === 'REJECTED') {
          setStatus('rejected');
          setRejectReason(decision.reason);
          clearInterval(pollInterval);
        }
      } catch {
        // Continue polling
      }
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [status]);

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
    padding: token.paddingMD,
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

  const renderApproved = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginLG, textAlign: 'center' }}
    >
      <SuccessAnimation size={100} />
      
      <div>
        <h2 style={{
          fontSize: isMobile ? 24 : 32,
          fontWeight: fontWeights.bold,
          color: '#ffffff',
          marginBottom: token.marginXS,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          You're Verified! 🎉
        </h2>
        <p style={{
          fontSize: token.fontSize,
          color: 'rgba(255,255,255,0.8)',
        }}>
          Full access to all trading features unlocked
        </p>
      </div>

      <div style={getCardStyle()}>
        <div style={{ 
          fontSize: token.fontSizeSM, 
          fontWeight: fontWeights.semibold, 
          color: 'rgba(255,255,255,0.7)',
          marginBottom: token.marginSM,
        }}>
          What you can do now:
        </div>
        {[
          '💰 Buy & sell cryptocurrencies',
          '🏦 Deposit and withdraw funds',
          '🤝 Access P2P marketplace',
          '📈 Trade with higher limits',
        ].map((feature, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginSM,
            fontSize: token.fontSize,
            color: '#ffffff',
            marginBottom: index < 3 ? token.marginXS : 0,
          }}>
            {feature}
          </div>
        ))}
      </div>

      <Button
        type="primary"
        size="large"
        block
        onClick={() => window.location.href = '/overview'}
        style={getButtonStyle()}
      >
        Go to Dashboard <ArrowRightOutlined />
      </Button>
    </motion.div>
  );

  const renderPending = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginLG, textAlign: 'center' }}
    >
      <LoadingAnimation size={80} text="" />
      
      <div>
        <h2 style={{
          fontSize: isMobile ? 22 : 28,
          fontWeight: fontWeights.bold,
          color: '#ffffff',
          marginBottom: token.marginXS,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          Verification in Progress
        </h2>
        <p style={{
          fontSize: token.fontSize,
          color: 'rgba(255,255,255,0.8)',
          maxWidth: 300,
        }}>
          We're reviewing your documents. This usually takes just a few minutes.
        </p>
      </div>

      <div style={{
        ...getCardStyle(),
        display: 'flex',
        alignItems: 'center',
        gap: token.marginMD,
        justifyContent: 'center',
      }}>
        <ClockCircleOutlined style={{ fontSize: 24, color: themeColors.light }} />
        <span style={{ fontSize: token.fontSize, color: '#ffffff' }}>
          We'll email you when it's done
        </span>
      </div>

      <Button
        size="large"
        icon={<ReloadOutlined />}
        onClick={() => window.location.reload()}
        style={getButtonStyle(false)}
      >
        Refresh Status
      </Button>
    </motion.div>
  );

  const renderRejected = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginLG, textAlign: 'center' }}
    >
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <CloseCircleOutlined style={{ fontSize: 50, color: '#EF4444' }} />
      </div>

      <div>
        <h2 style={{
          fontSize: isMobile ? 22 : 28,
          fontWeight: fontWeights.bold,
          color: '#ffffff',
          marginBottom: token.marginXS,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          Verification Unsuccessful
        </h2>
        <p style={{
          fontSize: token.fontSize,
          color: 'rgba(255,255,255,0.8)',
        }}>
          We were unable to verify your identity
        </p>
      </div>

      {rejectReason && (
        <Alert
          type="error"
          message="Reason"
          description={rejectReason}
          showIcon
          style={{ width: '100%', textAlign: 'left' }}
        />
      )}

      <div style={getCardStyle()}>
        <p style={{
          fontSize: token.fontSize,
          color: '#ffffff',
          marginBottom: 0,
        }}>
          If you believe this is an error, please contact our support team for assistance.
        </p>
      </div>

      <Button
        size="large"
        block
        onClick={() => window.location.href = '/support'}
        style={getButtonStyle(false)}
      >
        Contact Support
      </Button>
    </motion.div>
  );

  const renderIncomplete = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginLG, textAlign: 'center' }}
    >
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(251, 191, 36, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ClockCircleOutlined style={{ fontSize: 50, color: '#FBBF24' }} />
      </div>

      <div>
        <h2 style={{
          fontSize: isMobile ? 22 : 28,
          fontWeight: fontWeights.bold,
          color: '#ffffff',
          marginBottom: token.marginXS,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          Complete Your Verification
        </h2>
        <p style={{
          fontSize: token.fontSize,
          color: 'rgba(255,255,255,0.8)',
          maxWidth: 300,
        }}>
          You started the verification process but didn't finish. Please complete it to continue.
        </p>
      </div>

      <Button
        type="primary"
        size="large"
        block
        onClick={() => router.push('/onboarding/verify')}
        style={getButtonStyle()}
      >
        Continue Verification <ArrowRightOutlined />
      </Button>
    </motion.div>
  );

  const renderRetry = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginLG, textAlign: 'center' }}
    >
      <div style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(251, 191, 36, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ReloadOutlined style={{ fontSize: 50, color: '#FBBF24' }} />
      </div>

      <div>
        <h2 style={{
          fontSize: isMobile ? 22 : 28,
          fontWeight: fontWeights.bold,
          color: '#ffffff',
          marginBottom: token.marginXS,
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          Please Try Again
        </h2>
        <p style={{
          fontSize: token.fontSize,
          color: 'rgba(255,255,255,0.8)',
        }}>
          Your verification needs another attempt
        </p>
      </div>

      {rejectReason && (
        <Alert
          type="warning"
          message="What happened"
          description={rejectReason}
          showIcon
          style={{ width: '100%', textAlign: 'left' }}
        />
      )}

      <div style={getCardStyle()}>
        <div style={{
          fontSize: token.fontSizeSM,
          fontWeight: fontWeights.semibold,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: token.marginSM,
        }}>
          Tips for your next attempt:
        </div>
        {[
          '🪪 Use a valid, unexpired ID',
          '💡 Ensure good lighting',
          '📝 Make sure text is readable',
          '📱 Use a physical document, not a photo of it',
        ].map((tip, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginSM,
            fontSize: token.fontSize,
            color: '#ffffff',
            marginBottom: index < 3 ? token.marginXS : 0,
          }}>
            {tip}
          </div>
        ))}
      </div>

      <Button
        type="primary"
        size="large"
        block
        onClick={() => router.push('/onboarding/verify')}
        style={getButtonStyle()}
      >
        <ReloadOutlined /> Try Again
      </Button>
    </motion.div>
  );

  const renderLoading = () => (
    <div style={{ padding: token.paddingXL }}>
      <Skeleton active avatar={{ shape: 'circle', size: 100 }} paragraph={{ rows: 3 }} />
    </div>
  );

  const renderError = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginLG }}
    >
      <Alert
        type="error"
        message="Something went wrong"
        description="We couldn't load your verification status. Please try again."
        showIcon
        style={{ width: '100%' }}
      />
      <Button
        type="primary"
        icon={<ReloadOutlined />}
        onClick={() => window.location.reload()}
        style={getButtonStyle()}
      >
        Refresh
      </Button>
    </motion.div>
  );

  return (
    <>
      <Head>
        <title>Verification Status - InTuition Exchange</title>
        <meta name="description" content="Check your identity verification status" />
      </Head>

      <OnboardingLayout currentStep={4}>
        {status === 'loading' && renderLoading()}
        {status === 'approved' && renderApproved()}
        {status === 'pending' && renderPending()}
        {status === 'incomplete' && renderIncomplete()}
        {status === 'retry' && renderRetry()}
        {status === 'rejected' && renderRejected()}
        {status === 'error' && renderError()}
      </OnboardingLayout>
    </>
  );
}
