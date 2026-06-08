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
  Radio,
  DatePicker,
} from 'antd';
import { ReloadOutlined, PercentageOutlined, DollarOutlined, SwapOutlined } from '@ant-design/icons';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { TransactionDetailDrawer } from '../../components/admin/transactions/TransactionDetailDrawer';
import { getFeeReport, getTransactionDetail, FeeReport, FeeTransaction, TransactionDetail } from '../../services/api/admin';
import Link from 'next/link';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AdminFeesPage() {
  const [report, setReport] = useState<FeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'thisMonth' | 'thisYear' | 'custom'>('thisMonth');
  const [dateRange, setDateRange] = useState<[string, string] | undefined>();

  // Detail drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getFeeReport({
        period,
        dateFrom: dateRange?.[0],
        dateTo: dateRange?.[1],
      });
      setReport(response);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch fee reports');
    } finally {
      setLoading(false);
    }
  }, [period, dateRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleRowClick = async (record: FeeTransaction) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const response = await getTransactionDetail(record.id, 'trade');
      setSelectedTxn(response.transaction);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch transaction details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const byCurrencyColumns = [
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      render: (currency: string) => <Text strong>{currency}</Text>,
    },
    {
      title: 'Total Fees Collected',
      dataIndex: 'totalFees',
      key: 'totalFees',
      align: 'right' as const,
      render: (val: number, record: any) => (
        <Text>
          {val.toLocaleString(undefined, { minimumFractionDigits: record.currency === 'UGX' ? 0 : 4, maximumFractionDigits: record.currency === 'UGX' ? 2 : 6 })}
        </Text>
      ),
    },
    {
      title: 'Transactions',
      dataIndex: 'transactionCount',
      key: 'transactionCount',
      align: 'right' as const,
    },
    {
      title: 'Avg Fee / Txn',
      dataIndex: 'avgFee',
      key: 'avgFee',
      align: 'right' as const,
      render: (val: number, record: any) => (
        <Text>
          {val.toLocaleString(undefined, { minimumFractionDigits: record.currency === 'UGX' ? 0 : 4, maximumFractionDigits: record.currency === 'UGX' ? 2 : 6 })}
        </Text>
      ),
    },
  ];

  const transactionColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>{new Date(date).toLocaleString()}</Text>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 180,
      render: (_: any, record: FeeTransaction) => (
        <Link href={`/admin/users/${record.id}`}>
          <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}>
            {record.userEmail}
          </Button>
        </Link>
      ),
    },
    {
      title: 'Pair',
      key: 'pair',
      width: 100,
      render: (_: any, record: FeeTransaction) => (
        <Text>{record.asset}/{record.quote}</Text>
      ),
    },
    {
      title: 'Trade Value',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 140,
      align: 'right' as const,
      render: (val: number, record: FeeTransaction) => (
        <Text>
          {val.toLocaleString(undefined, { minimumFractionDigits: 2 })} <Text type="secondary" style={{ fontSize: 11 }}>{record.quote}</Text>
        </Text>
      ),
    },
    {
      title: 'Fee Amount',
      dataIndex: 'platformFee',
      key: 'platformFee',
      width: 140,
      align: 'right' as const,
      render: (val: number, record: FeeTransaction) => (
        <Text type="success" strong>
          {val.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })} <Text type="secondary" style={{ fontSize: 11 }}>{record.quote}</Text>
        </Text>
      ),
    },
    {
      title: 'Fee %',
      dataIndex: 'feePercent',
      key: 'feePercent',
      width: 80,
      align: 'right' as const,
      render: (val: number) => (
        <Text>{val.toFixed(2)}%</Text>
      ),
    },
  ];

  return (
    <AdminLayout selectedKey="fees">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Radio.Group 
            value={period} 
            onChange={(e) => {
              setPeriod(e.target.value);
              if (e.target.value !== 'custom') setDateRange(undefined);
            }}
          >
            <Radio.Button value="today">Today</Radio.Button>
            <Radio.Button value="thisMonth">This Month</Radio.Button>
            <Radio.Button value="thisYear">This Year</Radio.Button>
            <Radio.Button value="custom">Custom</Radio.Button>
          </Radio.Group>
          {period === 'custom' && (
            <RangePicker
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([
                    dates[0].format('YYYY-MM-DD'),
                    dates[1].format('YYYY-MM-DD'),
                  ]);
                } else {
                  setDateRange(undefined);
                }
              }}
            />
          )}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchReport} loading={loading}>
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="Total Transactions w/ Fees"
              value={report?.summary?.totalTransactions || 0}
              prefix={<SwapOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="Effective Fee Rate"
              value={report?.summary?.feePercentOfVolume || 0}
              precision={2}
              suffix="%"
              prefix={<PercentageOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false}>
            <Statistic
              title="Total Traded Volume (Mixed Currencies)"
              value={report?.summary?.totalVolume || 0}
              precision={2}
              prefix={<DollarOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} xl={8}>
          <Card title="Fees by Currency" bordered={false} bodyStyle={{ padding: 0 }}>
            <Table
              columns={byCurrencyColumns}
              dataSource={report?.byCurrency || []}
              rowKey="currency"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="Fee Ledger" bordered={false} bodyStyle={{ padding: 0 }}>
            <Table
              columns={transactionColumns}
              dataSource={report?.transactions || []}
              rowKey="id"
              loading={loading}
              size="small"
              scroll={{ x: 800 }}
              pagination={{ pageSize: 15 }}
              onRow={(record) => ({
                onClick: () => handleRowClick(record),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>
      </Row>

      <TransactionDetailDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedTxn(null);
        }}
        transaction={selectedTxn}
        loading={drawerLoading}
      />
    </AdminLayout>
  );
}
