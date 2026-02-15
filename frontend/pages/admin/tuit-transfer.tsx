import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  message,
  Tabs,
  Card,
  Statistic,
  Row,
  Col,
  Tag,
  Input,
  Modal,
  Form,
  Switch,
  Upload,
  Popconfirm,
  Typography,
  Tooltip,
  Descriptions,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  TuitTransferAdminApi,
  AuthorizedWallet,
  ConversionRequest,
  TransferStats,
  VestingData,
} from '@/services/api/tuit-transfer';

const { Text } = Typography;

export default function TuitTransferAdminPage() {
  const [activeTab, setActiveTab] = useState('wallets');
  const [stats, setStats] = useState<TransferStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await TuitTransferAdminApi.getStats();
      setStats(data);
    } catch (error: any) {
      message.error(error.message || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <AdminLayout selectedKey="tuit-transfer" title="TUIT Transfer Management">
      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <Statistic
              title="Total Wallets"
              value={stats?.totalWallets || 0}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <Statistic
              title="Active Wallets"
              value={stats?.activeWallets || 0}
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <Statistic
              title="Completed Transfers"
              value={stats?.completedTransfers || 0}
              loading={statsLoading}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <Statistic
              title="Pending Conversions"
              value={stats?.pendingConversions || 0}
              loading={statsLoading}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <Statistic
              title="Total Credited"
              value={stats ? formatNumber(stats.totalCredited) : 0}
              suffix="TUIT"
              loading={statsLoading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card size="small">
            <Statistic
              title="Total Converted"
              value={stats ? formatNumber(stats.totalConverted) : 0}
              suffix="TUIT"
              loading={statsLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        destroyInactiveTabPane
        items={[
          {
            key: 'wallets',
            label: 'Authorized Wallets',
            children: <AuthorizedWalletsTab onStatsChange={fetchStats} />,
          },
          {
            key: 'conversions',
            label: (
              <span>
                Conversion Requests
                {stats && stats.pendingConversions > 0 && (
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    {stats.pendingConversions}
                  </Tag>
                )}
              </span>
            ),
            children: <ConversionRequestsTab onStatsChange={fetchStats} />,
          },
        ]}
      />
    </AdminLayout>
  );
}

// ============================================
// Authorized Wallets Tab
// ============================================

interface WalletsTabProps {
  onStatsChange: () => void;
}

function AuthorizedWalletsTab({ onStatsChange }: WalletsTabProps) {
  const [wallets, setWallets] = useState<AuthorizedWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [vestingModalVisible, setVestingModalVisible] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<AuthorizedWallet | null>(null);
  const [vestingData, setVestingData] = useState<VestingData | null>(null);
  const [vestingLoading, setVestingLoading] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await TuitTransferAdminApi.getWallets(page, 20, search || undefined);
      setWallets(response.wallets);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || 'Failed to load wallets');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const handleViewVesting = async (wallet: AuthorizedWallet) => {
    setSelectedWallet(wallet);
    setVestingModalVisible(true);
    setVestingLoading(true);
    setVestingData(null);
    try {
      const data = await TuitTransferAdminApi.getWalletVesting(wallet.id);
      setVestingData(data);
    } catch (error: any) {
      message.error(error.message || 'Failed to load vesting data');
    } finally {
      setVestingLoading(false);
    }
  };

  const handleEdit = (wallet: AuthorizedWallet) => {
    setSelectedWallet(wallet);
    setEditModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await TuitTransferAdminApi.deleteWallet(id);
      message.success('Wallet deleted');
      fetchWallets();
      onStatsChange();
    } catch (error: any) {
      message.error(error.message || 'Failed to delete wallet');
    }
  };

  const handleToggleActive = async (wallet: AuthorizedWallet) => {
    try {
      await TuitTransferAdminApi.updateWallet(wallet.id, { isActive: !wallet.isActive });
      message.success(`Wallet ${wallet.isActive ? 'deactivated' : 'activated'}`);
      fetchWallets();
      onStatsChange();
    } catch (error: any) {
      message.error(error.message || 'Failed to update wallet');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const formatNumber = (value: string) => {
    return parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string | null) =>
        email ? (
          <Text ellipsis style={{ maxWidth: 180 }}>
            {email}
          </Text>
        ) : (
          <Text type="secondary">No email</Text>
        ),
    },
    {
      title: 'Wallet Address',
      dataIndex: 'walletAddress',
      key: 'walletAddress',
      width: 180,
      render: (address: string) => (
        <Space>
          <Text ellipsis style={{ maxWidth: 120 }} copyable={false}>
            {address.slice(0, 6)}...{address.slice(-4)}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(address)}
          />
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: any, record: AuthorizedWallet) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.hasTransferred && (
            <Tag color="blue">Transferred</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Credited',
      key: 'credited',
      width: 150,
      render: (_: any, record: AuthorizedWallet) =>
        record.transfer ? (
          <Text>{formatNumber(record.transfer.amountCredited)} TUIT</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_: any, record: AuthorizedWallet) => (
        <Space>
          <Tooltip title="View Vesting Data">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewVesting(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
            <Switch
              size="small"
              checked={record.isActive}
              onChange={() => handleToggleActive(record)}
            />
          </Tooltip>
          {!record.hasTransferred && (
            <Popconfirm
              title="Delete wallet?"
              description="This cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Input.Search
            placeholder="Search name, email, or wallet..."
            onSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
            Import CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            Add Wallet
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchWallets}>
            Refresh
          </Button>
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={wallets}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Add Wallet Modal */}
      <AddWalletModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={() => {
          setAddModalVisible(false);
          fetchWallets();
          onStatsChange();
        }}
      />

      {/* Edit Wallet Modal */}
      <EditWalletModal
        visible={editModalVisible}
        wallet={selectedWallet}
        onClose={() => {
          setEditModalVisible(false);
          setSelectedWallet(null);
        }}
        onSuccess={() => {
          setEditModalVisible(false);
          setSelectedWallet(null);
          fetchWallets();
        }}
      />

      {/* Vesting Data Modal */}
      <Modal
        title={`Vesting Data - ${selectedWallet?.name}`}
        open={vestingModalVisible}
        onCancel={() => {
          setVestingModalVisible(false);
          setSelectedWallet(null);
          setVestingData(null);
        }}
        footer={null}
        width={500}
      >
        {vestingLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : vestingData ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Wallet Address">
              <Text copyable>{vestingData.walletAddress}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Allocated">
              {formatNumber(vestingData.totalAllocated)} TUIT
            </Descriptions.Item>
            <Descriptions.Item label="Unlocked">
              {formatNumber(vestingData.unlocked)} TUIT
            </Descriptions.Item>
            <Descriptions.Item label="Withdrawn (External)">
              {formatNumber(vestingData.withdrawn)} TUIT
            </Descriptions.Item>
            <Descriptions.Item label="Available to Withdraw">
              <Text strong style={{ color: '#52c41a' }}>
                {formatNumber(vestingData.availableToWithdraw)} TUIT
              </Text>
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">No data available</Text>
        )}
      </Modal>

      {/* Import CSV Modal */}
      <ImportCsvModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSuccess={() => {
          setImportModalVisible(false);
          fetchWallets();
          onStatsChange();
        }}
      />
    </>
  );
}

// ============================================
// Add Wallet Modal
// ============================================

interface AddWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function AddWalletModal({ visible, onClose, onSuccess }: AddWalletModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await TuitTransferAdminApi.addWallet(values.name, values.walletAddress, values.email);
      message.success('Wallet added successfully');
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      message.error(error.message || 'Failed to add wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Authorized Wallet"
      open={visible}
      onCancel={onClose}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Investor Name"
          rules={[{ required: true, message: 'Name is required' }]}
        >
          <Input placeholder="John Doe" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email Address"
          rules={[{ type: 'email', message: 'Invalid email' }]}
        >
          <Input placeholder="john@example.com (optional)" />
        </Form.Item>
        <Form.Item
          name="walletAddress"
          label="Wallet Address"
          rules={[
            { required: true, message: 'Wallet address is required' },
            { pattern: /^0x[a-fA-F0-9]{40}$/, message: 'Invalid Ethereum address' },
          ]}
        >
          <Input placeholder="0x..." />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Add Wallet
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ============================================
// Edit Wallet Modal
// ============================================

interface EditWalletModalProps {
  visible: boolean;
  wallet: AuthorizedWallet | null;
  onClose: () => void;
  onSuccess: () => void;
}

function EditWalletModal({ visible, wallet, onClose, onSuccess }: EditWalletModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wallet) {
      form.setFieldsValue({
        name: wallet.name,
        email: wallet.email || '',
      });
    }
  }, [wallet, form]);

  const handleSubmit = async (values: any) => {
    if (!wallet) return;
    setLoading(true);
    try {
      await TuitTransferAdminApi.updateWallet(wallet.id, {
        name: values.name,
        email: values.email || null,
      });
      message.success('Wallet updated successfully');
      onSuccess();
    } catch (error: any) {
      message.error(error.message || 'Failed to update wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Edit Authorized Wallet"
      open={visible}
      onCancel={onClose}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Investor Name"
          rules={[{ required: true, message: 'Name is required' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email Address"
          rules={[{ type: 'email', message: 'Invalid email' }]}
        >
          <Input placeholder="Leave empty to remove" />
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save Changes
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ============================================
// Import CSV Modal
// ============================================

interface ImportCsvModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ImportCsvModal({ visible, onClose, onSuccess }: ImportCsvModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setResult(null);
    try {
      const response = await TuitTransferAdminApi.importCsv(file);
      setResult(response);
      if (response.imported > 0) {
        message.success(`Imported ${response.imported} wallets`);
      }
      if (response.skipped > 0) {
        message.warning(`Skipped ${response.skipped} entries`);
      }
      onSuccess();
    } catch (error: any) {
      message.error(error.message || 'Import failed');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <Modal
      title="Import Wallets from CSV"
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary">
          CSV format: name, email, wallet (with headers)
        </Text>

        <Upload.Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={loading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">Click or drag CSV file to upload</p>
        </Upload.Dragger>

        {loading && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin />
            <Text style={{ marginLeft: 8 }}>Processing...</Text>
          </div>
        )}

        {result && (
          <Card size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                Imported: {result.imported}
              </Text>
              <Text>
                <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Skipped: {result.skipped}
              </Text>
              {result.errors.length > 0 && (
                <div style={{ maxHeight: 150, overflow: 'auto' }}>
                  {result.errors.map((err, i) => (
                    <Text key={i} type="danger" style={{ display: 'block', fontSize: 12 }}>
                      {err}
                    </Text>
                  ))}
                </div>
              )}
            </Space>
          </Card>
        )}

        <Button onClick={handleClose} style={{ marginTop: 16 }}>
          Close
        </Button>
      </Space>
    </Modal>
  );
}

// ============================================
// Conversion Requests Tab
// ============================================

interface ConversionsTabProps {
  onStatsChange: () => void;
}

function ConversionRequestsTab({ onStatsChange }: ConversionsTabProps) {
  const [requests, setRequests] = useState<ConversionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | undefined>(undefined);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ConversionRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await TuitTransferAdminApi.getConversions(page, 20, statusFilter);
      setRequests(response.requests);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openReviewModal = (request: ConversionRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewModalVisible(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  const formatNumber = (value: string | null) => {
    if (!value) return '-';
    return parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'orange';
      case 'APPROVED':
        return 'green';
      case 'REJECTED':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_: any, record: ConversionRequest) => (
        <Space direction="vertical" size={0}>
          <Text>{record.userEmail}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.userId.slice(0, 8)}...
          </Text>
        </Space>
      ),
    },
    {
      title: 'Transaction Hash',
      dataIndex: 'txHash',
      key: 'txHash',
      width: 180,
      render: (hash: string) => (
        <Space>
          <Text ellipsis style={{ maxWidth: 120 }}>
            {hash.slice(0, 10)}...{hash.slice(-6)}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => copyToClipboard(hash)}
          />
          <a
            href={`https://etherscan.io/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button type="text" size="small" icon={<EyeOutlined />} />
          </a>
        </Space>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (amount: string | null) => (
        <Text>{formatNumber(amount)} TUIT</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Notes',
      dataIndex: 'reviewNotes',
      key: 'reviewNotes',
      width: 150,
      render: (notes: string | null) =>
        notes ? (
          <Tooltip title={notes}>
            <Text ellipsis style={{ maxWidth: 130 }}>
              {notes}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: ConversionRequest) =>
        record.status === 'PENDING' ? (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => openReviewModal(record, 'approve')}
            >
              Approve
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => openReviewModal(record, 'reject')}
            >
              Reject
            </Button>
          </Space>
        ) : (
          <Text type="secondary">
            Reviewed {record.reviewedAt ? new Date(record.reviewedAt).toLocaleDateString() : ''}
          </Text>
        ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button
            type={statusFilter === undefined ? 'primary' : 'default'}
            onClick={() => {
              setStatusFilter(undefined);
              setPage(1);
            }}
          >
            All
          </Button>
          <Button
            type={statusFilter === 'PENDING' ? 'primary' : 'default'}
            onClick={() => {
              setStatusFilter('PENDING');
              setPage(1);
            }}
          >
            Pending
          </Button>
          <Button
            type={statusFilter === 'APPROVED' ? 'primary' : 'default'}
            onClick={() => {
              setStatusFilter('APPROVED');
              setPage(1);
            }}
          >
            Approved
          </Button>
          <Button
            type={statusFilter === 'REJECTED' ? 'primary' : 'default'}
            onClick={() => {
              setStatusFilter('REJECTED');
              setPage(1);
            }}
          >
            Rejected
          </Button>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={fetchRequests}>
          Refresh
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Review Modal */}
      <ReviewConversionModal
        visible={reviewModalVisible}
        request={selectedRequest}
        action={reviewAction}
        onClose={() => {
          setReviewModalVisible(false);
          setSelectedRequest(null);
        }}
        onSuccess={() => {
          setReviewModalVisible(false);
          setSelectedRequest(null);
          fetchRequests();
          onStatsChange();
        }}
      />
    </>
  );
}

// ============================================
// Review Conversion Modal
// ============================================

interface ReviewConversionModalProps {
  visible: boolean;
  request: ConversionRequest | null;
  action: 'approve' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewConversionModal({
  visible,
  request,
  action,
  onClose,
  onSuccess,
}: ReviewConversionModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    if (!request) return;
    setLoading(true);
    try {
      if (action === 'approve') {
        await TuitTransferAdminApi.approveConversion(request.id, values.notes);
        message.success('Request approved and balance credited');
      } else {
        await TuitTransferAdminApi.rejectConversion(request.id, values.notes);
        message.success('Request rejected');
      }
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      message.error(error.message || `Failed to ${action} request`);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: string | null) => {
    if (!value) return '-';
    return parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <Modal
      title={action === 'approve' ? 'Approve Conversion Request' : 'Reject Conversion Request'}
      open={visible}
      onCancel={onClose}
      footer={null}
    >
      {request && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="User">{request.userEmail}</Descriptions.Item>
            <Descriptions.Item label="Amount">
              {formatNumber(request.amount)} TUIT
            </Descriptions.Item>
            <Descriptions.Item label="Transaction">
              <a
                href={`https://etherscan.io/tx/${request.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Etherscan
              </a>
            </Descriptions.Item>
          </Descriptions>

          <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 16 }}>
            <Form.Item
              name="notes"
              label="Notes"
              rules={action === 'reject' ? [{ required: true, message: 'Rejection reason is required' }] : []}
            >
              <Input.TextArea
                rows={3}
                placeholder={action === 'approve' ? 'Optional notes...' : 'Reason for rejection...'}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                  type="primary"
                  danger={action === 'reject'}
                  htmlType="submit"
                  loading={loading}
                >
                  {action === 'approve' ? 'Approve & Credit' : 'Reject'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      )}
    </Modal>
  );
}
