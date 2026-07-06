import React, { useState, useEffect, useCallback, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { theme, Grid, Input, Button, message } from 'antd';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CreditCardOutlined,
  MobileOutlined,
  BankOutlined,
  WalletOutlined,
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrl } from '@/services/api/config';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type Step = 'amount' | 'method' | 'details' | 'processing' | 'success';
type PaymentMethod = 'mobile_money' | 'card' | 'bank';

// Accent / brand palette
const colors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.12)',
  warning: '#F59E0B',
  gradientPrimary: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  gradientSuccess: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
  gradientCard: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
};

// Quick-pick amounts
const QUICK_AMOUNTS = [50_000, 100_000, 500_000, 1_000_000, 5_000_000];

const DepositPage = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const { user } = useAuth();
  const isDark = mode === 'dark';
  const isMobile = !screens.md;

  // State
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('mobile_money');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState('');

  // Mobile money fields
  const [mobileNumber, setMobileNumber] = useState('');

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');

  // SMS verification (for card)
  const [smsCode, setSmsCode] = useState('');
  const [showSmsVerify, setShowSmsVerify] = useState(false);

  const [error, setError] = useState('');

  const numericAmount = parseFloat(amount.replace(/,/g, '')) || 0;

  // ─── Styles ──────────────────────────────────────────
  const pageBg = isDark
    ? 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)'
    : 'linear-gradient(180deg, #f8f9fc 0%, #eef1f8 100%)';

  const cardBg = isDark ? 'rgba(30, 30, 50, 0.6)' : 'rgba(255, 255, 255, 0.85)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const subtleText = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  // Format amount for display
  const formatAmount = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    if (!num) return '';
    return parseInt(num).toLocaleString('en-UG');
  };

  const handleAmountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (cleaned.length <= 10) {
      setAmount(cleaned ? parseInt(cleaned).toLocaleString('en-UG') : '');
    }
    setError('');
  };

  const handleQuickAmount = (amt: number) => {
    setAmount(amt.toLocaleString('en-UG'));
    setError('');
  };

  // Card number formatting
  const handleCardNumberChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  };

  // Expiry formatting
  const handleExpiryChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setCardExpiry(digits);
    }
  };

  // ─── Step navigation ─────────────────────────────────
  const goToMethod = () => {
    if (numericAmount < 1000) {
      setError('Minimum deposit is UGX 1,000');
      return;
    }
    if (numericAmount > 40_000_000) {
      setError('Maximum single deposit is UGX 40,000,000');
      return;
    }
    setError('');
    setStep('method');
  };

  const goToDetails = () => {
    setStep('details');
  };

  const goBack = () => {
    if (step === 'method') setStep('amount');
    else if (step === 'details') {
      setShowSmsVerify(false);
      setStep('method');
    }
    else if (step === 'success') router.push('/portfolio');
  };

  // ─── Deposit submission ──────────────────────────────
  const submitDeposit = useCallback(async () => {
    // Validate details
    if (method === 'mobile_money') {
      const clean = mobileNumber.replace(/\s/g, '');
      if (clean.length < 9) {
        setError('Enter a valid Uganda mobile number');
        return;
      }
    } else if (method === 'card') {
      if (!showSmsVerify) {
        // First: validate card, then show SMS step
        const digits = cardNumber.replace(/\s/g, '');
        if (digits.length < 13 || digits.length > 19) {
          setError('Enter a valid card number');
          return;
        }
        if (cardExpiry.length < 5) {
          setError('Enter a valid expiry date (MM/YY)');
          return;
        }
        if (cardCvc.length < 3) {
          setError('Enter a valid CVC');
          return;
        }
        if (!cardName.trim()) {
          setError('Enter the cardholder name');
          return;
        }
        setError('');
        setShowSmsVerify(true);
        return;
      }
      // SMS code validation (any 6-digit code works for dummy)
      if (smsCode.length < 4) {
        setError('Enter the verification code sent to your phone');
        return;
      }
    }

    setError('');
    setStep('processing');

    // Simulated processing animation
    const labels = method === 'mobile_money'
      ? ['Connecting to Mobile Money...', 'Verifying account...', 'Processing payment...', 'Confirming deposit...']
      : ['Verifying card details...', 'Authorizing payment...', 'Processing transaction...', 'Confirming deposit...'];

    for (let i = 0; i < labels.length; i++) {
      setProcessingLabel(labels[i]);
      setProcessingProgress(((i + 1) / labels.length) * 100);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    }

    // Make API call
    try {
      const apiBase = getApiBaseUrl();
      const authToken = localStorage.getItem('authToken');
      const res = await fetch(`${apiBase}/fiat/dummy-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ amount: numericAmount, method: method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStep('details');
        setError(data.message || 'Deposit failed. Please try again.');
        return;
      }

      // Small delay before success
      await new Promise(r => setTimeout(r, 600));
      setStep('success');
      message.success('A confirmation SMS has been sent to your phone');
      
      // Tell the DashboardLayout to refresh the portfolio header value
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('refresh_portfolio_header'));
      }
    } catch (err: any) {
      setStep('details');
      setError(err.message || 'Network error. Please try again.');
    }
  }, [method, mobileNumber, cardNumber, cardExpiry, cardCvc, cardName, showSmsVerify, smsCode, numericAmount]);

  // ─── Render helpers ──────────────────────────────────

  const renderProgressBar = () => {
    const steps: Step[] = ['amount', 'method', 'details'];
    const currentIndex = steps.indexOf(step);
    const progress = step === 'processing' || step === 'success' ? 100 : ((currentIndex + 1) / steps.length) * 100;

    return (
      <div style={{ width: '100%', height: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{ height: '100%', background: colors.gradientPrimary, borderRadius: 2 }}
        />
      </div>
    );
  };

  const renderHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginMD, padding: `${token.paddingLG}px ${token.paddingLG}px ${token.paddingMD}px` }}>
      {step !== 'processing' && step !== 'success' && (
        <motion.div
          whileTap={{ scale: 0.9 }}
          onClick={step === 'amount' ? () => router.back() : goBack}
          style={{ cursor: 'pointer', width: 40, height: 40, borderRadius: 12, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeftOutlined style={{ fontSize: 16, color: token.colorText }} />
        </motion.div>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: token.colorText }}>
          {step === 'amount' && 'Add Funds'}
          {step === 'method' && 'Payment Method'}
          {step === 'details' && (method === 'mobile_money' ? 'Mobile Money' : 'Card Payment')}
          {step === 'processing' && 'Processing'}
          {step === 'success' && 'Deposit Complete'}
        </div>
        {step !== 'processing' && step !== 'success' && (
          <div style={{ fontSize: token.fontSizeSM, color: subtleText }}>
            {step === 'amount' && 'Enter the amount you want to deposit'}
            {step === 'method' && `UGX ${numericAmount.toLocaleString('en-UG')}`}
            {step === 'details' && `UGX ${numericAmount.toLocaleString('en-UG')}`}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: subtleText, fontSize: 12 }}>
        <LockOutlined /> Secure
      </div>
    </div>
  );

  // ─── Step: Amount ────────────────────────────────────
  const renderAmountStep = () => (
    <motion.div
      key="amount"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3 }}
      style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {/* Large amount display */}
      <div style={{ textAlign: 'center', padding: `${token.paddingXL * 2}px 0 ${token.paddingLG}px` }}>
        <div style={{ fontSize: 14, color: subtleText, marginBottom: 8, fontWeight: fontWeights.medium }}>Amount (UGX)</div>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Input
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            autoFocus
            style={{
              fontSize: isMobile ? 40 : 56,
              fontWeight: fontWeights.bold,
              textAlign: 'center',
              border: 'none',
              background: 'transparent',
              color: token.colorText,
              padding: 0,
              width: '100%',
              maxWidth: 400,
              boxShadow: 'none',
              caretColor: colors.primary,
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: -4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: 2,
            background: numericAmount > 0 ? colors.gradientPrimary : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
            borderRadius: 1,
            transition: 'background 0.3s ease',
          }} />
        </div>
      </div>

      {/* Quick amounts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: token.marginLG }}>
        {QUICK_AMOUNTS.map(amt => (
          <motion.button
            key={amt}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleQuickAmount(amt)}
            style={{
              background: numericAmount === amt
                ? colors.gradientPrimary
                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
              color: numericAmount === amt ? '#fff' : token.colorText,
              border: numericAmount === amt ? 'none' : `1px solid ${cardBorder}`,
              borderRadius: 20,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: fontWeights.semibold,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {amt >= 1_000_000 ? `${amt / 1_000_000}M` : `${amt / 1_000}K`}
          </motion.button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginBottom: token.marginMD }}
        >
          {error}
        </motion.div>
      )}

      {/* Info */}
      <div style={{ textAlign: 'center', fontSize: 12, color: subtleText, marginBottom: token.marginLG }}>
        <SafetyOutlined style={{ marginRight: 4 }} />
        Maximum cumulative deposit: UGX 40,000,000
      </div>

      {/* Continue button */}
      <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL }}>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            type="primary"
            block
            size="large"
            disabled={numericAmount < 1000}
            onClick={goToMethod}
            style={{
              height: 56,
              borderRadius: 16,
              background: numericAmount >= 1000 ? colors.gradientPrimary : undefined,
              border: 'none',
              fontSize: 16,
              fontWeight: fontWeights.bold,
              boxShadow: numericAmount >= 1000 ? '0 8px 24px rgba(99, 102, 241, 0.3)' : 'none',
            }}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );

  // ─── Step: Method ────────────────────────────────────
  const renderMethodStep = () => {
    const methods = [
      {
        key: 'mobile_money' as PaymentMethod,
        label: 'UG Mobile Money',
        desc: 'MTN, Airtel, or any Uganda mobile wallet',
        icon: <MobileOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
        available: true,
      },
      {
        key: 'card' as PaymentMethod,
        label: 'Credit / Debit Card',
        desc: 'Visa, Mastercard, or any supported card',
        icon: <CreditCardOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        available: true,
      },
      {
        key: 'bank' as PaymentMethod,
        label: 'Bank Transfer',
        desc: 'Direct bank wire transfer',
        icon: <BankOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)',
        available: false,
      },
    ];

    return (
      <motion.div
        key="method"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.3 }}
        style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: token.marginMD }}>
          {methods.map((m, idx) => {
            const isSelected = method === m.key && m.available;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                whileTap={m.available ? { scale: 0.98 } : undefined}
                onClick={() => { if (m.available) setMethod(m.key); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: token.marginMD,
                  padding: token.paddingLG,
                  borderRadius: 16,
                  background: cardBg,
                  border: `2px solid ${isSelected ? colors.primary : cardBorder}`,
                  cursor: m.available ? 'pointer' : 'not-allowed',
                  opacity: m.available ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: m.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {m.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: fontWeights.semibold, color: token.colorText }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: subtleText, marginTop: 2 }}>{m.desc}</div>
                </div>
                {!m.available && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: fontWeights.bold,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)',
                    padding: '3px 10px',
                    borderRadius: 20,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}>
                    Coming Soon
                  </div>
                )}
                {isSelected && (
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: colors.gradientPrimary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CheckCircleFilled style={{ color: '#fff', fontSize: 14 }} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Continue */}
        <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL, paddingTop: token.paddingLG }}>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              type="primary"
              block
              size="large"
              onClick={goToDetails}
              style={{
                height: 56,
                borderRadius: 16,
                background: colors.gradientPrimary,
                border: 'none',
                fontSize: 16,
                fontWeight: fontWeights.bold,
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
              }}
            >
              Continue with {method === 'mobile_money' ? 'Mobile Money' : 'Card'}
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  };

  // ─── Step: Details ───────────────────────────────────
  const renderDetailsStep = () => {
    if (method === 'mobile_money') {
      return (
        <motion.div
          key="details-momo"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
          style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          {/* Mobile Money icon + description */}
          <div style={{ textAlign: 'center', padding: `${token.paddingXL}px 0` }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: token.marginMD,
            }}>
              <MobileOutlined style={{ fontSize: 36, color: '#fff' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: fontWeights.semibold, color: token.colorText }}>
              Enter your Mobile Money number
            </div>
            <div style={{ fontSize: 13, color: subtleText, marginTop: 4 }}>
              Enter the phone number associated with your mobile wallet
            </div>
          </div>

          {/* Phone input */}
          <div style={{
            background: cardBg,
            borderRadius: 16,
            border: `1px solid ${cardBorder}`,
            padding: token.paddingLG,
            marginBottom: token.marginLG,
          }}>
            <div style={{ fontSize: 12, color: subtleText, marginBottom: 8, fontWeight: fontWeights.medium }}>
              Phone Number
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                padding: '8px 12px',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: fontWeights.semibold,
                color: token.colorText,
                flexShrink: 0,
              }}>
                🇺🇬 +256
              </div>
              <Input
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="7XX XXX XXX"
                inputMode="tel"
                autoFocus
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 18,
                  fontWeight: fontWeights.semibold,
                  padding: '8px 0',
                  boxShadow: 'none',
                  letterSpacing: '0.05em',
                }}
              />
            </div>
          </div>

          {/* Summary */}
          <div style={{
            background: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)',
            borderRadius: 12,
            padding: token.paddingMD,
            marginBottom: token.marginLG,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: subtleText }}>You deposit</span>
              <span style={{ fontSize: 15, fontWeight: fontWeights.bold, color: token.colorText }}>
                UGX {numericAmount.toLocaleString('en-UG')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: subtleText }}>Fee</span>
              <span style={{ fontSize: 13, color: colors.success, fontWeight: fontWeights.semibold }}>Free</span>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginBottom: token.marginMD }}
            >
              {error}
            </motion.div>
          )}

          <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL }}>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                type="primary"
                block
                size="large"
                onClick={submitDeposit}
                style={{
                  height: 56,
                  borderRadius: 16,
                  background: colors.gradientPrimary,
                  border: 'none',
                  fontSize: 16,
                  fontWeight: fontWeights.bold,
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
                }}
              >
                Deposit UGX {numericAmount.toLocaleString('en-UG')}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      );
    }

    // Card payment details
    return (
      <motion.div
        key="details-card"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.3 }}
        style={{ padding: `0 ${token.paddingLG}px`, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}
      >
        <AnimatePresence mode="wait">
          {!showSmsVerify ? (
            <motion.div key="card-form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Card visual preview */}
              <div style={{
                background: colors.gradientCard,
                borderRadius: 20,
                padding: '24px 20px',
                marginBottom: token.marginLG,
                marginTop: token.marginMD,
                position: 'relative',
                overflow: 'hidden',
                minHeight: 180,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                <div style={{ position: 'absolute', bottom: -30, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <CreditCardOutlined style={{ fontSize: 28, color: 'rgba(255,255,255,0.6)' }} />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>DEBIT / CREDIT</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: fontWeights.semibold, color: '#fff', letterSpacing: '0.15em', fontFamily: 'monospace', marginTop: 20 }}>
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Card Holder</div>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: fontWeights.medium }}>{cardName || 'YOUR NAME'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Expires</div>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: fontWeights.medium }}>{cardExpiry || 'MM/YY'}</div>
                  </div>
                </div>
              </div>

              {/* Card form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: subtleText, marginBottom: 6, fontWeight: fontWeights.medium }}>Card Number</div>
                  <Input
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    inputMode="numeric"
                    autoFocus
                    prefix={<CreditCardOutlined style={{ color: subtleText }} />}
                    style={{ height: 48, borderRadius: 12, fontSize: 16, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: subtleText, marginBottom: 6, fontWeight: fontWeights.medium }}>Expiry Date</div>
                    <Input
                      value={cardExpiry}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      placeholder="MM/YY"
                      inputMode="numeric"
                      style={{ height: 48, borderRadius: 12, fontSize: 16, textAlign: 'center' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: subtleText, marginBottom: 6, fontWeight: fontWeights.medium }}>CVC</div>
                    <Input
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      inputMode="numeric"
                      type="password"
                      prefix={<LockOutlined style={{ color: subtleText }} />}
                      style={{ height: 48, borderRadius: 12, fontSize: 16, textAlign: 'center' }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: subtleText, marginBottom: 6, fontWeight: fontWeights.medium }}>Cardholder Name</div>
                  <Input
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="John Doe"
                    style={{ height: 48, borderRadius: 12, fontSize: 16 }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div style={{
                background: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)',
                borderRadius: 12,
                padding: token.paddingMD,
                marginTop: token.marginLG,
                marginBottom: token.marginMD,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: subtleText }}>You deposit</span>
                  <span style={{ fontSize: 15, fontWeight: fontWeights.bold, color: token.colorText }}>
                    UGX {numericAmount.toLocaleString('en-UG')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: subtleText }}>Fee</span>
                  <span style={{ fontSize: 13, color: colors.success, fontWeight: fontWeights.semibold }}>Free</span>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginBottom: token.marginMD }}
                >
                  {error}
                </motion.div>
              )}

              <div style={{ paddingBottom: token.paddingXL, paddingTop: token.paddingSM }}>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    type="primary"
                    block
                    size="large"
                    onClick={submitDeposit}
                    style={{
                      height: 56,
                      borderRadius: 16,
                      background: colors.gradientPrimary,
                      border: 'none',
                      fontSize: 16,
                      fontWeight: fontWeights.bold,
                      boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    Pay UGX {numericAmount.toLocaleString('en-UG')}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            // SMS verification step
            <motion.div
              key="sms-verify"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: token.paddingXL * 2 }}
            >
              <div style={{ textAlign: 'center', marginBottom: token.marginXL }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: colors.gradientPrimary,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: token.marginMD,
                }}>
                  <SafetyOutlined style={{ fontSize: 36, color: '#fff' }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: fontWeights.bold, color: token.colorText }}>
                  Verify Payment
                </div>
                <div style={{ fontSize: 13, color: subtleText, marginTop: 8, maxWidth: 300, margin: '8px auto 0' }}>
                  We&apos;ve sent a verification code to your registered phone number ending in ****{user?.phone?.slice(-4) || '0000'}
                </div>
              </div>

              <div style={{ maxWidth: 280, margin: '0 auto', width: '100%' }}>
                <Input
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter code"
                  inputMode="numeric"
                  autoFocus
                  style={{
                    height: 56,
                    borderRadius: 14,
                    fontSize: 24,
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                    fontWeight: fontWeights.bold,
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ textAlign: 'center', marginTop: token.marginSM }}>
                  <span style={{ fontSize: 12, color: subtleText }}>
                    For testing: enter any 4+ digit code
                  </span>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginTop: token.marginMD }}
                >
                  {error}
                </motion.div>
              )}

              <div style={{ marginTop: 'auto', paddingBottom: token.paddingXL }}>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    type="primary"
                    block
                    size="large"
                    disabled={smsCode.length < 4}
                    onClick={submitDeposit}
                    style={{
                      height: 56,
                      borderRadius: 16,
                      background: smsCode.length >= 4 ? colors.gradientPrimary : undefined,
                      border: 'none',
                      fontSize: 16,
                      fontWeight: fontWeights.bold,
                      boxShadow: smsCode.length >= 4 ? '0 8px 24px rgba(99, 102, 241, 0.3)' : 'none',
                    }}
                  >
                    Confirm Payment
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ─── Step: Processing ────────────────────────────────
  const renderProcessingStep = () => (
    <motion.div
      key="processing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: token.paddingXL,
        textAlign: 'center',
      }}
    >
      {/* Animated spinner */}
      <div style={{ position: 'relative', width: 100, height: 100, marginBottom: token.marginXL }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            border: `3px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            borderTopColor: colors.primary,
            borderRightColor: colors.primary,
          }}
        />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 28,
        }}>
          {method === 'mobile_money' ? '📱' : '💳'}
        </div>
      </div>

      <motion.div
        key={processingLabel}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ fontSize: 16, fontWeight: fontWeights.semibold, color: token.colorText, marginBottom: 8 }}
      >
        {processingLabel}
      </motion.div>

      <div style={{ fontSize: 13, color: subtleText, marginBottom: token.marginLG }}>
        Please don&apos;t close this page
      </div>

      {/* Progress bar */}
      <div style={{
        width: '80%',
        maxWidth: 300,
        height: 6,
        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <motion.div
          animate={{ width: `${processingProgress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: colors.gradientPrimary,
            borderRadius: 3,
          }}
        />
      </div>
    </motion.div>
  );

  // ─── Step: Success ───────────────────────────────────
  const renderSuccessStep = () => (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: token.paddingXL,
        textAlign: 'center',
      }}
    >
      {/* Success checkmark animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: colors.gradientSuccess,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: token.marginXL,
          boxShadow: '0 12px 32px rgba(16, 185, 129, 0.3)',
        }}
      >
        <CheckCircleFilled style={{ fontSize: 48, color: '#fff' }} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div style={{ fontSize: 24, fontWeight: fontWeights.bold, color: token.colorText, marginBottom: 8 }}>
          Deposit Successful!
        </div>
        <div style={{ fontSize: 32, fontWeight: fontWeights.bold, color: colors.success, marginBottom: 8 }}>
          UGX {numericAmount.toLocaleString('en-UG')}
        </div>
        <div style={{ fontSize: 14, color: subtleText }}>
          has been added to your account
        </div>
      </motion.div>

      {/* Receipt summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: token.paddingLG,
          width: '100%',
          maxWidth: 350,
          marginTop: token.marginXL,
          marginBottom: token.marginXL,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: subtleText }}>Method</span>
          <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: token.colorText }}>
            {method === 'mobile_money' ? '📱 Mobile Money' : '💳 Card'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: subtleText }}>Status</span>
          <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.success }}>
            ✓ Completed
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: subtleText }}>Fee</span>
          <span style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.success }}>Free</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{ width: '100%', maxWidth: 350, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            type="primary"
            block
            size="large"
            onClick={() => router.push('/portfolio')}
            style={{
              height: 56,
              borderRadius: 16,
              background: colors.gradientPrimary,
              border: 'none',
              fontSize: 16,
              fontWeight: fontWeights.bold,
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
            }}
          >
            <WalletOutlined style={{ marginRight: 8 }} />
            View Portfolio
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            block
            size="large"
            onClick={() => {
              setStep('amount');
              setAmount('');
              setCardNumber('');
              setCardExpiry('');
              setCardCvc('');
              setCardName('');
              setMobileNumber('');
              setSmsCode('');
              setShowSmsVerify(false);
              setError('');
            }}
            style={{
              height: 48,
              borderRadius: 14,
              fontSize: 14,
              fontWeight: fontWeights.semibold,
              border: `1px solid ${cardBorder}`,
              color: token.colorText,
            }}
          >
            Make Another Deposit
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );

  return (
    <>
      <Head>
        <title>Deposit Funds | UG Coin</title>
        <meta name="description" content="Add funds to your UG Coin account via Mobile Money or Card" />
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
          {/* Progress + header */}
          {renderProgressBar()}
          {renderHeader()}

          {/* Step content */}
          <AnimatePresence mode="wait">
            {step === 'amount' && renderAmountStep()}
            {step === 'method' && renderMethodStep()}
            {step === 'details' && renderDetailsStep()}
            {step === 'processing' && renderProcessingStep()}
            {step === 'success' && renderSuccessStep()}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

// Use DashboardLayout
DepositPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default DepositPage;
