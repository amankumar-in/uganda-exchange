import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Space,
  Button,
  message,
} from 'antd';
import { ReloadOutlined, ArrowRightOutlined, DollarOutlined, UserOutlined, BankOutlined } from '@ant-design/icons';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { getPlatformHoldings, PlatformHoldings } from '../../services/api/admin';
import Link from 'next/link';
import { useRouter } from 'next/router';

const { Title, Text } = Typography;

export default function AdminHoldingsPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<PlatformHoldings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPlatformHoldings();
      setHoldings(response);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch platform holdings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const totalFeeRevenue = holdings?.revenue.reduce((acc, curr) => {
    // A simplified conversion for display, but ideally we'd show per currency.
    // Assuming for now we just want to know how many non-zero fee currencies exist
    return acc + curr.amount; // Note: mixing currencies in sum is bad, we will just show count or major
  }, 0);

  const columns = [
    {
      title: 'Asset',
      dataIndex: 'asset',
      key: 'asset',
      width: 150,
      render: (asset: string) => (
        <Space>
          <Text strong>{asset}</Text>
        </Space>
      ),
    },
    {
      title: 'Total Balance Held',
      dataIndex: 'totalBalance',
      key: 'totalBalance',
      align: 'right' as const,
      render: (balance: number, record: any) => (
        <Text>
          {balance.toLocaleString(undefined, {
            minimumFractionDigits: record.asset === 'UGX' ? 0 : 4,
            maximumFractionDigits: record.asset === 'UGX' ? 2 : 8,
          })}
        </Text>
      ),
    },
    {
      title: 'Number of Holders',
      dataIndex: 'userCount',
      key: 'userCount',
      align: 'right' as const,
      render: (count: number) => <Text>{count.toLocaleString()}</Text>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Link href={`/admin/holdings/${record.asset}/transactions`}>
          <Button type="link" size="small">
            View Ledger <ArrowRightOutlined />
          </Button>
        </Link>
      ),
    },
  ];

  const dataSourceLive = holdings ? [
    holdings.fiat,
    ...holdings.crypto
  ] : [];

  const dataSourceDemo = holdings ? [
    holdings.learnerFiat,
    ...holdings.learnerCrypto
  ] : [];

  return (
    <AdminLayout selectedKey="holdings">
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'flex-end' }}>
        <Button icon={<ReloadOutlined />} onClick={fetchHoldings} loading={loading}>
          Refresh
        </Button>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Total Cash Held (UGX)"
              value={holdings?.fiat?.totalBalance || 0}
              precision={0}
              prefix={<BankOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Active Crypto Assets"
              value={holdings?.crypto?.length || 0}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title="Total Active Users"
              value={holdings?.totalUsers || 0}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ cursor: 'pointer' }} onClick={() => router.push('/admin/fees')}>
            <Statistic
              title="Fee Revenue Currencies"
              value={holdings?.revenue?.length || 0}
              prefix={<DollarOutlined />}
              suffix={<ArrowRightOutlined style={{ fontSize: 14, color: '#1890ff', marginLeft: 8 }} />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Live Assets (System Wallet)" bordered={false} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={dataSourceLive}
          rowKey="asset"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card title="Demo Assets (Learner Wallet)" bordered={false} bodyStyle={{ padding: 0 }} style={{ marginTop: 24 }}>
        <Table
          columns={columns}
          dataSource={dataSourceDemo}
          rowKey="asset"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </Card>

      <Card title="Fee Revenue Balances" bordered={false} style={{ marginTop: 24 }}>
        {loading ? (
          <Text type="secondary">Loading...</Text>
        ) : holdings?.revenue && holdings.revenue.length > 0 ? (
          <Row gutter={[16, 16]}>
            {holdings.revenue.map(rev => (
              <Col xs={24} sm={12} md={8} lg={6} key={rev.currency}>
                <Card size="small" type="inner">
                  <Statistic 
                    title={`${rev.currency} Fees Collected`}
                    value={rev.amount}
                    precision={rev.currency === 'UGX' ? 0 : 6}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Text type="secondary">No fee revenue collected yet.</Text>
        )}
        <div style={{ marginTop: 16 }}>
          <Link href="/admin/fees">
            <Button type="primary">View Detailed Fee Reports</Button>
          </Link>
        </div>
      </Card>

    </AdminLayout>
  );
}
