import React, { useState, useRef, useCallback, useEffect, useMemo, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { theme, Grid, Form, Input, Select, Button, message } from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CameraOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  UserOutlined,
  SafetyOutlined,
  IdcardOutlined,
  EnvironmentOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { Country, State, ICountry, IState } from 'country-state-city';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/services/api/config';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type Step = 'welcome' | 'personal' | 'address' | 'doc-front' | 'doc-back' | 'selfie' | 'review' | 'verifying' | 'success';

const STEPS: Step[] = ['welcome', 'personal', 'address', 'doc-front', 'doc-back', 'selfie', 'review', 'verifying', 'success'];

const stepMeta: Record<Step, { title: string; subtitle: string; icon: string }> = {
  welcome: { title: 'Identity Verification', subtitle: 'Verify your identity to unlock all features', icon: '🛡️' },
  personal: { title: 'Personal Information', subtitle: 'Tell us about yourself', icon: '👤' },
  address: { title: 'Residential Address', subtitle: 'Where do you live?', icon: '📍' },
  'doc-front': { title: 'ID Document — Front', subtitle: 'Capture the front of your government-issued ID', icon: '📄' },
  'doc-back': { title: 'ID Document — Back', subtitle: 'Capture the back of your ID', icon: '🔄' },
  selfie: { title: 'Selfie Verification', subtitle: 'Take a clear photo of your face', icon: '📸' },
  review: { title: 'Review & Submit', subtitle: 'Confirm your information before submitting', icon: '✅' },
  verifying: { title: 'Verifying...', subtitle: 'We are checking your documents', icon: '⏳' },
  success: { title: 'Verification Complete', subtitle: 'Your identity has been verified', icon: '🎉' },
};

const colors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  gradientPrimary: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  success: '#10B981',
  gradientSuccess: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
};

// Date options
const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
  { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];
const DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, '0'), label: String(i + 1) }));
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 80 }, (_, i) => ({ value: String(currentYear - 18 - i), label: String(currentYear - 18 - i) }));

