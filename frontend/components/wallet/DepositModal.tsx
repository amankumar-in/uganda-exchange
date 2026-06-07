'use client';

import React, { useState } from 'react';
import { Modal, Form, InputNumber, Button, message, theme, Typography, Space } from 'antd';
import { LockOutlined, BankOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { createDepositOrder } from '@/services/api/fiat';

const { useToken } = theme;
const { Text } = Typography;

const MIN_DEPOSIT = 500;
const MAX_DEPOSIT = 5_000_000;

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

export default function DepositModal({ visible, onClose }: DepositModalProps) {
  const { token } = useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { amount: number }) => {
    const amount = Number(values.amount);
    if (!amount || amount < MIN_DEPOSIT) {
      message.error(`Minimum deposit is UGX ${MIN_DEPOSIT.toLocaleString('en-UG')}`);
      return;
    }

    setLoading(true);
    try {
      const order = await createDepositOrder(amount);
      if (order.redirectUrl) {
        // Redirect the user to Pesapal
        window.location.href = order.redirectUrl;
      } else {
        throw new Error('No redirect URL provided from payment gateway.');
      }
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
          Deposit UGX into your account securely via Pesapal (Mobile Money or Card).
        </Text>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ amount: 10000 }}
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
                  if (n < MIN_DEPOSIT) return Promise.reject(new Error(`Minimum deposit is UGX ${MIN_DEPOSIT.toLocaleString('en-UG')}`));
                  if (n > MAX_DEPOSIT) {
                    return Promise.reject(
                      new Error(`Maximum deposit is UGX ${MAX_DEPOSIT.toLocaleString('en-UG')}`),
                    );
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              prefix="UGX "
              size="large"
              style={{ width: '100%' }}
              placeholder="10000"
              min={MIN_DEPOSIT}
              max={MAX_DEPOSIT}
              step={1000}
              precision={0}
              autoFocus
              disabled={loading}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: token.marginSM, marginBottom: token.marginMD }}>
            {[10000, 50000, 100000, 500000].map(preset => (
              <Button
                key={preset}
                size="small"
                onClick={() => form.setFieldsValue({ amount: preset })}
                disabled={loading}
              >
                UGX {preset.toLocaleString('en-UG')}
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
            Proceed to Payment
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
            Secured by Pesapal.
          </div>
        </Form>
      </motion.div>
    </Modal>
  );
}
