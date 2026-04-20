/**
 * Register Page
 * Multi-step registration with OTP verification
 * Beautiful design matching the dashboard aesthetic
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import Image from 'next/image';
import { Form, Input, Select, Typography, message, theme, Grid, Space, Row, Col } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  RocketOutlined,
  GiftOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import LoadingButton from '@/components/auth/LoadingButton';
import OTPInput from '@/components/auth/OTPInput';
import MobileSelectDrawer from '@/components/auth/MobileSelectDrawer';
import {
  registerUser,
  verifyRegistration,
  resendEmailOtp,
  // resendPhoneOtp, // Phone OTP temporarily disabled
  loginUser,
  RegisterData,
  ApiError,
} from '@/services/api/auth';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { fontWeights } from '@/theme/themeConfig';
import { getCountryOptions, getPhoneCodeOptions, getCountryByCode } from '@/data/countries';

const { Text, Title } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

// Get options from countries data
const countryOptions = getCountryOptions();
const phoneCodeOptions = getPhoneCodeOptions();

// Custom filter that matches from the start of words
const filterFromStart = (input: string, option?: { searchValue?: string }) => {
  if (!option?.searchValue) return false;
  const searchLower = input.toLowerCase();
  const words = option.searchValue.toLowerCase().split(' ');
  return words.some(word => word.startsWith(searchLower));
};

type Step = 'form' | 'otp';

export default function RegisterPage() {
  const router = useRouter();
  const { token } = useToken();
  const { login, isLoggedIn, isLoading: authLoading } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const screens = useBreakpoint();
  const [form] = Form.useForm();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<RegisterData | null>(null);
  const [otpEmail, setOtpEmail] = useState('');
  // Phone OTP temporarily disabled - will be re-enabled in future
  // const [otpPhone, setOtpPhone] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [countryDrawerOpen, setCountryDrawerOpen] = useState(false);
  const [phoneCodeDrawerOpen, setPhoneCodeDrawerOpen] = useState(false);
  const [selectedPhoneCode, setSelectedPhoneCode] = useState<string>('IN');

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      router.replace('/overview');
    }
  }, [authLoading, isLoggedIn, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleFormSubmit = async (values: RegisterData & { confirmPassword: string; phoneCountryCode: string }) => {
    setLoading(true);
    try {
      // Convert country code (US) to phone code (1) for the API
      const countryData = getCountryByCode(values.phoneCountryCode);
      const phoneCountry = countryData?.phoneCode || '1';
      
      const data: RegisterData = {
        email: values.email,
        phone: values.phone,
        phoneCountry: phoneCountry,
        password: values.password,
        country: values.country,
      };

      await registerUser(data);
      setFormData(data);
      setStep('otp');
      setResendCooldown(60);
      message.success('Verification code sent to your email');
    } catch (error) {
      const apiError = error as ApiError;
      message.error(apiError.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!formData) return;
    // Phone OTP temporarily disabled
    if (otpEmail.length !== 6 /* || otpPhone.length !== 6 */) {
      message.error('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      // Verify and create account
      // Phone OTP temporarily disabled - not sending otpPhone
      await verifyRegistration({
        ...formData,
        otpEmail,
      });

      message.success('Account created successfully!');

      // Auto-login the user after successful registration
      try {
        const loginResponse = await loginUser({
          email: formData.email,
          password: formData.password,
          remember: true,
        });

        login(loginResponse.user);
        
        // Redirect to onboarding for KYC
        router.replace('/onboarding');
      } catch {
        // If auto-login fails, redirect to login page
        router.push('/login?registered=true');
      }
    } catch (error) {
      const apiError = error as ApiError;
      message.error(apiError.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!formData || resendCooldown > 0) return;
    try {
      await resendEmailOtp(formData.email, 'REGISTER');
      setResendCooldown(60);
      message.success('Email OTP resent');
    } catch {
      message.error('Failed to resend email OTP');
    }
  };

  // Phone OTP resend temporarily disabled - will be re-enabled in future
  // const handleResendPhone = async () => {
  //   if (!formData || resendCooldown > 0) return;
  //   try {
  //     await resendPhoneOtp(formData.phone, formData.phoneCountry, 'REGISTER');
  //     setResendCooldown(60);
  //     message.success('Phone OTP resent');
  //   } catch {
  //     message.error('Failed to resend phone OTP');
  //   }
  // };

  // Password validation rules
  const passwordRules = [
    { required: true, message: 'Please enter a password' },
    { min: 8, message: 'Password must be at least 8 characters' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
      message: 'Must include uppercase, lowercase, number, and special character',
    },
  ];

  // Benefits for left panel
  const benefits = [
    { icon: <RocketOutlined />, title: 'Start Trading in Minutes', desc: 'Quick verification process' },
    { icon: <GiftOutlined />, title: '$100,000 Practice Balance', desc: 'Learn risk-free in Learner Mode' },
    { icon: <BookOutlined />, title: 'Educational Resources', desc: 'Master crypto trading basics' },
    { icon: <SafetyCertificateOutlined />, title: 'Bank-Grade Security', desc: 'Your assets are protected' },
  ];

  // Don't render while checking auth
  if (authLoading) return null;
  if (isLoggedIn) return null;

  return (
    <>
      <Head>
        <title>{step === 'otp' ? 'Verify Your Account' : 'Create Account'} - InTuition Exchange</title>
        <meta name="description" content="Create your InTuition Exchange account" />
      </Head>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: isDark ? '#0f0f14' : '#f8f9fc',
        }}
      >
        {/* Left Panel - Immersive Branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            flex: isMobile ? 'none' : '1 1 45%',
            minHeight: isMobile ? 'auto' : '100vh',
            background: 'linear-gradient(135deg, #0d7377 0%, #14919b 50%, #0f766e 100%)',
            position: 'relative',
            overflow: 'hidden',
            display: isMobile ? 'none' : 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: token.paddingXL * 2,
          }}
        >
          {/* Decorative Elements */}
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 350,
              height: 350,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              filter: 'blur(50px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -30,
              left: '40%',
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              filter: 'blur(40px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: -30,
              width: 150,
              height: 150,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              filter: 'blur(25px)',
            }}
          />

          {/* Logo */}
          <Link 
            href="/" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: token.marginSM,
              textDecoration: 'none',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Image
              src="/images/intuition-logo-no-text.svg"
              alt="InTuition"
              width={40}
              height={40}
            />
            <span style={{ 
              color: '#ffffff', 
              fontSize: token.fontSizeHeading4, 
              fontWeight: fontWeights.bold,
              letterSpacing: '-0.02em',
            }}>
              InTuition
            </span>
          </Link>

          {/* Main Content */}
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {/* Hero Image */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  marginBottom: token.marginXL,
                }}
              >
                <Image
                  src="/images/signup.png"
                  alt="Start Trading"
                  width={280}
                  height={280}
                  style={{ objectFit: 'contain' }}
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                style={{
                  color: '#ffffff',
                  fontSize: token.fontSizeHeading2,
                  fontWeight: fontWeights.bold,
                  marginBottom: token.marginSM,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  textAlign: 'center',
                }}
              >
                Start Your Trading Journey
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: token.fontSizeLG,
                  lineHeight: 1.5,
                  textAlign: 'center',
                  marginBottom: token.marginLG,
                }}
              >
                Trade College Coins, build your portfolio, and learn crypto trading the smart way.
              </motion.p>

              {/* Benefits Pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: token.marginSM, 
                  justifyContent: 'center',
                }}
              >
                {benefits.map((benefit, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: token.marginXS,
                      padding: `${token.paddingXS}px ${token.paddingSM}px`,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      borderRadius: 20,
                      fontSize: token.fontSizeSM,
                      color: '#ffffff',
                    }}
                  >
                    {benefit.icon}
                    <span>{benefit.title}</span>
                  </div>
                ))}
              </motion.div>
            </div>

          {/* Bottom Indicator */}
          <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: token.marginSM,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <CheckCircleFilled style={{ color: '#ffffff', fontSize: 18 }} />
              <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: token.fontSize }}>
                Trusted by 100,000+ students across 50+ colleges
              </span>
            </motion.div>
        </motion.div>

        {/* Right Panel - Form */}
        <motion.div
          initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            flex: isMobile ? 1 : '1 1 55%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: isDark ? '#0f0f14' : '#ffffff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle gradient overlay for color */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: isDark 
                ? 'radial-gradient(ellipse at 100% 0%, rgba(13, 115, 119, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(20, 145, 155, 0.1) 0%, transparent 50%)'
                : 'radial-gradient(ellipse at 100% 0%, rgba(13, 115, 119, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(20, 145, 155, 0.12) 0%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile 
                ? `${token.paddingSM}px ${token.paddingMD}px`
                : `${token.paddingMD}px ${token.paddingLG}px`,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              flexShrink: 0,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Link 
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
                color: token.colorTextSecondary,
                fontSize: token.fontSize,
              }}
            >
              <ArrowLeftOutlined />
              Back to Home
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: token.marginMD }}>
              {/* Theme Toggle */}
              <div
                onClick={toggleMode}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  fontSize: token.fontSizeLG,
                }}
              >
                {isDark ? '🌙' : '☀️'}
              </div>
              <Link href="/login">
                <span
                  style={{
                    padding: `${token.paddingXS}px ${token.paddingMD}px`,
                    borderRadius: token.borderRadius,
                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                    color: '#ffffff',
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.semibold,
                    cursor: 'pointer',
                  }}
                >
                  Sign In
                </span>
              </Link>
            </div>
          </div>

          {/* Form Container */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: isMobile 
                ? `${token.paddingMD}px ${token.paddingMD}px`
                : `${token.paddingLG}px ${token.paddingXL * 2}px`,
              maxWidth: 560,
              width: '100%',
              margin: '0 auto',
              overflowY: 'auto',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <AnimatePresence mode="wait">
              {step === 'form' ? (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Form Header */}
                  <div style={{ marginBottom: isMobile ? token.marginSM : token.marginLG }}>
                    <Title
                      level={2}
                      style={{
                        fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading2,
                        fontWeight: fontWeights.bold,
                        color: token.colorText,
                        marginBottom: 4,
                      }}
                    >
                      Create your account
                    </Title>
                    <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                      Start your College Coins journey in just a few steps
                    </Text>
                  </div>

                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFormSubmit}
                    requiredMark={false}
                    size="large"
                    initialValues={{ phoneCountryCode: 'IN', country: 'IN' }}
                  >
                    {/* Country */}
                    <Form.Item
                      name="country"
                      label={<span style={{ fontWeight: fontWeights.medium, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>Country</span>}
                      rules={[{ required: true, message: 'Please select your country' }]}
                      style={{ marginBottom: isMobile ? token.marginSM : token.marginMD }}
                    >
                      {isMobile ? (
                        <>
                          <div
                            onClick={() => !loading && setCountryDrawerOpen(true)}
                            style={{
                              height: 44,
                              padding: `0 ${token.paddingSM}px`,
                              borderRadius: token.borderRadius,
                              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#d9d9d9'}`,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: loading ? 0.5 : 1,
                            }}
                          >
                            <span style={{ 
                              color: form.getFieldValue('country') ? token.colorText : token.colorTextPlaceholder,
                            }}>
                              {form.getFieldValue('country')
                                ? countryOptions.find(c => c.value === form.getFieldValue('country'))?.label || 'Select your country'
                                : 'Select your country'}
                            </span>
                            <span style={{ color: token.colorTextSecondary }}>▼</span>
                          </div>
                          <MobileSelectDrawer
                            open={countryDrawerOpen}
                            onClose={() => setCountryDrawerOpen(false)}
                            title="Select Country"
                            options={countryOptions}
                            value={form.getFieldValue('country')}
                            onSelect={(value) => {
                              form.setFieldsValue({ country: value });
                            }}
                            placeholder="Search countries..."
                          />
                        </>
                      ) : (
                        <Select
                          showSearch
                          placeholder="Select your country"
                          options={countryOptions}
                          disabled={loading}
                          filterOption={filterFromStart}
                          style={{ height: 48 }}
                        />
                      )}
                    </Form.Item>

                    {/* Email */}
                    <Form.Item
                      name="email"
                      label={<span style={{ fontWeight: fontWeights.medium, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>Email Address</span>}
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Please enter a valid email' },
                      ]}
                      style={{ marginBottom: isMobile ? token.marginSM : token.marginMD }}
                    >
                      <Input
                        prefix={<MailOutlined style={{ color: token.colorTextSecondary }} />}
                        placeholder="you@example.com"
                        style={{
                          height: isMobile ? 44 : 48,
                          borderRadius: token.borderRadius,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                        }}
                        autoComplete="email"
                        disabled={loading}
                      />
                    </Form.Item>

                    {/* Phone */}
                    <Form.Item
                      label={<span style={{ fontWeight: fontWeights.medium, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>Phone Number</span>}
                      required
                      style={{ marginBottom: isMobile ? token.marginSM : token.marginMD }}
                    >
                      {isMobile ? (
                        <div style={{ display: 'flex', gap: token.marginXS }}>
                          <Form.Item name="phoneCountryCode" noStyle rules={[{ required: true }]}>
                            <div
                              onClick={() => !loading && setPhoneCodeDrawerOpen(true)}
                              style={{
                                width: '38%',
                                height: 44,
                                padding: `0 ${token.paddingXS}px`,
                                borderRadius: token.borderRadius,
                                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#d9d9d9'}`,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1,
                              }}
                            >
                              <span style={{ 
                                color: selectedPhoneCode ? token.colorText : token.colorTextPlaceholder,
                                fontSize: token.fontSizeSM,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {selectedPhoneCode
                                  ? phoneCodeOptions.find(c => c.value === selectedPhoneCode)?.label || 'Select'
                                  : 'Select'}
                              </span>
                              <span style={{ color: token.colorTextSecondary, marginLeft: 4 }}>▼</span>
                            </div>
                          </Form.Item>
                          <Form.Item
                            name="phone"
                            noStyle
                            rules={[
                              { required: true, message: 'Please enter your phone number' },
                              { pattern: /^\d{7,15}$/, message: 'Enter valid phone number' },
                            ]}
                          >
                            <Input
                              style={{ flex: 1, height: 44 }}
                              placeholder="Phone number"
                              autoComplete="new-phone-number"
                              inputMode="tel"
                              name="phone_number_field"
                              disabled={loading}
                            />
                          </Form.Item>
                          <MobileSelectDrawer
                            open={phoneCodeDrawerOpen}
                            onClose={() => setPhoneCodeDrawerOpen(false)}
                            title="Select Phone Code"
                            options={phoneCodeOptions}
                            value={selectedPhoneCode}
                            onSelect={(value) => {
                              form.setFieldsValue({ phoneCountryCode: value });
                              setSelectedPhoneCode(value);
                            }}
                            placeholder="Search country or code..."
                          />
                        </div>
                      ) : (
                        <Space.Compact style={{ width: '100%' }}>
                          <Form.Item name="phoneCountryCode" noStyle rules={[{ required: true }]}>
                            <Select
                              showSearch
                              style={{ width: '35%' }}
                              options={phoneCodeOptions}
                              disabled={loading}
                              filterOption={filterFromStart}
                              popupMatchSelectWidth={280}
                            />
                          </Form.Item>
                          <Form.Item
                            name="phone"
                            noStyle
                            rules={[
                              { required: true, message: 'Please enter your phone number' },
                              { pattern: /^\d{7,15}$/, message: 'Enter valid phone number' },
                            ]}
                          >
                            <Input
                              style={{ width: '65%', height: 48 }}
                              placeholder="Phone number"
                              autoComplete="new-phone-number"
                              inputMode="tel"
                              name="phone_number_field"
                              disabled={loading}
                            />
                          </Form.Item>
                        </Space.Compact>
                      )}
                    </Form.Item>

                    {/* Password & Confirm Password - Same Row */}
                    <Row gutter={token.marginSM}>
                      <Col xs={12} md={12}>
                        <Form.Item
                          name="password"
                          label={<span style={{ fontWeight: fontWeights.medium, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>Password</span>}
                          rules={passwordRules}
                          style={{ marginBottom: isMobile ? token.marginSM : token.marginLG }}
                        >
                          <Input
                            prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
                            suffix={
                              <span
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ cursor: 'pointer', color: token.colorTextSecondary }}
                              >
                                {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                              </span>
                            }
                            type={showPassword ? 'text' : 'password'}
                            placeholder={isMobile ? "Password" : "Create password"}
                            style={{
                              height: isMobile ? 44 : 48,
                              borderRadius: token.borderRadius,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                            }}
                            autoComplete="new-password"
                            disabled={loading}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={12}>
                        <Form.Item
                          name="confirmPassword"
                          label={<span style={{ fontWeight: fontWeights.medium, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>Confirm</span>}
                          dependencies={['password']}
                          rules={[
                            { required: true, message: 'Please confirm' },
                            ({ getFieldValue }) => ({
                              validator(_, value) {
                                if (!value || getFieldValue('password') === value) {
                                  return Promise.resolve();
                                }
                                return Promise.reject(new Error('Passwords do not match'));
                              },
                            }),
                          ]}
                          style={{ marginBottom: isMobile ? token.marginSM : token.marginLG }}
                        >
                          <Input
                            prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
                            type="password"
                            placeholder={isMobile ? "Confirm" : "Confirm password"}
                            style={{
                              height: isMobile ? 44 : 48,
                              borderRadius: token.borderRadius,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                            }}
                            autoComplete="new-password"
                            disabled={loading}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    {/* Submit Button */}
                    <Form.Item style={{ marginTop: token.marginMD, marginBottom: isMobile ? token.marginSM : token.marginMD }}>
                      <LoadingButton
                        loading={loading}
                        htmlType="submit"
                        style={{
                          height: isMobile ? 48 : 52,
                          background: 'linear-gradient(135deg, #0d7377 0%, #14919b 100%)',
                          border: 'none',
                        }}
                      >
                        Create Account
                      </LoadingButton>
                    </Form.Item>

                    {/* Terms */}
                    <Text
                      style={{
                        fontSize: 11,
                        color: token.colorTextSecondary,
                        textAlign: 'center',
                        display: 'block',
                        marginBottom: isMobile ? token.marginXS : token.marginMD,
                        lineHeight: 1.4,
                      }}
                    >
                      By creating an account, you agree to our{' '}
                      <Link href="/terms" style={{ color: token.colorPrimary }}>
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/privacy" style={{ color: token.colorPrimary }}>
                        Privacy Policy
                      </Link>
                    </Text>

                    {/* Sign In Link */}
                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}>
                        Already have an account?{' '}
                        <Link
                          href="/login"
                          style={{
                            color: token.colorPrimary,
                            fontWeight: fontWeights.semibold,
                          }}
                        >
                          Sign In
                        </Link>
                      </Text>
                    </div>
                  </Form>
                </motion.div>
              ) : (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Back Button */}
                  <div
                    onClick={() => setStep('form')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: token.marginXS,
                      color: token.colorTextSecondary,
                      fontSize: token.fontSize,
                      cursor: 'pointer',
                      marginBottom: token.marginLG,
                    }}
                  >
                    <ArrowLeftOutlined />
                    Back to form
                  </div>

                  {/* OTP Header */}
                  <div style={{ marginBottom: token.marginXL }}>
                    <Title
                      level={2}
                      style={{
                        fontSize: isMobile ? token.fontSizeHeading3 : token.fontSizeHeading2,
                        fontWeight: fontWeights.bold,
                        color: token.colorText,
                        marginBottom: token.marginXS,
                      }}
                    >
                      Verify Your Account
                    </Title>
                    <Text style={{ fontSize: token.fontSize, color: token.colorTextSecondary }}>
                      We&apos;ve sent a verification code to <strong>{formData?.email}</strong>
                    </Text>
                  </div>

                  {/* Email OTP */}
                  <div style={{ marginBottom: token.marginXL }}>
                    <Text
                      style={{
                        fontSize: token.fontSize,
                        fontWeight: fontWeights.medium,
                        color: token.colorText,
                        marginBottom: token.marginSM,
                        display: 'block',
                      }}
                    >
                      Email Verification Code
                    </Text>
                    <OTPInput value={otpEmail} onChange={setOtpEmail} disabled={loading} autoFocus={true} />
                    <Text
                      onClick={handleResendEmail}
                      style={{
                        fontSize: token.fontSize,
                        color: resendCooldown > 0 ? token.colorTextDisabled : token.colorPrimary,
                        cursor: resendCooldown > 0 ? 'default' : 'pointer',
                        marginTop: token.marginSM,
                        display: 'block',
                        textAlign: 'center',
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </div>

                  {/* Phone OTP - temporarily disabled, will be re-enabled in future */}
                  {/* <div style={{ marginBottom: token.marginXL }}>
                    <Text
                      style={{
                        fontSize: token.fontSize,
                        fontWeight: fontWeights.medium,
                        color: token.colorText,
                        marginBottom: token.marginSM,
                        display: 'block',
                      }}
                    >
                      Phone Verification Code
                    </Text>
                    <OTPInput value={otpPhone} onChange={setOtpPhone} disabled={loading} autoFocus={false} />
                    <Text
                      onClick={handleResendPhone}
                      style={{
                        fontSize: token.fontSize,
                        color: resendCooldown > 0 ? token.colorTextDisabled : token.colorPrimary,
                        cursor: resendCooldown > 0 ? 'default' : 'pointer',
                        marginTop: token.marginSM,
                        display: 'block',
                        textAlign: 'center',
                      }}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </div> */}

                  {/* Verify Button */}
                  <LoadingButton
                    loading={loading}
                    onClick={handleOtpSubmit}
                    disabled={otpEmail.length !== 6}
                    style={{
                      height: 52,
                      background: 'linear-gradient(135deg, #0d7377 0%, #14919b 100%)',
                      border: 'none',
                      color: '#ffffff',
                    }}
                  >
                    Verify & Continue
                  </LoadingButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom secure indicator - hidden on mobile */}
          {!isMobile && (
            <div
              style={{
                textAlign: 'center',
                padding: token.paddingMD,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
                🔒 Your data is secured with 256-bit encryption
              </Text>
            </div>
          )}
        </motion.div>
      </div>

      <style jsx global>{`
        /* Fix iOS password dots being too large */
        input[type="password"] {
          font-family: Verdana, sans-serif;
          font-size: 15px;
        }
        @media (max-width: 767px) {
          .ant-select-selector {
            height: 44px !important;
            display: flex !important;
            align-items: center !important;
          }
          .ant-select-selection-search-input {
            height: 42px !important;
          }
          .ant-form-item-label {
            padding-bottom: 2px !important;
          }
        }
        @media (min-width: 768px) {
          .ant-select-selector {
            height: 48px !important;
            display: flex !important;
            align-items: center !important;
          }
          .ant-select-selection-search-input {
            height: 46px !important;
          }
        }
      `}</style>
    </>
  );
}
