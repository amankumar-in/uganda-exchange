import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Input,
  Select,
  Tag,
  Button,
  Space,
  message,
  DatePicker,
  Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { TransactionDetailDrawer } from '../../components/admin/transactions/TransactionDetailDrawer';
import {
  getAllTransactions,
  getTransactionDetail,
  PlatformTransaction,
  TransactionDetail,
} from '../../services/api/admin';
import Link from 'next/link';
import dayjs from 'dayjs';

const { Search } = Input;
const { Text } = Typography;
const { RangePicker } = DatePicker;

const typeColors: Record<string, string> = {
  BUY: 'green',
  SELL: 'red',
  DEPOSIT: 'blue',
  WITHDRAWAL: 'orange',
};

const statusColors: Record<string, string> = {
  COMPLETED: 'green',
  PENDING: 'orange',
  PROCESSING: 'blue',
  FAILED: 'red',
  CANCELLED: 'default',
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<PlatformTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | undefined>();

  // Detail drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllTransactions({
        page,
        limit,
        type: typeFilter,
        status: statusFilter,
        dateFrom: dateRange?.[0],
        dateTo: dateRange?.[1],
        search: search || undefined,
      });
      setTransactions(response.transactions);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, typeFilter, statusFilter, dateRange, search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleRowClick = async (record: PlatformTransaction) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const response = await getTransactionDetail(record.id, record.category);
      setSelectedTxn(response.transaction);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch transaction details');
    } finally {
      setDrawerLoading(false);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => (
        <Text style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Transaction ID',
      key: 'transactionId',
      width: 150,
      render: (_: any, record: PlatformTransaction) => (
        <Text copyable={{ text: record.transactionId || record.id }} style={{ fontSize: 12 }}>
          {record.transactionId || record.id.slice(0, 12) + '...'}
        </Text>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 180,
      render: (_: any, record: PlatformTransaction) => (
        <Link href={`/admin/users/${record.userId}`}>
          <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}>
            {record.userEmail}
          </Button>
        </Link>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'txnType',
      key: 'txnType',
      width: 110,
      render: (type: string) => (
        <Tag color={typeColors[type] || 'default'}>{type}</Tag>
      ),
    },
    {
      title: 'Asset',
      key: 'asset',
      width: 100,
      render: (_: any, record: PlatformTransaction) => (
        <Text>
          {record.asset}
          {record.quote ? `/${record.quote}` : ''}
        </Text>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 140,
      align: 'right' as const,
      render: (_: any, record: PlatformTransaction) => (
        <Text>
          {record.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
          })}
        </Text>
      ),
    },
    {
      title: 'Total Value',
      key: 'totalValue',
      width: 140,
      align: 'right' as const,
      render: (_: any, record: PlatformTransaction) => (
        <Text>
          {record.totalValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          {' '}
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.quote || 'UGX'}
          </Text>
        </Text>
      ),
    },
    {
      title: 'Fee',
      dataIndex: 'platformFee',
      key: 'platformFee',
      width: 100,
      align: 'right' as const,
      render: (fee: number) =>
        fee > 0 ? (
          <Text type="warning">
            {fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{status}</Tag>
      ),
    },
  ];

  return (
    <AdminLayout selectedKey="transactions">
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Search
          placeholder="Search by ID, email, phone..."
          style={{ width: 260 }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          allowClear
        />
        <Select
          placeholder="Type"
          style={{ width: 130 }}
          allowClear
          onChange={(value) => {
            setTypeFilter(value);
            setPage(1);
          }}
          options={[
            { value: 'BUY', label: 'Buy' },
            { value: 'SELL', label: 'Sell' },
            { value: 'DEPOSIT', label: 'Deposit' },
            { value: 'WITHDRAWAL', label: 'Withdrawal' },
          ]}
        />
        <Select
          placeholder="Status"
          style={{ width: 120 }}
          allowClear
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'PROCESSING', label: 'Processing' },
            { value: 'FAILED', label: 'Failed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
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
            setPage(1);
          }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchTransactions} loading={loading}>
          Refresh
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={transactions}
        loading={loading}
        rowKey="id"
        size="small"
        scroll={{ x: 1200 }}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} transactions`,
          onChange: (p, l) => {
            setPage(p);
            setLimit(l);
          },
        }}
      />

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
