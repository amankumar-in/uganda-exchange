
import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, message, Avatar, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { TokensApi } from '../../../services/api/tokens';
import { Token } from '../../../types/token';

export default function AssetManagerPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      // Fetch with prices = true
      const data = await TokensApi.getAll(true);
      setTokens(data);
    } catch (error) {
      message.error('Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, symbol: string) => {
    if (!confirm(`Are you sure you want to delete ${symbol}?`)) return;
    try {
      await TokensApi.delete(id);
      message.success('Token deleted');
      fetchTokens();
    } catch (error) {
      message.error('Failed to delete token');
    }
  };

  const columns = [
    {
      title: 'Asset',
      key: 'asset',
      render: (_: any, record: Token) => (
        <Space>
          <Avatar src={record.iconUrl} shape="square" size="small">{record.symbol[0]}</Avatar>
          <Space direction="vertical" size={0}>
             <span style={{ fontWeight: 600 }}>{record.name}</span>
             <span style={{ fontSize: 12, color: '#888' }}>{record.symbol}</span>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Current Price',
      key: 'price',
      width: 150,
      render: (_: any, record: Token) => {
        const price = record.currentPrice || record.manualPrice || 0;
        return (
          <Space direction="vertical" size={0}>
            <span>${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            {record.coingeckoId ? (
                <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>Auto (API)</Tag>
            ): record.contractAddress ? (
                <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>Contract</Tag>
            ) : (
                <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>Manual</Tag>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Toggles',
      key: 'toggles',
      render: (_: any, record: Token) => (
         <Space wrap size={[4, 4]}>
            <Tooltip title="Buy">
                <Tag color={record.allowBuy ? 'green' : 'default'}>Buy</Tag>
            </Tooltip>
            {/* Minimal display of most critical toggles */}
            <Tooltip title="Sell">
                <Tag color={record.allowSell ? 'green' : 'default'}>Sell</Tag>
            </Tooltip>
            <Tooltip title="P2P">
                <Tag color={record.allowP2P ? 'cyan' : 'default'}>P2P</Tag>
            </Tooltip>
             <Tooltip title="Deposit">
                <Tag color={record.allowDeposit ? 'green' : 'default'}>Dep</Tag>
            </Tooltip>
         </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        isActive ? <Tag icon={<CheckCircleOutlined />} color="success">Active</Tag>
                 : <Tag icon={<CloseCircleOutlined />} color="error">Inactive</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: Token) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => router.push(`/admin/assets/${record.id}`)}
          />
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            size="small"
            onClick={() => handleDelete(record.id, record.symbol)}
          />
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout selectedKey="assets" title="Asset Manager" hideHeader={false}>
      <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <Space>
                <Button icon={<SyncOutlined />} onClick={fetchTokens} loading={loading}>
                    Refresh Prices
                </Button>
            </Space>
            <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => router.push('/admin/assets/new')}
            >
                Add New Token
            </Button>
          </div>

          <Table 
            columns={columns} 
            dataSource={tokens} 
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 50 }}
            scroll={{ x: 800 }}
          />
      </div>
    </AdminLayout>
  );
}
