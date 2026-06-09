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
  Select,
  message,
  Empty,
  Spin,
  Grid,
  Card,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../_app';
import {
  listTrades,
  type P2PTrade,
  type TradeStatus,
  TRADE_STATUS_CONFIG,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;

const MyTradesPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<P2PTrade[]>([]);
  const [total, setTotal] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<TradeStatus | 'ALL' | 'ACTIVE'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'buyer' | 'seller' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      // Map ACTIVE to actual statuses
      let status: TradeStatus | 'ALL' | undefined;
      if (statusFilter === 'ACTIVE') {
        // Fetch CREATED and PAID separately or use ALL and filter
        status = 'ALL';
      } else {
        status = statusFilter;
      }

      const result = await listTrades({
        status,
        role: roleFilter,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      // Client-side filter for ACTIVE
      let filteredTrades = result.trades;
      if (statusFilter === 'ACTIVE') {
        filteredTrades = result.trades.filter(t => 
          t.status === 'CREATED' || t.status === 'PAID'
        );
      }

      setTrades(filteredTrades);
      setTotal(statusFilter === 'ACTIVE' ? filteredTrades.length : result.total);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, roleFilter, page, pageSize]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const getUserRole = (trade: P2PTrade): 'buyer' | 'seller' => {
    return trade.buyerUserId === user?.id ? 'buyer' : 'seller';
  };

  const getCounterparty = (trade: P2PTrade) => {
    const isBuyer = trade.buyerUserId === user?.id;
    return isBuyer ? trade.seller : trade.buyer;
  };

  // Table columns
  const columns: ColumnsType<P2PTrade> = [
    {
      title: 'Trade',
      key: 'trade',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{record.tradeNumber}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(record.createdAt).toLocaleDateString()}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      key: 'type',
      render: (_, record) => {
        const role = getUserRole(record);
        return (
          <Tag color={role === 'buyer' ? 'green' : 'blue'}>
            {role === 'buyer' ? 'Buying' : 'Selling'}
          </Tag>
        );
      },
    },
    {
      title: 'Asset',
      key: 'asset',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>
            {Number(record.qtyCrypto).toFixed(6)} {record.asset}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {Number(record.notional).toLocaleString('en-US', {
              style: 'currency',
              currency: record.fiatCurrency,
            })}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Counterparty',
      key: 'counterparty',
      render: (_, record) => {
        const counterparty = getCounterparty(record);
        return (
          <Text style={{ fontSize: 12 }}>
            {counterparty?.email || 'Unknown'}
          </Text>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const config = TRADE_STATUS_CONFIG[record.status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => router.push(`/p2p/trade/${record.id}`)}
        >
          View
        </Button>
      ),
    },
  ];

  // Mobile card view
  const renderMobileCard = (trade: P2PTrade) => {
    const role = getUserRole(trade);
    const counterparty = getCounterparty(trade);
    const config = TRADE_STATUS_CONFIG[trade.status];

    return (
      <Card
        key={trade.id}
        size="small"
        style={{
          marginBottom: token.marginSM,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : token.colorBorderSecondary}`,
          cursor: 'pointer',
        }}
        onClick={() => router.push(`/p2p/trade/${trade.id}`)}
      >
        <Space direction="vertical" size={token.marginXS} style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Tag color={role === 'buyer' ? 'green' : 'blue'}>
                {role === 'buyer' ? 'Buying' : 'Selling'}
              </Tag>
              <Text strong>{trade.tradeNumber}</Text>
            </Space>
            <Tag color={config.color}>{config.label}</Tag>
          </div>

          {/* Amount */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 16 }}>
              {Number(trade.qtyCrypto).toFixed(6)} {trade.asset}
            </Text>
            <Text style={{ color: token.colorSuccess }}>
              {Number(trade.notional).toLocaleString('en-US', {
                style: 'currency',
                currency: trade.fiatCurrency,
              })}
            </Text>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {counterparty?.email || 'Unknown'}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {new Date(trade.createdAt).toLocaleDateString()}
            </Text>
          </div>
        </Space>
      </Card>
    );
  };

  const tabItems = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'RELEASED', label: 'Completed' },
    { key: 'DISPUTED', label: 'Disputed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <>
      <Head>
        <title>My Trades | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: token.marginLG,
        }}>
          <div>
            <Link href="/p2p">
              <Button type="text" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: token.marginXS }}>
                Back to Marketplace
              </Button>
            </Link>
            <Title level={4} style={{ margin: 0 }}>My Trades</Title>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchTrades} loading={loading}>
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Space 
          direction={isMobile ? 'vertical' : 'horizontal'} 
          style={{ width: '100%', marginBottom: token.marginMD }}
          size={token.marginMD}
        >
          <Tabs
            activeKey={statusFilter}
            onChange={(key) => { setStatusFilter(key as TradeStatus | 'ALL' | 'ACTIVE'); setPage(1); }}
            items={tabItems}
            style={{ marginBottom: 0 }}
          />
          <Select
            value={roleFilter}
            onChange={(val) => { setRoleFilter(val); setPage(1); }}
            style={{ width: 140 }}
            options={[
              { label: 'All Roles', value: 'all' },
              { label: 'As Buyer', value: 'buyer' },
              { label: 'As Seller', value: 'seller' },
            ]}
          />
        </Space>

        {/* Trade List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: token.paddingXL }}>
            <Spin size="large" />
          </div>
        ) : trades.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No trades found"
          />
        ) : isMobile ? (
          <div>{trades.map(renderMobileCard)}</div>
        ) : (
          <Table
            columns={columns}
            dataSource={trades}
            rowKey="id"
            size="small"
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (t) => `${t} trades`,
            }}
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

MyTradesPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default MyTradesPage;

