'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Skeleton, theme } from 'antd';
import { useAuth } from '@/context/AuthContext';

const { useToken } = theme;

interface RequireKycProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper component that ensures the user is logged in.
 * KYC is disabled for this exchange, so it acts as an auth wrapper.
 */
const RequireKyc: React.FC<RequireKycProps> = ({ children, fallback }) => {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Not logged in - redirect to login
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      return;
    }

    // Auto-approve since KYC is disabled
    setChecking(false);
  }, [user, authLoading, router]);

  // Show loading while checking
  if (authLoading || checking) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div
        style={{
          padding: token.paddingXL,
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  // Auth confirmed - render children
  return <>{children}</>;
};

export default RequireKyc;
