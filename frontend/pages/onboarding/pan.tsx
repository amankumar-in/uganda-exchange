import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Form, Input, Select, Button, Skeleton, message } from 'antd';
import { IdcardOutlined, UserOutlined, ArrowRightOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { fontWeights } from '@/theme/themeConfig';
import { getKycStatus, verifyPan, ApiError } from '@/services/api/onboarding';

const MONTHS = [
  { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' }, { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' }, { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' }, { value: '08', label: 'Aug' }, { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
];
const DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1) }));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 82 }, (_, i) => ({ value: String(CURRENT_YEAR - 18 - i), label: String(CURRENT_YEAR - 18 - i) }));

interface FormValues {
  pan: string;
  nameAsPerPan: string;
  birthMonth: string;
  birthDay: string;
  birthYear: string;
}

export default function PanPage() {
  const router = useRouter();
  const { user } = useAuth();
  const s = useOnboardingStyles();
  const [form] = Form.useForm<FormValues>();
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding/pan');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        if (status.status === 'APPROVED') {
          router.replace('/overview');
          return;
        }
        if (!status.hasConsent) {
          router.replace('/onboarding');
          return;
        }
        // Deliberately NOT auto-bouncing on hasPan. The user may have arrived
        // here to correct a previously verified PAN (e.g. wrong DOB combo).
        // The smart router at /onboarding handles resume-flow; this page just
        // serves the form and re-runs the verify endpoint, which will overwrite
        // the existing values atomically.
      } catch {
        // show form anyway
      } finally {
        setPageLoading(false);
      }
    })();
  }, [user, router]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const dateOfBirth = `${values.birthYear}-${values.birthMonth}-${values.birthDay}`;
      const res = await verifyPan({
        pan: values.pan.trim().toUpperCase(),
        nameAsPerPan: values.nameAsPerPan.trim(),
        dateOfBirth,
      });
      message.success(`PAN verified — ${res.fullName || 'match'}`);
      router.push('/onboarding/aadhaar');
    } catch (err) {
      message.error((err as ApiError).message || 'Could not verify PAN. Please check and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <Head><title>PAN Verification · InTuition India</title></Head>
        <OnboardingLayout currentStep={1} title="PAN Details" subtitle="Step 1 of 6">
          <Skeleton active paragraph={{ rows: 6 }} />
        </OnboardingLayout>
      </>
    );
  }

  return (
    <>
      <Head><title>PAN Verification · InTuition India</title></Head>
      <OnboardingLayout
        currentStep={1}
        title="PAN Details"
        subtitle="Verified against NSDL records"
        showBack
        onBack={() => router.push('/onboarding')}
      >
        <style>{s.formErrorCss}</style>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large" className="onboarding-form">
            <Form.Item
              name="pan"
              label={<span style={s.label}>PAN Number</span>}
              rules={[
                { required: true, message: 'Please enter your PAN' },
                { pattern: /^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, message: 'Invalid PAN (e.g. ABCDE1234F)' },
              ]}
              normalize={(v: string) => v?.toUpperCase().replace(/\s/g, '')}
              style={{ marginBottom: s.token.marginMD }}
            >
              <Input prefix={<IdcardOutlined />} placeholder="ABCDE1234F" maxLength={10} style={s.input} disabled={submitting} />
            </Form.Item>

            <Form.Item
              name="nameAsPerPan"
              label={<span style={s.label}>Name (as on PAN card)</span>}
              rules={[
                { required: true, message: 'Please enter your name' },
                { max: 120, message: 'Name too long' },
                { pattern: /^[A-Za-z\s.'-]+$/, message: 'Use letters only' },
              ]}
              style={{ marginBottom: s.token.marginMD }}
            >
              <Input prefix={<UserOutlined />} placeholder="RAHUL KUMAR SHARMA" style={s.input} disabled={submitting} />
            </Form.Item>

            <div style={{ marginBottom: s.token.marginXL }}>
              <span style={{ ...s.label, display: 'block', marginBottom: 8 }}>Date of Birth</span>
              <div style={{ display: 'flex', gap: s.token.marginSM }}>
                <Form.Item name="birthDay" rules={[{ required: true, message: 'Day' }]} style={{ flex: 1, marginBottom: 0 }}>
                  <Select placeholder="DD" options={DAYS} disabled={submitting} />
                </Form.Item>
                <Form.Item name="birthMonth" rules={[{ required: true, message: 'Month' }]} style={{ flex: 1.5, marginBottom: 0 }}>
                  <Select placeholder="Month" options={MONTHS} disabled={submitting} />
                </Form.Item>
                <Form.Item name="birthYear" rules={[{ required: true, message: 'Year' }]} style={{ flex: 1.2, marginBottom: 0 }}>
                  <Select placeholder="YYYY" options={YEARS} showSearch optionFilterProp="label" disabled={submitting} />
                </Form.Item>
              </div>
              <div style={{ ...s.hint, marginTop: s.token.marginXS }}>
                Must match your PAN record exactly · You must be 18+
              </div>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: s.token.marginSM }}>
                <Button size="large" onClick={() => router.push('/onboarding')} style={{ ...s.buttonSecondary, flex: 1 }}>
                  <ArrowLeftOutlined />
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting} style={{ ...s.buttonPrimary, flex: 3 }}>
                  Verify PAN <ArrowRightOutlined />
                </Button>
              </div>
            </Form.Item>

            <p style={{ ...s.hint, textAlign: 'center', marginTop: s.token.marginMD, fontWeight: fontWeights.medium }}>
              🔒 Your PAN is verified against NSDL and never shared
            </p>
          </Form>
        </motion.div>
      </OnboardingLayout>
    </>
  );
}
