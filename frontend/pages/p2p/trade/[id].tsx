import React, { useState, useEffect, useCallback, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  theme,
  Typography,
  Button,
  Card,
  Tag,
  Space,
  Modal,
  Input,
  message,
  Spin,
  Alert,
  Descriptions,
  Divider,
  Steps,
  Image,
  Popconfirm,
  Grid,
  Progress,
  Drawer,
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  FileImageOutlined,
  WarningOutlined,
  UserOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../_app';
import {
  getTrade,
  uploadProof,
  markPaid,
  cancelTrade,
  releaseTrade,
  openDispute,
  type P2PTrade,
  TRADE_STATUS_CONFIG,
  ESCROW_STATUS_CONFIG,
  PAYMENT_METHOD_LABELS,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;
const { TextArea } = Input;

const TradeDetailPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { id } = router.query;
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(true);
  const [trade, setTrade] = useState<P2PTrade | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Timer
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Modals
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofUrl, setProofUrl] = useState('');

  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTrade = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    try {
      const result = await getTrade(id);
      setTrade(result);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to load trade');
      router.push('/p2p/trades');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchTrade();
  }, [fetchTrade]);

  // Polling for status updates
  useEffect(() => {
    if (!trade || trade.status === 'RELEASED' || trade.status === 'REFUNDED' || 
        trade.status === 'CANCELLED' || trade.status === 'EXPIRED') {
      return;
    }

    const interval = setInterval(fetchTrade, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [trade, fetchTrade]);

  // Timer countdown
  useEffect(() => {
    if (!trade || trade.status !== 'CREATED') {
      setTimeRemaining(0);
      return;
    }

    const calculateRemaining = () => {
      const expiresAt = new Date(trade.expiresAt).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((expiresAt - now) / 1000));
    };

    setTimeRemaining(calculateRemaining());
    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemaining(remaining);
      if (remaining === 0) {
        fetchTrade(); // Refresh to get updated status
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trade, fetchTrade]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isBuyer = trade?.buyerUserId === user?.id;
  const isSeller = trade?.sellerUserId === user?.id;

  // Action handlers
  const handleUploadProof = async () => {
    if (!trade || !proofUrl.trim()) return;
    setActionLoading('proof');
    try {
      const updated = await uploadProof(trade.id, proofUrl.trim());
      setTrade(updated);
      setProofModalOpen(false);
      setProofUrl('');
      message.success('Proof uploaded');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to upload proof');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!trade) return;
    if (trade.proofUrls.length === 0) {
      message.error('Please upload payment proof first');
      return;
    }
    setActionLoading('paid');
    try {
      const updated = await markPaid(trade.id);
      setTrade(updated);
      message.success('Marked as paid');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!trade) return;
    setActionLoading('cancel');
    try {
      const updated = await cancelTrade(trade.id);
      setTrade(updated);
      message.success('Trade cancelled');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to cancel trade');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelease = async () => {
    if (!trade) return;
    setActionLoading('release');
    try {
      const updated = await releaseTrade(trade.id);
      setTrade(updated);
      message.success('Crypto released to buyer');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to release');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDispute = async () => {
    if (!trade || !disputeReason.trim()) return;
    setActionLoading('dispute');
    try {
      await openDispute(trade.id, { reason: disputeReason.trim() });
      await fetchTrade();
      setDisputeModalOpen(false);
      setDisputeReason('');
      message.success('Dispute opened');
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to open dispute');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingXL * 2 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!trade) {
    return <Alert type="error" message="Trade not found" showIcon />;
  }

  const statusConfig = TRADE_STATUS_CONFIG[trade.status];
  const escrowConfig = trade.escrow ? ESCROW_STATUS_CONFIG[trade.escrow.status] : null;

  // Build timeline steps
  const getSteps = () => {
    const steps = [
      { title: 'Created', description: new Date(trade.createdAt).toLocaleString() },
    ];

    if (trade.paidAt) {
      steps.push({ title: 'Paid', description: new Date(trade.paidAt).toLocaleString() });
    }

    if (trade.status === 'DISPUTED' && trade.dispute) {
      steps.push({ title: 'Disputed', description: new Date(trade.dispute.openedAt).toLocaleString() });
    }

    if (trade.releasedAt) {
      steps.push({ title: 'Released', description: new Date(trade.releasedAt).toLocaleString() });
    }

    if (trade.cancelledAt) {
      steps.push({ title: trade.status === 'EXPIRED' ? 'Expired' : 'Cancelled', description: new Date(trade.cancelledAt).toLocaleString() });
    }

    return steps;
  };

  const getCurrentStep = () => {
    if (trade.status === 'RELEASED' || trade.status === 'REFUNDED') return getSteps().length - 1;
    if (trade.status === 'CANCELLED' || trade.status === 'EXPIRED') return getSteps().length - 1;
    if (trade.status === 'DISPUTED') return 2;
    if (trade.status === 'PAID') return 1;
    return 0;
  };

  return (
    <>
      <Head>
        <title>Trade {trade.tradeNumber} | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Back Button */}
        <Link href="/p2p/trades">
          <Button type="text" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: token.marginMD }}>
            Back to My Trades
          </Button>
        </Link>

        {/* Header */}
        <Card
          style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: token.marginMD }}>
            <div>
              <Space size={token.marginSM}>
                <Title level={4} style={{ margin: 0 }}>{trade.tradeNumber}</Title>
                <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
              </Space>
              <div style={{ marginTop: token.marginXS }}>
                <Tag color={isBuyer ? 'green' : 'blue'}>
                  You are the {isBuyer ? 'Buyer' : 'Seller'}
                </Tag>
              </div>
            </div>

            {/* Timer for CREATED status */}
            {trade.status === 'CREATED' && (
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Payment due in</Text>
                <div style={{ 
                  fontSize: 24, 
                  fontWeight: fontWeights.bold,
                  color: timeRemaining < 120 ? token.colorError : token.colorWarning,
                }}>
                  <ClockCircleOutlined style={{ marginRight: 8 }} />
                  {formatTime(timeRemaining)}
                </div>
                <Progress 
                  percent={Math.max(0, (timeRemaining / 900) * 100)} 
                  showInfo={false} 
                  strokeColor={timeRemaining < 120 ? token.colorError : token.colorWarning}
                  style={{ width: 150 }}
                />
              </div>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: token.marginLG }}>
          {/* Left Column - Trade Details */}
          <div style={{ flex: 1 }}>
            {/* Trade Info */}
            <Card
              title="Trade Details"
              style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
            >
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Asset">
                  <Text strong style={{ fontSize: 16 }}>
                    {Number(trade.qtyCrypto).toFixed(6)} {trade.asset}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Price">
                  {Number(trade.price).toLocaleString('en-US', {
                    style: 'currency',
                    currency: trade.fiatCurrency,
                  })} per {trade.asset}
                </Descriptions.Item>
                <Descriptions.Item label="Total">
                  <Text strong style={{ fontSize: 16, color: token.colorSuccess }}>
                    {Number(trade.notional).toLocaleString('en-US', {
                      style: 'currency',
                      currency: trade.fiatCurrency,
                    })}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Payment Method">
                  <Tag>{PAYMENT_METHOD_LABELS[trade.paymentMethodType]}</Tag>
                </Descriptions.Item>
              </Descriptions>

              <Divider style={{ margin: `${token.marginMD}px 0` }} />

              {/* Counterparty */}
              <Space>
                <UserOutlined />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {isBuyer ? 'Seller' : 'Buyer'}
                  </Text>
                  <br />
                  <Text strong>
                    {isBuyer ? trade.seller?.email : trade.buyer?.email}
                  </Text>
                </div>
              </Space>
            </Card>

            {/* Escrow Status */}
            {trade.escrow && (
              <Card
                title={
                  <Space>
                    <SafetyCertificateOutlined style={{ color: token.colorSuccess }} />
                    <span>Escrow</span>
                  </Space>
                }
                style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ fontSize: 16 }}>
                      {Number(trade.escrow.qtyLocked).toFixed(6)} {trade.escrow.asset}
                    </Text>
                  </div>
                  <Tag color={escrowConfig?.color}>{escrowConfig?.label}</Tag>
                </div>
              </Card>
            )}

            {/* Payment Proof */}
            <Card
              title={
                <Space>
                  <FileImageOutlined />
                  <span>Payment Proof</span>
                </Space>
              }
              style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
            >
              {trade.proofUrls.length === 0 ? (
                <Text type="secondary">No proof uploaded yet</Text>
              ) : (
                <Image.PreviewGroup>
                  <Space wrap>
                    {trade.proofUrls.map((url, index) => (
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

              {/* Upload button for buyer in CREATED status */}
              {isBuyer && trade.status === 'CREATED' && (
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => setProofModalOpen(true)}
                  style={{ marginTop: token.marginMD }}
                >
                  Upload Proof
                </Button>
              )}
            </Card>

            {/* Dispute Info */}
            {trade.dispute && (
              <Card
                title={
                  <Space>
                    <ExclamationCircleOutlined style={{ color: token.colorError }} />
                    <span>Dispute</span>
                  </Space>
                }
                style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Status">
                    <Tag color={trade.dispute.status === 'OPEN' ? 'error' : 'default'}>
                      {trade.dispute.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Reason">
                    {trade.dispute.reason}
                  </Descriptions.Item>
                  <Descriptions.Item label="Opened By">
                    {trade.dispute.openedBy?.email}
                  </Descriptions.Item>
                  {trade.dispute.outcome && (
                    <Descriptions.Item label="Outcome">
                      <Tag color={trade.dispute.outcome === 'RELEASE_TO_BUYER' ? 'success' : 'warning'}>
                        {trade.dispute.outcome === 'RELEASE_TO_BUYER' ? 'Released to Buyer' : 'Refunded to Seller'}
                      </Tag>
                    </Descriptions.Item>
                  )}
                  {trade.dispute.resolution && (
                    <Descriptions.Item label="Resolution">
                      {trade.dispute.resolution}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}
          </div>

          {/* Right Column - Actions & Timeline */}
          <div style={{ width: isMobile ? '100%' : 300 }}>
            {/* Actions */}
            <Card
              title="Actions"
              style={{ marginBottom: token.marginLG, borderRadius: token.borderRadiusLG }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={token.marginSM}>
                {/* Buyer Actions */}
                {isBuyer && (
                  <>
                    {trade.status === 'CREATED' && (
                      <>
                        <Button
                          type="primary"
                          block
                          icon={<CheckCircleOutlined />}
                          onClick={handleMarkPaid}
                          loading={actionLoading === 'paid'}
                          disabled={trade.proofUrls.length === 0}
                        >
                          I Have Paid
                        </Button>
                        {trade.proofUrls.length === 0 && (
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center' }}>
                            Upload proof before marking paid
                          </Text>
                        )}
                        <Popconfirm
                          title="Cancel this trade?"
                          description="The crypto will be returned to the seller."
                          onConfirm={handleCancel}
                          okText="Yes, Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <Button
                            block
                            icon={<CloseCircleOutlined />}
                            loading={actionLoading === 'cancel'}
                          >
                            Cancel Trade
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                    {trade.status === 'PAID' && !trade.dispute && (
                      <Button
                        block
                        danger
                        icon={<WarningOutlined />}
                        onClick={() => setDisputeModalOpen(true)}
                      >
                        Open Dispute
                      </Button>
                    )}
                  </>
                )}

                {/* Seller Actions */}
                {isSeller && (
                  <>
                    {trade.status === 'CREATED' && (
                      <Alert
                        type="info"
                        message="Waiting for buyer to pay"
                        style={{ margin: 0 }}
                      />
                    )}
                    {trade.status === 'PAID' && !trade.dispute && (
                      <>
                        <Popconfirm
                          title="Release crypto to buyer?"
                          description="Only release after confirming payment received."
                          onConfirm={handleRelease}
                          okText="Yes, Release"
                        >
                          <Button
                            type="primary"
                            block
                            icon={<CheckCircleOutlined />}
                            loading={actionLoading === 'release'}
                            style={{ background: token.colorSuccess, borderColor: token.colorSuccess }}
                          >
                            Release Crypto
                          </Button>
                        </Popconfirm>
                        <Button
                          block
                          danger
                          icon={<WarningOutlined />}
                          onClick={() => setDisputeModalOpen(true)}
                        >
                          Open Dispute
                        </Button>
                      </>
                    )}
                  </>
                )}

                {/* Final States */}
                {trade.status === 'RELEASED' && (
                  <Alert
                    type="success"
                    message="Trade Completed"
                    description="Crypto has been transferred to the buyer."
                    icon={<CheckCircleOutlined />}
                    showIcon
                  />
                )}
                {trade.status === 'REFUNDED' && (
                  <Alert
                    type="info"
                    message="Trade Refunded"
                    description="Crypto has been returned to the seller."
                    showIcon
                  />
                )}
                {trade.status === 'CANCELLED' && (
                  <Alert
                    type="info"
                    message="Trade Cancelled"
                    showIcon
                  />
                )}
                {trade.status === 'EXPIRED' && (
                  <Alert
                    type="warning"
                    message="Trade Expired"
                    description="Payment window expired."
                    showIcon
                  />
                )}
                {trade.status === 'DISPUTED' && (
                  <Alert
                    type="warning"
                    message="Under Review"
                    description="Awaiting admin resolution."
                    icon={<ExclamationCircleOutlined />}
                    showIcon
                  />
                )}
              </Space>
            </Card>

            {/* Timeline */}
            <Card
              title="Timeline"
              style={{ borderRadius: token.borderRadiusLG }}
            >
              <Steps
                direction="vertical"
                size="small"
                current={getCurrentStep()}
                items={getSteps().map((step) => ({
                  title: step.title,
                  description: <Text type="secondary" style={{ fontSize: 11 }}>{step.description}</Text>,
                }))}
              />
            </Card>
          </div>
        </div>
      </div>

      {/* Proof Upload Modal/Drawer */}
      {isMobile ? (
        <Drawer
          title="Upload Payment Proof"
          placement="bottom"
          height="50vh"
          open={proofModalOpen}
          onClose={() => setProofModalOpen(false)}
          styles={{ wrapper: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' } }}
          footer={
            <Space style={{ width: '100%' }}>
              <Button block onClick={() => setProofModalOpen(false)}>Cancel</Button>
              <Button block type="primary" onClick={handleUploadProof} loading={actionLoading === 'proof'}>
                Upload
              </Button>
            </Space>
          }
        >
          <Text style={{ marginBottom: token.marginSM, display: 'block' }}>
            Enter the URL of your payment screenshot or receipt:
          </Text>
          <Input
            placeholder="https://example.com/proof.jpg"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          <Text type="secondary" style={{ fontSize: 11, marginTop: token.marginXS, display: 'block' }}>
            Upload your image to a service like imgur.com and paste the URL here.
          </Text>
        </Drawer>
      ) : (
        <Modal
          title="Upload Payment Proof"
          open={proofModalOpen}
          onCancel={() => setProofModalOpen(false)}
          onOk={handleUploadProof}
          confirmLoading={actionLoading === 'proof'}
        >
          <Text style={{ marginBottom: token.marginSM, display: 'block' }}>
            Enter the URL of your payment screenshot or receipt:
          </Text>
          <Input
            placeholder="https://example.com/proof.jpg"
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
          />
          <Text type="secondary" style={{ fontSize: 11, marginTop: token.marginXS, display: 'block' }}>
            Upload your image to a service like imgur.com and paste the URL here.
          </Text>
        </Modal>
      )}

      {/* Dispute Modal/Drawer */}
      {isMobile ? (
        <Drawer
          title="Open Dispute"
          placement="bottom"
          height="60vh"
          open={disputeModalOpen}
          onClose={() => setDisputeModalOpen(false)}
          styles={{ wrapper: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' } }}
          footer={
            <Space style={{ width: '100%' }}>
              <Button block onClick={() => setDisputeModalOpen(false)}>Cancel</Button>
              <Button block type="primary" danger onClick={handleOpenDispute} loading={actionLoading === 'dispute'}>
                Open Dispute
              </Button>
            </Space>
          }
        >
          <Alert
            type="warning"
            message="Only open a dispute if there is a genuine issue"
            style={{ marginBottom: token.marginMD }}
          />
          <Text style={{ marginBottom: token.marginXS, display: 'block' }}>Reason for dispute:</Text>
          <TextArea
            rows={4}
            placeholder="Describe the issue..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
        </Drawer>
      ) : (
        <Modal
          title="Open Dispute"
          open={disputeModalOpen}
          onCancel={() => setDisputeModalOpen(false)}
          onOk={handleOpenDispute}
          okText="Open Dispute"
          okButtonProps={{ danger: true }}
          confirmLoading={actionLoading === 'dispute'}
        >
          <Alert
            type="warning"
            message="Only open a dispute if there is a genuine issue"
            style={{ marginBottom: token.marginMD }}
          />
          <Text style={{ marginBottom: token.marginXS, display: 'block' }}>Reason for dispute:</Text>
          <TextArea
            rows={4}
            placeholder="Describe the issue..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
          />
        </Modal>
      )}
    </>
  );
};

TradeDetailPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default TradeDetailPage;

