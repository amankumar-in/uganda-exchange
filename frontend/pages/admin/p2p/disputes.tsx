import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  theme,
  Typography,
  Button,
  Table,
  Tag,
  Space,
  Select,
  message,
  Empty,
  Spin,
  Card,
  Modal,
  Input,
  Descriptions,
  Image,
  Divider,
  Alert,
  Radio,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import {
  listTrades,
  resolveDispute,
  type P2PTrade,
  type DisputeOutcome,
  TRADE_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';

const { useToken } = theme;
const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

export default function AdminP2PDisputesPage() {
  const router = useRouter();
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  // State
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<P2PTrade[]>([]);
  const [statusFilter, setStatusFilter] = useState<'DISPUTED' | 'ALL'>('DISPUTED');

  // Modal state
  const [selectedTrade, setSelectedTrade] = useState<P2PTrade | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<DisputeOutcome | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all trades for admin view
      const result = await listTrades({
        status: statusFilter === 'DISPUTED' ? 'DISPUTED' : 'ALL',
        role: 'all',
        limit: 100,
      });
      
      // Filter to only disputed trades if needed
      let filtered = result.trades;
      if (statusFilter === 'DISPUTED') {
        filtered = result.trades.filter(t => t.status === 'DISPUTED');
      }
      
      setTrades(filtered);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleViewDetails = (trade: P2PTrade) => {
    setSelectedTrade(trade);
    setSelectedOutcome(null);
    setResolutionNotes('');
    setDetailModalOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedTrade || !selectedOutcome || !resolutionNotes.trim()) {
      message.error('Please select an outcome and provide resolution notes');
      return;
    }

    setResolving(true);
    try {
      await resolveDispute(selectedTrade.id, {
        outcome: selectedOutcome,
        resolution: resolutionNotes.trim(),
      });
      message.success('Dispute resolved successfully');
      setDetailModalOpen(false);
      setSelectedTrade(null);
      fetchTrades();
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
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
      title: 'Buyer',
      key: 'buyer',
      render: (_, record) => (
        <Text style={{ fontSize: 12 }}>{record.buyer?.email || 'Unknown'}</Text>
      ),
    },
    {
      title: 'Seller',
      key: 'seller',
      render: (_, record) => (
        <Text style={{ fontSize: 12 }}>{record.seller?.email || 'Unknown'}</Text>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
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
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const config = TRADE_STATUS_CONFIG[record.status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'Dispute',
      key: 'dispute',
      render: (_, record) => {
        if (!record.dispute) return <Text type="secondary">-</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Tag color={record.dispute.status === 'OPEN' ? 'error' : 'default'}>
              {record.dispute.status}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.dispute.reason?.slice(0, 30)}...
            </Text>
          </Space>
        );
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
          onClick={() => handleViewDetails(record)}
        >
          View
        </Button>
      ),
    },
  ];

  const openDisputesCount = trades.filter(t => t.status === 'DISPUTED' && t.dispute?.status === 'OPEN').length;

  return (
    <AdminLayout selectedKey="p2p-disputes" title="P2P Disputes">
      <Head>
        <title>P2P Disputes | Admin | UG Coin</title>
      </Head>

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: token.marginLG,
      }}>
        <div>
          {openDisputesCount > 0 && (
            <Tag color="error" style={{ marginLeft: token.marginSM }}>
              {openDisputesCount} open dispute{openDisputesCount > 1 ? 's' : ''}
            </Tag>
          )}
        </div>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { label: 'Disputed Only', value: 'DISPUTED' },
              { label: 'All Trades', value: 'ALL' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTrades} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Trade List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: token.paddingXL }}>
          <Spin size="large" />
        </div>
      ) : trades.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={statusFilter === 'DISPUTED' ? 'No disputed trades' : 'No trades found'}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={trades}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 20,
            showTotal: (t) => `${t} trades`,
          }}
        />
      )}

      {/* Trade Detail Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: token.colorError }} />
            <span>Trade Details - {selectedTrade?.tradeNumber}</span>
          </Space>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={700}
        footer={null}
      >
        {selectedTrade && (
          <>
            {/* Trade Info */}
            <Card size="small" style={{ marginBottom: token.marginMD }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Asset">
                  {Number(selectedTrade.qtyCrypto).toFixed(6)} {selectedTrade.asset}
                </Descriptions.Item>
                <Descriptions.Item label="Value">
                  {Number(selectedTrade.notional).toLocaleString('en-US', {
                    style: 'currency',
                    currency: selectedTrade.fiatCurrency,
                  })}
                </Descriptions.Item>
                <Descriptions.Item label="Buyer">
                  {selectedTrade.buyer?.email}
                </Descriptions.Item>
                <Descriptions.Item label="Seller">
                  {selectedTrade.seller?.email}
                </Descriptions.Item>
                <Descriptions.Item label="Payment Method">
                  {PAYMENT_METHOD_LABELS[selectedTrade.paymentMethodType]}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={TRADE_STATUS_CONFIG[selectedTrade.status].color}>
                    {TRADE_STATUS_CONFIG[selectedTrade.status].label}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Escrow Info */}
            {selectedTrade.escrow && (
              <Card size="small" title="Escrow" style={{ marginBottom: token.marginMD }}>
                <Text strong>
                  {Number(selectedTrade.escrow.qtyLocked).toFixed(6)} {selectedTrade.escrow.asset}
                </Text>
                <Tag style={{ marginLeft: token.marginSM }}>
                  {selectedTrade.escrow.status}
                </Tag>
              </Card>
            )}

            {/* Payment Proof */}
            <Card size="small" title="Payment Proof" style={{ marginBottom: token.marginMD }}>
              {selectedTrade.proofUrls.length === 0 ? (
                <Text type="secondary">No proof uploaded</Text>
              ) : (
                <Image.PreviewGroup>
                  <Space wrap>
                    {selectedTrade.proofUrls.map((url, index) => (
                      <Image
                        key={index}
                        src={url}
                        alt={`Proof ${index + 1}`}
                        width={100}
                        height={100}
                        style={{ objectFit: 'cover', borderRadius: token.borderRadius }}
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              )}
            </Card>

            {/* Dispute Info */}
            {selectedTrade.dispute && (
              <Card 
                size="small" 
                title={
                  <Space>
                    <ExclamationCircleOutlined style={{ color: token.colorError }} />
                    <span>Dispute Details</span>
                    <Tag color={selectedTrade.dispute.status === 'OPEN' ? 'error' : 'success'}>
                      {selectedTrade.dispute.status}
                    </Tag>
                  </Space>
                }
                style={{ marginBottom: token.marginMD }}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Opened By">
                    {selectedTrade.dispute.openedBy?.email}
                  </Descriptions.Item>
                  <Descriptions.Item label="Reason">
                    {selectedTrade.dispute.reason}
                  </Descriptions.Item>
                  {selectedTrade.dispute.evidence?.length > 0 && (
                    <Descriptions.Item label="Evidence">
                      <Image.PreviewGroup>
                        <Space wrap>
                          {selectedTrade.dispute.evidence.map((url, index) => (
                            <Image
                              key={index}
                              src={url}
                              alt={`Evidence ${index + 1}`}
                              width={80}
                              height={80}
                              style={{ objectFit: 'cover', borderRadius: token.borderRadius }}
                            />
                          ))}
                        </Space>
                      </Image.PreviewGroup>
                    </Descriptions.Item>
                  )}
                  {selectedTrade.dispute.outcome && (
                    <>
                      <Descriptions.Item label="Outcome">
                        <Tag color={selectedTrade.dispute.outcome === 'RELEASE_TO_BUYER' ? 'success' : 'warning'}>
                          {selectedTrade.dispute.outcome === 'RELEASE_TO_BUYER' ? 'Released to Buyer' : 'Refunded to Seller'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Resolution">
                        {selectedTrade.dispute.resolution}
                      </Descriptions.Item>
                      <Descriptions.Item label="Resolved By">
                        {selectedTrade.dispute.resolvedBy?.email}
                      </Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              </Card>
            )}

            {/* Resolution Form (only for open disputes) */}
            {selectedTrade.dispute?.status === 'OPEN' && (
              <>
                <Divider />
                <Title level={5}>Resolve Dispute</Title>
                
                <div style={{ marginBottom: token.marginMD }}>
                  <Text style={{ display: 'block', marginBottom: token.marginXS }}>
                    Select Outcome:
                  </Text>
                  <Radio.Group
                    value={selectedOutcome}
                    onChange={(e) => setSelectedOutcome(e.target.value)}
                  >
                    <Space direction="vertical">
                      <Radio value="RELEASE_TO_BUYER">
                        <Space>
                          <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                          <span>Release to Buyer</span>
                          <Text type="secondary">(Crypto goes to buyer)</Text>
                        </Space>
                      </Radio>
                      <Radio value="REFUND_TO_SELLER">
                        <Space>
                          <CheckCircleOutlined style={{ color: token.colorWarning }} />
                          <span>Refund to Seller</span>
                          <Text type="secondary">(Crypto returns to seller)</Text>
                        </Space>
                      </Radio>
                    </Space>
                  </Radio.Group>
                </div>

                <div style={{ marginBottom: token.marginMD }}>
                  <Text style={{ display: 'block', marginBottom: token.marginXS }}>
                    Resolution Notes:
                  </Text>
                  <TextArea
                    rows={3}
                    placeholder="Explain the decision..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>

                <Alert
                  type="warning"
                  message="This action cannot be undone. Make sure to review all evidence before resolving."
                  style={{ marginBottom: token.marginMD }}
                />

                <Space>
                  <Button onClick={() => setDetailModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    loading={resolving}
                    onClick={handleResolve}
                    disabled={!selectedOutcome || !resolutionNotes.trim()}
                  >
                    Resolve Dispute
                  </Button>
                </Space>
              </>
            )}
          </>
        )}
      </Modal>
    </AdminLayout>
  );
}

