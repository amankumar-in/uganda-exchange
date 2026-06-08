import React from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Typography,
  Divider,
  Space,
  Button,
} from 'antd';
import Link from 'next/link';
import { TransactionDetail } from '../../../services/api/admin';

const { Text, Title } = Typography;

interface TransactionDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  transaction: TransactionDetail | null;
  loading?: boolean;
}

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

function formatNumber(value: number | undefined | null, decimals = 2): string {
  if (value === undefined || value === null) return '-';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals > 2 ? 8 : decimals,
  });
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

export const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  open,
  onClose,
  transaction,
  loading,
}) => {
  if (!transaction) return null;

  const isTrade = transaction.category === 'trade';

  return (
    <Drawer
      title={
        <Space>
          <Tag color={typeColors[transaction.txnType] || 'default'}>
            {transaction.txnType}
          </Tag>
          <Tag color={statusColors[transaction.status] || 'default'}>
            {transaction.status}
          </Tag>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {transaction.transactionId || transaction.id.slice(0, 8)}
          </Text>
        </Space>
      }
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      loading={loading}
    >
      {/* User Info */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>USER</Text>
        <div>
          <Link href={`/admin/users/${transaction.user?.id}`}>
            <Button type="link" style={{ padding: 0 }}>
              {transaction.user?.email}
            </Button>
          </Link>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {transaction.user?.phoneCountry} {transaction.user?.phone}
        </Text>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Trade Details */}
      {isTrade && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>Trade Details</Title>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Pair">
              {transaction.asset}/{transaction.quote}
            </Descriptions.Item>
            <Descriptions.Item label="Side">
              <Tag color={typeColors[transaction.txnType]}>{transaction.txnType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Product ID">
              {transaction.productId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Requested Amount">
              {formatNumber(transaction.requestedAmount, 8)} {transaction.asset}
            </Descriptions.Item>
            <Descriptions.Item label="Filled Amount">
              {formatNumber(transaction.filledAmount, 8)} {transaction.asset}
            </Descriptions.Item>
            <Descriptions.Item label="Execution Price">
              {formatNumber(transaction.price)} {transaction.quote}
            </Descriptions.Item>
            <Descriptions.Item label="Total Value">
              <Text strong>{formatNumber(transaction.totalValue)} {transaction.quote}</Text>
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '16px 0' }} />

          <Title level={5} style={{ marginBottom: 12 }}>Fee Breakdown</Title>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Platform Fee">
              {formatNumber(transaction.platformFee)} {transaction.quote}
            </Descriptions.Item>
            <Descriptions.Item label="Fee Percentage">
              {formatNumber(transaction.feePercent)}%
            </Descriptions.Item>
            <Descriptions.Item label="Exchange Fee">
              {formatNumber(transaction.exchangeFee)} {transaction.quote}
            </Descriptions.Item>
          </Descriptions>

          {transaction.coinbaseOrderId && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Coinbase Order ID">
                  <Text copyable={{ text: transaction.coinbaseOrderId }}>
                    {transaction.coinbaseOrderId.slice(0, 16)}...
                  </Text>
                </Descriptions.Item>
              </Descriptions>
            </>
          )}
        </>
      )}

      {/* Fiat Transaction Details */}
      {!isTrade && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>Transaction Details</Title>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Type">
              <Tag color={typeColors[transaction.txnType]}>{transaction.txnType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Amount">
              <Text strong>{formatNumber(transaction.amount)} UGX</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Method">
              {transaction.method || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Reference">
              {transaction.reference ? (
                <Text copyable={{ text: transaction.reference }}>
                  {transaction.reference}
                </Text>
              ) : '-'}
            </Descriptions.Item>
          </Descriptions>

          {transaction.metadata && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <Title level={5} style={{ marginBottom: 12 }}>Payment Metadata</Title>
              <Descriptions column={1} size="small" bordered>
                {Object.entries(transaction.metadata as Record<string, any>).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    <Text copyable={{ text: String(value) }}>
                      {String(value)}
                    </Text>
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </>
          )}
        </>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* Timestamps */}
      <Title level={5} style={{ marginBottom: 12 }}>Timeline</Title>
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Created">
          {formatDate(transaction.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Updated">
          {formatDate(transaction.updatedAt)}
        </Descriptions.Item>
        {transaction.completedAt && (
          <Descriptions.Item label="Completed">
            {formatDate(transaction.completedAt)}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider style={{ margin: '16px 0' }} />

      {/* IDs */}
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Transaction ID">
          <Text copyable={{ text: transaction.transactionId || transaction.id }} style={{ fontSize: 12 }}>
            {transaction.transactionId || transaction.id}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Internal ID">
          <Text copyable={{ text: transaction.id }} type="secondary" style={{ fontSize: 11 }}>
            {transaction.id}
          </Text>
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};
