import React, { useState, useEffect, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  theme,
  Typography,
  Button,
  Card,
  Tag,
  Space,
  InputNumber,
  Select,
  message,
  Spin,
  Alert,
  Descriptions,
  Divider,
  Grid,
} from 'antd';
import {
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../_app';
import {
  getAd,
  createTrade,
  getUserStats,
  type P2PAd,
  type P2PUserStats,
  type PaymentMethodType,
  AD_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Paragraph } = Typography;

const AdDetailPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { id } = router.query;
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<P2PAd | null>(null);
  const [stats, setStats] = useState<P2PUserStats | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [quantity, setQuantity] = useState<number | null>(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethodType | null>(null);

  const isMobile = mounted ? !screens.md : false;
  const isKycApproved = user?.kycStatus === 'APPROVED';
  const isOwnAd = ad?.userId === user?.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [adData, statsData] = await Promise.all([
          getAd(id),
          isKycApproved ? getUserStats() : Promise.resolve(null),
        ]);
        setAd(adData);
        setStats(statsData);
        
        // Set default values
        if (adData.minQty) {
          setQuantity(Number(adData.minQty));
        }
        if (adData.paymentMethods?.length > 0) {
          setSelectedPaymentType(adData.paymentMethods[0].type);
        }
      } catch (err: unknown) {
        const error = err as Error;
        message.error(error.message || 'Failed to load ad');
        router.push('/p2p');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isKycApproved, router]);

  // Calculate notional
  const notional = quantity && ad ? quantity * Number(ad.price) : 0;

  // Validation
  const validateTrade = (): string | null => {
    if (!ad || !quantity || !selectedPaymentType) {
      return 'Please fill all fields';
    }
    const minQty = Number(ad.minQty);
    const maxQty = Number(ad.maxQty);
    const remainingQty = Number(ad.remainingQty);
    if (quantity < minQty) {
      return `Minimum quantity is ${minQty} ${ad.asset}`;
    }
    if (quantity > maxQty) {
      return `Maximum quantity is ${maxQty} ${ad.asset}`;
    }
    if (quantity > remainingQty) {
      return `Only ${remainingQty} ${ad.asset} available`;
    }
    if (stats && notional > stats.dailyRemainingUsd) {
      return `Trade exceeds daily limit. Remaining: $${stats.dailyRemainingUsd.toFixed(2)}`;
    }
    return null;
  };

  const handleCreateTrade = async () => {
    if (!ad || !quantity || !selectedPaymentType) return;

    const error = validateTrade();
    if (error) {
      message.error(error);
      return;
    }

    setSubmitting(true);
    try {
      const trade = await createTrade({
        adId: ad.id,
        quantity,
        paymentMethodType: selectedPaymentType,
      });
      message.success('Trade created successfully!');
      router.push(`/p2p/trade/${trade.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to create trade');
    } finally {
      setSubmitting(false);
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
    return (
      <Alert type="error" message="Ad not found" showIcon />
    );
  }

  // Determine user's role in this trade
  // SELL ad: maker is selling, taker is buying → taker pays fiat
  // BUY ad: maker is buying, taker is selling → taker receives fiat
  const isBuying = ad.side === 'SELL'; // User is buying crypto from seller
  const actionText = isBuying ? 'Buy' : 'Sell';
  const actionColor = isBuying ? token.colorSuccess : token.colorError;

  return (
    <>
      <Head>
        <title>{actionText} {ad.asset} | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Back Button */}
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/p2p')}
          style={{ marginBottom: token.marginMD, padding: 0 }}
        >
          Back to Marketplace
        </Button>

        {/* Ad Status Alert */}
        {ad.status !== 'ACTIVE' && (
          <Alert
            type="warning"
            message={`This ad is ${ad.status.toLowerCase()}`}
            style={{ marginBottom: token.marginMD }}
            showIcon
          />
        )}

        {/* Own Ad Alert */}
        {isOwnAd && (
          <Alert
            type="info"
            message="This is your own ad. You cannot trade with yourself."
            style={{ marginBottom: token.marginMD }}
            showIcon
          />
        )}

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: token.marginLG }}>
          {/* Ad Details */}
          <Card
            style={{ flex: 1, borderRadius: token.borderRadiusLG }}
            title={
              <Space>
                <Tag color={isBuying ? 'green' : 'red'} style={{ margin: 0 }}>
                  {actionText} {ad.asset}
                </Tag>
                <Tag color={AD_STATUS_CONFIG[ad.status].color}>
                  {AD_STATUS_CONFIG[ad.status].label}
                </Tag>
              </Space>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Price">
                <Text strong style={{ fontSize: 18, color: actionColor }}>
                  {Number(ad.price).toLocaleString('en-US', {
                    style: 'currency',
                    currency: ad.fiatCurrency,
                  })}
                  <Text type="secondary" style={{ fontSize: 12 }}> per {ad.asset}</Text>
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Available">
                {Number(ad.remainingQty).toFixed(6)} {ad.asset}
                <Text type="secondary"> (of {Number(ad.totalQty).toFixed(6)})</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Limits">
                {Number(ad.minQty)} - {Number(ad.maxQty)} {ad.asset}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Methods">
                <Space wrap>
                  {ad.paymentMethods?.map((pm) => (
                    <Tag key={pm.id}>
                      {PAYMENT_METHOD_LABELS[pm.type]}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: `${token.marginMD}px 0` }} />

            {/* Advertiser Info */}
            <Space>
              <UserOutlined />
              <div>
                <Text strong>
                  {ad.user?.firstName || ad.user?.email?.split('@')[0] || 'Anonymous'}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {ad.user?.email}
                </Text>
              </div>
            </Space>

            {/* Terms */}
            {ad.terms && (
              <>
                <Divider style={{ margin: `${token.marginMD}px 0` }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Terms & Conditions</Text>
                  <Paragraph style={{ marginTop: token.marginXS, marginBottom: 0 }}>
                    {ad.terms}
                  </Paragraph>
                </div>
              </>
            )}

            <Divider style={{ margin: `${token.marginMD}px 0` }} />

            <Space>
              <ClockCircleOutlined />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Created {new Date(ad.createdAt).toLocaleDateString()}
              </Text>
            </Space>
          </Card>

          {/* Trade Form */}
          <Card
            style={{ 
              flex: 1, 
              borderRadius: token.borderRadiusLG,
              background: isDark ? 'rgba(255,255,255,0.04)' : undefined,
            }}
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: token.colorSuccess }} />
                <span>Create Trade</span>
              </Space>
            }
          >
            {!isKycApproved ? (
              <Alert
                type="warning"
                message="Complete identity verification to trade"
                action={
                  <Button size="small" onClick={() => router.push('/onboarding')}>
                    Verify Now
                  </Button>
                }
              />
            ) : isOwnAd ? (
              <Alert
                type="info"
                message="You cannot trade with your own ad"
              />
            ) : ad.status !== 'ACTIVE' ? (
              <Alert
                type="warning"
                message="This ad is not active"
              />
            ) : (
              <Space direction="vertical" size={token.marginMD} style={{ width: '100%' }}>
                {/* Quantity */}
                <div>
                  <Text style={{ fontWeight: fontWeights.medium }}>
                    Quantity ({ad.asset})
                  </Text>
                  <InputNumber
                    style={{ width: '100%', marginTop: token.marginXS }}
                    size="large"
                    min={Number(ad.minQty)}
                    max={Math.min(Number(ad.maxQty), Number(ad.remainingQty))}
                    step={0.000001}
                    precision={6}
                    value={quantity}
                    onChange={(val) => setQuantity(val)}
                    placeholder={`${Number(ad.minQty)} - ${Number(ad.maxQty)}`}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Min: {Number(ad.minQty)} | Max: {Number(ad.maxQty)}
                  </Text>
                </div>

                {/* Payment Method */}
                <div>
                  <Text style={{ fontWeight: fontWeights.medium }}>
                    Payment Method
                  </Text>
                  <Select
                    style={{ width: '100%', marginTop: token.marginXS }}
                    size="large"
                    value={selectedPaymentType}
                    onChange={setSelectedPaymentType}
                    placeholder="Select payment method"
                    options={ad.paymentMethods?.map((pm) => ({
                      label: PAYMENT_METHOD_LABELS[pm.type],
                      value: pm.type,
                    }))}
                  />
                </div>

                {/* Notional Display */}
                <Card
                  size="small"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)',
                    borderRadius: token.borderRadius,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">You will {isBuying ? 'pay' : 'receive'}</Text>
                    <Text strong style={{ fontSize: 18, color: actionColor }}>
                      {notional.toLocaleString('en-US', {
                        style: 'currency',
                        currency: ad.fiatCurrency,
                      })}
                    </Text>
                  </div>
                </Card>

                {/* Daily Limit */}
                {stats && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Daily limit remaining</Text>
                    <Text style={{ fontSize: 12, color: notional > stats.dailyRemainingUsd ? token.colorError : undefined }}>
                      ${stats.dailyRemainingUsd.toFixed(2)} / ${stats.dailyLimitUsd.toFixed(2)}
                    </Text>
                  </div>
                )}

                {/* Create Button */}
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  disabled={!!validateTrade()}
                  onClick={handleCreateTrade}
                  style={{
                    background: actionColor,
                    borderColor: actionColor,
                    height: 48,
                    fontWeight: fontWeights.semibold,
                  }}
                >
                  {actionText} {ad.asset}
                </Button>

                {validateTrade() && (
                  <Text type="danger" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
                    {validateTrade()}
                  </Text>
                )}

                {/* Escrow Notice */}
                <Alert
                  type="info"
                  message={
                    <Text style={{ fontSize: 12 }}>
                      <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                      Trade protected by escrow. Crypto is locked until payment is confirmed.
                    </Text>
                  }
                  style={{ background: 'transparent', border: 'none', padding: 0 }}
                />
              </Space>
            )}
          </Card>
        </div>
      </div>
    </>
  );
};

AdDetailPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default AdDetailPage;