const OnboardingPageExport = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const { user, refreshUser } = useAuth();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;

  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [personalForm] = Form.useForm();
  const [addressForm] = Form.useForm();

  // Camera states
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [capturedImages, setCapturedImages] = useState<{
    docFront: string | null;
    docBack: string | null;
    selfie: string | null;
  }>({ docFront: null, docBack: null, selfie: null });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Form data
  const [formData, setFormData] = useState<{
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    country?: string;
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  }>({});
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');

  // Verification progress
  const [verifyProgress, setVerifyProgress] = useState(0);
  const [verifyLabel, setVerifyLabel] = useState('');

  const countryOptions = useMemo(() => Country.getAllCountries().map((c: ICountry) => ({
    value: c.isoCode, label: `${c.flag} ${c.name}`,
  })), []);

  const stateOptions = useMemo(() => State.getStatesOfCountry(selectedCountry).map((s: IState) => ({
    value: s.isoCode, label: s.name,
  })), [selectedCountry]);

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progressPercent = Math.round((currentStepIndex / (STEPS.length - 1)) * 100);

  // ─── Styles ──────────────────────────────────────────
  const pageBg = isDark
    ? 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)'
    : 'linear-gradient(180deg, #f8f9fc 0%, #eef1f8 100%)';
  const cardBg = isDark ? 'rgba(30, 30, 50, 0.6)' : 'rgba(255, 255, 255, 0.85)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const subtleText = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  // ─── Camera ──────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facingMode: 'user' | 'environment') => {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraUnavailable(true);
      return;
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = newStream;
      setCameraUnavailable(false);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch {
      setCameraUnavailable(true);
    }
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  useEffect(() => {
    const needsCamera = currentStep === 'doc-front' || currentStep === 'doc-back' || currentStep === 'selfie';
    if (needsCamera) {
      startCamera(currentStep === 'selfie' ? 'user' : 'environment');
    } else {
      stopCamera();
    }
    return () => { stopCamera(); };
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { return () => { stopCamera(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Navigation ──────────────────────────────────────
  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex]);
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex]);
  };

  const handlePersonalSubmit = (values: any) => {
    const monthLabel = MONTHS.find(m => m.value === values.birthMonth)?.label || values.birthMonth;
    setFormData(prev => ({
      ...prev,
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: `${monthLabel} ${parseInt(values.birthDay, 10)}, ${values.birthYear}`,
    }));
    goToNextStep();
  };

  const handleAddressSubmit = (values: any) => {
    const countryName = Country.getCountryByCode(values.country)?.name || values.country;
    const stateName = State.getStateByCodeAndCountry(values.region, values.country)?.name || values.region;
    setFormData(prev => ({
      ...prev,
      country: countryName,
      street: values.street,
      city: values.city,
      region: stateName,
      postalCode: values.postalCode,
    }));
    goToNextStep();
  };

  const handleCapture = useCallback((type: 'docFront' | 'docBack' | 'selfie') => {
    const photo = capturePhoto();
    if (photo) {
      setCapturedImages(prev => ({ ...prev, [type]: photo }));
      stopCamera();
    }
  }, [capturePhoto, stopCamera]);

  const handleRetake = useCallback((type: 'docFront' | 'docBack' | 'selfie') => {
    setCapturedImages(prev => ({ ...prev, [type]: null }));
    startCamera(type === 'selfie' ? 'user' : 'environment');
  }, [startCamera]);

  // ─── Submit verification ─────────────────────────────
  const handleSubmitVerification = async () => {
    setCurrentStep('verifying');

    const labels = [
      'Uploading documents...',
      'Verifying personal information...',
      'Checking ID authenticity...',
      'Matching selfie with ID photo...',
      'Running compliance checks...',
      'Finalizing verification...',
    ];

    for (let i = 0; i < labels.length; i++) {
      setVerifyLabel(labels[i]);
      setVerifyProgress(((i + 1) / labels.length) * 100);
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));
    }

    // Call backend dummy KYC
    try {
      const apiBase = getApiBaseUrl();
      const authToken = localStorage.getItem('authToken');
      await fetch(`${apiBase}/account/kyc/dummy-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      // Refresh user data so KYC status updates across the app
      if (refreshUser) await refreshUser();
    } catch (e) {
      console.error('Failed to verify KYC:', e);
    }

    await new Promise(r => setTimeout(r, 500));
    setCurrentStep('success');
  };

  // ─── Render: Progress bar ────────────────────────────
  const renderProgressBar = () => (
    <div style={{ width: '100%', height: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        animate={{ width: `${progressPercent}%` }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{ height: '100%', background: colors.gradientPrimary, borderRadius: 2 }}
      />
    </div>
  );

  // ─── Render: Header ──────────────────────────────────
  const renderHeader = () => {
    const meta = stepMeta[currentStep];
    const canGoBack = currentStepIndex > 0 && currentStep !== 'verifying' && currentStep !== 'success';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginMD, padding: `${token.paddingLG}px ${token.paddingLG}px ${token.paddingMD}px` }}>
        {canGoBack ? (
          <motion.div
            whileTap={{ scale: 0.9 }}
            onClick={goToPrevStep}
            style={{ cursor: 'pointer', width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeftOutlined style={{ fontSize: 16, color: token.colorText }} />
          </motion.div>
        ) : currentStep === 'welcome' ? (
          <motion.div
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            style={{ cursor: 'pointer', width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeftOutlined style={{ fontSize: 16, color: token.colorText }} />
          </motion.div>
        ) : null}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: token.colorText }}>{meta.title}</div>
          <div style={{ fontSize: token.fontSizeSM, color: subtleText }}>{meta.subtitle}</div>
        </div>
        {currentStep !== 'verifying' && currentStep !== 'success' && (
          <div style={{ fontSize: 12, color: subtleText, fontWeight: 500 }}>
            {currentStepIndex + 1}/{STEPS.length}
          </div>
        )}
      </div>
    );
  };

  // ─── Common button ───────────────────────────────────
  const PrimaryButton: React.FC<{ children: React.ReactNode; onClick: () => void; disabled?: boolean }> = ({ children, onClick, disabled }) => (
    <motion.div whileTap={disabled ? undefined : { scale: 0.97 }}>
      <Button type="primary" block size="large" disabled={disabled} onClick={onClick} style={{
        height: 56, borderRadius: 16, background: disabled ? undefined : colors.gradientPrimary,
        border: 'none', fontSize: 16, fontWeight: fontWeights.bold,
        boxShadow: disabled ? 'none' : '0 8px 24px rgba(99, 102, 241, 0.3)',
      }}>
        {children}
      </Button>
    </motion.div>
  );

  // ─── Camera step render ──────────────────────────────
  const renderCameraStep = (type: 'docFront' | 'docBack' | 'selfie') => {
    const captured = capturedImages[type];
    const isSelfie = type === 'selfie';
    return (
      <motion.div key={type} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.3 }} style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, borderRadius: 20, overflow: 'hidden', position: 'relative',
          background: isDark ? '#000' : '#1a1a2e', marginBottom: token.marginMD,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: isMobile ? 280 : 360, maxHeight: 400,
        }}>
          {captured ? (
            <img src={captured} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : cameraUnavailable ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
              <div style={{ color: '#fff', fontSize: 14 }}>Camera unavailable</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
                This is a demo — tap &quot;Skip&quot; to continue
              </div>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: isSelfie ? 'scaleX(-1)' : 'none',
            }} />
          )}
          {/* Overlay guide frame */}
          {!captured && !cameraUnavailable && (
            <div style={{
              position: 'absolute', inset: isSelfie ? '15%' : '10% 8%',
              border: '2px dashed rgba(255,255,255,0.4)', borderRadius: isSelfie ? '50%' : 12,
              pointerEvents: 'none',
            }} />
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', gap: 10, paddingBottom: token.paddingXL }}>
          {captured ? (
            <>
              <Button block size="large" onClick={() => handleRetake(type)} style={{
                height: 48, borderRadius: 14, fontWeight: fontWeights.semibold, border: `1px solid ${cardBorder}`,
              }}>
                <ReloadOutlined /> Retake
              </Button>
              <motion.div whileTap={{ scale: 0.97 }} style={{ flex: 1 }}>
                <Button type="primary" block size="large" onClick={goToNextStep} style={{
                  height: 48, borderRadius: 14, background: colors.gradientPrimary, border: 'none', fontWeight: fontWeights.bold,
                }}>
                  Continue <ArrowRightOutlined />
                </Button>
              </motion.div>
            </>
          ) : cameraUnavailable ? (
            <PrimaryButton onClick={goToNextStep}>Skip — Continue</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => handleCapture(type)}>
              <CameraOutlined style={{ marginRight: 8 }} /> Capture
            </PrimaryButton>
          )}
        </div>
      </motion.div>
    );
  };

  // ─── Step renders ────────────────────────────────────
  const renderWelcome = () => (
    <motion.div key="welcome" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }} style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: token.marginXL * 2 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          style={{
            width: 100, height: 100, borderRadius: 28, background: colors.gradientPrimary,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: token.marginLG,
            boxShadow: '0 12px 32px rgba(99, 102, 241, 0.3)',
          }}>
          <SafetyOutlined style={{ fontSize: 48, color: '#fff' }} />
        </motion.div>
        <div style={{ fontSize: 24, fontWeight: fontWeights.bold, color: token.colorText, marginBottom: 8 }}>
          Verify Your Identity
        </div>
        <div style={{ fontSize: 14, color: subtleText, maxWidth: 320, margin: '0 auto', lineHeight: 1.6 }}>
          Complete a quick verification to unlock higher deposit limits, faster payouts, and full trading access.
        </div>
      </div>

      {/* What you'll need */}
      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: token.paddingLG, marginBottom: token.marginXL }}>
        <div style={{ fontSize: 14, fontWeight: fontWeights.semibold, color: token.colorText, marginBottom: token.marginMD }}>What you&apos;ll need:</div>
        {[
          { icon: <IdcardOutlined />, label: 'A government-issued photo ID' },
          { icon: <UserOutlined />, label: 'A selfie for facial verification' },
          { icon: <EnvironmentOutlined />, label: 'Your residential address' },
        ].map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 2 ? 12 : 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary, fontSize: 16,
            }}>
              {item.icon}
            </div>
            <span style={{ fontSize: 14, color: token.colorText }}>{item.label}</span>
          </motion.div>
        ))}
      </div>

      <div style={{ fontSize: 12, textAlign: 'center', color: subtleText, marginBottom: token.marginLG }}>
        <FileProtectOutlined style={{ marginRight: 4 }} />
        Your data is encrypted and securely processed
      </div>

      <div style={{ paddingBottom: token.paddingXL }}>
        <PrimaryButton onClick={goToNextStep}>Begin Verification</PrimaryButton>
      </div>
    </motion.div>
  );

  const renderPersonal = () => (
    <motion.div key="personal" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }} style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Form form={personalForm} onFinish={handlePersonalSubmit} layout="vertical" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: token.marginMD }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="firstName" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>First Name</span>}
              rules={[{ required: true, message: 'Required' }]} style={{ flex: 1, marginBottom: 0 }}>
              <Input placeholder="John" style={{ height: 48, borderRadius: 12, fontSize: 15 }} />
            </Form.Item>
            <Form.Item name="lastName" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>Last Name</span>}
              rules={[{ required: true, message: 'Required' }]} style={{ flex: 1, marginBottom: 0 }}>
              <Input placeholder="Doe" style={{ height: 48, borderRadius: 12, fontSize: 15 }} />
            </Form.Item>
          </div>

          <div>
            <div style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12, marginBottom: 6 }}>Date of Birth</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Form.Item name="birthMonth" rules={[{ required: true, message: '' }]} style={{ flex: 2, marginBottom: 0 }}>
                <Select placeholder="Month" options={MONTHS} style={{ height: 48 }}
                  value={birthMonth || undefined} onChange={(v) => { setBirthMonth(v); personalForm.setFieldValue('birthMonth', v); }} />
              </Form.Item>
              <Form.Item name="birthDay" rules={[{ required: true, message: '' }]} style={{ flex: 1, marginBottom: 0 }}>
                <Select placeholder="Day" options={DAYS} style={{ height: 48 }}
                  value={birthDay || undefined} onChange={(v) => { setBirthDay(v); personalForm.setFieldValue('birthDay', v); }} />
              </Form.Item>
              <Form.Item name="birthYear" rules={[{ required: true, message: '' }]} style={{ flex: 1.5, marginBottom: 0 }}>
                <Select placeholder="Year" options={YEARS} style={{ height: 48 }} showSearch
                  value={birthYear || undefined} onChange={(v) => { setBirthYear(v); personalForm.setFieldValue('birthYear', v); }} />
              </Form.Item>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL, paddingTop: token.paddingLG }}>
          <PrimaryButton onClick={() => personalForm.submit()}>Continue</PrimaryButton>
        </div>
      </Form>
    </motion.div>
  );

  const renderAddress = () => (
    <motion.div key="address" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }} style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Form form={addressForm} onFinish={handleAddressSubmit} layout="vertical" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: token.marginMD }}>
          <Form.Item name="country" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>Country</span>}
            rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
            <Select showSearch placeholder="Select country" options={countryOptions} style={{ height: 48 }}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              onChange={(v) => { setSelectedCountry(v); addressForm.setFieldValue('region', undefined); }} />
          </Form.Item>
          <Form.Item name="street" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>Street Address</span>}
            rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
            <Input placeholder="123 Main Street" style={{ height: 48, borderRadius: 12, fontSize: 15 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="city" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>City</span>}
              rules={[{ required: true, message: 'Required' }]} style={{ flex: 1, marginBottom: 0 }}>
              <Input placeholder="Kampala" style={{ height: 48, borderRadius: 12, fontSize: 15 }} />
            </Form.Item>
            <Form.Item name="region" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>Region / State</span>}
              rules={[{ required: true, message: 'Required' }]} style={{ flex: 1, marginBottom: 0 }}>
              <Select showSearch placeholder="Select" options={stateOptions} style={{ height: 48 }}
                disabled={!selectedCountry} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
            </Form.Item>
          </div>
          <Form.Item name="postalCode" label={<span style={{ fontWeight: fontWeights.medium, color: subtleText, fontSize: 12 }}>Postal Code</span>}
            style={{ marginBottom: 0 }}>
            <Input placeholder="10101" style={{ height: 48, borderRadius: 12, fontSize: 15 }} />
          </Form.Item>
        </div>

        <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL, paddingTop: token.paddingLG }}>
          <PrimaryButton onClick={() => addressForm.submit()}>Continue</PrimaryButton>
        </div>
      </Form>
    </motion.div>
  );

  const renderReview = () => (
    <motion.div key="review" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }} style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: token.marginMD }}>
        {/* Personal info */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: token.paddingLG }}>
          <div style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.primary, marginBottom: 12 }}>Personal Information</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: subtleText }}>Name</span>
            <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: token.colorText }}>
              {formData.firstName} {formData.lastName}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: subtleText }}>Date of Birth</span>
            <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: token.colorText }}>{formData.dateOfBirth}</span>
          </div>
        </div>

        {/* Address */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: token.paddingLG }}>
          <div style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.primary, marginBottom: 12 }}>Address</div>
          <div style={{ fontSize: 13, color: token.colorText, lineHeight: 1.6 }}>
            {formData.street}<br />
            {formData.city}, {formData.region} {formData.postalCode}<br />
            {formData.country}
          </div>
        </div>

        {/* Documents */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: token.paddingLG }}>
          <div style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.primary, marginBottom: 12 }}>Documents</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['docFront', 'docBack', 'selfie'] as const).map(key => (
              <div key={key} style={{
                flex: 1, aspectRatio: '1', borderRadius: 12, overflow: 'hidden',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {capturedImages[key] ? (
                  <img src={capturedImages[key]!} alt={key} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <CheckCircleFilled style={{ fontSize: 20, color: colors.success }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 10, color: subtleText }}>ID Front</span>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 10, color: subtleText }}>ID Back</span>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 10, color: subtleText }}>Selfie</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL, paddingTop: token.paddingLG }}>
        <PrimaryButton onClick={handleSubmitVerification}>Submit for Verification</PrimaryButton>
      </div>
    </motion.div>
  );

  const renderVerifying = () => (
    <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: token.paddingXL, textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 100, height: 100, marginBottom: token.marginXL }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{ width: 100, height: 100, borderRadius: '50%', border: `3px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, borderTopColor: colors.primary, borderRightColor: colors.primary }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 32 }}>🔍</div>
      </div>
      <motion.div key={verifyLabel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: 16, fontWeight: fontWeights.semibold, color: token.colorText, marginBottom: 8 }}>
        {verifyLabel}
      </motion.div>
      <div style={{ fontSize: 13, color: subtleText, marginBottom: token.marginLG }}>This may take a moment</div>
      <div style={{ width: '80%', maxWidth: 300, height: 6, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${verifyProgress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ height: '100%', background: colors.gradientPrimary, borderRadius: 3 }} />
      </div>
    </motion.div>
  );

  const renderSuccess = () => (
    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: token.paddingXL, textAlign: 'center' }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        style={{
          width: 100, height: 100, borderRadius: '50%', background: colors.gradientSuccess,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: token.marginXL,
          boxShadow: '0 12px 32px rgba(16, 185, 129, 0.3)',
        }}>
        <CheckCircleFilled style={{ fontSize: 48, color: '#fff' }} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div style={{ fontSize: 24, fontWeight: fontWeights.bold, color: token.colorText, marginBottom: 8 }}>
          Identity Verified!
        </div>
        <div style={{ fontSize: 14, color: subtleText, maxWidth: 300, margin: '0 auto', lineHeight: 1.6 }}>
          Your account is now fully verified. You have access to higher deposit limits and faster payouts.
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        style={{
          background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16,
          padding: token.paddingLG, width: '100%', maxWidth: 350, marginTop: token.marginXL, marginBottom: token.marginXL,
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: subtleText }}>Status</span>
          <span style={{ fontSize: 13, fontWeight: fontWeights.bold, color: colors.success }}>✓ Verified</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: subtleText }}>Deposit Limit</span>
          <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: token.colorText }}>UGX 40,000,000</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: subtleText }}>Payouts</span>
          <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: token.colorText }}>Instant</span>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{ width: '100%', maxWidth: 350 }}>
        <PrimaryButton onClick={() => router.push('/overview')}>Go to Dashboard</PrimaryButton>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      <Head>
        <title>Identity Verification | UG Coin</title>
        <meta name="description" content="Complete your identity verification to unlock all trading features" />
      </Head>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        minHeight: isMobile ? 'calc(100vh - 120px)' : 'auto',
        padding: isMobile ? 0 : `${token.paddingLG}px 0`,
      }}>
        <div style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : 520,
          minHeight: isMobile ? 'calc(100vh - 120px)' : 600,
          background: isMobile ? 'transparent' : (isDark ? 'rgba(30, 30, 50, 0.4)' : 'rgba(255, 255, 255, 0.7)'),
          border: isMobile ? 'none' : `1px solid ${cardBorder}`,
          borderRadius: isMobile ? 0 : 24,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backdropFilter: isMobile ? 'none' : 'blur(12px)',
        }}>
          {renderProgressBar()}
          {renderHeader()}
          <AnimatePresence mode="wait">
            {currentStep === 'welcome' && renderWelcome()}
            {currentStep === 'personal' && renderPersonal()}
            {currentStep === 'address' && renderAddress()}
            {currentStep === 'doc-front' && renderCameraStep('docFront')}
            {currentStep === 'doc-back' && renderCameraStep('docBack')}
            {currentStep === 'selfie' && renderCameraStep('selfie')}
            {currentStep === 'review' && renderReview()}
            {currentStep === 'verifying' && renderVerifying()}
            {currentStep === 'success' && renderSuccess()}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

const OnboardingPage = OnboardingPageExport as any;

OnboardingPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default OnboardingPage;
