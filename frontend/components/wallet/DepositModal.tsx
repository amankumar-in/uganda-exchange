'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Button, message, theme, Typography, Space, Grid, Tag } from 'antd';
import { DollarOutlined, ArrowRightOutlined, LockOutlined, CheckCircleOutlined, CreditCardOutlined, CloseOutlined, ExperimentOutlined } from '@ant-design/icons';
import { createDepositIntent } from '@/services/api/fiat';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { useExchange } from '@/context/ExchangeContext';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Initialize Stripe
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
const stripePromise = STRIPE_PUBLISHABLE_KEY && STRIPE_PUBLISHABLE_KEY.length > 0 
  ? loadStripe(STRIPE_PUBLISHABLE_KEY) 
  : null;

function DepositForm({ 
  amount, 
  clientSecret, 
  onSuccess, 
  onBack 
}: { 
  amount: number;
  clientSecret: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { token } = useToken();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    try {
      // First, submit the elements to validate the form
      const { error: submitError } = await elements.submit();
      
      if (submitError) {
        message.error(submitError.message || 'Please check your payment details');
        setLoading(false);
        return;
      }

      // Then confirm the payment
      // Note: When return_url is provided, Stripe will redirect the user
      // The success handling happens on the redirect page
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/portfolio?deposit=success`,
        },
      });

      if (error) {
        message.error(error.message || 'Payment failed');
        setLoading(false);
      }
      // If no error, Stripe will redirect to return_url
      // Don't call onSuccess here as the redirect will happen
    } catch (error: any) {
      message.error(error.message || 'Failed to process deposit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Amount Summary - Compact */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: token.paddingMD,
        backgroundColor: token.colorBgLayout,
        borderRadius: token.borderRadius,
        marginBottom: token.marginMD,
      }}>
        <Text style={{ 
          color: token.colorTextSecondary,
          fontSize: token.fontSize,
        }}>
          Deposit Amount
        </Text>
        <Text style={{ 
          fontSize: token.fontSizeHeading4,
          fontWeight: fontWeights.bold,
          color: token.colorText,
        }}>
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </div>

      {/* Payment Form */}
      <div style={{ marginBottom: token.marginMD }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginSM,
          marginBottom: token.marginMD,
        }}>
          <CreditCardOutlined style={{ 
            fontSize: token.fontSizeLG,
            color: token.colorPrimary,
          }} />
          <Text style={{ 
            fontWeight: fontWeights.semibold,
            fontSize: token.fontSizeLG,
          }}>
            Payment Details
          </Text>
        </div>
        <PaymentElement />
      </div>

      {/* Action Buttons */}
      <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: token.marginMD }}>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          disabled={!stripe || !elements}
          block
          size="large"
          icon={<CheckCircleOutlined />}
          style={{
            height: token.controlHeightLG + token.marginXS,
            fontSize: token.fontSizeLG,
            fontWeight: fontWeights.semibold,
          }}
        >
          Complete Deposit
        </Button>
        <Button
          onClick={onBack}
          block
          disabled={loading}
          style={{
            height: token.controlHeightLG,
          }}
        >
          Change Amount
        </Button>
      </Space>

      {/* Security Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: token.marginXS,
        padding: token.paddingSM,
        backgroundColor: token.colorSuccessBg,
        borderRadius: token.borderRadius,
      }}>
        <LockOutlined style={{ color: token.colorSuccess }} />
        <Text style={{ 
          fontSize: token.fontSizeSM,
          color: token.colorTextSecondary,
        }}>
          Secured by Stripe • Your payment information is encrypted
        </Text>
      </div>
    </motion.form>
  );
}

export default function DepositModal({ visible, onClose, onSuccess }: DepositModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);
  const [form] = Form.useForm();
  const { token } = useToken();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const { appMode } = useExchange();
  const isLearnerMode = appMode === 'learner';

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = mounted ? !screens.md : false;

  // Check if Stripe is configured
  if (!STRIPE_PUBLISHABLE_KEY || !stripePromise) {
    return (
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        width="100vw"
        centered={false}
        closable={false}
        maskClosable={false}
        zIndex={token.zIndexPopupBase + 20}
        styles={{
          body: {
            padding: token.paddingLG,
            paddingTop: 60,
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          wrapper: { borderRadius: 0 },
          mask: { background: token.colorBgContainer },
        }}
        style={{ top: 0, margin: 0, padding: 0, maxWidth: '100vw' }}
        wrapClassName="fullscreen-modal"
      >
        <Button
          type="text"
          icon={<CloseOutlined style={{ fontSize: 20 }} />}
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 10,
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            color: token.colorTextSecondary,
            backgroundColor: token.colorBgElevated,
            boxShadow: token.boxShadowSecondary,
          }}
        />
        <div style={{ padding: token.paddingLG, textAlign: 'center', maxWidth: 520 }}>
          <Text style={{ color: token.colorError }}>
            Stripe is not configured. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env file.
          </Text>
        </div>
      </Modal>
    );
  }

  // Create payment intent when amount is entered
  const handleAmountSubmit = async (values: { amount: number }) => {
    setLoading(true);
    try {
      if (isLearnerMode) {
        // In learner mode, skip actual payment processing
        // Simulate a brief delay for realistic UX
        await new Promise(resolve => setTimeout(resolve, 800));
        setAmount(values.amount);
        setSimulationSuccess(true);
      } else {
        // Real mode - create actual payment intent
        const { clientSecret: secret } = await createDepositIntent(values.amount);
        setClientSecret(secret);
        setAmount(values.amount);
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to create payment intent');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setClientSecret(null);
    setAmount(null);
    setSimulationSuccess(false);
    form.resetFields();
    onClose();
  };

  const handleBack = () => {
    setClientSecret(null);
    setAmount(null);
    setSimulationSuccess(false);
    form.resetFields();
  };

  const handleSimulationComplete = () => {
    setSimulationSuccess(false);
    setAmount(null);
    form.resetFields();
    onSuccess();
  };

  const options = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
        },
      }
    : undefined;

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      width="100vw"
      centered={false}
      closable={false}
      maskClosable={false}
      zIndex={token.zIndexPopupBase + 20}
      styles={{
        body: {
          padding: token.paddingLG,
          paddingTop: 60,
          minHeight: '100vh',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isMobile ? 'flex-start' : 'center',
        },
        wrapper: {
          borderRadius: 0,
          minHeight: '100vh',
          boxShadow: 'none',
          overflow: 'hidden',
        },
        mask: {
          background: token.colorBgContainer,
        },
      }}
      style={{
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        maxWidth: '100vw',
        height: '100vh',
      }}
      wrapClassName="fullscreen-modal"
    >
      {/* Custom Close Button */}
      <Button
        type="text"
        icon={<CloseOutlined style={{ fontSize: 20 }} />}
        onClick={handleClose}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 10,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          color: token.colorTextSecondary,
          backgroundColor: token.colorBgElevated,
          boxShadow: token.boxShadowSecondary,
        }}
      />
      <div style={{ maxWidth: 520, width: '100%' }}>
      <AnimatePresence mode="wait">
        {/* Learner Mode Simulation Success */}
        {simulationSuccess && amount ? (
          <motion.div
            key="simulation-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: 'center' }}
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: token.marginLG,
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
              }}
            >
              <ExperimentOutlined
                style={{
                  fontSize: 40,
                  color: '#fff',
                }}
              />
            </motion.div>

            {/* Learner Mode Badge */}
            <Tag color="orange" style={{ marginBottom: token.marginMD, fontSize: token.fontSize }}>
              <ExperimentOutlined /> Learner Mode Simulation
            </Tag>

            {/* Success Title */}
            <Title
              level={3}
              style={{
                marginBottom: token.marginSM,
                fontWeight: fontWeights.bold,
                color: token.colorText,
              }}
            >
              Simulated Deposit Complete!
            </Title>

            {/* Amount */}
            <Text
              style={{
                fontSize: token.fontSizeHeading4,
                color: '#F59E0B',
                fontWeight: fontWeights.semibold,
                display: 'block',
                marginBottom: token.marginMD,
              }}
            >
              +${amount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>

            {/* Explanation */}
            <div
              style={{
                padding: token.paddingMD,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderRadius: token.borderRadius,
                border: '1px solid rgba(245, 158, 11, 0.3)',
                marginBottom: token.marginLG,
              }}
            >
              <Text
                style={{
                  fontSize: token.fontSize,
                  color: token.colorTextSecondary,
                  display: 'block',
                }}
              >
                This is a <strong>simulated deposit</strong> for practice purposes.
                <br />
                No real money was transferred. In Learner Mode, you can practice
                trading without financial risk.
              </Text>
            </div>

            {/* Info about switching */}
            <Text
              style={{
                fontSize: token.fontSizeSM,
                color: token.colorTextTertiary,
                display: 'block',
                marginBottom: token.marginLG,
              }}
            >
              Complete KYC verification to enable real deposits in Investor Mode.
            </Text>

            {/* Close Button */}
            <Button
              type="primary"
              size="large"
              onClick={handleSimulationComplete}
              style={{
                height: token.controlHeightLG,
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.semibold,
                paddingLeft: token.paddingXL,
                paddingRight: token.paddingXL,
                backgroundColor: '#F59E0B',
                borderColor: '#F59E0B',
              }}
            >
              Got it!
            </Button>
          </motion.div>
        ) : !clientSecret ? (
          <motion.div
            key="amount-step"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Learner Mode Banner */}
            {isLearnerMode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: token.marginXS,
                  padding: token.paddingSM,
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: token.borderRadius,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: token.marginMD,
                }}
              >
                <ExperimentOutlined style={{ color: '#F59E0B' }} />
                <Text style={{ fontSize: token.fontSizeSM, color: '#D97706' }}>
                  Learner Mode - This deposit will be simulated
                </Text>
              </div>
            )}

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: token.marginXL }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: isLearnerMode 
                  ? 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)'
                  : `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorSuccess} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: token.marginMD,
              }}>
                <DollarOutlined style={{ 
                  fontSize: token.fontSizeHeading2,
                  color: '#fff',
                }} />
              </div>
              <Title level={3} style={{ 
                margin: 0,
                marginBottom: token.marginSM,
                fontWeight: fontWeights.bold,
              }}>
                {isLearnerMode ? 'Simulate a Deposit' : 'Add Funds to Your Wallet'}
              </Title>
              <Text style={{ 
                color: token.colorTextSecondary,
                fontSize: token.fontSize,
              }}>
                {isLearnerMode 
                  ? 'Practice depositing USD (no real money)'
                  : 'Instantly deposit USD to start trading'}
              </Text>
            </div>

            {/* Amount Input */}
            <Form form={form} onFinish={handleAmountSubmit} layout="vertical">
              <Form.Item
                name="amount"
                rules={[
                  { required: true, message: 'Please enter an amount' },
                  {
                    validator: (_, value) => {
                      if (!value && value !== 0) {
                        return Promise.resolve();
                      }
                      const numValue = Number(value);
                      if (isNaN(numValue)) {
                        return Promise.reject(new Error('Please enter a valid number'));
                      }
                      if (numValue < 10) {
                        return Promise.reject(new Error('Minimum deposit is $10'));
                      }
                      if (numValue > 10000) {
                        return Promise.reject(new Error('Maximum deposit is $10,000'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <div>
                  <Text style={{ 
                    display: 'block',
                    marginBottom: token.marginSM,
                    fontWeight: fontWeights.medium,
                    fontSize: token.fontSize,
                  }}>
                    Deposit Amount
                  </Text>
                  <InputNumber
                    prefix={<DollarOutlined style={{ color: token.colorTextSecondary }} />}
                    style={{ 
                      width: '100%',
                      height: token.controlHeightLG + token.marginXS,
                      fontSize: token.fontSizeHeading4,
                      fontWeight: fontWeights.bold,
                    }}
                    placeholder="0.00"
                    min={10}
                    max={10000}
                    step={0.01}
                    precision={2}
                    size="large"
                    autoFocus
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: token.marginXS,
                  }}>
                    <Text style={{ 
                      fontSize: token.fontSizeSM,
                      color: token.colorTextSecondary,
                    }}>
                      Min: $10
                    </Text>
                    <Text style={{ 
                      fontSize: token.fontSizeSM,
                      color: token.colorTextSecondary,
                    }}>
                      Max: $10,000
                    </Text>
                  </div>
                </div>
              </Form.Item>

              {/* Quick Amount Buttons */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: token.marginSM,
                marginBottom: token.marginLG,
              }}>
                {[50, 100, 250, 500].map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    onClick={() => {
                      form.setFieldsValue({ amount: quickAmount });
                      form.submit();
                    }}
                    style={{
                      height: token.controlHeight,
                      fontSize: token.fontSize,
                    }}
                  >
                    ${quickAmount}
                  </Button>
                ))}
              </div>

              {/* Submit Button */}
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                icon={isLearnerMode ? <ExperimentOutlined /> : <ArrowRightOutlined />}
                style={{
                  height: token.controlHeightLG + token.marginXS,
                  fontSize: token.fontSizeLG,
                  fontWeight: fontWeights.semibold,
                  ...(isLearnerMode && {
                    backgroundColor: '#F59E0B',
                    borderColor: '#F59E0B',
                  }),
                }}
              >
                {isLearnerMode ? 'Simulate Deposit' : 'Continue to Payment'}
              </Button>
            </Form>
          </motion.div>
        ) : amount ? (
          <motion.div
            key="payment-step"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Elements stripe={stripePromise} options={options}>
              <DepositForm 
                amount={amount}
                clientSecret={clientSecret}
                onSuccess={onSuccess}
                onBack={handleBack}
              />
            </Elements>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>
    </Modal>
  );
}
