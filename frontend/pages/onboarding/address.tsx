import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Form, Input, Select, Button, Skeleton, message, Alert, Row, Col } from 'antd';
import { HomeOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { State, IState } from 'country-state-city';
import { motion } from 'motion/react';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingStyles } from '@/hooks/useOnboardingStyles';
import { fontWeights } from '@/theme/themeConfig';
import { confirmAddress, getKycDetails, getKycStatus, ApiError, AddressData } from '@/services/api/onboarding';

interface FormValues extends AddressData {}

export default function AddressPage() {
  const router = useRouter();
  const { user } = useAuth();
  const s = useOnboardingStyles();
  const [form] = Form.useForm<FormValues>();
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prefilledFromAadhaar, setPrefilledFromAadhaar] = useState(false);

  const stateOptions = useMemo(
    () =>
      State.getStatesOfCountry('IN').map((st: IState) => ({
        value: st.name, // Aadhaar returns state names, not ISO codes
        label: st.name,
      })),
    [],
  );

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/onboarding/address');
      return;
    }
    (async () => {
      try {
        const status = await getKycStatus();
        if (status.status === 'APPROVED') { router.replace('/overview'); return; }
        if (!status.hasAadhaar) { router.replace('/onboarding/aadhaar'); return; }

        const details = await getKycDetails();
        if (details?.address?.street1) {
          form.setFieldsValue({
            street1: details.address.street1 || '',
            street2: details.address.street2 || '',
            city: details.address.city || '',
            region: details.address.region || '',
            postalCode: details.address.postalCode || '',
            country: details.address.country || 'IN',
          });
          setPrefilledFromAadhaar(true);
        } else {
          form.setFieldsValue({ country: 'IN' });
        }
      } catch {
        form.setFieldsValue({ country: 'IN' });
      } finally {
        setPageLoading(false);
      }
    })();
  }, [user, router, form]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await confirmAddress({
        street1: values.street1.trim(),
        street2: values.street2?.trim() || undefined,
        city: values.city.trim(),
        region: values.region.trim(),
        postalCode: values.postalCode.trim(),
        country: (values.country || 'IN').toUpperCase(),
      });
      router.push('/onboarding/selfie');
    } catch (err) {
      message.error((err as ApiError).message || 'Could not save address');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return (
      <>
        <Head><title>Address · InTuition India</title></Head>
        <OnboardingLayout currentStep={4} title="Address" subtitle="Step 4 of 6">
          <Skeleton active paragraph={{ rows: 8 }} />
        </OnboardingLayout>
      </>
    );
  }

  return (
    <>
      <Head><title>Address · InTuition India</title></Head>
      <OnboardingLayout
        currentStep={4}
        title="Confirm Address"
        subtitle={prefilledFromAadhaar ? 'Pre-filled from Aadhaar — add your flat/apartment if needed' : 'Your current residential address'}
        showBack
        onBack={() => router.push('/onboarding/otp')}
      >
        <style>{s.formErrorCss}</style>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {prefilledFromAadhaar && (
            <Alert
              type="info"
              showIcon
              message="From your Aadhaar"
              description="We pulled this from UIDAI. Check it's right, or edit anything that's different (e.g. flat/apt number)."
              style={{ marginBottom: s.token.marginMD, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}
            />
          )}
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large" className="onboarding-form">
            <Form.Item
              name="street1"
              label={<span style={s.label}>House / Street</span>}
              rules={[{ required: true, message: 'Please enter your street' }, { max: 200 }]}
              style={{ marginBottom: s.token.marginMD }}
            >
              <Input prefix={<HomeOutlined />} placeholder="123, Main Road" style={s.input} disabled={submitting} />
            </Form.Item>

            <Form.Item
              name="street2"
              label={
                <span style={s.label}>
                  Flat / Apt / Landmark <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span>
                </span>
              }
              style={{ marginBottom: s.token.marginMD }}
            >
              <Input placeholder="Flat 4B, Near Metro Station" style={s.input} disabled={submitting} />
            </Form.Item>

            <Row gutter={s.token.marginSM}>
              <Col xs={12}>
                <Form.Item
                  name="city"
                  label={<span style={s.label}>City</span>}
                  rules={[{ required: true, message: 'Required' }, { max: 100 }]}
                  style={{ marginBottom: s.token.marginMD }}
                >
                  <Input placeholder="Mumbai" style={s.input} disabled={submitting} />
                </Form.Item>
              </Col>
              <Col xs={12}>
                <Form.Item
                  name="postalCode"
                  label={<span style={s.label}>PIN Code</span>}
                  rules={[
                    { required: true, message: 'Required' },
                    { pattern: /^\d{6}$/, message: '6 digits' },
                  ]}
                  style={{ marginBottom: s.token.marginMD }}
                >
                  <Input placeholder="400001" inputMode="numeric" maxLength={6} style={s.input} disabled={submitting} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="region"
              label={<span style={s.label}>State</span>}
              rules={[{ required: true, message: 'Please select your state' }]}
              style={{ marginBottom: s.token.marginLG }}
            >
              <Select
                showSearch
                placeholder="Select state"
                options={stateOptions}
                disabled={submitting}
                filterOption={(input, option) => {
                  const label = String(option?.label ?? '');
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
              />
            </Form.Item>

            <Form.Item name="country" hidden initialValue="IN">
              <Input />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: s.token.marginSM }}>
                <Button size="large" onClick={() => router.push('/onboarding/otp')} style={{ ...s.buttonSecondary, flex: 1 }} disabled={submitting}>
                  <ArrowLeftOutlined />
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting} style={{ ...s.buttonPrimary, flex: 3 }}>
                  Continue <ArrowRightOutlined />
                </Button>
              </div>
            </Form.Item>

            <p style={{ ...s.hint, textAlign: 'center', marginTop: s.token.marginMD, fontWeight: fontWeights.medium }}>
              We only operate in select states — we&apos;ll confirm availability when you submit
            </p>
          </Form>
        </motion.div>
      </OnboardingLayout>
    </>
  );
}
