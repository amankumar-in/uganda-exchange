import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Tag,
  Typography,
  Image,
  Switch,
  Upload,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ImportOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import {
  getCollegeCoins,
  deleteCollegeCoin,
  updateCollegeCoin,
  importCollegeCoins,
  DemoCollegeCoin,
} from '../../../services/api/admin';
import { resolveUploadUrl } from '../../../services/api/demo-college-coins';

const { Text } = Typography;

const CSV_TEMPLATE = `ticker,name,peggedToAsset,peggedPercentage,iconUrl,description,website,whitepaper,twitter,discord,categories,genesisDate,isActive
MIT,MIT Coin,ETH,10,/api/uploads/media/mit-icon.png,MIT University Token,https://mit.edu,,,MIT|Education|University,2024-01-01,true
STANFORD,Stanford Token,BTC,5,,Stanford University Token,https://stanford.edu,,,Stanford|Education,2024-01-01,true`;

export default function AdminCollegeCoinsPage() {
  const router = useRouter();
  const [coins, setCoins] = useState<DemoCollegeCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    created: number;
    failed: number;
    errors: { row: number; ticker: string; error: string }[];
  } | null>(null);

  const fetchCoins = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getCollegeCoins();
      setCoins(response.coins);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch college coins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoins();
  }, [fetchCoins]);

  const handleDelete = (id: string, ticker: string) => {
    Modal.confirm({
      title: `Delete ${ticker}?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteCollegeCoin(id);
          message.success(`${ticker} deleted`);
          fetchCoins();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete');
        }
      },
    });
  };

  const handleToggleActive = async (id: string, ticker: string, isActive: boolean) => {
    try {
      await updateCollegeCoin(id, { isActive });
      message.success(`${ticker} is now ${isActive ? 'active' : 'inactive'}`);
      fetchCoins();
    } catch (error: any) {
      message.error(error.message || 'Failed to update');
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const response = await importCollegeCoins(file);
      setImportResult(response.results);
      if (response.results.created > 0) {
        message.success(response.message);
        fetchCoins();
      } else if (response.results.failed > 0) {
        message.warning('No coins were imported. Check the errors below.');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to import');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'college-coins-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatPrice = (price?: number) => {
    if (!price) return '-';
    if (price < 0.01) return `UGX ${price.toFixed(6)}`;
    if (price < 1) return `UGX ${price.toFixed(4)}`;
    return `UGX ${price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columns = [
    {
      title: '',
      dataIndex: 'iconUrl',
      key: 'iconUrl',
      width: 50,
      render: (url: string | null, record: DemoCollegeCoin) =>
        url ? (
          <Image
            src={resolveUploadUrl(url)}
            alt={record.ticker}
            width={28}
            height={28}
            style={{ borderRadius: 4 }}
            fallback="/images/default-token.png"
          />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: 4, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: '#999' }}>
            {record.ticker.substring(0, 2)}
          </div>
        ),
    },
    {
      title: 'Token',
      key: 'token',
      render: (_: any, record: DemoCollegeCoin) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.ticker}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: 'Pegged',
      key: 'pegged',
      width: 100,
      render: (_: any, record: DemoCollegeCoin) => (
        <Text>{record.peggedToAsset} @ {record.peggedPercentage}%</Text>
      ),
    },
    {
      title: 'Price',
      key: 'price',
      width: 120,
      render: (_: any, record: DemoCollegeCoin) => (
        <Text strong>{formatPrice(record.currentPrice)}</Text>
      ),
    },
    {
      title: 'Categories',
      dataIndex: 'categories',
      key: 'categories',
      render: (categories: string[]) =>
        categories.length > 0 ? (
          <Space size={4} wrap>
            {categories.slice(0, 2).map((cat) => (
              <Tag key={cat} style={{ fontSize: 11 }}>{cat}</Tag>
            ))}
            {categories.length > 2 && <Tag style={{ fontSize: 11 }}>+{categories.length - 2}</Tag>}
          </Space>
        ) : '-',
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 70,
      render: (isActive: boolean, record: DemoCollegeCoin) => (
        <Switch size="small" checked={isActive} onChange={(checked) => handleToggleActive(record.id, record.ticker, checked)} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, record: DemoCollegeCoin) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => router.push(`/admin/demo-college-coins/${record.id}`)} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id, record.ticker)} />
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout selectedKey="demo-college-coins">
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Demo college coins for <strong>Learner Mode</strong> – pegged to real crypto, for practice trading.
      </Text>

      <Space style={{ marginBottom: 16 }}>
        <Link href="/admin/demo-college-coins/new">
          <Button type="primary" icon={<PlusOutlined />}>Add Token</Button>
        </Link>
        <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>Import CSV</Button>
        <Button icon={<ReloadOutlined />} onClick={fetchCoins} loading={loading}>Refresh</Button>
      </Space>

      <Modal
        title="Import Demo Tokens from CSV"
        open={importModalVisible}
        onCancel={() => { setImportModalVisible(false); setImportResult(null); }}
        footer={[
          <Button key="template" icon={<DownloadOutlined />} onClick={downloadTemplate}>Download Template</Button>,
          <Button key="close" onClick={() => { setImportModalVisible(false); setImportResult(null); }}>Close</Button>,
        ]}
        width={550}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text type="secondary">
            Required: <strong>ticker, name, peggedToAsset, peggedPercentage</strong><br />
            Use <code>|</code> to separate multiple categories
          </Text>

          <Upload.Dragger
            accept=".csv"
            showUploadList={false}
            disabled={importing}
            beforeUpload={(file) => { handleImport(file); return false; }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}><ImportOutlined /></p>
            <p>Click or drag CSV file</p>
          </Upload.Dragger>

          {importing && <Alert type="info" message="Importing..." showIcon />}

          {importResult && (
            <Alert
              type={importResult.failed === 0 ? 'success' : importResult.created > 0 ? 'warning' : 'error'}
              message={`Imported ${importResult.created} of ${importResult.total} coins`}
              description={
                importResult.failed > 0 && (
                  <div style={{ maxHeight: 150, overflow: 'auto', marginTop: 8, fontSize: 12 }}>
                    {importResult.errors.map((err, i) => (
                      <div key={i}>Row {err.row} ({err.ticker}): {err.error}</div>
                    ))}
                  </div>
                )
              }
              showIcon
            />
          )}
        </Space>
      </Modal>

      <Table
        columns={columns}
        dataSource={coins}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={{ showSizeChanger: true, showTotal: (t) => `${t} tokens` }}
      />
    </AdminLayout>
  );
}
