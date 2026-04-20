'use client';

import React, { useEffect, useState } from 'react';
import { Modal, Form, InputNumber, Button, message, theme, Typography, Space } from 'antd';
import { LockOutlined, BankOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { createDepositOrder, verifyDepositPayment } from '@/services/api/fiat';

const { useToken } = theme;
const { Text, Title } = Typography;

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const MIN_DEPOSIT = 100;
const MAX_DEPOSIT = 1_000_000;

// Module-level promise so we load the SDK once per page
let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (amount: number) => void;
}

export default function DepositModal({ visible, onClose, onSuccess }: DepositModalProps) {
  const { token } = useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Pre-load Razorpay SDK so the button feels instant
  useEffect(() => {
    if (visible) {
      loadRazorpayScript();
    }
  }, [visible]);

  const handleSubmit = async (values: { amount: number }) => {
    const amount = Number(values.amount);
    if (!amount || amount < MIN_DEPOSIT) {
      message.error(`Minimum deposit is ₹${MIN_DEPOSIT}`);
      return;
    }

    setLoading(true);
    try {
      const ready = await loadRazorpayScript();
      if (!ready || !(window as any).Razorpay) {
        message.error('Unable to load payment gateway. Check your connection and try again.');
        setLoading(false);
        return;
      }

      const order = await createDepositOrder(amount);

      const options: any = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'InTuition Exchange',
        description: `Deposit ₹${amount.toLocaleString('en-IN')}`,
        order_id: order.razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await verifyDepositPayment({
              orderId: order.orderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            if (result.success) {
              message.success(`₹${amount.toLocaleString('en-IN')} credited to your balance`);
              form.resetFields();
              onSuccess(amount);
              onClose();
            } else {
              message.error('Payment verification failed. Contact support if you were charged.');
            }
          } catch (e: any) {
            message.error(e?.message || 'Payment verification failed');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
        theme: { color: '#0d7377' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setLoading(false);
        message.error(resp?.error?.description || 'Payment failed');
      });
      rzp.open();
    } catch (e: any) {
      setLoading(false);
      message.error(e?.message || 'Failed to start deposit');
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={() => {
        if (!loading) onClose();
      }}
      footer={null}
      centered
      width={460}
      maskClosable={!loading}
      closable={!loading}
      destroyOnHidden
      title={
        <Space>
          <BankOutlined style={{ color: token.colorPrimary }} />
          <span>Add Funds</span>
        </Space>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: token.marginLG }}>
          Deposit INR into your account via UPI, card, or netbanking through Razorpay.
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ amount: 500 }}
        >
          <Form.Item
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: 'Enter an amount' },
              {
                validator: (_, value) => {
                  const n = Number(value);
                  if (!Number.isFinite(n)) return Promise.reject(new Error('Enter a valid amount'));
                  if (n < MIN_DEPOSIT) return Promise.reject(new Error(`Minimum deposit is ₹${MIN_DEPOSIT}`));
                  if (n > MAX_DEPOSIT) {
                    return Promise.reject(
                      new Error(`Maximum deposit is ₹${MAX_DEPOSIT.toLocaleString('en-IN')}`),
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              prefix="₹"
              size="large"
              style={{ width: '100%' }}
              placeholder="500"
              min={MIN_DEPOSIT}
              max={MAX_DEPOSIT}
              step={100}
              precision={2}
              autoFocus
              disabled={loading}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: token.marginSM, marginBottom: token.marginMD }}>
            {[500, 1000, 5000, 10000].map(preset => (
              <Button
                key={preset}
                size="small"
                onClick={() => form.setFieldsValue({ amount: preset })}
                disabled={loading}
              >
                ₹{preset.toLocaleString('en-IN')}
              </Button>
            ))}
          </div>

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
            style={{ height: 48, fontWeight: fontWeights.semibold }}
          >
            Pay with Razorpay
          </Button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: token.marginMD,
              color: token.colorTextTertiary,
              fontSize: token.fontSizeSM,
            }}
          >
            <LockOutlined />
            Secured by Razorpay. Your bank/card details never reach our servers.
          </div>
        </Form>
      </motion.div>
    </Modal>
  );
}
