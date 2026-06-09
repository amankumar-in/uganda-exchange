import React, { useState, useEffect, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  theme,
  Typography,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Checkbox,
  message,
  Alert,
  Space,
  Divider,
  Grid,
  Segmented,
} from 'antd';
import {
  ArrowLeftOutlined,
  DollarOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../_app';
import {
  createAd,
  getPaymentMethods,
  type PaymentMethod,
  type AdSide,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;
const { TextArea } = Input;

const CRYPTO_ASSETS = ['BTC', 'ETH', 'USDT', 'USDC'];
const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'UGX'];

const CreateAdPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);

  const [form] = Form.useForm();
  const side = Form.useWatch('side', form) as AdSide;
  const asset = Form.useWatch('asset', form);
  const fiat = Form.useWatch('fiatCurrency', form);
  const price = Form.useWatch('price', form);
  const quantity = Form.useWatch('totalQty', form);

  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const result = await getPaymentMethods();
        setPaymentMethods(result.filter(pm => pm.isActive));
      } catch (err: unknown) {
        const error = err as Error;
        message.error(error.message || 'Failed to load payment methods');
      } finally {
        setPaymentMethodsLoading(false);
      }
    };
    fetchPaymentMethods();
  }, []);

  const handleSubmit = async (values: {
    side: AdSide;
    asset: string;
    fiatCurrency: string;
    price: number;
    totalQty: number;
    minQty: number;
    maxQty: number;
    paymentMethodIds: string[];
    terms?: string;
  }) => {
    // Validation
    if (values.minQty > values.maxQty) {
      message.error('Minimum must be less than or equal to maximum');
      return;
    }
    if (values.maxQty > values.totalQty) {
      message.error('Maximum per trade cannot exceed total quantity');
      return;
    }
    if (values.paymentMethodIds.length === 0) {
      message.error('Select at least one payment method');
      return;
    }

    setLoading(true);
    try {
      await createAd({
        side: values.side,
        asset: values.asset,
        fiatCurrency: values.fiatCurrency,
        price: values.price,
        totalQty: values.totalQty,
        minQty: values.minQty,
        maxQty: values.maxQty,
        paymentMethodIds: values.paymentMethodIds,
        terms: values.terms,
      });
      message.success('Ad created successfully!');
      router.push('/p2p/ads/my');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to create ad');
    } finally {
      setLoading(false);
    }
  };

  const totalValue = price && quantity ? price * quantity : 0;

  return (
    <>
      <Head>
        <title>Create Ad | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Back Button */}
        <Link href="/p2p/ads/my">
          <Button type="text" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: token.marginMD }}>
            Back to My Ads
          </Button>
        </Link>

        <Title level={4} style={{ marginBottom: token.marginLG }}>Create Ad</Title>

        {/* No Payment Methods Warning */}
        {!paymentMethodsLoading && paymentMethods.length === 0 && (
          <Alert
            type="warning"
            message="Add payment methods first"
            description="You need at least one payment method to create an ad."
            action={
              <Link href="/p2p/payment-methods">
                <Button size="small" type="primary">Add Payment Method</Button>
              </Link>
            }
            style={{ marginBottom: token.marginLG }}
            showIcon
          />
        )}

        <Card style={{ borderRadius: token.borderRadiusLG }}>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            initialValues={{
              side: 'SELL',
              asset: 'BTC',
              fiatCurrency: 'USD',
            }}
          >
            {/* Side Selection */}
            <Form.Item
              name="side"
              label="I want to"
              rules={[{ required: true }]}
            >
              <Segmented
                block
                options={[
                  { label: 'Sell Crypto', value: 'SELL' },
                  { label: 'Buy Crypto', value: 'BUY' },
                ]}
                style={{ fontWeight: fontWeights.medium }}
              />
            </Form.Item>

            <div style={{ display: 'flex', gap: token.marginMD }}>
              {/* Asset */}
              <Form.Item
                name="asset"
                label="Crypto Asset"
                rules={[{ required: true }]}
                style={{ flex: 1 }}
              >
                <Select
                  size="large"
                  options={CRYPTO_ASSETS.map(a => ({ label: a, value: a }))}
                />
              </Form.Item>

              {/* Fiat */}
              <Form.Item
                name="fiatCurrency"
                label="Fiat Currency"
                rules={[{ required: true }]}
                style={{ flex: 1 }}
              >
                <Select
                  size="large"
                  options={FIAT_CURRENCIES.map(f => ({ label: f, value: f }))}
                />
              </Form.Item>
            </div>

            {/* Price */}
            <Form.Item
              name="price"
              label={`Price per ${asset || 'unit'}`}
              rules={[
                { required: true, message: 'Enter price' },
                { type: 'number', min: 0.01, message: 'Price must be positive' },
              ]}
            >
              <InputNumber
                size="large"
                style={{ width: '100%' }}
                prefix={<DollarOutlined />}
                placeholder="0.00"
                min={0.01}
                precision={2}
              />
            </Form.Item>

            {/* Total Quantity */}
            <Form.Item
              name="totalQty"
              label="Total Quantity"
              rules={[
                { required: true, message: 'Enter quantity' },
                { type: 'number', min: 0.000001, message: 'Quantity must be positive' },
              ]}
              extra={side === 'SELL' && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <WalletOutlined style={{ marginRight: 4 }} />
                  This amount will be locked from your balance when creating a SELL ad
                </Text>
              )}
            >
              <InputNumber
                size="large"
                style={{ width: '100%' }}
                placeholder="0.000000"
                min={0.000001}
                precision={6}
                addonAfter={asset || 'crypto'}
              />
            </Form.Item>

            {/* Min/Max per trade */}
            <div style={{ display: 'flex', gap: token.marginMD }}>
              <Form.Item
                name="minQty"
                label="Min per trade"
                rules={[
                  { required: true, message: 'Enter minimum' },
                  { type: 'number', min: 0.000001, message: 'Must be positive' },
                ]}
                style={{ flex: 1 }}
              >
                <InputNumber
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="0.001"
                  min={0.000001}
                  precision={6}
                />
              </Form.Item>

              <Form.Item
                name="maxQty"
                label="Max per trade"
                rules={[
                  { required: true, message: 'Enter maximum' },
                  { type: 'number', min: 0.000001, message: 'Must be positive' },
                ]}
                style={{ flex: 1 }}
              >
                <InputNumber
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="1.0"
                  min={0.000001}
                  precision={6}
                />
              </Form.Item>
            </div>

            {/* Payment Methods */}
            <Form.Item
              name="paymentMethodIds"
              label="Accepted Payment Methods"
              rules={[{ required: true, message: 'Select at least one payment method' }]}
            >
              <Checkbox.Group style={{ width: '100%' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {paymentMethods.map(pm => (
                    <Checkbox key={pm.id} value={pm.id}>
                      {pm.name} ({PAYMENT_METHOD_LABELS[pm.type]})
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Form.Item>

            {paymentMethods.length === 0 && !paymentMethodsLoading && (
              <Link href="/p2p/payment-methods">
                <Button type="link" style={{ padding: 0 }}>
                  + Add payment method
                </Button>
              </Link>
            )}

            {/* Terms */}
            <Form.Item
              name="terms"
              label="Terms & Conditions (Optional)"
              extra="Additional instructions or requirements for traders"
            >
              <TextArea
                rows={3}
                placeholder="e.g., Only trade during business hours. Payment must include trade reference."
                maxLength={2000}
                showCount
              />
            </Form.Item>

            <Divider />

            {/* Preview */}
            <Card
              size="small"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                marginBottom: token.marginLG,
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>Ad Preview</Text>
              <div style={{ marginTop: token.marginSM }}>
                <Text strong style={{ fontSize: 16 }}>
                  {side === 'SELL' ? 'Selling' : 'Buying'} {quantity || 0} {asset || '...'} at{' '}
                  {price ? price.toLocaleString('en-US', { style: 'currency', currency: fiat || 'USD' }) : '$0.00'} per unit
                </Text>
              </div>
              <div style={{ marginTop: token.marginXS }}>
                <Text type="secondary">
                  Total value: {totalValue.toLocaleString('en-US', { style: 'currency', currency: fiat || 'USD' })}
                </Text>
              </div>
            </Card>

            {/* Submit */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space style={{ width: '100%' }}>
                <Button onClick={() => router.back()}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  disabled={paymentMethods.length === 0}
                  style={{ flex: 1 }}
                >
                  Create Ad
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
};

CreateAdPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default CreateAdPage;

