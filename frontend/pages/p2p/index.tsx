import React, { useState, useEffect, useCallback, ReactElement, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  theme,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Card,
  message,
  Empty,
  Spin,
  Grid,
  Segmented,
  Alert,
  Tooltip,
  Drawer,
  Input,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  ShopOutlined,
  SwapOutlined,
  CreditCardOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  DownOutlined,
  CheckOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import { useExchange } from '@/context/ExchangeContext';
import type { NextPageWithLayout } from '../_app';
import {
  listAds,
  getUserStats,
  type P2PAd,
  type P2PUserStats,
  type AdSide,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;

const FIAT_CURRENCIES = [
  { symbol: 'USD', name: 'US Dollar', icon: <DollarOutlined /> },
  { symbol: 'EUR', name: 'Euro', icon: '€' },
  { symbol: 'GBP', name: 'British Pound', icon: '£' },
  { symbol: 'UGX', name: 'Ugandan Shilling', icon: 'UGX ' },
];

const P2PMarketplace: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const { user } = useAuth();
  const { pairs } = useExchange();
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<P2PAd[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<P2PUserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Filters - "Buy" from user perspective means SELL ads (user wants to buy crypto)
  const [viewMode, setViewMode] = useState<'buy' | 'sell'>('buy');
  const [asset, setAsset] = useState<string>('BTC');
  const [fiat, setFiat] = useState<string>('USD');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isMobile = mounted ? !screens.md : false;
  const isKycApproved = user?.kycStatus === 'APPROVED';

  // Get all unique assets from pairs
  const availableAssets = useMemo(() => {
    const assetMap = new Map<string, { symbol: string; name: string; iconUrl: string }>();
    pairs.forEach(pair => {
      if (!assetMap.has(pair.baseCurrency)) {
        assetMap.set(pair.baseCurrency, {
          symbol: pair.baseCurrency,
          name: pair.name,
          iconUrl: pair.iconUrl,
        });
      }
    });
    // Sort: BTC, ETH first, then alphabetically
    const sorted = Array.from(assetMap.values()).sort((a, b) => {
      if (a.symbol === 'BTC') return -1;
      if (b.symbol === 'BTC') return 1;
      if (a.symbol === 'ETH') return -1;
      if (b.symbol === 'ETH') return 1;
      return a.symbol.localeCompare(b.symbol);
    });
    return sorted;
  }, [pairs]);

  // Get selected asset data
  const selectedAssetData = useMemo(() => {
    return availableAssets.find(a => a.symbol === asset) || availableAssets[0] || { symbol: 'BTC', name: 'Bitcoin', iconUrl: 'https://assets.coincap.io/assets/icons/btc@2x.png' };
  }, [asset, availableAssets]);

  // Get selected currency data
  const selectedCurrencyData = useMemo(() => {
    return FIAT_CURRENCIES.find(c => c.symbol === fiat) || FIAT_CURRENCIES[0];
  }, [fiat]);

  // Filter assets for picker
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return availableAssets;
    const q = searchQuery.toLowerCase();
    return availableAssets.filter(
      a => a.symbol.toLowerCase().includes(q) || 
           a.name.toLowerCase().includes(q)
    );
  }, [searchQuery, availableAssets]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      // When user wants to "Buy", they see SELL ads
      // When user wants to "Sell", they see BUY ads
      const side: AdSide = viewMode === 'buy' ? 'SELL' : 'BUY';
      const result = await listAds({
        side,
        asset,
        fiatCurrency: fiat,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setAds(result.ads);
      setTotal(result.total);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, [viewMode, asset, fiat, page, pageSize]);

  const fetchStats = useCallback(async () => {
    if (!isKycApproved) return;
    setStatsLoading(true);
    try {
      const result = await getUserStats();
      setStats(result);
    } catch {
      // Silent fail for stats
    } finally {
      setStatsLoading(false);
    }
  }, [isKycApproved]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Table columns
  const columns: ColumnsType<P2PAd> = [
    {
      title: 'Advertiser',
      key: 'advertiser',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>
            {record.user?.firstName || record.user?.email?.split('@')[0] || 'Anonymous'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.user?.email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Price',
      key: 'price',
      render: (_, record) => (
        <Text strong style={{ color: token.colorSuccess, fontSize: 14 }}>
          {Number(record.price).toLocaleString('en-US', {
            style: 'currency',
            currency: record.fiatCurrency,
          })}
        </Text>
      ),
    },
    {
      title: 'Available',
      key: 'available',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>
            {Number(record.remainingQty).toFixed(6)} {record.asset}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            of {Number(record.totalQty).toFixed(6)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Limits',
      key: 'limits',
      render: (_, record) => (
        <Text style={{ fontSize: 12 }}>
          {Number(record.minQty)} - {Number(record.maxQty)} {record.asset}
        </Text>
      ),
    },
    {
      title: 'Payment',
      key: 'payment',
      render: (_, record) => (
        <Space wrap size={4}>
          {record.paymentMethods?.slice(0, 2).map((pm) => (
            <Tag key={pm.id} style={{ margin: 0, fontSize: 11 }}>
              {PAYMENT_METHOD_LABELS[pm.type]}
            </Tag>
          ))}
          {(record.paymentMethods?.length || 0) > 2 && (
            <Tag style={{ margin: 0, fontSize: 11 }}>
              +{(record.paymentMethods?.length || 0) - 2}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => {
        const isOwn = record.userId === user?.id;
        return (
          <Tooltip title={isOwn ? 'You cannot trade with your own ad' : undefined}>
            <Button
              type="primary"
              size="small"
              disabled={isOwn || !isKycApproved}
              onClick={() => router.push(`/p2p/ad/${record.id}`)}
              style={{
                background: isOwn ? undefined : (viewMode === 'buy' ? token.colorSuccess : token.colorPrimary),
                borderColor: isOwn ? undefined : (viewMode === 'buy' ? token.colorSuccess : token.colorPrimary),
              }}
            >
              {viewMode === 'buy' ? 'Buy' : 'Sell'}
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  // Mobile card view
  const renderMobileCard = (ad: P2PAd) => {
    const isOwn = ad.userId === user?.id;
    return (
      <Card
        key={ad.id}
        size="small"
        style={{
          marginBottom: token.marginSM,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : token.colorBorderSecondary}`,
        }}
      >
        <Space direction="vertical" size={token.marginXS} style={{ width: '100%' }}>
          {/* Advertiser and Price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Text strong style={{ fontSize: 13 }}>
                {ad.user?.firstName || ad.user?.email?.split('@')[0] || 'Anonymous'}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>{ad.user?.email}</Text>
            </div>
            <Text strong style={{ color: token.colorSuccess, fontSize: 16 }}>
              {Number(ad.price).toLocaleString('en-US', {
                style: 'currency',
                currency: ad.fiatCurrency,
              })}
            </Text>
          </div>

          {/* Available and Limits */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Available</Text>
              <br />
              <Text>{Number(ad.remainingQty).toFixed(6)} {ad.asset}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Limits</Text>
              <br />
              <Text style={{ fontSize: 12 }}>{Number(ad.minQty)} - {Number(ad.maxQty)}</Text>
            </div>
          </div>

          {/* Payment Methods */}
          <Space wrap size={4}>
            {ad.paymentMethods?.map((pm) => (
              <Tag key={pm.id} style={{ margin: 0, fontSize: 10 }}>
                {PAYMENT_METHOD_LABELS[pm.type]}
              </Tag>
            ))}
          </Space>

          {/* Action */}
          <Button
            type="primary"
            block
            disabled={isOwn || !isKycApproved}
            onClick={() => router.push(`/p2p/ad/${ad.id}`)}
            style={{
              marginTop: token.marginXS,
              background: isOwn ? undefined : (viewMode === 'buy' ? token.colorSuccess : token.colorPrimary),
              borderColor: isOwn ? undefined : (viewMode === 'buy' ? token.colorSuccess : token.colorPrimary),
            }}
          >
            {isOwn ? 'Your Ad' : (viewMode === 'buy' ? `Buy ${ad.asset}` : `Sell ${ad.asset}`)}
          </Button>
        </Space>
      </Card>
    );
  };

  // KYC not approved view
  if (!isKycApproved) {
    return (
      <>
        <Head>
          <title>P2P Trading | UG Coin</title>
        </Head>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', padding: token.paddingXL }}>
          <SafetyCertificateOutlined style={{ fontSize: 64, color: token.colorWarning, marginBottom: token.marginLG }} />
          <Title level={3}>Complete Identity Verification</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: token.marginLG }}>
            P2P trading requires identity verification. Complete KYC to start trading directly with other users.
          </Text>
          <Button type="primary" size="large" onClick={() => router.push('/onboarding')}>
            Complete Verification
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>P2P Marketplace | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? 0 : token.paddingLG }}>
        {/* Header */}
        <div style={{ marginBottom: token.marginXL }}>
          {isMobile ? (
            <>
              {/* Mobile: Title and Currency in same row */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: token.marginMD,
              }}>
                <Title level={3} style={{ margin: 0, fontWeight: fontWeights.bold, fontSize: token.fontSizeHeading4 }}>
                  P2P Marketplace
                </Title>
                <div
                  onClick={() => setShowCurrencyPicker(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `6px 14px`,
                    cursor: 'pointer',
                    borderRadius: 20,
                    background: isDark 
                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)'
                      : 'linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
                    border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.35)' : 'rgba(102, 126, 234, 0.25)'}`,
                    boxShadow: isDark 
                      ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                      : '0 4px 12px rgba(102, 126, 234, 0.15)',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: -10,
                    left: -10,
                    width: 40,
                    height: 40,
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                  }} />
                  <GlobalOutlined style={{ 
                    fontSize: 18, 
                    color: token.colorPrimary,
                    position: 'relative',
                    zIndex: 1,
                  }} />
                  <span style={{ 
                    fontWeight: fontWeights.bold, 
                    fontSize: token.fontSize, 
                    color: token.colorText,
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {selectedCurrencyData.symbol}
                  </span>
                  <DownOutlined style={{ 
                    fontSize: 10, 
                    color: token.colorPrimary,
                    position: 'relative',
                    zIndex: 1,
                  }} />
                </div>
              </div>

              {/* Mobile Action Buttons - All 4 in one row */}
              <div style={{ 
                display: 'flex',
                gap: token.marginSM,
                flexWrap: 'nowrap',
                marginBottom: token.marginMD,
              }}>
                {[
                  { key: 'trades', icon: <SwapOutlined />, label: 'Trades', color: token.colorWarning, href: '/p2p/trades' },
                  { key: 'my-ads', icon: <ShopOutlined />, label: 'My Ads', color: token.colorPrimary, href: '/p2p/ads/my' },
                  { key: 'payments', icon: <CreditCardOutlined />, label: 'Payments', color: token.colorSuccess, href: '/p2p/payment-methods' },
                  { key: 'post-ad', icon: <PlusOutlined />, label: 'Post Ad', color: token.colorSuccess, href: '/p2p/ads/create' },
                ].map((action) => (
                  <Link key={action.key} href={action.href} style={{ flex: 1, minWidth: 0 }}>
                    <button
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5em',
                        padding: '1em',
                        background: isMobile ? 'transparent' : token.colorBgContainer,
                        border: isMobile ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusLG,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.borderColor = action.color;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 4px 12px ${action.color}20`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.borderColor = token.colorBorderSecondary;
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '2.5em',
                          height: '2.5em',
                          borderRadius: '50%',
                          background: `${action.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: action.color,
                          fontSize: '1.2em',
                          flexShrink: 0,
                        }}
                      >
                        {action.icon}
                      </div>
                      <span
                        style={{
                          fontSize: '0.9em',
                          fontWeight: fontWeights.semibold,
                          color: token.colorText,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {action.label}
                      </span>
                    </button>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: token.marginLG,
                flexWrap: 'wrap',
                gap: token.marginMD,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, flexWrap: 'wrap', marginBottom: token.marginXS }}>
                    <Title level={2} style={{ margin: 0, fontWeight: fontWeights.bold }}>
                      P2P Marketplace
                    </Title>
                    {stats && (
                      <>
                        <Tag
                          style={{
                            margin: 0,
                            padding: `2px 8px`,
                            fontSize: token.fontSizeSM,
                            borderRadius: 12,
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.08)',
                            border: `1px solid ${token.colorBorderSecondary}`,
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                            Limit:{' '}
                          </Text>
                          <Text strong style={{ fontSize: token.fontSizeSM }}>
                            ${stats.dailyRemainingUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </Text>
                          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                            {' '}/ ${stats.dailyLimitUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </Text>
                        </Tag>
                        <Tag
                          style={{
                            margin: 0,
                            padding: `2px 8px`,
                            fontSize: token.fontSizeSM,
                            borderRadius: 12,
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.08)',
                            border: `1px solid ${token.colorBorderSecondary}`,
                          }}
                        >
                          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                            Trades:{' '}
                          </Text>
                          <Text strong style={{ fontSize: token.fontSizeSM }}>
                            {stats.totalTradesCompleted}
                          </Text>
                        </Tag>
                      </>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: token.fontSize }}>
                    Trade crypto directly with other users
                  </Text>
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: token.marginSM,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  <div
                    onClick={() => setShowCurrencyPicker(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: `6px 14px`,
                      cursor: 'pointer',
                      borderRadius: 20,
                      background: isDark 
                        ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)'
                        : 'linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
                      border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.35)' : 'rgba(102, 126, 234, 0.25)'}`,
                      boxShadow: isDark 
                        ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                        : '0 4px 12px rgba(102, 126, 234, 0.15)',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDark 
                        ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(139, 92, 246, 0.3) 100%)'
                        : 'linear-gradient(135deg, rgba(102, 126, 234, 0.22) 0%, rgba(139, 92, 246, 0.18) 100%)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.3)';
                      e.currentTarget.style.boxShadow = isDark 
                        ? '0 6px 16px rgba(102, 126, 234, 0.4)' 
                        : '0 6px 16px rgba(102, 126, 234, 0.2)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isDark 
                        ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(139, 92, 246, 0.25) 100%)'
                        : 'linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)';
                      e.currentTarget.style.borderColor = isDark ? 'rgba(102, 126, 234, 0.35)' : 'rgba(102, 126, 234, 0.25)';
                      e.currentTarget.style.boxShadow = isDark 
                        ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                        : '0 4px 12px rgba(102, 126, 234, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: -10,
                      left: -10,
                      width: 40,
                      height: 40,
                      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)',
                      borderRadius: '50%',
                      pointerEvents: 'none',
                    }} />
                    <GlobalOutlined style={{ 
                      fontSize: 18, 
                      color: token.colorPrimary,
                      position: 'relative',
                      zIndex: 1,
                    }} />
                    <span style={{ 
                      fontWeight: fontWeights.bold, 
                      fontSize: token.fontSize, 
                      color: token.colorText,
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      {selectedCurrencyData.symbol}
                    </span>
                    <DownOutlined style={{ 
                      fontSize: 10, 
                      color: token.colorPrimary,
                      position: 'relative',
                      zIndex: 1,
                    }} />
                  </div>
                  <Space>
                    <Link href="/p2p/trades">
                      <Button icon={<SwapOutlined />}>Trades</Button>
                    </Link>
                    <Link href="/p2p/ads/my">
                      <Button icon={<ShopOutlined />}>My Ads</Button>
                    </Link>
                    <Link href="/p2p/payment-methods">
                      <Button icon={<CreditCardOutlined />}>Payments</Button>
                    </Link>
                    <Link href="/p2p/ads/create">
                      <Button type="primary" icon={<PlusOutlined />}>Post Ad</Button>
                    </Link>
                  </Space>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats - Only show strikes and suspension */}
        {stats && (stats.strikeCount > 0 || stats.suspendedUntil) && (
          <div style={{ 
            display: 'flex', 
            gap: token.marginLG,
            marginBottom: token.marginLG,
            flexWrap: 'wrap',
          }}>
            {stats.strikeCount > 0 && (
              <div style={{ 
                padding: `${token.paddingMD}px ${token.paddingLG}px`,
                borderRadius: token.borderRadiusLG,
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(255,77,79,0.15) 0%, rgba(255,77,79,0.08) 100%)'
                  : 'linear-gradient(135deg, rgba(255,77,79,0.1) 0%, rgba(255,77,79,0.05) 100%)',
                border: `1px solid ${token.colorError}`,
                flex: 1,
                minWidth: 200,
              }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: token.marginXS }}>
                  Strikes
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                  <WarningOutlined style={{ color: token.colorError }} />
                  <Text strong style={{ fontSize: token.fontSizeLG, color: token.colorError }}>
                    {stats.strikeCount}
                  </Text>
                </div>
              </div>
            )}
            {stats.suspendedUntil && (
              <Alert
                type="error"
                message={`Suspended until ${new Date(stats.suspendedUntil).toLocaleDateString()}`}
                style={{ flex: '1 1 100%' }}
                showIcon
              />
            )}
          </div>
        )}

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: token.marginMD,
          marginBottom: token.marginLG,
          flexWrap: 'wrap',
          alignItems: 'center',
          flexDirection: isMobile ? 'column' : 'row',
        }}>
          {isMobile ? (
            <>
              {/* Mobile: Buy/Sell toggle and Crypto selector in full row with space between */}
              <div style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'space-between',
                gap: token.marginSM,
                alignItems: 'center',
              }}>
                <div className="p2p-segmented-wrapper" style={{ flex: 1, height: 48, display: 'flex', alignItems: 'center' }}>
                  <Segmented
                    value={viewMode}
                    onChange={(val) => setViewMode(val as 'buy' | 'sell')}
                    options={[
                      { 
                        label: (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ 
                              width: 8, 
                              height: 8, 
                              borderRadius: '50%', 
                              background: token.colorSuccess,
                              display: 'inline-block',
                            }} />
                            Buy Crypto
                          </span>
                        ), 
                        value: 'buy' 
                      },
                      { 
                        label: (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ 
                              width: 8, 
                              height: 8, 
                              borderRadius: '50%', 
                              background: token.colorWarning,
                              display: 'inline-block',
                            }} />
                            Sell Crypto
                          </span>
                        ), 
                        value: 'sell' 
                      },
                    ]}
                    style={{ 
                      fontWeight: fontWeights.medium,
                      width: '100%',
                    }}
                  />
                </div>
                
                <div
                  onClick={() => setShowTokenPicker(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginSM,
                    padding: `0 16px`,
                    height: 48,
                    cursor: 'pointer',
                    borderRadius: 12,
                    background: isDark 
                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)'
                      : 'linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
                    border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.25)'}`,
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 60,
                    height: 60,
                    background: isDark ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                  }} />
                  <img
                    src={selectedAssetData.iconUrl}
                    alt={selectedAssetData.symbol}
                    width={32}
                    height={32}
                    style={{ borderRadius: '50%', flexShrink: 0, position: 'relative', zIndex: 1 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selectedAssetData.symbol}&background=667eea&color=fff&size=64`;
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <div style={{ 
                      fontWeight: fontWeights.bold, 
                      color: token.colorText, 
                      fontSize: token.fontSize,
                      lineHeight: 1.2,
                    }}>
                      {selectedAssetData.symbol}
                    </div>
                    <div style={{ 
                      color: token.colorTextTertiary, 
                      fontSize: token.fontSizeSM,
                      lineHeight: 1.2,
                    }}>
                      {selectedAssetData.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 }}>
                    <Text style={{ 
                      fontSize: token.fontSizeSM, 
                      color: token.colorPrimary,
                      fontWeight: fontWeights.medium,
                    }}>
                      Change
                    </Text>
                    <DownOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <Space size="large" wrap>
              <div className="p2p-segmented-wrapper" style={{ height: 48, display: 'flex', alignItems: 'center' }}>
                <Segmented
                  value={viewMode}
                  onChange={(val) => setViewMode(val as 'buy' | 'sell')}
                  options={[
                    { 
                      label: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            background: token.colorSuccess,
                            display: 'inline-block',
                          }} />
                          Buy Crypto
                        </span>
                      ), 
                      value: 'buy' 
                    },
                    { 
                      label: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            background: token.colorWarning,
                            display: 'inline-block',
                          }} />
                          Sell Crypto
                        </span>
                      ), 
                      value: 'sell' 
                    },
                  ]}
                  style={{ 
                    fontWeight: fontWeights.medium,
                  }}
                />
              </div>
              
              <div
                onClick={() => setShowTokenPicker(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: token.marginSM,
                  padding: `0 16px`,
                  height: 48,
                  cursor: 'pointer',
                  borderRadius: 12,
                  background: isDark 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)',
                  border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.25)'}`,
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDark 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.35) 0%, rgba(139, 92, 246, 0.25) 100%)'
                    : 'linear-gradient(135deg, rgba(102, 126, 234, 0.22) 0%, rgba(139, 92, 246, 0.18) 100%)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.3)';
                  e.currentTarget.style.transform = 'scale(1.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDark 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(139, 92, 246, 0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(102, 126, 234, 0.18) 0%, rgba(139, 92, 246, 0.15) 100%)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.25)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 60,
                  height: 60,
                  background: isDark ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.1)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }} />
                <img
                  src={selectedAssetData.iconUrl}
                  alt={selectedAssetData.symbol}
                  width={32}
                  height={32}
                  style={{ borderRadius: '50%', flexShrink: 0, position: 'relative', zIndex: 1 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selectedAssetData.symbol}&background=667eea&color=fff&size=64`;
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                  <div style={{ 
                    fontWeight: fontWeights.bold, 
                    color: token.colorText, 
                    fontSize: token.fontSize,
                    lineHeight: 1.2,
                  }}>
                    {selectedAssetData.symbol}
                  </div>
                  <div style={{ 
                    color: token.colorTextTertiary, 
                    fontSize: token.fontSizeSM,
                    lineHeight: 1.2,
                  }}>
                    {selectedAssetData.name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 }}>
                  <Text style={{ 
                    fontSize: token.fontSizeSM, 
                    color: token.colorPrimary,
                    fontWeight: fontWeights.medium,
                  }}>
                    Change
                  </Text>
                  <DownOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
                </div>
              </div>

              <Button 
                type="primary"
                shape="circle"
                icon={<ReloadOutlined />} 
                onClick={fetchAds} 
                loading={loading}
                style={{ 
                  width: 40,
                  height: 40,
                  background: isDark 
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(139, 92, 246, 0.8) 100%)'
                    : undefined,
                  border: 'none',
                }}
                title="Refresh ads"
              />
            </Space>
          )}
        </div>

        {/* Ad List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: token.paddingXL }}>
            <Spin size="large" />
          </div>
        ) : ads.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                No ads found for {asset}/{fiat}.{' '}
                <Link href="/p2p/ads/create">Create one?</Link>
              </span>
            }
          />
        ) : isMobile ? (
          <div>{ads.map(renderMobileCard)}</div>
        ) : (
          <Table
            columns={columns}
            dataSource={ads}
            rowKey="id"
            size="small"
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (t) => `${t} ads`,
            }}
            style={{
              borderRadius: token.borderRadiusLG,
              overflow: 'hidden',
            }}
          />
        )}

        {/* Token Picker - Drawer (bottom sheet) on mobile, Modal on desktop */}
        {isMobile ? (
          <Drawer
            title="Select Asset"
            placement="bottom"
            open={showTokenPicker}
            onClose={() => {
              setShowTokenPicker(false);
              setSearchQuery('');
            }}
            height="70vh"
            zIndex={1100}
            styles={{
              header: {
                padding: `${token.paddingSM}px ${token.paddingMD}px`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              },
              body: {
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            <div style={{ padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
              <Input
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  borderRadius: token.borderRadius,
                  background: token.colorBgLayout,
                }}
                allowClear
              />
            </div>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: `0 ${token.paddingXS}px ${token.paddingSM}px`,
            }}>
              {filteredAssets.length === 0 ? (
                <Empty description="No assets found" />
              ) : (
                filteredAssets.map((assetData) => {
                  const isSelected = assetData.symbol === asset;
                  
                  return (
                    <div
                      key={assetData.symbol}
                      onClick={() => {
                        setAsset(assetData.symbol);
                        setShowTokenPicker(false);
                        setSearchQuery('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginSM,
                        padding: `${token.paddingSM}px ${token.paddingMD}px`,
                        cursor: 'pointer',
                        borderRadius: token.borderRadius,
                        backgroundColor: isSelected 
                          ? (isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                          : 'transparent',
                        border: isSelected 
                          ? `1px solid ${token.colorPrimary}` 
                          : `1px solid transparent`,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = isDark 
                            ? 'rgba(255,255,255,0.04)' 
                            : 'rgba(0,0,0,0.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <img
                        src={assetData.iconUrl}
                        alt={assetData.symbol}
                        width={40}
                        height={40}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${assetData.symbol}&background=667eea&color=fff&size=80`;
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: fontWeights.semibold, color: token.colorText, fontSize: token.fontSize }}>
                            {assetData.symbol}
                          </span>
                        </div>
                        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {assetData.name}
                        </div>
                      </div>
                      {isSelected && <CheckOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />}
                    </div>
                  );
                })
              )}
            </div>
          </Drawer>
        ) : (
          <Modal
            title="Select Asset"
            open={showTokenPicker}
            onCancel={() => {
              setShowTokenPicker(false);
              setSearchQuery('');
            }}
            footer={null}
            width={480}
            centered
            destroyOnClose={false}
            styles={{
              header: {
                padding: `${token.paddingSM}px ${token.paddingMD}px`,
                marginBottom: 0,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              },
              body: {
                padding: 0,
              },
              mask: {
                backdropFilter: 'blur(4px)',
              },
            }}
          >
            <div style={{ padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
              <Input
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  borderRadius: token.borderRadius,
                  background: token.colorBgLayout,
                }}
                allowClear
              />
            </div>
            <div style={{
              maxHeight: 400,
              overflowY: 'auto',
              padding: `0 ${token.paddingXS}px ${token.paddingSM}px`,
            }}>
              {filteredAssets.length === 0 ? (
                <Empty description="No assets found" />
              ) : (
                filteredAssets.map((assetData) => {
                  const isSelected = assetData.symbol === asset;
                  
                  return (
                    <div
                      key={assetData.symbol}
                      onClick={() => {
                        setAsset(assetData.symbol);
                        setShowTokenPicker(false);
                        setSearchQuery('');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginSM,
                        padding: `${token.paddingSM}px ${token.paddingMD}px`,
                        cursor: 'pointer',
                        borderRadius: token.borderRadius,
                        backgroundColor: isSelected 
                          ? (isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                          : 'transparent',
                        border: isSelected 
                          ? `1px solid ${token.colorPrimary}` 
                          : `1px solid transparent`,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = isDark 
                            ? 'rgba(255,255,255,0.04)' 
                            : 'rgba(0,0,0,0.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <img
                        src={assetData.iconUrl}
                        alt={assetData.symbol}
                        width={40}
                        height={40}
                        style={{ borderRadius: '50%', flexShrink: 0 }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${assetData.symbol}&background=667eea&color=fff&size=80`;
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontWeight: fontWeights.semibold,
                            color: token.colorText,
                            fontSize: token.fontSize,
                          }}>
                            {assetData.symbol}
                          </span>
                        </div>
                        <div style={{
                          fontSize: token.fontSizeSM,
                          color: token.colorTextTertiary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {assetData.name}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Modal>
        )}

        {/* Currency Picker - Drawer (bottom sheet) on mobile, Modal on desktop */}
        {isMobile ? (
          <Drawer
            title="Select Currency"
            placement="bottom"
            open={showCurrencyPicker}
            onClose={() => setShowCurrencyPicker(false)}
            height="50vh"
            zIndex={1100}
            styles={{
              header: {
                padding: `${token.paddingSM}px ${token.paddingMD}px`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              },
              body: {
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
              },
            }}
          >
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: `${token.paddingSM}px`,
            }}>
              {FIAT_CURRENCIES.map((currencyData) => {
                const isSelected = currencyData.symbol === fiat;
                
                return (
                  <div
                    key={currencyData.symbol}
                    onClick={() => {
                      setFiat(currencyData.symbol);
                      setShowCurrencyPicker(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: token.marginSM,
                      padding: `${token.paddingSM}px ${token.paddingMD}px`,
                      cursor: 'pointer',
                      borderRadius: token.borderRadius,
                      backgroundColor: isSelected ? (isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)') : 'transparent',
                      border: isSelected ? `1px solid ${token.colorPrimary}` : `1px solid transparent`,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: 20, display: 'flex', alignItems: 'center' }}>
                      {typeof currencyData.icon === 'string' 
                        ? currencyData.icon 
                        : currencyData.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: fontWeights.semibold, color: token.colorText, fontSize: token.fontSize }}>
                          {currencyData.symbol}
                        </span>
                      </div>
                      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
                        {currencyData.name}
                      </div>
                    </div>
                    {isSelected && <CheckOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />}
                  </div>
                );
              })}
            </div>
          </Drawer>
        ) : (
          <Modal
            title="Select Currency"
            open={showCurrencyPicker}
            onCancel={() => setShowCurrencyPicker(false)}
            footer={null}
            width={400}
            centered
            styles={{
              header: {
                padding: `${token.paddingSM}px ${token.paddingMD}px`,
                marginBottom: 0,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              },
              body: {
                padding: 0,
              },
            }}
          >
            <div style={{
              maxHeight: 400,
              overflowY: 'auto',
              padding: `${token.paddingSM}px`,
            }}>
              {FIAT_CURRENCIES.map((currencyData) => {
                const isSelected = currencyData.symbol === fiat;
                
                return (
                  <div
                    key={currencyData.symbol}
                    onClick={() => {
                      setFiat(currencyData.symbol);
                      setShowCurrencyPicker(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: token.marginSM,
                      padding: `${token.paddingSM}px ${token.paddingMD}px`,
                      cursor: 'pointer',
                      borderRadius: token.borderRadius,
                      backgroundColor: isSelected 
                        ? (isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)')
                        : 'transparent',
                      border: isSelected 
                        ? `1px solid ${token.colorPrimary}` 
                        : `1px solid transparent`,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isDark 
                          ? 'rgba(255,255,255,0.04)' 
                          : 'rgba(0,0,0,0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: 20, display: 'flex', alignItems: 'center' }}>
                      {typeof currencyData.icon === 'string' 
                        ? currencyData.icon 
                        : currencyData.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontWeight: fontWeights.semibold,
                          color: token.colorText,
                          fontSize: token.fontSize,
                        }}>
                          {currencyData.symbol}
                        </span>
                      </div>
                      <div style={{
                        fontSize: token.fontSizeSM,
                        color: token.colorTextTertiary,
                      }}>
                        {currencyData.name}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </Modal>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{
        __html: `
          .p2p-segmented-wrapper .ant-segmented {
            height: 48px !important;
            background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} !important;
            border-radius: 12px !important;
            padding: 4px !important;
            gap: 0 !important;
          }
          .p2p-segmented-wrapper .ant-segmented-item {
            height: 40px !important;
            line-height: 40px !important;
            border-radius: 8px !important;
            margin: 0 !important;
            border: none !important;
          }
          .p2p-segmented-wrapper .ant-segmented-item-selected {
            background: ${viewMode === 'buy' ? '#22C55E' : '#EF4444'} !important;
            box-shadow: ${viewMode === 'buy' 
              ? '0 2px 4px rgba(34, 197, 94, 0.3)' 
              : '0 2px 4px rgba(239, 68, 68, 0.3)'} !important;
          }
          .p2p-segmented-wrapper .ant-segmented-item-label {
            height: 40px !important;
            line-height: 40px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .p2p-segmented-wrapper .ant-segmented-item-selected .ant-segmented-item-label {
            color: #fff !important;
            font-weight: 600 !important;
          }
        `
      }} />
    </>
  );
};

P2PMarketplace.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default P2PMarketplace;
