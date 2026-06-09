/**
 * Login Page
 * Beautiful, modern design matching the dashboard aesthetic
 * Two-column layout: immersive branding (left) + form (right)
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import Image from 'next/image';
import { Form, Input, Checkbox, Typography, message, theme, Grid } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  TrophyOutlined,
  ArrowLeftOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import LoadingButton from '@/components/auth/LoadingButton';
import { loginUser, LoginData, ApiError } from '@/services/api/auth';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { fontWeights } from '@/theme/themeConfig';

const { Text, Title } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

export default function LoginPage() {
  const router = useRouter();
  const { token } = useToken();
  const { login, isLoggedIn, isLoading: authLoading } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const screens = useBreakpoint();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;
  const isBridgeFlow = typeof router.query.redirect === 'string' && router.query.redirect.includes('/bridge/authorize');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isLoggedIn) {
      const redirectTo = (router.query.redirect as string) || '/overview';
      router.replace(redirectTo);
    }
  }, [authLoading, isLoggedIn, router]);

  // Show welcome message if coming from registration
  useEffect(() => {
    if (router.query.registered === 'true') {
      message.success('Account created successfully! Please sign in.');
    }
  }, [router.query.registered]);

  const handleSubmit = async (values: LoginData) => {
    setLoading(true);
    try {
      const response = await loginUser({
        email: values.email,
        password: values.password,
        remember: values.remember,
      });

      login(response.user);
      message.success('Welcome back!');
      
      // Redirect based on KYC status
      const redirectTo = (router.query.redirect as string) || 
        (response.user.kycStatus === 'APPROVED' || response.user.kycStatus === 'PENDING' ? '/overview' : '/onboarding');
      router.replace(redirectTo);
    } catch (error) {
      const apiError = error as ApiError;
      message.error(apiError.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Stats for social proof
  const stats = [
    { value: '100K+', label: 'Students', icon: <TeamOutlined /> },
    { value: '50+', label: 'Colleges', icon: <TrophyOutlined /> },
    { value: 'UGX 165B+', label: 'Volume', icon: <ThunderboltOutlined /> },
  ];

  // Don't render while checking auth
  if (authLoading) return null;
  if (isLoggedIn) return null;

  return (
    <>
      <Head>
        <title>Login - UG Coin</title>
        <meta name="description" content="Login to your UG Coin account" />
      </Head>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          backgroundColor: isDark ? '#0f0f14' : '#f8f9fc',
        }}
      >
        {/* Left Panel - Immersive Branding - Hidden on Mobile */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            flex: '1 1 50%',
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
              bottom: -50,
              left: '30%',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              filter: 'blur(40px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: -50,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              filter: 'blur(30px)',
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
              src="/images/ugcoin-logo-no-text.svg"
              alt="UG Coin"
              width={40}
              height={40}
            />
            <span style={{ 
              color: '#ffffff', 
              fontSize: token.fontSizeHeading4, 
              fontWeight: fontWeights.bold,
              letterSpacing: '-0.02em',
            }}>
              UG Coin
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
                  src="/images/kyc-3d.png"
                  alt="Secure Login"
                  width={260}
                  height={260}
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
                Welcome Back
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: token.fontSizeLG,
                  lineHeight: 1.5,
                  marginBottom: token.marginLG,
                  textAlign: 'center',
                }}
              >
                Access your portfolio, track your College Coins, and continue trading.
              </motion.p>

              {/* Stats Pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: token.marginMD,
                  flexWrap: 'wrap',
                }}
              >
                {stats.map((stat, index) => (
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
                    {stat.icon}
                    <span style={{ fontWeight: fontWeights.bold }}>{stat.value}</span>
                    <span style={{ opacity: 0.8 }}>{stat.label}</span>
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
                Bank-grade security • SOC 2 Compliant • 256-bit encryption
              </span>
            </motion.div>
        </motion.div>

        {/* Right Panel - Login Form */}
        <motion.div
          initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{
            flex: isMobile ? 1 : '1 1 50%',
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
              <Link href="/register">
                <span
                  style={{
                    padding: `${token.paddingXS}px ${token.paddingMD}px`,
                    borderRadius: token.borderRadius,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#ffffff',
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.semibold,
                    cursor: 'pointer',
                  }}
                >
                  Sign Up
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
                ? `${token.paddingLG}px ${token.paddingMD}px`
                : `${token.paddingXL}px ${token.paddingXL * 2}px`,
              maxWidth: 480,
              width: '100%',
              margin: '0 auto',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Bridge flow banner */}
            {isBridgeFlow && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: `${token.paddingSM + 2}px ${token.paddingMD}px`,
                  borderRadius: token.borderRadius,
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  marginBottom: token.marginMD,
                }}
              >
                <LinkOutlined style={{ fontSize: 18, color: '#856404', flexShrink: 0 }} />
                <Text style={{ fontSize: token.fontSizeSM, color: '#856404' }}>
                  <strong>Coins for College</strong> wants to connect to your Exchange account. Sign in to continue.
                </Text>
              </div>
            )}

            {/* Form Header */}
            <div style={{ marginBottom: isMobile ? token.marginMD : token.marginXL }}>
              <Title
                level={2}
                style={{
                  fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading2,
                  fontWeight: fontWeights.bold,
                  color: token.colorText,
                  marginBottom: 4,
                }}
              >
                {isBridgeFlow ? 'Sign in to link your account' : 'Sign in to your account'}
              </Title>
              <Text style={{ fontSize: isMobile ? token.fontSizeSM : token.fontSize, color: token.colorTextSecondary }}>
                {isBridgeFlow
                  ? 'Log in to your UG Coin account to approve the connection'
                  : 'Enter your credentials to access your dashboard'}
              </Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
              size="large"
              autoComplete="off"
            >
              {/* Email Field */}
              <Form.Item
                name="email"
                label={
                  <span style={{ fontWeight: fontWeights.medium, color: token.colorText, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>
                    Email Address
                  </span>
                }
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
                    fontSize: token.fontSize,
                    borderRadius: token.borderRadius,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : token.colorBorder}`,
                  }}
                  autoComplete="nope"
                  name="login_email"
                  disabled={loading}
                />
              </Form.Item>

              {/* Password Field */}
              <Form.Item
                name="password"
                label={
                  <span style={{ fontWeight: fontWeights.medium, color: token.colorText, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>
                    Password
                  </span>
                }
                rules={[{ required: true, message: 'Please enter your password' }]}
                style={{ marginBottom: isMobile ? token.marginXS : token.marginSM }}
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
                  placeholder="Enter your password"
                  style={{
                    height: isMobile ? 44 : 48,
                    fontSize: token.fontSize,
                    borderRadius: token.borderRadius,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : token.colorBgContainer,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : token.colorBorder}`,
                  }}
                  autoComplete="new-password-nope"
                  name="login_password"
                  disabled={loading}
                />
              </Form.Item>

              {/* Remember Me & Forgot Password */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: isMobile ? token.marginMD : token.marginLG,
                }}
              >
                <Form.Item name="remember" valuePropName="checked" noStyle initialValue={true}>
                  <Checkbox disabled={loading}>
                    <span style={{ color: token.colorText, fontSize: isMobile ? token.fontSizeSM : token.fontSize }}>
                      Remember me
                    </span>
                  </Checkbox>
                </Form.Item>
                <Link
                  href="/reset"
                  style={{
                    color: token.colorPrimary,
                    fontWeight: fontWeights.medium,
                    fontSize: isMobile ? token.fontSizeSM : token.fontSize,
                  }}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <Form.Item style={{ marginBottom: isMobile ? token.marginMD : token.marginLG }}>
                <LoadingButton
                  loading={loading}
                  htmlType="submit"
                  style={{
                    height: isMobile ? 48 : 52,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  Sign In
                </LoadingButton>
              </Form.Item>

              {/* Sign Up Link */}
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}>
                  Don&apos;t have an account?{' '}
                  <Link
                    href="/register"
                    style={{
                      color: token.colorPrimary,
                      fontWeight: fontWeights.semibold,
                    }}
                  >
                    Create Account
                  </Link>
                </Text>
              </div>
            </Form>
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

      <style jsx global>{`
        .ant-input::placeholder {
          color: ${token.colorTextSecondary} !important;
        }
        .ant-checkbox-wrapper:hover .ant-checkbox-inner,
        .ant-checkbox:hover .ant-checkbox-inner {
          border-color: ${token.colorPrimary} !important;
        }
        @media (max-width: 767px) {
          .ant-form-item-label {
            padding-bottom: 2px !important;
          }
        }
      `}</style>
    </>
  );
}
