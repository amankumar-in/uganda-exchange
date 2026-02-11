/**
 * Reset Password Page
 * Multi-step password reset flow with modern two-column design
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import Image from 'next/image';
import { Form, Input, Typography, message, theme, Grid, Steps, Row, Col } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  KeyOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import LoadingButton from '@/components/auth/LoadingButton';
import OTPInput from '@/components/auth/OTPInput';
import {
  requestPasswordReset,
  verifyPasswordResetOtp,
  setNewPassword,
  resendEmailOtp,
  ApiError,
} from '@/services/api/auth';
import { useThemeMode } from '@/context/ThemeContext';
import { fontWeights } from '@/theme/themeConfig';

const { Text, Title } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [form] = Form.useForm();
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mounted, setMounted] = useState(false);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleEmailSubmit = async (values: { email: string }) => {
    setLoading(true);
    try {
      const response = await requestPasswordReset({ email: values.email });
      setEmail(values.email);
      setResetToken(response.token);
      setStep('otp');
      setResendCooldown(60);
      message.success('Reset code sent to your email');
    } catch (error) {
      const apiError = error as ApiError;
      message.error(apiError.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 6) {
      message.error('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      await verifyPasswordResetOtp({ otp, token: resetToken });
      setStep('password');
      message.success('Code verified successfully');
    } catch (error) {
      const apiError = error as ApiError;
      message.error(apiError.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (values: { password: string }) => {
    setLoading(true);
    try {
      await setNewPassword({
        password: values.password,
        token: resetToken,
      });
      setStep('success');
      message.success('Password reset successfully!');
    } catch (error) {
      const apiError = error as ApiError;
      message.error(apiError.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendEmailOtp(email, 'RESET');
      setResendCooldown(60);
      message.success('Reset code resent');
    } catch {
      message.error('Failed to resend code');
    }
  };

  // Password validation rules
  const passwordRules = [
    { required: true, message: 'Please enter a password' },
    { min: 8, message: 'Password must be at least 8 characters' },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
      message: 'Must include uppercase, lowercase, number, and special character',
    },
  ];

  const getCurrentStep = () => {
    switch (step) {
      case 'email': return 0;
      case 'otp': return 1;
      case 'password': return 2;
      case 'success': return 3;
      default: return 0;
    }
  };

  const getTitle = () => {
    switch (step) {
      case 'email': return 'Reset Password';
      case 'otp': return 'Enter Code';
      case 'password': return 'New Password';
      case 'success': return '';
      default: return 'Reset Password';
    }
  };

  const getSubtitle = () => {
    switch (step) {
      case 'email': return 'Enter your email to receive a reset code';
      case 'otp': return `We've sent a 6-digit code to ${email}`;
      case 'password': return 'Create a strong new password for your account';
      case 'success': return '';
      default: return '';
    }
  };

  // Features for left panel
  const features = [
    { icon: <KeyOutlined />, title: 'Secure Reset' },
    { icon: <SecurityScanOutlined />, title: '2-Step Verification' },
    { icon: <SafetyCertificateOutlined />, title: 'Encrypted' },
  ];

  return (
    <>
      <Head>
        <title>{getTitle()} - InTuition Exchange</title>
      </Head>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: isDark ? '#0a0a0f' : '#f8fafc',
        }}
      >
        {/* Left Panel - Branding - Hidden on Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            flex: '1 1 45%',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
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
              top: -100,
              right: -100,
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              filter: 'blur(60px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: -80,
              left: -80,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              filter: 'blur(40px)',
            }}
          />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, textDecoration: 'none' }}>
              <Image
                src="/images/intuition-logo-no-text.svg"
                alt="InTuition"
                width={40}
                height={40}
              />
              <span style={{ color: '#ffffff', fontSize: token.fontSizeHeading4, fontWeight: fontWeights.bold }}>
                InTuition
              </span>
            </Link>
          </motion.div>

          {/* Main Content */}
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 400, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              style={{ display: 'flex', justifyContent: 'center', marginBottom: token.marginXL }}
            >
              <Image
                src="/images/kyc-3d.png"
                alt="Secure Reset"
                width={220}
                height={220}
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
                textAlign: 'center',
              }}
            >
              Secure Password Reset
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
              Regain access to your account with our secure verification process.
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={{ display: 'flex', justifyContent: 'center', gap: token.marginMD, flexWrap: 'wrap' }}
            >
              {features.map((feature, index) => (
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
                  {feature.icon}
                  <span>{feature.title}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Bottom Trust Indicator */}
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
            <SafetyCertificateOutlined style={{ color: '#ffffff', fontSize: 20 }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: token.fontSize }}>
              Bank-grade security • 256-bit encryption
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
                ? 'radial-gradient(ellipse at 100% 0%, rgba(102, 126, 234, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(118, 75, 162, 0.1) 0%, transparent 50%)'
                : 'radial-gradient(ellipse at 100% 0%, rgba(102, 126, 234, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(118, 75, 162, 0.12) 0%, transparent 60%)',
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
            {/* Mobile Logo */}
            {isMobile && (
              <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, textDecoration: 'none' }}>
                <Image src="/images/intuition-logo-no-text.svg" alt="InTuition" width={32} height={32} />
                <span style={{ color: token.colorText, fontSize: token.fontSizeLG, fontWeight: fontWeights.bold }}>InTuition</span>
              </Link>
            )}
            {!isMobile && <div />}

            <Link
              href="/login"
              style={{
                color: token.colorPrimary,
                fontSize: token.fontSize,
                fontWeight: fontWeights.medium,
                textDecoration: 'none',
              }}
            >
              Back to Sign In
            </Link>
          </div>

          {/* Form Container */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: isMobile
                ? `${token.paddingLG}px ${token.paddingMD}px`
                : `${token.paddingXL}px ${token.paddingXL * 2}px`,
              maxWidth: 560,
              width: '100%',
              margin: '0 auto',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Header */}
                <div style={{ marginBottom: token.marginLG }}>
                  <Title
                    level={isMobile ? 4 : 3}
                    style={{
                      margin: 0,
                      marginBottom: token.marginXS,
                      fontWeight: fontWeights.bold,
                    }}
                  >
                    {getTitle()}
                  </Title>
                  {getSubtitle() && (
                    <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}>
                      {getSubtitle()}
                    </Text>
                  )}
                </div>

                {/* Progress Steps */}
                {step !== 'success' && (
                  <Steps
                    current={getCurrentStep()}
                    size="small"
                    direction="horizontal"
                    responsive={false}
                    style={{ marginBottom: token.marginLG }}
                    items={[
                      { title: 'Email' },
                      { title: 'Verify' },
                      { title: 'Password' },
                    ]}
                  />
                )}

                {/* Email Step */}
                {step === 'email' && (
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleEmailSubmit}
                    requiredMark={false}
                    size="large"
                  >
                    <Form.Item
                      name="email"
                      label={<span style={{ fontWeight: fontWeights.medium }}>Email Address</span>}
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Please enter a valid email' },
                      ]}
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

                    <Form.Item style={{ marginTop: token.marginMD, marginBottom: token.marginMD }}>
                      <LoadingButton
                        loading={loading}
                        htmlType="submit"
                        style={{
                          height: isMobile ? 48 : 52,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          border: 'none',
                        }}
                      >
                        Send Reset Code
                      </LoadingButton>
                    </Form.Item>

                    <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize, textAlign: 'center', display: 'block' }}>
                      Remember your password?{' '}
                      <Link href="/login" style={{ color: token.colorPrimary, fontWeight: fontWeights.medium }}>
                        Sign In
                      </Link>
                    </Text>
                  </Form>
                )}

                {/* OTP Step */}
                {step === 'otp' && (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginXS,
                        color: token.colorTextSecondary,
                        fontSize: token.fontSize,
                        cursor: 'pointer',
                        marginBottom: token.marginLG,
                      }}
                      onClick={() => setStep('email')}
                    >
                      <ArrowLeftOutlined />
                      Change email
                    </div>

                    <div style={{ marginBottom: token.marginLG }}>
                      <OTPInput
                        value={otp}
                        onChange={setOtp}
                        disabled={loading}
                      />
                      <Text
                        style={{
                          fontSize: token.fontSize,
                          color: resendCooldown > 0 ? token.colorTextDisabled : token.colorPrimary,
                          cursor: resendCooldown > 0 ? 'default' : 'pointer',
                          marginTop: token.marginSM,
                          textAlign: 'center',
                          display: 'block',
                        }}
                        onClick={handleResend}
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                      </Text>
                    </div>

                    <LoadingButton
                      loading={loading}
                      onClick={handleOtpSubmit}
                      disabled={otp.length !== 6}
                      style={{
                        height: isMobile ? 48 : 52,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                      }}
                    >
                      Verify Code
                    </LoadingButton>
                  </>
                )}

                {/* Password Step */}
                {step === 'password' && (
                  <Form
                    layout="vertical"
                    onFinish={handlePasswordSubmit}
                    requiredMark={false}
                    size="large"
                  >
                    <Row gutter={token.marginSM}>
                      <Col xs={12} md={12}>
                        <Form.Item
                          name="password"
                          label={<span style={{ fontWeight: fontWeights.medium }}>New Password</span>}
                          rules={passwordRules}
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
                            placeholder="New password"
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
                          label={<span style={{ fontWeight: fontWeights.medium }}>Confirm</span>}
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
                        >
                          <Input
                            prefix={<LockOutlined style={{ color: token.colorTextSecondary }} />}
                            type="password"
                            placeholder="Confirm"
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

                    <Form.Item style={{ marginTop: token.marginMD }}>
                      <LoadingButton
                        loading={loading}
                        htmlType="submit"
                        style={{
                          height: isMobile ? 48 : 52,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          border: 'none',
                        }}
                      >
                        Reset Password
                      </LoadingButton>
                    </Form.Item>
                  </Form>
                )}

                {/* Success Step */}
                {step === 'success' && (
                  <div style={{ textAlign: 'center', padding: `${token.paddingLG}px 0` }}>
                    <CheckCircleFilled style={{ fontSize: 64, color: token.colorSuccess, marginBottom: token.marginLG }} />
                    <Title level={3} style={{ marginBottom: token.marginSM, fontWeight: fontWeights.bold }}>
                      Password Reset Successful
                    </Title>
                    <Text style={{ fontSize: token.fontSizeLG, color: token.colorTextSecondary, marginBottom: token.marginXL, display: 'block' }}>
                      Your password has been updated. You can now sign in with your new password.
                    </Text>
                    <LoadingButton
                      onClick={() => router.push('/login')}
                      style={{
                        height: isMobile ? 48 : 52,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                      }}
                    >
                      Sign In Now
                    </LoadingButton>
                  </div>
                )}
              </motion.div>
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
                🔒 Your connection is secured with 256-bit encryption
              </Text>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
