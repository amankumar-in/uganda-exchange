import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button, Skeleton, Alert, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import SuccessAnimation from '@/components/onboarding/animations/SuccessAnimation';
import LoadingAnimation from '@/components/onboarding/animations/LoadingAnimation';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { fontWeights } from '@/theme/themeConfig';
import { getKycStatus, resetKyc, KycDecisionStatus, ApiError } from '@/services/api/onboarding';

type View = 'loading' | 'approved' | 'pending' | 'rejected' | 'error';

export default function StatusPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const s = useOnboardingStyles();

  const [view, setView] = useState<View>('loading');
  const [reason, setReason] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/onboarding/status');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        mapToView(status.status, status.rejectionReason);
      } catch {
        setView('error');
      }
    })();
  }, [user, authLoading, router]);

  const mapToView = (status: KycDecisionStatus, r: string | null) => {
    if (status === 'APPROVED') setView('approved');
    else if (status === 'REJECTED') { setView('rejected'); setReason(r); }
    else setView('pending');
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetKyc();
      await refreshUser();
      message.success('Ready to try again');
      router.push('/onboarding');
    } catch (err) {
      message.error((err as ApiError).message || 'Could not reset');
    } finally {
      setResetting(false);
    }
  };

  const renderApproved = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.token.marginLG, textAlign: 'center' }}
    >
      <SuccessAnimation size={100} />
      <div>
        <h2 style={{ ...s.titleLg, fontSize: s.isMobile ? 24 : 32 }}>You&apos;re Verified 🎉</h2>
        <p style={{ fontSize: s.token.fontSize, color: 'rgba(255,255,255,0.8)' }}>
          Full access to all trading features unlocked
        </p>
      </div>

      <div style={s.card}>
        <div style={{ fontSize: s.token.fontSizeSM, fontWeight: fontWeights.semibold, color: s.palette.text.secondary, marginBottom: s.token.marginSM }}>
          What you can do now
        </div>
        {[
          '💰 Buy & sell crypto with INR',
          '🏦 Deposit via UPI / Razorpay',
          '🤝 Trade P2P with verified users',
          '📈 Access full investor mode',
        ].map((feature, i, arr) => (
          <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: s.token.marginSM, fontSize: s.token.fontSize, color: s.palette.text.primary, marginBottom: i < arr.length - 1 ? s.token.marginXS : 0 }}>
            {feature}
          </div>
        ))}
      </div>

      <Button type="primary" size="large" block onClick={() => (window.location.href = '/overview')} style={s.buttonCta}>
        Go to Dashboard <ArrowRightOutlined />
      </Button>
    </motion.div>
  );

  const renderPending = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.token.marginLG, textAlign: 'center' }}
    >
      <LoadingAnimation size={80} text="" />
      <div>
        <h2 style={s.titleLg}>Under Review</h2>
        <p style={{ fontSize: s.token.fontSize, color: 'rgba(255,255,255,0.8)', maxWidth: 320 }}>
          A team member is reviewing your application. This is rare — we&apos;ll email you the decision shortly.
        </p>
      </div>
      <div style={{ ...s.card, display: 'flex', alignItems: 'center', gap: s.token.marginMD, justifyContent: 'center' }}>
        <ClockCircleOutlined style={{ fontSize: 24, color: s.palette.indigo.light }} />
        <span style={{ fontSize: s.token.fontSize, color: s.palette.text.primary }}>You&apos;ll receive an email when done</span>
      </div>
      <Button size="large" block icon={<ReloadOutlined />} onClick={() => window.location.reload()} style={s.buttonSecondary}>
        Refresh
      </Button>
    </motion.div>
  );

  const renderRejected = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.token.marginLG, textAlign: 'center' }}
    >
      <div
        style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <CloseCircleOutlined style={{ fontSize: 50, color: '#EF4444' }} />
      </div>
      <div>
        <h2 style={s.titleLg}>Verification Unsuccessful</h2>
        <p style={{ fontSize: s.token.fontSize, color: 'rgba(255,255,255,0.8)' }}>
          We couldn&apos;t verify your identity automatically
        </p>
      </div>
      {reason && (
        <Alert type="error" message="Reason" description={reason} showIcon style={{ width: '100%', textAlign: 'left' }} />
      )}
      <div style={s.card}>
        <div style={{ fontSize: s.token.fontSizeSM, fontWeight: fontWeights.semibold, color: s.palette.text.secondary, marginBottom: s.token.marginSM }}>
          Common issues
        </div>
        {[
          '📝 Name on PAN, Aadhaar, and what you entered must match',
          '📅 Date of birth must match exactly',
          '🪪 PAN should be linked to your Aadhaar',
          '📍 We may not yet operate in your state',
        ].map((tip, i, arr) => (
          <div key={tip} style={{ display: 'flex', alignItems: 'center', gap: s.token.marginSM, fontSize: s.token.fontSize, color: s.palette.text.primary, marginBottom: i < arr.length - 1 ? s.token.marginXS : 0 }}>
            {tip}
          </div>
        ))}
      </div>
      <div style={{ width: '100%', display: 'flex', gap: s.token.marginSM, flexDirection: s.isMobile ? 'column' : 'row' }}>
        <Button size="large" block onClick={() => (window.location.href = '/support')} style={s.buttonSecondary}>
          Contact Support
        </Button>
        <Button type="primary" size="large" block loading={resetting} onClick={handleReset} style={s.buttonPrimary}>
          <ReloadOutlined /> Try Again
        </Button>
      </div>
    </motion.div>
  );

  const renderLoading = () => (
    <div style={{ padding: s.token.paddingXL }}>
      <Skeleton active avatar={{ shape: 'circle', size: 100 }} paragraph={{ rows: 3 }} />
    </div>
  );

  const renderError = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.token.marginLG }}>
      <Alert
        type="error"
        message="Couldn't load your status"
        description="Please refresh and try again. If this keeps happening, contact support."
        showIcon
        style={{ width: '100%' }}
      />
      <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()} style={s.buttonPrimary}>
        Refresh
      </Button>
    </motion.div>
  );

  return (
    <>
      <Head><title>Verification Status · InTuition India</title></Head>
      <OnboardingLayout currentStep={6}>
        {view === 'loading' && renderLoading()}
        {view === 'approved' && renderApproved()}
        {view === 'pending' && renderPending()}
        {view === 'rejected' && renderRejected()}
        {view === 'error' && renderError()}
      </OnboardingLayout>
    </>
  );
}
