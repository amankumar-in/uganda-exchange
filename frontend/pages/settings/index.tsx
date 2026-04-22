'use client';

import React, { useEffect, useState, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  theme,
  Typography,
  Button,
  Switch,
  Skeleton,
  message,
  Modal,
  Drawer,
  Input,
  Tag,
  Popconfirm,
  Grid,
  Space,
  Descriptions,
  Collapse,
  Avatar,
  Flex,
  Spin,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BellOutlined,
  BankOutlined,
  MailOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExperimentOutlined,
  RocketOutlined,
  SettingOutlined,
  IdcardOutlined,
  KeyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../_app';
import {
  getUserSettings,
  requestPasswordChange,
  changePassword,
  updateNotificationPreferences,
  updateAppMode,
  type UserSettings,
  type AppMode,
} from '@/services/api/settings';
import { resetLearnerAccount } from '@/services/api/learner';
import OTPInput from '@/components/auth/OTPInput';
import dayjs from 'dayjs';
import { Country, State } from 'country-state-city';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;

// Notification Toggle Component with better styling
const NotificationToggle: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, description, checked, onChange, disabled }) => {
  const { token } = useToken();

  return (
    <Flex justify="space-between" align="center" style={{ padding: `${token.paddingXS}px 0` }}>
      <div>
        <Text style={{ fontWeight: fontWeights.medium }}>{label}</Text>
        {description && (
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {description}
          </Text>
        )}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} size="small" />
    </Flex>
  );
};

const SettingsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const { user, isLoading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true);

  // Password change state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordStep, setPasswordStep] = useState<'request' | 'verify'>('request');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // App mode
  const [appMode, setAppMode] = useState<'learner' | 'investor'>('learner');
  const [appModeLoading, setAppModeLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessVisible, setResetSuccessVisible] = useState(false);

  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login?redirect=/settings');
        return;
      }
      loadData();
    }
  }, [user, authLoading, router]);

  // Scroll to a specific settings section when the URL has a hash (e.g. /settings#trading).
  // We wait a tick so the Collapse has rendered before measuring.
  useEffect(() => {
    if (!mounted || loading) return;
    const hash = router.asPath.includes('#') ? router.asPath.split('#')[1] : '';
    if (!hash) return;
    const id = `settings-section-${hash}`;
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timer);
  }, [mounted, loading, router.asPath]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const loadData = async () => {
    setLoading(true);
    setBankAccountsLoading(false);
    try {
      const settingsData = await getUserSettings();

      // KYC decision is synchronous now (Sandbox REST). Backend kycStatus is authoritative.

      setSettings(settingsData);
      setBankAccounts([]);

      if (settingsData.appMode) {
        const mode = settingsData.appMode.toLowerCase() as 'learner' | 'investor';
        setAppMode(mode);
        localStorage.setItem('appMode', mode);
      }
    } catch {
      message.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPasswordChange = async () => {
    setPasswordLoading(true);
    try {
      await requestPasswordChange();
      message.success('Verification code sent to your email');
      setPasswordStep('verify');
      setResendCooldown(60);
    } catch (err) {
      const error = err as Error & { message?: string };
      message.error(error.message || 'Failed to send verification code');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    if (otp.length !== 6) {
      message.error('Please enter the 6-digit verification code');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(otp, newPassword);
      message.success('Password changed successfully');
      setPasswordModalVisible(false);
      resetPasswordModal();
    } catch (err) {
      const error = err as Error & { message?: string };
      message.error(error.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetPasswordModal = () => {
    setPasswordStep('request');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    if (!settings) return;
    try {
      const updatedPrefs = await updateNotificationPreferences({ [key]: value });
      setSettings({ ...settings, notificationPreferences: updatedPrefs });
      message.success('Preference updated');
    } catch {
      message.error('Failed to update preference');
    }
  };

  const handleDeleteBankAccount = async (accountId: string) => {
    try {
      // bank accounts flow removed
      void accountId;
      message.success('Bank account deleted');
      setBankAccounts(bankAccounts.filter((a) => a.id !== accountId));
    } catch {
      message.error('Failed to delete bank account');
    }
  };

  const handleAppModeChange = async (isInvestor: boolean) => {
    if (isInvestor && settings?.kycStatus !== 'APPROVED') {
      message.warning('Complete identity verification to enable Investor mode');
      return;
    }
    if (appModeLoading) return;
    
    const newMode: AppMode = isInvestor ? 'INVESTOR' : 'LEARNER';
    const previousMode = appMode;
    const newLocalMode = newMode.toLowerCase() as 'learner' | 'investor';
    
    setAppMode(newLocalMode);
    localStorage.setItem('appMode', newLocalMode);
    setAppModeLoading(true);
    
    try {
      const result = await updateAppMode(newMode);
      const confirmedMode = result.appMode.toLowerCase() as 'learner' | 'investor';
      localStorage.setItem('appMode', confirmedMode);
      message.success(result.message);
      // Refresh page to reload all data for the new mode
      router.reload();
    } catch (err) {
      setAppMode(previousMode);
      localStorage.setItem('appMode', previousMode);
      const error = err as Error & { message?: string };
      message.error(error.message || 'Failed to switch mode');
    } finally {
      setAppModeLoading(false);
    }
  };

  const handleResetLearnerAccount = async () => {
    setResetLoading(true);
    try {
      await resetLearnerAccount();
      setResetSuccessVisible(true);
    } catch (err) {
      const error = err as Error & { message?: string };
      message.error(error.message || 'Failed to reset learner account');
    } finally {
      setResetLoading(false);
    }
  };

  const formatPhone = () => {
    if (!settings) return '—';
    return `+${settings.phoneCountry} ${settings.phone}`;
  };

  const getCountryName = (code: string | null) => {
    if (!code) return '—';
    const country = Country.getCountryByCode(code);
    return country ? `${country.flag} ${country.name}` : code;
  };

  const getStateName = (countryCode: string | null, stateCode: string | null) => {
    if (!countryCode || !stateCode) return stateCode || '—';
    const state = State.getStateByCodeAndCountry(stateCode, countryCode);
    return state ? state.name : stateCode;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return dayjs(dateString).format('MMM D, YYYY');
  };

  const notificationPrefs = settings?.notificationPreferences || {
    emailMarketing: true,
    emailSecurityAlerts: true,
    emailTransactions: true,
    emailPriceAlerts: false,
    emailNewsUpdates: true,
    pushEnabled: true,
    pushSecurityAlerts: true,
    pushTransactions: true,
    pushPriceAlerts: false,
    pushNewsUpdates: false,
    smsEnabled: true,
    smsSecurityAlerts: true,
    smsTransactions: false,
  };

  const kycStatusConfig: Record<string, { color: string; label: string }> = {
    APPROVED: { color: 'success', label: 'Verified' },
    PENDING: { color: 'warning', label: 'Pending' },
    SUBMITTED: { color: 'processing', label: 'Under Review' },
    REJECTED: { color: 'error', label: 'Rejected' },
  };

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <>
        <Head><title>Settings - InTuition Exchange</title></Head>
        <Skeleton active paragraph={{ rows: 12 }} />
      </>
    );
  }

  // KYC status config for tags
  const kycConfig = kycStatusConfig[settings?.kycStatus || 'PENDING'];

  // Account info items for Descriptions
  const accountItems = [
    { key: 'email', label: 'Email', children: settings?.email || '—' },
    { key: 'phone', label: 'Phone', children: formatPhone() },
    { key: 'country', label: 'Country', children: getCountryName(settings?.country || null) },
    { key: 'member', label: 'Member Since', children: formatDate(settings?.createdAt || null) },
  ];

  // KYC items for Descriptions
  const kycItems = settings?.kyc ? [
    { 
      key: 'name',
      label: 'Full Name',
      children: settings.kyc.aadhaarName || settings.kyc.panName || '—'
    },
    { key: 'dob', label: 'Date of Birth', children: formatDate(settings.kyc.aadhaarDob) },
    { key: 'pan', label: 'PAN', children: settings.kyc.pan ? `${settings.kyc.pan.slice(0, 2)}XXXX${settings.kyc.pan.slice(-2)}` : '—' },
    { key: 'aadhaar', label: 'Aadhaar', children: settings.kyc.aadhaarLast4 ? `XXXX XXXX ${settings.kyc.aadhaarLast4}` : '—' },
    { 
      key: 'address', 
      label: 'Address', 
      children: settings.kyc.city ? `${settings.kyc.city}, ${getStateName(settings.kyc.country, settings.kyc.region)}` : '—' 
    },
    { key: 'kycCountry', label: 'Country', children: getCountryName(settings.kyc.country) },
  ] : [];

  // Collapse items
  const collapseItems = [
    {
      key: 'account',
      label: (
        <Flex align="center" gap={token.marginSM}>
          <Avatar 
            size={32} 
            icon={<UserOutlined />} 
            style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }} 
          />
          <div>
            <Text strong>Account Information</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Your personal details and contact info
            </Text>
          </div>
        </Flex>
      ),
      children: (
        <Descriptions 
          column={isMobile ? 1 : 2} 
          size="small"
          items={accountItems}
          colon={false}
          labelStyle={{ color: token.colorTextSecondary, fontWeight: 500 }}
          contentStyle={{ color: token.colorText }}
        />
      ),
    },
    {
      key: 'trading',
      label: (
        <Flex align="center" gap={token.marginSM} id="settings-section-trading" style={{ scrollMarginTop: 80 }}>
          <Avatar
            size={32}
            icon={appMode === 'investor' ? <RocketOutlined /> : <ExperimentOutlined />}
            style={{
              background: appMode === 'investor'
                ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
                : 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
            }}
          />
          <div>
            <Text strong>Trading Mode</Text>
            <Tag
              color={appMode === 'investor' ? 'success' : 'warning'}
              style={{ margin: 0, marginLeft: 8 }}
            >
              {appMode === 'investor' ? 'Investor' : 'Learner'}
            </Tag>
          </div>
        </Flex>
      ),
      children: (
        <div>
          <Flex 
            align="center" 
            justify="space-between" 
            style={{ 
              padding: token.paddingMD,
              background: isDark ? 'rgba(255,255,255,0.04)' : token.colorFillQuaternary,
              borderRadius: token.borderRadiusLG,
              marginBottom: token.marginMD,
            }}
          >
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Current Mode</Text>
              <div style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 16, fontWeight: fontWeights.semibold }}>
                  {appMode === 'investor' ? 'Real Trading' : 'Practice Mode'}
                </Text>
              </div>
            </div>
            <Flex align="center" gap={token.marginXS}>
              <Text 
                style={{ 
                  fontSize: 13, 
                  fontWeight: appMode === 'learner' ? fontWeights.semibold : fontWeights.normal,
                  color: appMode === 'learner' ? '#F59E0B' : token.colorTextTertiary,
                  transition: 'all 0.2s',
                }}
              >
                <ExperimentOutlined style={{ marginRight: 4 }} />
                Learner
              </Text>
              <Spin spinning={appModeLoading} size="small">
                <Switch
                  checked={appMode === 'investor'}
                  onChange={handleAppModeChange}
                  loading={appModeLoading}
                  disabled={settings?.kycStatus !== 'APPROVED'}
                  style={{
                    backgroundColor: appMode === 'investor' ? '#11998e' : '#F59E0B',
                  }}
                />
              </Spin>
              <Text 
                style={{ 
                  fontSize: 13, 
                  fontWeight: appMode === 'investor' ? fontWeights.semibold : fontWeights.normal,
                  color: appMode === 'investor' ? '#11998e' : token.colorTextTertiary,
                  transition: 'all 0.2s',
                }}
              >
                Investor
                <RocketOutlined style={{ marginLeft: 4 }} />
              </Text>
            </Flex>
          </Flex>
          
          {settings?.kycStatus !== 'APPROVED' && (
            <Flex 
              align="center" 
              justify="space-between"
              style={{ 
                padding: token.paddingSM,
                background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
                borderRadius: token.borderRadiusSM,
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <Text style={{ fontSize: 13, color: '#DC2626' }}>
                Complete identity verification to unlock Investor mode
              </Text>
              <Button size="small" type="primary" danger onClick={() => router.push('/onboarding')}>
                Verify Now
              </Button>
            </Flex>
          )}

          {appMode === 'learner' && (
            <Flex 
              align="center" 
              justify="space-between"
              style={{ 
                padding: token.paddingSM,
                background: isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
                borderRadius: token.borderRadiusSM,
                border: '1px solid rgba(245, 158, 11, 0.2)',
                marginTop: token.marginSM,
              }}
            >
              <div>
                <Text style={{ fontSize: 13 }}>Reset Learner Account</Text>
                <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                  Clear all trades and start fresh with ₹1,00,000
                </Text>
              </div>
              <Popconfirm
                title="Reset Learner Account?"
                description="All trades and history will be cleared."
                onConfirm={handleResetLearnerAccount}
                okText="Reset"
                cancelText="Cancel"
                okButtonProps={{ danger: true, loading: resetLoading }}
              >
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                  loading={resetLoading}
                >
                  Reset
                </Button>
              </Popconfirm>
            </Flex>
          )}
        </div>
      ),
    },
    {
      key: 'security',
      label: (
        <Flex align="center" gap={token.marginSM}>
          <Avatar 
            size={32} 
            icon={<KeyOutlined />} 
            style={{ 
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            }} 
          />
          <div>
            <Text strong>Security</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Password and authentication
            </Text>
          </div>
        </Flex>
      ),
      children: (
        <Flex vertical gap={token.marginSM}>
          <Flex 
            align="center" 
            justify="space-between"
            style={{ 
              padding: token.paddingSM,
              background: isDark ? 'rgba(255,255,255,0.04)' : token.colorFillQuaternary,
              borderRadius: token.borderRadiusSM,
            }}
          >
            <div>
              <Text>Password</Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                Change your account password
              </Text>
            </div>
            <Button size="small" onClick={() => setPasswordModalVisible(true)}>
              Change
            </Button>
          </Flex>
          <Flex 
            align="center" 
            justify="space-between"
            style={{ 
              padding: token.paddingSM,
              background: isDark ? 'rgba(255,255,255,0.04)' : token.colorFillQuaternary,
              borderRadius: token.borderRadiusSM,
            }}
          >
            <div>
              <Text>Two-Factor Authentication</Text>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                Extra layer of security via email OTP
              </Text>
            </div>
            <Tag color="success">Enabled</Tag>
          </Flex>
        </Flex>
      ),
    },
    {
      key: 'kyc',
      label: (
        <Flex align="center" gap={token.marginSM}>
          <Avatar 
            size={32} 
            icon={<IdcardOutlined />} 
            style={{ 
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            }} 
          />
          <div>
            <Flex align="center" gap={8}>
              <Text strong>Identity Verification</Text>
              <Tag color={kycConfig.color} style={{ margin: 0 }}>
                {kycConfig.label}
              </Tag>
            </Flex>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              KYC documentation status
            </Text>
          </div>
        </Flex>
      ),
      children: settings?.kyc ? (
        <Descriptions 
          column={isMobile ? 1 : 2} 
          size="small"
          items={kycItems}
          colon={false}
          labelStyle={{ color: token.colorTextSecondary, fontWeight: 500 }}
          contentStyle={{ color: token.colorText }}
        />
      ) : (
        <Flex vertical align="center" gap={token.marginMD} style={{ padding: token.paddingLG }}>
          <IdcardOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />
          <Text type="secondary">No verification on file</Text>
          <Button type="primary" onClick={() => router.push('/onboarding')}>
            Complete Verification
          </Button>
        </Flex>
      ),
    },
    {
      key: 'bank',
      label: (
        <Flex align="center" gap={token.marginSM}>
          <Avatar 
            size={32} 
            icon={<BankOutlined />} 
            style={{ 
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: '#333',
            }} 
          />
          <div>
            <Text strong>Bank Accounts</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              {bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''} linked
            </Text>
          </div>
        </Flex>
      ),
      extra: (
        <Button 
          size="small" 
          type="text"
          icon={<PlusOutlined />} 
          onClick={(e) => {
            e.stopPropagation();
            router.push('/portfolio/bank-accounts/add');
          }}
        >
          Add
        </Button>
      ),
      children: bankAccountsLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : bankAccounts.length === 0 ? (
        <Flex vertical align="center" gap={token.marginMD} style={{ padding: token.paddingLG }}>
          <BankOutlined style={{ fontSize: 48, color: token.colorTextTertiary }} />
          <Text type="secondary">No bank accounts linked</Text>
          <Button onClick={() => router.push('/portfolio/bank-accounts/add')}>
            Add Bank Account
          </Button>
        </Flex>
      ) : (
        <Flex vertical gap={token.marginXS}>
          {bankAccounts.map((account) => (
            <Flex 
              key={account.id}
              align="center" 
              justify="space-between"
              style={{ 
                padding: token.paddingSM,
                background: isDark ? 'rgba(255,255,255,0.04)' : token.colorFillQuaternary,
                borderRadius: token.borderRadiusSM,
              }}
            >
              <Flex align="center" gap={token.marginSM}>
                <Avatar size="small" icon={<BankOutlined />} />
                <div>
                  <Text>{account.accountName}</Text>
                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                    •••• {account.last4} · {account.accountType}
                  </Text>
                </div>
              </Flex>
              <Flex align="center" gap={token.marginXS}>
                {account.isVerified && (
                  <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                )}
                <Popconfirm
                  title="Delete bank account?"
                  onConfirm={() => handleDeleteBankAccount(account.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Flex>
            </Flex>
          ))}
        </Flex>
      ),
    },
    {
      key: 'notifications',
      label: (
        <Flex align="center" gap={token.marginSM}>
          <Avatar 
            size={32} 
            icon={<BellOutlined />} 
            style={{ 
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              color: '#333',
            }} 
          />
          <div>
            <Text strong>Notifications</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Email and push notification preferences
            </Text>
          </div>
        </Flex>
      ),
      children: (
        <Flex vertical gap={token.marginLG}>
          {/* Email Notifications */}
          <div>
            <Flex align="center" gap={token.marginXS} style={{ marginBottom: token.marginSM }}>
              <MailOutlined style={{ color: token.colorPrimary }} />
              <Text strong style={{ fontSize: 13 }}>Email Notifications</Text>
            </Flex>
            <div 
              style={{ 
                padding: token.paddingSM,
                background: isDark ? 'rgba(255,255,255,0.04)' : token.colorFillQuaternary,
                borderRadius: token.borderRadiusSM,
              }}
            >
              <NotificationToggle
                label="Marketing"
                description="Promotions and offers"
                checked={notificationPrefs.emailMarketing}
                onChange={(val) => handleNotificationChange('emailMarketing', val)}
              />
              <NotificationToggle
                label="Security Alerts"
                description="Login and suspicious activity"
                checked={notificationPrefs.emailSecurityAlerts}
                onChange={(val) => handleNotificationChange('emailSecurityAlerts', val)}
              />
              <NotificationToggle
                label="Transactions"
                description="Trade and payment confirmations"
                checked={notificationPrefs.emailTransactions}
                onChange={(val) => handleNotificationChange('emailTransactions', val)}
              />
              <NotificationToggle
                label="Price Alerts"
                description="Watchlist price movements"
                checked={notificationPrefs.emailPriceAlerts}
                onChange={(val) => handleNotificationChange('emailPriceAlerts', val)}
              />
            </div>
          </div>
          
          {/* Push Notifications */}
          <div>
            <Flex align="center" gap={token.marginXS} style={{ marginBottom: token.marginSM }}>
              <BellOutlined style={{ color: token.colorPrimary }} />
              <Text strong style={{ fontSize: 13 }}>Push Notifications</Text>
            </Flex>
            <div 
              style={{ 
                padding: token.paddingSM,
                background: isDark ? 'rgba(255,255,255,0.04)' : token.colorFillQuaternary,
                borderRadius: token.borderRadiusSM,
              }}
            >
              <NotificationToggle
                label="Enable Push"
                description="Master toggle for all push notifications"
                checked={notificationPrefs.pushEnabled}
                onChange={(val) => handleNotificationChange('pushEnabled', val)}
              />
              <NotificationToggle
                label="Security Alerts"
                checked={notificationPrefs.pushSecurityAlerts}
                onChange={(val) => handleNotificationChange('pushSecurityAlerts', val)}
                disabled={!notificationPrefs.pushEnabled}
              />
              <NotificationToggle
                label="Transactions"
                checked={notificationPrefs.pushTransactions}
                onChange={(val) => handleNotificationChange('pushTransactions', val)}
                disabled={!notificationPrefs.pushEnabled}
              />
            </div>
          </div>
        </Flex>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>Settings - InTuition Exchange</title>
        <meta name="description" content="Manage your account settings" />
      </Head>

      <div style={{ minHeight: '100%', maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <Flex align="center" gap={token.marginMD} style={{ marginBottom: token.marginLG }}>
          <Avatar 
            size={48} 
            icon={<SettingOutlined />}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          />
          <div>
            <Title level={4} style={{ margin: 0 }}>Settings</Title>
            <Text type="secondary">Manage your account preferences</Text>
          </div>
        </Flex>

        {/* Collapse Sections */}
        <Collapse
          defaultActiveKey={['account', 'trading']}
          ghost
          expandIconPlacement="end"
          items={collapseItems}
          style={{
            background: 'transparent',
          }}
          styles={{
            header: {
              padding: `${token.paddingMD}px ${token.paddingSM}px`,
              borderRadius: token.borderRadiusLG,
              background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
              marginBottom: token.marginSM,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : token.colorBorderSecondary}`,
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
            },
            body: {
              padding: `${token.paddingMD}px ${token.paddingSM}px`,
              paddingTop: 0,
            },
          }}
        />
      </div>

      {/* Password Change Modal */}
      <Modal
        open={passwordModalVisible}
        onCancel={() => { setPasswordModalVisible(false); resetPasswordModal(); }}
        footer={null}
        title={<Space><LockOutlined /><span>Change Password</span></Space>}
        width={400}
      >
        {passwordStep === 'request' ? (
          <div style={{ textAlign: 'center', padding: token.paddingMD }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: token.marginMD,
              }}
            >
              <LockOutlined style={{ fontSize: 24, color: '#fff' }} />
            </div>
            <Text style={{ display: 'block', marginBottom: token.marginSM }}>
              We&apos;ll send a code to <strong>{settings?.email}</strong>
            </Text>
            <Button type="primary" loading={passwordLoading} onClick={handleRequestPasswordChange} block>
              Send Code
            </Button>
          </div>
        ) : (
          <div style={{ padding: token.paddingXS }}>
            <div style={{ marginBottom: token.marginMD }}>
              <Text style={{ fontWeight: fontWeights.medium, marginBottom: token.marginXS, display: 'block' }}>
                Verification Code
              </Text>
              <OTPInput value={otp} onChange={setOtp} disabled={passwordLoading} />
              <Text
                style={{
                  fontSize: 12,
                  color: resendCooldown > 0 ? token.colorTextDisabled : token.colorPrimary,
                  cursor: resendCooldown > 0 ? 'default' : 'pointer',
                  marginTop: token.marginSM,
                  textAlign: 'center',
                  display: 'block',
                }}
                onClick={resendCooldown > 0 ? undefined : handleRequestPasswordChange}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
              </Text>
            </div>

            <div style={{ marginBottom: token.marginSM }}>
              <Text style={{ fontWeight: fontWeights.medium, marginBottom: 4, display: 'block' }}>
                New Password
              </Text>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
                suffix={
                  <span onClick={() => setShowPassword(!showPassword)} style={{ cursor: 'pointer', color: token.colorTextTertiary }}>
                    {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                  </span>
                }
              />
            </div>

            <div style={{ marginBottom: token.marginMD }}>
              <Text style={{ fontWeight: fontWeights.medium, marginBottom: 4, display: 'block' }}>
                Confirm Password
              </Text>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
              />
            </div>

            <Button
              type="primary"
              loading={passwordLoading}
              onClick={handleChangePassword}
              block
              disabled={otp.length !== 6 || !newPassword || !confirmPassword}
            >
              Change Password
            </Button>
          </div>
        )}
      </Modal>

      {/* Reset Success Modal (Desktop) / Drawer (Mobile) */}
      {isMobile ? (
        <Drawer
          placement="bottom"
          open={resetSuccessVisible}
          onClose={() => setResetSuccessVisible(false)}
          height="auto"
          closable={false}
          zIndex={1100}
          styles={{
            wrapper: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            },
            body: {
              padding: token.paddingLG,
              paddingBottom: token.paddingXL + 16,
            },
          }}
        >
          <div style={{ textAlign: 'center' }}>
            {/* Drag indicator */}
            <div
              style={{
                width: 36,
                height: 4,
                background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                borderRadius: 2,
                margin: '0 auto',
                marginBottom: token.marginLG,
              }}
            />

            {/* Celebration emoji */}
            <div style={{ fontSize: 56, marginBottom: token.marginMD }}>
              🚀
            </div>

            {/* Title */}
            <Title level={4} style={{ margin: 0, marginBottom: token.marginXS }}>
              Fresh Start!
            </Title>

            {/* Balance amount */}
            <div
              style={{
                fontSize: 36,
                fontWeight: fontWeights.bold,
                background: 'linear-gradient(135deg, #0d7377 0%, #14919b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: token.marginSM,
              }}
            >
              ₹1,00,000
            </div>

            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginLG }}>
              virtual balance ready to trade
            </Text>

            {/* Motivational message */}
            <div
              style={{
                padding: token.paddingMD,
                background: isDark ? 'rgba(13, 115, 119, 0.15)' : 'rgba(13, 115, 119, 0.08)',
                borderRadius: token.borderRadiusLG,
                marginBottom: token.marginLG,
              }}
            >
              <Text style={{ fontSize: 15 }}>
                Think you can turn it into{' '}
                <span style={{ fontWeight: fontWeights.bold, color: token.colorPrimary }}>
                  ₹1 crore
                </span>
                ?
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 13 }}>
                Practice smart, trade wisely, and see how far you can go.
              </Text>
            </div>

            {/* Action button */}
            <Button
              type="primary"
              size="large"
              block
              onClick={() => {
                setResetSuccessVisible(false);
                router.push('/overview');
              }}
              style={{
                height: 48,
                borderRadius: token.borderRadiusLG,
                fontWeight: fontWeights.semibold,
              }}
            >
              Start Trading
            </Button>
          </div>
        </Drawer>
      ) : (
        <Modal
          open={resetSuccessVisible}
          onCancel={() => setResetSuccessVisible(false)}
          footer={null}
          centered
          width={400}
          closable={true}
          zIndex={1100}
        >
          <div style={{ textAlign: 'center', padding: `${token.paddingMD}px 0` }}>
            {/* Celebration emoji */}
            <div style={{ fontSize: 64, marginBottom: token.marginMD }}>
              🚀
            </div>

            {/* Title */}
            <Title level={3} style={{ margin: 0, marginBottom: token.marginXS }}>
              Fresh Start!
            </Title>

            {/* Balance amount */}
            <div
              style={{
                fontSize: 42,
                fontWeight: fontWeights.bold,
                background: 'linear-gradient(135deg, #0d7377 0%, #14919b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: token.marginSM,
              }}
            >
              ₹1,00,000
            </div>

            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginLG, fontSize: 15 }}>
              virtual balance ready to trade
            </Text>

            {/* Motivational message */}
            <div
              style={{
                padding: token.paddingMD,
                background: isDark ? 'rgba(13, 115, 119, 0.15)' : 'rgba(13, 115, 119, 0.08)',
                borderRadius: token.borderRadiusLG,
                marginBottom: token.marginLG,
              }}
            >
              <Text style={{ fontSize: 16 }}>
                Think you can turn it into{' '}
                <span style={{ fontWeight: fontWeights.bold, color: token.colorPrimary }}>
                  ₹1 crore
                </span>
                ?
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 14 }}>
                Practice smart, trade wisely, and see how far you can go.
              </Text>
            </div>

            {/* Action button */}
            <Button
              type="primary"
              size="large"
              block
              onClick={() => {
                setResetSuccessVisible(false);
                router.push('/overview');
              }}
              style={{
                height: 48,
                borderRadius: token.borderRadiusLG,
                fontWeight: fontWeights.semibold,
              }}
            >
              Start Trading
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

SettingsPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default SettingsPage;
