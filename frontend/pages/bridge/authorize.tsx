/**
 * Bridge Authorize Page
 * Shown when a CFC user is redirected here to approve account linking.
 * If not logged in, redirects to /login with return URL.
 * If logged in, shows approve/deny screen, then redirects back to CFC callback.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import { Typography, Button, Spin, message, theme, Grid } from 'antd';
import {
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { fontWeights } from '@/theme/themeConfig';

const { Text, Title } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export default function BridgeAuthorizePage() {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoggedIn, isLoading: authLoading } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;

  const isRouterReady = router.isReady;
  const { state, callback, cfcEmail } = (isRouterReady ? router.query : {}) as { state?: string; callback?: string; cfcEmail?: string };

  useEffect(() => {
    setMounted(true);
  }, []);

  // If not logged in, redirect to login with return URL
  useEffect(() => {
    if (!isRouterReady || authLoading || !mounted) return;
    if (!isLoggedIn) {
      let currentPath = `/bridge/authorize?state=${encodeURIComponent(state || '')}&callback=${encodeURIComponent(callback || '')}`;
      if (cfcEmail) {
        currentPath += `&cfcEmail=${encodeURIComponent(cfcEmail)}`;
      }
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [isRouterReady, authLoading, isLoggedIn, mounted, state, callback, cfcEmail, router]);

  const handleApprove = async () => {
    if (!state || !callback) {
      message.error('Invalid authorization request. Missing parameters.');
      return;
    }

    setLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/bridge/generate-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ state }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate authorization code');
      }

      const code = data.data.code;
      // Redirect back to CFC callback with code and state
      const redirectUrl = `${callback}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      window.location.href = redirectUrl;
    } catch (error: any) {
      message.error(error.message || 'Authorization failed. Please try again.');
      setLoading(false);
    }
  };

  const handleDeny = () => {
    if (!callback || !state) {
      router.push('/overview');
      return;
    }
    const redirectUrl = `${callback}?error=denied&state=${encodeURIComponent(state)}`;
    window.location.href = redirectUrl;
  };

  // Show nothing while checking auth or waiting for query params
  if (authLoading || !mounted || !isRouterReady || !isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#0f0f14' : '#f8f9fc' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Authorize Account Linking - InTuition Exchange</title>
      </Head>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? '#0f0f14' : '#f8f9fc',
          padding: token.paddingLG,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            maxWidth: 480,
            width: '100%',
            backgroundColor: isDark ? '#1a1a24' : '#ffffff',
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: `${token.paddingLG}px ${token.paddingXL}px`,
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: token.marginMD }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  src="/images/intuition-logo-no-text.svg"
                  alt="InTuition"
                  width={28}
                  height={28}
                />
              </div>
              <LinkOutlined style={{ fontSize: 24, color: 'rgba(255,255,255,0.6)' }} />
              <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                CFC
              </div>
            </div>
            <Title level={4} style={{ color: '#ffffff', margin: 0, fontWeight: fontWeights.bold }}>
              Account Linking Request
            </Title>
          </div>

          {/* Body */}
          <div style={{ padding: `${token.paddingLG}px ${token.paddingXL}px` }}>
            <Text style={{ fontSize: token.fontSizeLG, color: token.colorText, display: 'block', marginBottom: token.marginLG }}>
              <strong>Coins for College</strong> wants to link to your InTuition Exchange account.
            </Text>

            {/* Account linking info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: token.marginLG,
              }}
            >
              {/* CFC account */}
              <div
                style={{
                  flex: 1,
                  padding: token.paddingSM,
                  borderRadius: token.borderRadius,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  textAlign: 'center',
                }}
              >
                <Text style={{ fontSize: 11, color: token.colorTextSecondary, display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CFC Account
                </Text>
                <Text style={{ fontSize: token.fontSizeSM, color: token.colorText, fontWeight: fontWeights.semibold, wordBreak: 'break-all' }}>
                  {cfcEmail || 'Your CFC account'}
                </Text>
              </div>

              {/* Arrow */}
              <LinkOutlined style={{ fontSize: 18, color: token.colorTextSecondary, flexShrink: 0 }} />

              {/* Exchange account */}
              <div
                style={{
                  flex: 1,
                  padding: token.paddingSM,
                  borderRadius: token.borderRadius,
                  backgroundColor: isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.06)',
                  border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.25)' : 'rgba(102, 126, 234, 0.15)'}`,
                  textAlign: 'center',
                }}
              >
                <Text style={{ fontSize: 11, color: token.colorTextSecondary, display: 'block', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Exchange Account
                </Text>
                <Text style={{ fontSize: token.fontSizeSM, color: token.colorText, fontWeight: fontWeights.semibold, wordBreak: 'break-all' }}>
                  {user?.email}
                </Text>
              </div>
            </div>

            {/* Permissions */}
            <div style={{ marginBottom: token.marginLG }}>
              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, display: 'block', marginBottom: token.marginSM }}>
                This will allow Coins for College to:
              </Text>
              <ul style={{ margin: 0, paddingLeft: 20, color: token.colorText, lineHeight: 2 }}>
                <li>Sync your mining earnings to your Exchange wallet</li>
                <li>Migrate your college coin balances</li>
                <li>View your linked account status</li>
              </ul>
            </div>

            {/* Security note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: token.paddingSM,
                borderRadius: token.borderRadius,
                backgroundColor: isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.06)',
                marginBottom: token.marginXL,
              }}
            >
              <SafetyCertificateOutlined style={{ color: '#667eea', fontSize: 16 }} />
              <Text style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                CFC will never have access to your Exchange password or funds.
              </Text>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                size="large"
                onClick={handleDeny}
                disabled={loading}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: token.borderRadius,
                }}
              >
                <CloseCircleOutlined /> Deny
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={handleApprove}
                loading={loading}
                style={{
                  flex: 2,
                  height: 48,
                  borderRadius: token.borderRadius,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                }}
              >
                <CheckCircleOutlined /> Approve Linking
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
