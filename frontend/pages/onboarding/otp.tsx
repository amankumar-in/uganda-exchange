import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button, Skeleton, message } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { fontWeights } from '@/theme/themeConfig';
import { getKycStatus, verifyAadhaarOtp, requestAadhaarOtp, ApiError } from '@/services/api/onboarding';

export default function OtpPage() {
  const router = useRouter();
  const { user } = useAuth();
  const s = useOnboardingStyles();

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [aadhaarLast4, setAadhaarLast4] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding/otp');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        if (status.status === 'APPROVED') { router.replace('/overview'); return; }
        if (!status.hasConsent) { router.replace('/onboarding'); return; }
        if (!status.hasPan) { router.replace('/onboarding/pan'); return; }
        if (status.hasAadhaar) { router.replace('/onboarding/address'); return; }
        if (!status.hasAadhaarRefId) { router.replace('/onboarding/aadhaar'); return; }
        setAadhaarLast4(status.aadhaarLast4);
        setResendCountdown(30); // 30-sec initial cooldown
      } catch {
        // stay
      } finally {
        setPageLoading(false);
      }
    })();
  }, [user, router]);

  // Resend cooldown tick
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const handleDigitChange = (idx: number, raw: string) => {
    const val = raw.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length) {
      e.preventDefault();
      const next = text.split('').concat(Array(6 - text.length).fill(''));
      setDigits(next);
      const lastFilled = Math.min(text.length, 5);
      inputsRef.current[lastFilled]?.focus();
    }
  };

  const otp = digits.join('');
  const canSubmit = otp.length === 6 && !submitting;

  const handleVerify = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await verifyAadhaarOtp(otp);
      message.success('Aadhaar verified');
      router.push('/onboarding/address');
    } catch (err) {
      message.error((err as ApiError).message || 'OTP verification failed');
      // clear OTP on failure
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    // We don't have the full Aadhaar here to re-request.
    // Send user back to aadhaar page to re-enter (keeps flow simple and secure).
    message.info('Please re-enter your Aadhaar number to resend OTP');
    router.push('/onboarding/aadhaar');
  };

  if (pageLoading) {
    return (
      <>
        <Head><title>Verify OTP · InTuition India</title></Head>
        <OnboardingLayout currentStep={3} title="OTP" subtitle="Step 3 of 6">
          <Skeleton active paragraph={{ rows: 3 }} />
        </OnboardingLayout>
      </>
    );
  }

  return (
    <>
      <Head><title>Verify OTP · InTuition India</title></Head>
      <OnboardingLayout
        currentStep={3}
        title="Enter OTP"
        subtitle={aadhaarLast4 ? `Sent to mobile linked with Aadhaar ending in ${aadhaarLast4}` : 'Sent to your registered mobile'}
        showBack
        onBack={() => router.push('/onboarding/aadhaar')}
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: s.token.marginLG, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                gap: s.isMobile ? s.token.marginXS : s.token.marginSM,
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  disabled={submitting}
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    maxWidth: s.isMobile ? 48 : 56,
                    height: s.isMobile ? 56 : 64,
                    textAlign: 'center',
                    fontSize: s.isMobile ? 22 : 28,
                    fontWeight: fontWeights.bold,
                    color: s.isDark ? s.palette.text.primary : '#1a1a2e',
                    background: s.input.background,
                    border: s.input.border,
                    borderRadius: s.token.borderRadiusLG,
                    outline: 'none',
                  }}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center', fontSize: s.token.fontSizeSM, color: s.palette.text.secondary }}>
              {resendCountdown > 0 ? (
                <>Didn&apos;t get it? Resend in {resendCountdown}s</>
              ) : (
                <Button type="link" loading={resending} onClick={handleResend} style={{ color: s.palette.indigo.light, padding: 0 }}>
                  Resend OTP
                </Button>
              )}
            </div>

            <div style={{ display: 'flex', gap: s.token.marginSM, width: '100%' }}>
              <Button size="large" onClick={() => router.push('/onboarding/aadhaar')} style={{ ...s.buttonSecondary, flex: 1 }} disabled={submitting}>
                <ArrowLeftOutlined />
              </Button>
              <Button type="primary" size="large" onClick={handleVerify} loading={submitting} disabled={!canSubmit} style={{ ...s.buttonPrimary, flex: 3 }}>
                Verify <ArrowRightOutlined />
              </Button>
            </div>
          </div>
        </motion.div>
      </OnboardingLayout>
    </>
  );
}
