import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { theme, Grid, Form, Input, Select, Button, message } from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CameraOutlined,
  CheckCircleFilled,
  ReloadOutlined,
  HomeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Country, State, ICountry, IState } from 'country-state-city';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';

const { useToken } = theme;
const { useBreakpoint } = Grid;

// Step types
type Step = 'welcome' | 'personal' | 'address' | 'doc-front' | 'doc-back' | 'selfie' | 'review' | 'success';

const STEPS: Step[] = ['welcome', 'personal', 'address', 'doc-front', 'doc-back', 'selfie', 'review', 'success'];

// Short captions - kids don't read!
const stepCaptions: Record<Step, string> = {
  welcome: "Identity Verification",
  personal: "Your info 👋",
  address: "Your address 🏠",
  'doc-front': "ID front 📄",
  'doc-back': "ID back 🔄",
  selfie: "Say cheese! 📸",
  review: "Almost done! 👀",
  success: "You did it!",
};

// Colors for KYC module (green theme)
const moduleColors = {
  primary: '#10B981',
  light: '#6EE7B7',
  dark: '#047857',
  accent: '#34D399',
};

// Date of Birth options
const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const DAYS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: String(i + 1),
}));

// Years from current year - 10 to current year - 100 (for practice, we allow younger ages)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 90 }, (_, i) => ({
  value: String(currentYear - 10 - i),
  label: String(currentYear - 10 - i),
}));


