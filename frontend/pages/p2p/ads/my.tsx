import React, { useState, useEffect, useCallback, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  theme,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Tabs,
  message,
  Empty,
  Spin,
  Grid,
  Card,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../_app';
import {
  getMyAds,
  pauseAd,
  resumeAd,
  closeAd,
  type P2PAd,
  type AdStatus,
  AD_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;

const MyAdsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(true);
  const [ads, setAds] = useState<P2PAd[]>([]);
  const [statusFilter, setStatusFilter] = useState<AdStatus | 'ALL'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyAds(true); // Include all statuses
      setAds(result);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const filteredAds = statusFilter === 'ALL' 
    ? ads 
    : ads.filter(ad => ad.status === statusFilter);

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await pauseAd(id);
      setAds(ads.map(ad => ad.id === id ? updated : ad));
      message.success('Ad paused');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to pause ad');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await resumeAd(id);
      setAds(ads.map(ad => ad.id === id ? updated : ad));
      message.success('Ad resumed');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to resume ad');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await closeAd(id);
      setAds(ads.map(ad => ad.id === id ? updated : ad));
      message.success('Ad closed');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to close ad');
    } finally {
      setActionLoading(null);
    }
  };

  // Table columns
  const columns: ColumnsType<P2PAd> = [
    {
      title: 'Type',
      key: 'type',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.side === 'SELL' ? 'red' : 'green'}>
            {record.side}
          </Tag>
          <Text style={{ fontSize: 12 }}>{record.asset}/{record.fiatCurrency}</Text>
        </Space>
      ),
    },
    {
      title: 'Price',
      key: 'price',
      render: (_, record) => (
        <Text strong>
          {Number(record.price).toLocaleString('en-US', {
            style: 'currency',
            currency: record.fiatCurrency,
          })}
        </Text>
      ),
    },
    {
      title: 'Quantity',
      key: 'quantity',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{Number(record.remainingQty).toFixed(6)} {record.asset}</Text>
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
          {Number(record.minQty)} - {Number(record.maxQty)}
        </Text>
      ),
    },
    {
      title: 'Payment',
      key: 'payment',
      render: (_, record) => (
        <Space wrap size={4}>
          {record.paymentMethods?.slice(0, 2).map((pm) => (
            <Tag key={pm.id} style={{ margin: 0, fontSize: 10 }}>
              {PAYMENT_METHOD_LABELS[pm.type]}
            </Tag>
          ))}
          {(record.paymentMethods?.length || 0) > 2 && (
            <Tag style={{ margin: 0, fontSize: 10 }}>+{(record.paymentMethods?.length || 0) - 2}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const config = AD_STATUS_CONFIG[record.status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'ACTIVE' && (
            <Tooltip title="Pause">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePause(record.id)}
                loading={actionLoading === record.id}
              />
            </Tooltip>
          )}
          {record.status === 'PAUSED' && (
            <Tooltip title="Resume">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleResume(record.id)}
                loading={actionLoading === record.id}
              />
            </Tooltip>
          )}
          {record.status !== 'CLOSED' && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => router.push(`/p2p/ads/${record.id}/edit`)}
                />
              </Tooltip>
              <Popconfirm
                title="Close this ad?"
                description="This action cannot be undone."
                onConfirm={() => handleClose(record.id)}
                okText="Close"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Close">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    loading={actionLoading === record.id}
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Mobile card view
  const renderMobileCard = (ad: P2PAd) => {
    const statusConfig = AD_STATUS_CONFIG[ad.status];
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
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Tag color={ad.side === 'SELL' ? 'red' : 'green'}>{ad.side}</Tag>
              <Text strong>{ad.asset}/{ad.fiatCurrency}</Text>
            </Space>
            <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
          </div>

          {/* Price and Quantity */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Price</Text>
              <br />
              <Text strong>
                {Number(ad.price).toLocaleString('en-US', {
                  style: 'currency',
                  currency: ad.fiatCurrency,
                })}
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Remaining</Text>
              <br />
              <Text>{Number(ad.remainingQty).toFixed(6)} {ad.asset}</Text>
            </div>
          </div>

          {/* Actions */}
          <Space style={{ marginTop: token.marginXS }}>
            {ad.status === 'ACTIVE' && (
              <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handlePause(ad.id)}>
                Pause
              </Button>
            )}
            {ad.status === 'PAUSED' && (
              <Button size="small" icon={<PlayCircleOutlined />} onClick={() => handleResume(ad.id)}>
                Resume
              </Button>
            )}
            {ad.status !== 'CLOSED' && (
              <>
                <Button size="small" icon={<EditOutlined />} onClick={() => router.push(`/p2p/ads/${ad.id}/edit`)}>
                  Edit
                </Button>
                <Popconfirm
                  title="Close this ad?"
                  onConfirm={() => handleClose(ad.id)}
                  okText="Close"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<StopOutlined />}>
                    Close
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        </Space>
      </Card>
    );
  };

  const tabItems = [
    { key: 'ALL', label: `All (${ads.length})` },
    { key: 'ACTIVE', label: `Active (${ads.filter(a => a.status === 'ACTIVE').length})` },
    { key: 'PAUSED', label: `Paused (${ads.filter(a => a.status === 'PAUSED').length})` },
    { key: 'CLOSED', label: `Closed (${ads.filter(a => a.status === 'CLOSED').length})` },
  ];

  return (
    <>
      <Head>
        <title>My Ads | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'stretch' : 'center',
          gap: token.marginMD,
          marginBottom: token.marginLG,
        }}>
          <div>
            <Link href="/p2p">
              <Button type="text" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: token.marginXS }}>
                Back to Marketplace
              </Button>
            </Link>
            <Title level={4} style={{ margin: 0 }}>My Ads</Title>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchAds} loading={loading}>
              Refresh
            </Button>
            <Link href="/p2p/ads/create">
              <Button type="primary" icon={<PlusOutlined />}>Create Ad</Button>
            </Link>
          </Space>
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={statusFilter}
          onChange={(key) => setStatusFilter(key as AdStatus | 'ALL')}
          items={tabItems}
          style={{ marginBottom: token.marginMD }}
        />

        {/* Ad List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: token.paddingXL }}>
            <Spin size="large" />
          </div>
        ) : filteredAds.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={statusFilter === 'ALL' ? 'No ads created yet' : `No ${statusFilter.toLowerCase()} ads`}
          >
            <Link href="/p2p/ads/create">
              <Button type="primary">Create Your First Ad</Button>
            </Link>
          </Empty>
        ) : isMobile ? (
          <div>{filteredAds.map(renderMobileCard)}</div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredAds}
            rowKey="id"
            size="small"
            pagination={false}
            style={{
              borderRadius: token.borderRadiusLG,
              overflow: 'hidden',
            }}
          />
        )}
      </div>
    </>
  );
};

MyAdsPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default MyAdsPage;

