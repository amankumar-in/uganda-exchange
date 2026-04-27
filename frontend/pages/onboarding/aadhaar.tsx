import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Form, Input, Button, Skeleton, message, Alert } from 'antd';
import { SafetyCertificateOutlined, ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { fontWeights } from '@/theme/themeConfig';
import { getKycStatus, requestAadhaarOtp, ApiError } from '@/services/api/onboarding';

interface FormValues { aadhaarNumber: string }

export default function AadhaarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const s = useOnboardingStyles();
  const [form] = Form.useForm<FormValues>();
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding/aadhaar');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        if (status.status === 'APPROVED') { router.replace('/overview'); return; }
        if (!status.hasConsent) { router.replace('/onboarding'); return; }
        if (!status.hasPan) { router.replace('/onboarding/pan'); return; }
        if (status.hasAadhaar) { router.replace('/onboarding/address'); return; }
        // Deliberately NOT auto-bouncing on hasAadhaarRefId. Backend now
        // expires ref-ids after 12 minutes so getKycStatus already reflects
        // reality; if a fresh ref-id exists the user can navigate to /otp
        // themselves. Bouncing here was the original cause of the "stuck on
        // OTP page with a dead ref-id" trap.
      } catch {
        // show form
      } finally {
        setPageLoading(false);
      }
    })();
  }, [user, router]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const aadhaar = values.aadhaarNumber.replace(/\s/g, '');
      await requestAadhaarOtp(aadhaar);
      message.success('OTP sent to your Aadhaar-linked mobile');
      router.push('/onboarding/otp');
    } catch (err) {
      message.error((err as ApiError).message || 'Could not send OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <Head><title>Aadhaar · InTuition India</title></Head>
        <OnboardingLayout currentStep={2} title="Aadhaar" subtitle="Step 2 of 6">
          <Skeleton active paragraph={{ rows: 4 }} />
        </OnboardingLayout>
      </>
    );
  }

  return (
    <>
      <Head><title>Aadhaar · InTuition India</title></Head>
      <OnboardingLayout
        currentStep={2}
        title="Aadhaar Number"
        subtitle="We'll send an OTP to your linked mobile"
        showBack
        onBack={() => router.push('/onboarding/pan')}
      >
        <style>{s.formErrorCss}</style>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large" className="onboarding-form">
            <Form.Item
              name="aadhaarNumber"
              label={<span style={s.label}>12-digit Aadhaar Number</span>}
              rules={[
                { required: true, message: 'Please enter your Aadhaar number' },
                {
                  validator: (_, val: string) => {
                    const digits = val?.replace(/\s/g, '') ?? '';
                    if (!/^\d{12}$/.test(digits)) return Promise.reject('Aadhaar must be 12 digits');
                    return Promise.resolve();
                  },
                },
              ]}
              normalize={(v: string) => {
                const digits = (v || '').replace(/\D/g, '').slice(0, 12);
                // Format as "XXXX XXXX XXXX" for readability
                return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
              }}
              style={{ marginBottom: s.token.marginLG }}
            >
              <Input
                prefix={<SafetyCertificateOutlined />}
                placeholder="XXXX XXXX XXXX"
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                style={s.input}
                disabled={submitting}
              />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              message="Your Aadhaar must be linked to a mobile number"
              description="UIDAI will send a 6-digit OTP to the mobile registered with your Aadhaar. We never store the full Aadhaar — only the last 4 digits for reference."
              style={{ marginBottom: s.token.marginLG, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
            />

            <Form.Item style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: s.token.marginSM }}>
                <Button size="large" onClick={() => router.push('/onboarding/pan')} style={{ ...s.buttonSecondary, flex: 1 }} disabled={submitting}>
                  <ArrowLeftOutlined />
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting} style={{ ...s.buttonPrimary, flex: 3 }}>
                  Send OTP <ArrowRightOutlined />
                </Button>
              </div>
            </Form.Item>

            <p style={{ ...s.hint, textAlign: 'center', marginTop: s.token.marginMD, fontWeight: fontWeights.medium }}>
              🔒 End-to-end encrypted · Powered by UIDAI via Sandbox.co.in
            </p>
          </Form>
        </motion.div>
      </OnboardingLayout>
    </>
  );
}
