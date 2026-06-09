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
  Checkbox,
  message,
  Alert,
  Space,
  Divider,
  Spin,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../../_app';
import {
  getAd,
  updateAd,
  getPaymentMethods,
  type P2PAd,
  type PaymentMethod,
  AD_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { Text, Title } = Typography;
const { TextArea } = Input;

const EditAdPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { id } = router.query;
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ad, setAd] = useState<P2PAd | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [form] = Form.useForm();

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [adData, pmData] = await Promise.all([
          getAd(id),
          getPaymentMethods(),
        ]);
        setAd(adData);
        setPaymentMethods(pmData.filter(pm => pm.isActive));

        // Set form values
        form.setFieldsValue({
          price: Number(adData.price),
          minQty: Number(adData.minQty),
          maxQty: Number(adData.maxQty),
          paymentMethodIds: adData.paymentMethods?.map(pm => pm.id) || [],
          terms: adData.terms || '',
        });
      } catch (err: unknown) {
        const error = err as Error;
        message.error(error.message || 'Failed to load ad');
        router.push('/p2p/ads/my');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router, form]);

  const handleSubmit = async (values: {
    price: number;
    minQty: number;
    maxQty: number;
    paymentMethodIds: string[];
    terms?: string;
  }) => {
    if (!ad) return;

    if (values.minQty > values.maxQty) {
      message.error('Minimum must be less than or equal to maximum');
      return;
    }
    if (values.paymentMethodIds.length === 0) {
      message.error('Select at least one payment method');
      return;
    }

    setSaving(true);
    try {
      await updateAd(ad.id, {
        price: values.price,
        minQty: values.minQty,
        maxQty: values.maxQty,
        paymentMethodIds: values.paymentMethodIds,
        terms: values.terms,
      });
      message.success('Ad updated successfully!');
      router.push('/p2p/ads/my');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to update ad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingXL * 2 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!ad) {
    return <Alert type="error" message="Ad not found" showIcon />;
  }

  const statusConfig = AD_STATUS_CONFIG[ad.status];

  return (
    <>
      <Head>
        <title>Edit Ad | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Back Button */}
        <Link href="/p2p/ads/my">
          <Button type="text" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: token.marginMD }}>
            Back to My Ads
          </Button>
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: token.marginLG }}>
          <Title level={4} style={{ margin: 0 }}>Edit Ad</Title>
          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
        </div>

        {ad.status === 'CLOSED' && (
          <Alert
            type="warning"
            message="This ad is closed and cannot be edited"
            style={{ marginBottom: token.marginLG }}
            showIcon
          />
        )}

        <Card style={{ borderRadius: token.borderRadiusLG }}>
          {/* Read-only Info */}
          <div style={{ 
            padding: token.paddingMD, 
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            borderRadius: token.borderRadius,
            marginBottom: token.marginLG,
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Fixed Properties (cannot be changed)</Text>
            <div style={{ marginTop: token.marginSM }}>
              <Space size={token.marginMD}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Type</Text>
                  <br />
                  <Tag color={ad.side === 'SELL' ? 'red' : 'green'}>{ad.side}</Tag>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Asset</Text>
                  <br />
                  <Text strong>{ad.asset}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Currency</Text>
                  <br />
                  <Text strong>{ad.fiatCurrency}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Total Qty</Text>
                  <br />
                  <Text strong>{Number(ad.totalQty).toFixed(6)}</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Remaining</Text>
                  <br />
                  <Text strong>{Number(ad.remainingQty).toFixed(6)}</Text>
                </div>
              </Space>
            </div>
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            disabled={ad.status === 'CLOSED'}
          >
            {/* Price */}
            <Form.Item
              name="price"
              label={`Price per ${ad.asset}`}
              rules={[
                { required: true, message: 'Enter price' },
                { type: 'number', min: 0.01, message: 'Price must be positive' },
              ]}
            >
              <InputNumber
                size="large"
                style={{ width: '100%' }}
                prefix={<DollarOutlined />}
                min={0.01}
                precision={2}
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

            {/* Terms */}
            <Form.Item
              name="terms"
              label="Terms & Conditions (Optional)"
            >
              <TextArea
                rows={3}
                placeholder="Additional instructions or requirements"
                maxLength={2000}
                showCount
              />
            </Form.Item>

            <Divider />

            {/* Submit */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button onClick={() => router.back()}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  disabled={ad.status === 'CLOSED'}
                >
                  Save Changes
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </>
  );
};

EditAdPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default EditAdPage;

