import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Button, Checkbox, Skeleton, message } from 'antd';
import { ArrowRightOutlined, IdcardOutlined, SafetyCertificateOutlined, ClockCircleOutlined, LockOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useAuth } from '@/context/AuthContext';
import { fontWeights } from '@/theme/themeConfig';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { getKycStatus, saveConsent, ApiError } from '@/services/api/onboarding';

// Map currentStep → onboarding route. This is the SINGLE source of truth for
// resume-flow redirects — per-page bounce-back guards have been removed so they
// can no longer create dead-ends (e.g. previously, if hasPan was true the PAN
// page bounced to /aadhaar even when the user wanted to fix a typo). The smart
// router here decides where to land based on backend state.
//
// Indices align with backend `currentStep`:
//   0 intro/consent · 1 PAN · 2 Aadhaar · 3 OTP · 4 address · 5 selfie · 6+ status
// Step 6 and 7 both land on /status — that's the terminal page, not a bug.
const STEP_ROUTES = [
  '/onboarding',
  '/onboarding/pan',
  '/onboarding/aadhaar',
  '/onboarding/otp',
  '/onboarding/address',
  '/onboarding/selfie',
  '/onboarding/status',
  '/onboarding/status',
];

const features = [
  { icon: <IdcardOutlined />, title: 'Aadhaar + PAN', desc: 'Verified directly from UIDAI & NSDL' },
  { icon: <ClockCircleOutlined />, title: '2 minutes', desc: 'Fully automated, instant decision' },
  { icon: <SafetyCertificateOutlined />, title: 'India-compliant', desc: 'Meets FIU-IND & RBI requirements' },
  { icon: <LockOutlined />, title: 'Encrypted', desc: 'We only store the last 4 digits of Aadhaar' },
];

export default function OnboardingWelcome() {
  const router = useRouter();
  const { user } = useAuth();
  const s = useOnboardingStyles();

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        if (status.status === 'APPROVED') {
          router.replace('/overview');
          return;
        }
        // Resume flow from wherever user left off
        if (status.currentStep >= 1 && status.currentStep < STEP_ROUTES.length) {
          router.replace(STEP_ROUTES[status.currentStep]);
          return;
        }
      } catch {
        // Show intro on error
      } finally {
        setPageLoading(false);
      }
    })();
  }, [user, router]);

  const handleStart = async () => {
    if (!consented) {
      message.warning('Please agree to continue');
      return;
    }
    setSubmitting(true);
    try {
      await saveConsent();
      router.push('/onboarding/pan');
    } catch (err) {
      message.error((err as ApiError).message || 'Failed to save consent');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <Head><title>Verify Your Identity · InTuition India</title></Head>
        <OnboardingLayout currentStep={0}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.token.marginLG }}>
            <Skeleton.Avatar active size={140} shape="circle" />
            <Skeleton active paragraph={{ rows: 2 }} style={{ width: '100%', maxWidth: 300 }} />
          </div>
        </OnboardingLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Verify Your Identity · InTuition India</title>
        <meta name="description" content="Complete KYC to trade on InTuition India" />
      </Head>

      <OnboardingLayout currentStep={0} title="Verify Your Identity" subtitle="Quick KYC with Aadhaar & PAN">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s.isMobile ? s.token.marginMD : s.token.marginLG }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))', marginBottom: s.token.marginSM }}
          >
            <Image src="/images/kyc-3d.png" alt="KYC" width={s.isMobile ? 120 : 160} height={s.isMobile ? 120 : 160} style={{ objectFit: 'contain' }} />
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: s.isMobile ? '1fr' : 'repeat(2, 1fr)', gap: s.token.marginSM, width: '100%' }}>
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
                style={{ ...s.card, padding: `${s.token.paddingSM}px ${s.token.paddingMD}px`, display: 'flex', alignItems: 'center', gap: s.token.marginSM }}
              >
                <div style={{ fontSize: 22, color: s.palette.text.primary, opacity: 0.8 }}>{f.icon}</div>
                <div>
                  <div style={{ fontSize: s.token.fontSize, fontWeight: fontWeights.semibold, color: s.palette.text.primary }}>{f.title}</div>
                  <div style={{ fontSize: s.token.fontSizeSM, color: s.palette.text.secondary, lineHeight: 1.3 }}>{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            style={{ width: '100%', marginTop: s.token.marginSM, display: 'flex', flexDirection: 'column', gap: s.token.marginMD }}
          >
            <label
              htmlFor="kyc-consent"
              style={{ ...s.card, display: 'flex', alignItems: 'flex-start', gap: s.token.marginSM, cursor: 'pointer', padding: s.token.paddingMD }}
            >
              <Checkbox
                id="kyc-consent"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                disabled={submitting}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: s.token.fontSizeSM, color: s.palette.text.primary, lineHeight: 1.5 }}>
                I authorise InTuition India to verify my identity using my Aadhaar & PAN via Sandbox.co.in, and I confirm
                these documents belong to me. Data is used only for KYC and stored per RBI/FIU-IND guidelines.
              </span>
            </label>

            <Button
              type="primary"
              size="large"
              block
              loading={submitting}
              disabled={!consented || submitting}
              onClick={handleStart}
              style={s.buttonCta}
            >
              Start Verification <ArrowRightOutlined />
            </Button>

            <p style={{ ...s.hint, textAlign: 'center', margin: 0 }}>
              Takes about 2 minutes · Instant decision
            </p>
          </motion.div>
        </motion.div>
      </OnboardingLayout>
    </>
  );
}