export default function KYC101Page() {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;

  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<'processing' | 'success'>('processing');
  const [verifyingText, setVerifyingText] = useState('');
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

  // Form data (not persisted)
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
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  
  // Date of birth selections - no default values, user must select
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  

  // Get countries and states
  const countryOptions = useMemo(() => {
    return Country.getAllCountries().map((country: ICountry) => ({
      value: country.isoCode,
      label: `${country.flag} ${country.name}`,
    }));
  }, []);

  const stateOptions = useMemo(() => {
    return State.getStatesOfCountry(selectedCountry).map((state: IState) => ({
      value: state.isoCode,
      label: state.name,
    }));
  }, [selectedCountry]);

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progressPercent = Math.round(((currentStepIndex) / (STEPS.length - 1)) * 100);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start camera helper
  const startCamera = useCallback(async (facingMode: 'user' | 'environment') => {
    // Stop any existing stream first
    stopCamera();
    
    // Check if mediaDevices is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Camera not available - mediaDevices requires HTTPS');
      setCameraUnavailable(true);
      message.warning('Camera requires HTTPS. You can tap "Skip" to continue the demo.');
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
    } catch (error) {
      console.error('Camera error:', error);
      setCameraUnavailable(true);
      message.warning('Camera not available. You can tap "Skip" to continue the demo.');
    }
  }, [stopCamera]);

  // Capture photo
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

  // Handle step camera logic
  useEffect(() => {
    const needsCamera = currentStep === 'doc-front' || currentStep === 'doc-back' || currentStep === 'selfie';
    
    if (needsCamera) {
      const facingMode = currentStep === 'selfie' ? 'user' : 'environment';
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const goToNextStep = (loadingText?: string) => {
    const proceed = () => {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < STEPS.length) {
        setCurrentStep(STEPS[nextIndex]);
      }
    };

    if (loadingText) {
      setIsVerifying(true);
      setVerifyStatus('processing');
      setVerifyingText(loadingText);
      setTimeout(() => {
        setVerifyStatus('success');
        setVerifyingText('Verified successfully');
        setTimeout(() => {
          setIsVerifying(false);
          proceed();
        }, 1200); // Wait in success state before continuing
      }, 2000); // Processing duration
    } else {
      proceed();
    }
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handlePersonalSubmit = (values: { firstName: string; lastName: string; birthMonth: string; birthDay: string; birthYear: string }) => {
    const monthName = MONTHS.find(m => m.value === values.birthMonth)?.label || values.birthMonth;
    const day = parseInt(values.birthDay, 10);
    setFormData(prev => ({
      ...prev,
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: `${monthName} ${day}, ${values.birthYear}`,
    }));
    goToNextStep('Verifying personal details...');
  };

  const handleAddressSubmit = (values: { country: string; street: string; city: string; region: string; postalCode: string }) => {
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
    goToNextStep('Validating address format...');
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
    const facingMode = type === 'selfie' ? 'user' : 'environment';
    startCamera(facingMode);
  }, [startCamera]);

  // Claymorphic styles
  const getCardStyle = (isActive = true): React.CSSProperties => ({
    background: isDark
      ? `linear-gradient(145deg, ${moduleColors.primary}30 0%, ${moduleColors.dark}40 100%)`
      : `linear-gradient(135deg, ${moduleColors.light}50 0%, ${moduleColors.primary}40 35%, ${moduleColors.dark}30 100%)`,
    boxShadow: isDark
      ? `
        6px 6px 16px rgba(0,0,0,0.5),
        -3px -3px 10px ${moduleColors.primary}20,
        inset 2px 2px 6px ${moduleColors.primary}30,
        inset -2px -2px 6px rgba(0,0,0,0.3)
      `
      : `
        10px 10px 30px ${moduleColors.dark}40,
        -6px -6px 20px rgba(255,255,255,0.7),
        inset 4px 4px 12px rgba(255,255,255,0.35),
        inset -4px -4px 12px ${moduleColors.dark}30
      `,
    border: isDark
      ? `1px solid ${moduleColors.primary}40`
      : `1px solid rgba(255,255,255,0.5)`,
    borderRadius: 24,
    padding: isMobile ? token.paddingLG : token.paddingXL,
    opacity: isActive ? 1 : 0.7,
  });

  const getButtonStyle = (primary = true): React.CSSProperties => ({
    background: primary
      ? `linear-gradient(135deg, ${moduleColors.primary} 0%, ${moduleColors.dark} 100%)`
      : isDark
        ? 'linear-gradient(145deg, #3a3a45 0%, #2a2a35 100%)'
        : 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)',
    boxShadow: isDark
      ? `
        4px 4px 10px rgba(0,0,0,0.4),
        -2px -2px 6px ${moduleColors.primary}20,
        inset 2px 2px 4px rgba(255,255,255,0.1),
        inset -2px -2px 4px rgba(0,0,0,0.2)
      `
      : `
        6px 6px 14px ${moduleColors.dark}40,
        -3px -3px 10px rgba(255,255,255,0.8),
        inset 3px 3px 6px rgba(255,255,255,0.5),
        inset -3px -3px 6px rgba(0,0,0,0.1)
      `,
    border: 'none',
    borderRadius: 16,
    color: primary ? '#ffffff' : isDark ? '#ffffff' : moduleColors.dark,
    fontWeight: fontWeights.bold,
    height: 52,
    fontSize: token.fontSizeLG,
  });

  const getInputStyle = (): React.CSSProperties => ({
    background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
    borderRadius: 12,
    height: 48,
    fontSize: token.fontSize,
  });

  // Render steps
  const renderWelcome = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{ textAlign: 'center', padding: `0 ${token.paddingMD}px ${token.paddingMD}px` }}
    >
      {/* Big hero image */}
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        style={{
          marginBottom: token.marginMD,
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))',
        }}
      >
        <Image
          src="/images/kyc-3d.png"
          alt="KYC"
          width={180}
          height={180}
          style={{ objectFit: 'contain' }}
        />
      </motion.div>

      {/* Child-friendly intro */}
      <div style={{
        marginBottom: token.marginLG,
        padding: `${token.paddingMD}px`,
        background: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
        backdropFilter: 'blur(8px)',
      }}>
        <p style={{
          fontSize: isMobile ? 15 : 16,
          color: '#ffffff',
          margin: 0,
          lineHeight: 1.6,
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          <strong>Identity Verification Required</strong><br />
          Please complete this quick verification process to unlock higher deposit limits and faster payouts. Your data is encrypted and securely stored.
        </p>
      </div>

      {/* Simple icons showing steps */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: token.marginMD,
        marginBottom: token.marginLG,
        fontSize: 28,
      }}>
        <span>✏️</span>
        <span style={{ color: '#ffffff', opacity: 0.6, fontSize: 20 }}>→</span>
        <span>📄</span>
        <span style={{ color: '#ffffff', opacity: 0.6, fontSize: 20 }}>→</span>
        <span>📷</span>
        <span style={{ color: '#ffffff', opacity: 0.6, fontSize: 20 }}>→</span>
        <span>✅</span>
      </div>

      <Button
        type="primary"
        size="large"
        onClick={() => goToNextStep()}
        style={getButtonStyle()}
        block
      >
        Let&apos;s Go! <ArrowRightOutlined />
      </Button>
    </motion.div>
  );

  // Form error styles for visibility - different for dark/light mode
  const formErrorStyles = isDark 
    ? `
      .kyc-form .ant-form-item-explain-error {
        color: #FCA5A5 !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        font-weight: 600;
      }
      .kyc-form .ant-form-item-has-error .ant-input,
      .kyc-form .ant-form-item-has-error .ant-picker,
      .kyc-form .ant-form-item-has-error .ant-select-selector {
        border-color: #FCA5A5 !important;
      }
    `
    : `
      .kyc-form .ant-form-item-explain-error {
        color: #FFE066 !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        font-weight: 600;
      }
      .kyc-form .ant-form-item-has-error .ant-input,
      .kyc-form .ant-form-item-has-error .ant-picker,
      .kyc-form .ant-form-item-has-error .ant-select-selector {
        border-color: #FFE066 !important;
      }
    `;

  const renderPersonal = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      {isVerifying ? (
        <div style={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            initial={{ x: -100, opacity: 0, rotate: -10 }}
            animate={{ x: 0, opacity: 1, rotate: 0 }}
            style={{
               width: 240, height: 150, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
               borderRadius: 16, padding: 16, position: 'relative',
               boxShadow: '0 8px 32px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)'
            }}
          >
             <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', marginBottom: 16 }} />
             <div style={{ width: '80%', height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 6, marginBottom: 8 }} />
             <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 6 }} />
             
             {verifyStatus === 'success' && (
               <motion.div
                 initial={{ scale: 3, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ type: 'spring', stiffness: 300, damping: 10 }}
                 style={{
                    position: 'absolute', top: 20, right: 20, 
                    border: '4px solid #10B981', color: '#10B981', 
                    padding: '4px 8px', borderRadius: 8, fontWeight: 'bold',
                    transform: 'rotate(15deg)', fontSize: 20,
                    boxShadow: '0 0 10px rgba(16,185,129,0.3)'
                 }}
               >
                 VERIFIED
               </motion.div>
             )}
          </motion.div>
          <motion.h3 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ marginTop: 32, fontSize: 20, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {verifyingText}
          </motion.h3>
        </div>
      ) : (
        <>
          <style>{formErrorStyles}</style>
      <Form
        form={personalForm}
        layout="vertical"
        onFinish={handlePersonalSubmit}
        requiredMark={false}
        className="kyc-form"
      >
        <Form.Item
          name="firstName"
          label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>First Name</span>}
          rules={[{ required: true, message: 'Enter any name!' }]}
        >
          <Input
            prefix={<UserOutlined style={{ color: token.colorTextSecondary }} />}
            placeholder="e.g., Alex"
            style={getInputStyle()}
          />
        </Form.Item>

        <Form.Item
          name="lastName"
          label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Last Name</span>}
          rules={[{ required: true, message: 'Enter any name!' }]}
        >
          <Input
            placeholder="e.g., Johnson"
            style={getInputStyle()}
          />
        </Form.Item>

        {/* Date of Birth - 3 separate dropdowns */}
        <div style={{ marginBottom: token.marginMD }}>
          <span style={{ 
            color: '#fff', 
            fontWeight: fontWeights.medium, 
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            display: 'block',
            marginBottom: 8,
          }}>
            Date of Birth
          </span>
          <div style={{ display: 'flex', gap: token.marginSM }}>
            {/* Month */}
            <Form.Item
              name="birthMonth"
              rules={[{ required: true, message: 'Month!', validator: (_, value) => value ? Promise.resolve() : Promise.reject('Month!') }]}
              style={{ flex: 1.5, marginBottom: 0 }}
            >
              {isMobile ? (
                <select
                  style={{
                    ...getInputStyle(),
                    width: '100%',
                    padding: '0 12px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    color: birthMonth ? undefined : token.colorTextPlaceholder,
                  }}
                  value={birthMonth}
                  onChange={(e) => {
                    personalForm.setFieldsValue({ birthMonth: e.target.value });
                    setBirthMonth(e.target.value);
                  }}
                >
                  <option value="">Month</option>
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              ) : (
                <Select
                  placeholder="Month"
                  options={MONTHS}
                  style={getInputStyle()}
                />
              )}
            </Form.Item>

            {/* Day */}
            <Form.Item
              name="birthDay"
              rules={[{ required: true, message: 'Day!', validator: (_, value) => value ? Promise.resolve() : Promise.reject('Day!') }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              {isMobile ? (
                <select
                  style={{
                    ...getInputStyle(),
                    width: '100%',
                    padding: '0 12px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    color: birthDay ? undefined : token.colorTextPlaceholder,
                  }}
                  value={birthDay}
                  onChange={(e) => {
                    personalForm.setFieldsValue({ birthDay: e.target.value });
                    setBirthDay(e.target.value);
                  }}
                >
                  <option value="">Day</option>
                  {DAYS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              ) : (
                <Select
                  placeholder="Day"
                  options={DAYS}
                  style={getInputStyle()}
                />
              )}
            </Form.Item>

            {/* Year */}
            <Form.Item
              name="birthYear"
              rules={[{ required: true, message: 'Year!', validator: (_, value) => value ? Promise.resolve() : Promise.reject('Year!') }]}
              style={{ flex: 1.2, marginBottom: 0 }}
            >
              {isMobile ? (
                <select
                  style={{
                    ...getInputStyle(),
                    width: '100%',
                    padding: '0 12px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    color: birthYear ? undefined : token.colorTextPlaceholder,
                  }}
                  value={birthYear}
                  onChange={(e) => {
                    personalForm.setFieldsValue({ birthYear: e.target.value });
                    setBirthYear(e.target.value);
                  }}
                >
                  <option value="">Year</option>
                  {YEARS.map(y => (
                    <option key={y.value} value={y.value}>{y.label}</option>
                  ))}
                </select>
              ) : (
                <Select
                  placeholder="Year"
                  options={YEARS}
                  style={getInputStyle()}
                  showSearch
                  optionFilterProp="label"
                />
              )}
            </Form.Item>
          </div>
        </div>

        <div style={{ display: 'flex', gap: token.marginMD, marginTop: token.marginXL }}>
          <Button
            size="large"
            onClick={goToPrevStep}
            style={{ ...getButtonStyle(false), flex: 1 }}
          >
            <ArrowLeftOutlined /> Back
          </Button>
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            style={{ ...getButtonStyle(), flex: 2 }}
          >
            Continue <ArrowRightOutlined />
          </Button>
        </div>
      </Form>
      </>
      )}
    </motion.div>
  );

  const renderAddress = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      {isVerifying ? (
        <div style={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            initial={{ scale: 0, y: -50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            style={{ width: 100, height: 100, position: 'relative' }}
          >
            {verifyStatus === 'processing' ? (
               <div style={{ fontSize: 60, textAlign: 'center', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>📍</div>
            ) : (
               <div style={{ width: 80, height: 80, margin: '0 auto', borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16,185,129,0.5)' }}>
                  <CheckCircleFilled style={{ fontSize: 50, color: '#fff' }} />
               </div>
            )}
            
            {verifyStatus === 'processing' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  position: 'absolute', bottom: -10, left: '50%', marginLeft: -20,
                  width: 40, height: 10, borderRadius: '50%', background: 'rgba(16,185,129,0.5)'
                }}
              />
            )}
          </motion.div>
          <motion.h3 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ marginTop: 32, fontSize: 20, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {verifyingText}
          </motion.h3>
        </div>
      ) : (
        <>
          <style>{formErrorStyles}</style>
      <Form
        form={addressForm}
        layout="vertical"
        onFinish={handleAddressSubmit}
        requiredMark={false}
        initialValues={{  }}
        className="kyc-form"
      >
        <Form.Item
          name="country"
          label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Country</span>}
          rules={[{ required: true, validator: (_, value) => value ? Promise.resolve() : Promise.reject('Select country!') }]}
        >
          {isMobile ? (
            <select
              style={{
                ...getInputStyle(),
                width: '100%',
                padding: '0 12px',
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                cursor: 'pointer',
                color: selectedCountry ? undefined : token.colorTextPlaceholder,
              }}
              value={selectedCountry}
              onChange={(e) => {
                addressForm.setFieldsValue({ country: e.target.value, region: undefined });
                setSelectedCountry(e.target.value);
                setSelectedRegion('');
              }}
            >
              <option value="">Select Country</option>
              {countryOptions.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <Select
              showSearch
              options={countryOptions}
              onChange={(val) => setSelectedCountry(val)}
              style={getInputStyle()}
              optionFilterProp="label"
              placeholder="Select Country"
            />
          )}
        </Form.Item>

        <Form.Item
          name="street"
          label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Street Address</span>}
          rules={[{ required: true, message: 'Enter any address!' }]}
        >
          <Input
            prefix={<HomeOutlined style={{ color: token.colorTextSecondary }} />}
            placeholder="e.g., 123 Main Street"
            style={getInputStyle()}
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: token.marginSM }}>
          <Form.Item
            name="city"
            label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>City</span>}
            rules={[{ required: true }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="City" style={getInputStyle()} />
          </Form.Item>

          <Form.Item
            name="region"
            label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>State</span>}
            rules={[{ required: true, validator: (_, value) => value ? Promise.resolve() : Promise.reject('State!') }]}
            style={{ flex: 1 }}
          >
            {stateOptions.length > 0 ? (
              isMobile ? (
                <select
                  style={{
                    ...getInputStyle(),
                    width: '100%',
                    padding: '0 12px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: 'pointer',
                    color: selectedRegion ? undefined : token.colorTextPlaceholder,
                  }}
                  value={selectedRegion}
                  onChange={(e) => {
                    addressForm.setFieldsValue({ region: e.target.value });
                    setSelectedRegion(e.target.value);
                  }}
                >
                  <option value="">Select</option>
                  {stateOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <Select
                  showSearch
                  options={stateOptions}
                  style={getInputStyle()}
                  optionFilterProp="label"
                  placeholder="Select"
                />
              )
            ) : (
              <Input placeholder="Region" style={getInputStyle()} />
            )}
          </Form.Item>
        </div>

        <Form.Item
          name="postalCode"
          label={<span style={{ color: '#fff', fontWeight: fontWeights.medium, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>ZIP / Postal Code</span>}
          rules={[{ required: true }]}
        >
          <Input placeholder="12345" style={{ ...getInputStyle(), maxWidth: 150 }} />
        </Form.Item>

        <div style={{ display: 'flex', gap: token.marginMD, marginTop: token.marginLG }}>
          <Button
            size="large"
            onClick={goToPrevStep}
            style={{ ...getButtonStyle(false), flex: 1 }}
          >
            <ArrowLeftOutlined /> Back
          </Button>
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            style={{ ...getButtonStyle(), flex: 2 }}
          >
            Continue <ArrowRightOutlined />
          </Button>
        </div>
      </Form>
      </>
      )}
    </motion.div>
  );

  const renderCamera = (type: 'docFront' | 'docBack' | 'selfie') => {
    const captured = capturedImages[type];
    const isDocument = type !== 'selfie';
    
    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        style={{ textAlign: 'center' }}
      >
        {/* Camera/Preview area */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: isDocument ? 400 : 280,
          margin: '0 auto',
          aspectRatio: isDocument ? '1.6' : '1',
          borderRadius: isDocument ? 20 : '50%',
          overflow: 'hidden',
          background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)',
          boxShadow: isDark
            ? 'inset 4px 4px 10px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(255,255,255,0.05)'
            : 'inset 4px 4px 10px rgba(0,0,0,0.15), inset -2px -2px 6px rgba(255,255,255,0.5)',
          marginBottom: token.marginLG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {captured ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={captured}
                alt="Captured"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              
              {/* Contextual Animation Overlay */}
              {isVerifying && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: isDocument ? 20 : '50%' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
                  
                  {isDocument ? (
                    verifyStatus === 'processing' ? (
                      <motion.div
                        initial={{ top: '0%' }}
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          height: 4,
                          background: '#10B981',
                          boxShadow: '0 0 15px 4px rgba(16,185,129,0.8)',
                        }}
                      />
                    ) : (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 15 }}
                        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16,185,129,0.5)' }}>
                          <CheckCircleFilled style={{ fontSize: 50, color: '#fff' }} />
                        </div>
                      </motion.div>
                    )
                  ) : (
                    verifyStatus === 'processing' ? (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <motion.div
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 1.1, opacity: 1 }}
                            transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                            style={{
                              width: '60%',
                              height: '60%',
                              border: '2px solid rgba(16,185,129,0.6)',
                              borderRadius: 20,
                              position: 'relative'
                            }}
                         >
                           <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '4px solid #10B981', borderLeft: '4px solid #10B981' }} />
                           <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '4px solid #10B981', borderRight: '4px solid #10B981' }} />
                           <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '4px solid #10B981', borderLeft: '4px solid #10B981' }} />
                           <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '4px solid #10B981', borderRight: '4px solid #10B981' }} />
                         </motion.div>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 15 }}
                        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(16,185,129,0.5)' }}>
                          <CheckCircleFilled style={{ fontSize: 50, color: '#fff' }} />
                        </div>
                      </motion.div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : cameraUnavailable ? (
            // Show placeholder when camera is not available
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: token.paddingLG,
              color: 'rgba(255,255,255,0.7)',
            }}>
              <span style={{ fontSize: 48, marginBottom: token.marginSM }}>
                {isDocument ? '📄' : '🤳'}
              </span>
              <span style={{ fontSize: token.fontSizeSM, textAlign: 'center' }}>
                Camera requires HTTPS
              </span>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: type === 'selfie' ? 'scaleX(-1)' : 'none',
                }}
              />
              {/* Overlay guide */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: isDocument ? '85%' : '60%',
                  height: isDocument ? '70%' : '70%',
                  border: '3px dashed rgba(255,255,255,0.6)',
                  borderRadius: isDocument ? 12 : '50%',
                }} />
              </div>
            </>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Instructions */}
        <p style={{
          fontSize: token.fontSize,
          color: 'rgba(255,255,255,0.9)',
          marginBottom: token.marginLG,
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>
          {captured
            ? '✅ Looking good! Continue or retake.'
            : cameraUnavailable
              ? '📱 Camera not available on HTTP. This is just practice - skip ahead!'
              : isDocument
                ? 'Align your card within the frame and tap capture'
                : 'Center your face in the circle and tap capture'
          }
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: token.marginMD }}>
          <Button
            size="large"
            onClick={goToPrevStep}
            style={{ ...getButtonStyle(false), flex: 1 }}
          >
            <ArrowLeftOutlined />
          </Button>
          
          {captured ? (
            <>
              <Button
                size="large"
                onClick={() => handleRetake(type)}
                style={{ ...getButtonStyle(false), flex: 1, opacity: isVerifying ? 0.5 : 1 }}
                disabled={isVerifying}
              >
                <ReloadOutlined /> Retake
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={() => goToNextStep(isDocument ? 'Analyzing document...' : 'Performing liveness check...')}
                style={{ ...getButtonStyle(), flex: 2 }}
                disabled={isVerifying}
              >
                {isVerifying ? (verifyStatus === 'processing' ? 'Scanning...' : 'Verified!') : 'Continue '}
                {!isVerifying && <ArrowRightOutlined />}
              </Button>
            </>
          ) : cameraUnavailable ? (
            <Button
              type="primary"
              size="large"
              onClick={() => goToNextStep()}
              style={{ ...getButtonStyle(), flex: 3 }}
            >
              Skip <ArrowRightOutlined />
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              onClick={() => handleCapture(type)}
              style={{ ...getButtonStyle(), flex: 3 }}
            >
              <CameraOutlined /> Capture
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  const renderReview = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      {/* Just show the 3 images */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: token.marginSM,
        marginBottom: token.marginXL,
      }}>
        {(['docFront', 'docBack', 'selfie'] as const).map((type) => (
          <div key={type} style={{
            aspectRatio: '1',
            borderRadius: 16,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.3)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {capturedImages[type] ? (
              <img
                src={capturedImages[type]!}
                alt={type}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 28,
              }}>
                {type === 'selfie' ? '🤳' : '📄'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Name preview */}
      <p style={{
        textAlign: 'center',
        color: '#fff',
        fontSize: token.fontSizeLG,
        marginBottom: token.marginXL,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}>
        👤 {formData.firstName} {formData.lastName}
      </p>

      <div style={{ display: 'flex', gap: token.marginMD, justifyContent: 'center' }}>
        {!isVerifying && (
          <Button
            size="large"
            onClick={goToPrevStep}
            style={{ ...getButtonStyle(false), flex: 1 }}
          >
            <ArrowLeftOutlined />
          </Button>
        )}
        <Button
          type="primary"
          size="large"
          onClick={() => goToNextStep('Finalizing verification. Please wait...')}
          style={{ ...getButtonStyle(), flex: isVerifying ? 'none' : 2, width: isVerifying ? 52 : 'auto', padding: isVerifying ? 0 : undefined, transition: 'all 0.3s ease' }}
          disabled={isVerifying}
        >
          {isVerifying ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
               <ReloadOutlined />
            </motion.div>
          ) : (
            'Submit! 🚀'
          )}
        </Button>
      </div>
    </motion.div>
  );

  const renderSuccess = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ textAlign: 'center', padding: token.paddingMD }}
    >
      {/* Animated ID Document replacing Trophy */}
      <motion.div
        initial={{ y: 50, opacity: 0, rotateX: 45 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 100 }}
        style={{
           width: 200, height: 130, margin: '0 auto', marginBottom: token.marginLG,
           background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
           borderRadius: 16, position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
           display: 'flex', flexDirection: 'column', padding: 16,
           backdropFilter: 'blur(10px)'
        }}
      >
         <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ flex: 1 }}>
               <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 4, marginBottom: 8 }} />
               <div style={{ width: '60%', height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 4 }} />
            </div>
         </div>
         <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 4, marginBottom: 8 }} />
         <div style={{ width: '80%', height: 8, background: 'rgba(255,255,255,0.3)', borderRadius: 4 }} />
         
         <motion.div
           initial={{ scale: 0, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.6, type: 'spring', damping: 10 }}
           style={{
             position: 'absolute', bottom: -20, right: -20,
             width: 60, height: 60, borderRadius: '50%', background: '#10B981',
             display: 'flex', alignItems: 'center', justifyContent: 'center',
             boxShadow: '0 0 20px rgba(16,185,129,0.5)',
             border: '4px solid #041f15'
           }}
         >
           <CheckCircleFilled style={{ fontSize: 36, color: '#fff' }} />
         </motion.div>
      </motion.div>

      <h2 style={{
        fontSize: isMobile ? 28 : 36,
        fontWeight: fontWeights.bold,
        color: '#ffffff',
        marginBottom: token.marginMD,
        textShadow: '0 2px 4px rgba(0,0,0,0.4)',
      }}>
        Congratulations!
      </h2>

      <p style={{
        fontSize: token.fontSizeLG,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: token.marginXL,
        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        lineHeight: 1.6,
      }}>
        You&apos;ve successfully completed the KYC practice! You now know how the verification process works.
      </p>

      <div style={{ display: 'flex', gap: token.marginMD, marginTop: token.marginXL }}>
        <Button
          size="large"
          onClick={() => {
            // Reset to welcome step
            setCurrentStep('welcome');
            personalForm.resetFields();
            addressForm.resetFields();
            setCapturedImages({ docFront: null, docBack: null, selfie: null });
            setFormData({});
            setSelectedCountry('');
            setSelectedRegion('');
            setBirthMonth('');
            setBirthDay('');
            setBirthYear('');
          }}
          style={{ ...getButtonStyle(false), flex: 1 }}
        >
          <ReloadOutlined /> Restart
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={() => {
            // Save completion to localStorage
            localStorage.setItem('demoKycCompleted', 'true');
            router.push('/overview');
          }}
          style={{ ...getButtonStyle(), flex: 1 }}
        >
          Return to Dashboard <HomeOutlined />
        </Button>
      </div>
    </motion.div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return renderWelcome();
      case 'personal':
        return renderPersonal();
      case 'address':
        return renderAddress();
      case 'doc-front':
        return renderCamera('docFront');
      case 'doc-back':
        return renderCamera('docBack');
      case 'selfie':
        return renderCamera('selfie');
      case 'review':
        return renderReview();
      case 'success':
        return renderSuccess();
      default:
        return null;
    }
  };

  return (
    <>
      <Head>
        <title>Identity Verification - UG Coin</title>
        <meta name="description" content="Complete your identity verification" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: isDark
          ? `linear-gradient(160deg, #041f15 0%, #052e1c 50%, #041f15 100%)`
          : `linear-gradient(160deg, ${moduleColors.primary} 0%, ${moduleColors.dark} 50%, #023020 100%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: `${token.paddingXS}px ${token.padding}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid rgba(255,255,255,0.15)`,
          width: '100%',
          maxWidth: 480,
          background: isDark
            ? `linear-gradient(160deg, #041f15 0%, #052e1c 50%, #041f15 100%)`
            : `linear-gradient(160deg, ${moduleColors.primary} 0%, ${moduleColors.dark} 50%, #023020 100%)`,
          backdropFilter: 'blur(10px)',
        }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/overview')}
            style={{ color: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {!isMobile && 'Exit'}
          </Button>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginSM,
          }}>
            <span style={{
              fontSize: token.fontSizeSM,
              color: '#ffffff',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}>
              {currentStepIndex + 1} / {STEPS.length}
            </span>
            <div style={{
              width: 120,
              height: 10,
              background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.25)',
              borderRadius: 5,
              overflow: 'hidden',
              boxShadow: isDark 
                ? 'inset 0 1px 3px rgba(0,0,0,0.5)' 
                : 'inset 0 1px 3px rgba(0,0,0,0.3)',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                style={{
                  height: '100%',
                  background: isDark 
                    ? 'linear-gradient(90deg, #34D399 0%, #10B981 100%)'
                    : 'linear-gradient(90deg, #FFE066 0%, #FFC107 100%)',
                  borderRadius: 5,
                  boxShadow: isDark 
                    ? '0 0 8px rgba(52,211,153,0.6)' 
                    : '0 0 8px rgba(255,224,102,0.6)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Step Header */}
        <div style={{
          padding: `${token.paddingMD}px ${token.paddingLG}px`,
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          alignItems: 'center',
          gap: token.marginLG,
        }}>
          <div style={{
            width: 80,
            height: 80,
            flexShrink: 0,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              fontSize: 40,
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
            }}>
              🛡️
            </div>
          </div>
          <h2 style={{
            fontSize: isMobile ? 24 : 28,
            fontWeight: fontWeights.bold,
            color: '#ffffff',
            margin: 0,
            textShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}>
            {stepCaptions[currentStep]}
          </h2>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: `0 ${token.paddingLG}px ${token.paddingXL}px`,
          overflowY: 'auto',
          width: '100%',
          maxWidth: 480,
        }}>
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

