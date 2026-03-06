
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Space, Tag, message, Avatar, Tooltip, Input, Radio, Drawer, Form, Switch, InputNumber, Divider, Alert, Checkbox } from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined,
  CloseCircleOutlined, SyncOutlined, SettingOutlined, ThunderboltOutlined,
  BankOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { TokensApi } from '../../../services/api/tokens';
import { Token, GlobalAssetSettings } from '../../../types/token';

type FilterType = 'all' | 'college' | 'mining' | 'active' | 'inactive';

export default function AssetManagerPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [pageSize, setPageSize] = useState(50);

  // Global Settings Drawer
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [settingsForm] = Form.useForm();

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    setLoading(true);
    try {
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

  // Filtered tokens
  const filteredTokens = useMemo(() => {
    let list = tokens;
    if (filter === 'college') list = list.filter(t => t.isCollegeCoin);
    if (filter === 'mining') list = list.filter(t => t.miningAllowed);
    if (filter === 'active') list = list.filter(t => t.isActive);
    if (filter === 'inactive') list = list.filter(t => !t.isActive);
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        (t.collegeName && t.collegeName.toLowerCase().includes(q))
      );
      // Sort: exact symbol match first, then symbol starts-with (shorter first), then symbol contains, then name-only matches, alphabetical tiebreaker
      list = [...list].sort((a, b) => {
        const aSymbol = a.symbol.toLowerCase();
        const bSymbol = b.symbol.toLowerCase();
        const aExact = aSymbol === q;
        const bExact = bSymbol === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStartsWith = aSymbol.startsWith(q);
        const bStartsWith = bSymbol.startsWith(q);
        if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
        if (aStartsWith && bStartsWith) {
          if (aSymbol.length !== bSymbol.length) return aSymbol.length - bSymbol.length;
        }
        const aSymbolMatch = aSymbol.includes(q);
        const bSymbolMatch = bSymbol.includes(q);
        if (aSymbolMatch !== bSymbolMatch) return aSymbolMatch ? -1 : 1;
        return aSymbol.localeCompare(bSymbol);
      });
    }
    return list;
  }, [tokens, filter, searchText]);

  // Bulk actions
  const handleBulkAction = useCallback(async (data: Partial<Token>) => {
    if (selectedRowKeys.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(selectedRowKeys.map(id => TokensApi.update(id as string, data)));
      message.success(`Updated ${selectedRowKeys.length} tokens`);
      setSelectedRowKeys([]);
      fetchTokens();
    } catch (error) {
      message.error('Some updates failed');
      fetchTokens();
    } finally {
      setBulkLoading(false);
    }
  }, [selectedRowKeys]);

  // Global settings
  const openSettings = async () => {
    setSettingsOpen(true);
    setSettingsLoading(true);
    setApplyToExisting(false);
    try {
      const settings = await TokensApi.getGlobalSettings();
      settingsForm.setFieldsValue(settings);
    } catch (error) {
      message.error('Failed to load global settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const values = await settingsForm.validateFields();
      const { id, createdAt, updatedAt, ...payload } = values;
      if (payload.defaultMinTransaction !== undefined) payload.defaultMinTransaction = Number(payload.defaultMinTransaction);
      if (payload.defaultMaxTransaction !== undefined) payload.defaultMaxTransaction = Number(payload.defaultMaxTransaction);
      if (payload.defaultMiningBaseRate !== undefined) payload.defaultMiningBaseRate = Number(payload.defaultMiningBaseRate);
      if (payload.defaultMiningSessionHours !== undefined) payload.defaultMiningSessionHours = Number(payload.defaultMiningSessionHours);
      setSettingsLoading(true);
      await TokensApi.updateGlobalSettings({ ...payload, applyToExisting });
      message.success(applyToExisting ? 'Global settings saved and applied to all existing tokens' : 'Global settings saved');
      setSettingsOpen(false);
      if (applyToExisting) fetchTokens();
    } catch (error) {
      message.error('Failed to save settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const columns = [
    {
      title: 'Asset',
      key: 'asset',
      sorter: (a: Token, b: Token) => a.name.localeCompare(b.name),
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
      title: 'Type',
      key: 'type',
      width: 100,
      filters: [
        { text: 'College', value: 'college' },
        { text: 'Native', value: 'native' },
        { text: 'Standard', value: 'standard' },
      ],
      onFilter: (value: any, record: Token) => {
        if (value === 'college') return record.isCollegeCoin;
        if (value === 'native') return record.isNative;
        return !record.isNative;
      },
      render: (_: any, record: Token) =>
        record.isCollegeCoin
          ? <Tag icon={<BankOutlined />} color="purple">College</Tag>
          : record.isNative
            ? <Tag color="blue">Native</Tag>
            : <Tag>Standard</Tag>,
    },
    {
      title: 'Price',
      key: 'price',
      width: 150,
      sorter: (a: Token, b: Token) => (a.currentPrice || a.manualPrice || 0) - (b.currentPrice || b.manualPrice || 0),
      render: (_: any, record: Token) => {
        const price = record.currentPrice || record.manualPrice || 0;
        return (
          <Space direction="vertical" size={0}>
            <span>${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
            {record.coingeckoId ? (
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>Auto (API)</Tag>
            ) : record.contractAddress ? (
              <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>Contract</Tag>
            ) : (
              <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>Manual</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Permissions',
      key: 'toggles',
      render: (_: any, record: Token) => (
        <Space wrap size={[4, 4]}>
          <Tooltip title="Buy"><Tag color={record.allowBuy ? 'green' : 'default'}>Buy</Tag></Tooltip>
          <Tooltip title="Sell"><Tag color={record.allowSell ? 'green' : 'default'}>Sell</Tag></Tooltip>
          <Tooltip title="P2P"><Tag color={record.allowP2P ? 'cyan' : 'default'}>P2P</Tag></Tooltip>
          <Tooltip title="Deposit"><Tag color={record.allowDeposit ? 'green' : 'default'}>Dep</Tag></Tooltip>
        </Space>
      ),
    },
    {
      title: 'Mining',
      key: 'mining',
      width: 100,
      sorter: (a: Token, b: Token) => Number(a.miningAllowed) - Number(b.miningAllowed),
      render: (_: any, record: Token) =>
        record.miningAllowed
          ? <Tag icon={<ThunderboltOutlined />} color="green">{record.miningBaseRate} t/h</Tag>
          : <Tag color="default">-</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 100,
      sorter: (a: Token, b: Token) => Number(a.isActive) - Number(b.isActive),
      render: (isActive: boolean) => (
        isActive
          ? <Tag icon={<CheckCircleOutlined />} color="success">Active</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="error">Inactive</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: Token) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => router.push(`/admin/assets/${record.id}`)} />
          <Button danger icon={<DeleteOutlined />} size="small" onClick={() => handleDelete(record.id, record.symbol)} />
        </Space>
      ),
    },
  ];

  const filterCounts = useMemo(() => ({
    all: tokens.length,
    college: tokens.filter(t => t.isCollegeCoin).length,
    mining: tokens.filter(t => t.miningAllowed).length,
    active: tokens.filter(t => t.isActive).length,
    inactive: tokens.filter(t => !t.isActive).length,
  }), [tokens]);

  return (
    <AdminLayout selectedKey="assets" title="Asset Manager" hideHeader={false}>
      <div style={{ padding: 24 }}>
        {/* Header bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Button icon={<SyncOutlined />} onClick={fetchTokens} loading={loading}>Refresh Prices</Button>
            <Button icon={<SettingOutlined />} onClick={openSettings}>Global Defaults</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/admin/assets/new')}>
            Add New Token
          </Button>
        </div>

        {/* Search + Filter row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by name or symbol..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            style={{ maxWidth: 300 }}
          />
          <Radio.Group value={filter} onChange={e => setFilter(e.target.value)} buttonStyle="solid" size="small">
            <Radio.Button value="all">All ({filterCounts.all})</Radio.Button>
            <Radio.Button value="college">College ({filterCounts.college})</Radio.Button>
            <Radio.Button value="mining">Mining ({filterCounts.mining})</Radio.Button>
            <Radio.Button value="active">Active ({filterCounts.active})</Radio.Button>
            <Radio.Button value="inactive">Inactive ({filterCounts.inactive})</Radio.Button>
          </Radio.Group>
        </div>

        {/* Bulk actions bar */}
        {selectedRowKeys.length > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <Space wrap>
                <span>{selectedRowKeys.length} selected</span>
                <Button size="small" loading={bulkLoading} onClick={() => handleBulkAction({ isActive: true })}>Activate</Button>
                <Button size="small" loading={bulkLoading} onClick={() => handleBulkAction({ isActive: false })}>Deactivate</Button>
                <Button size="small" loading={bulkLoading} onClick={() => handleBulkAction({ miningAllowed: true })}>Enable Mining</Button>
                <Button size="small" loading={bulkLoading} onClick={() => handleBulkAction({ miningAllowed: false })}>Disable Mining</Button>
                <Button size="small" type="link" onClick={() => setSelectedRowKeys([])}>Clear</Button>
              </Space>
            }
          />
        )}

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredTokens}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100', '200'],
            onShowSizeChange: (_current, size) => setPageSize(size),
            showTotal: (total) => `${total} tokens`,
          }}
          scroll={{ x: 900 }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
      </div>

      {/* Global Settings Drawer */}
      <Drawer
        title="Global Asset Defaults"
        placement="right"
        width={480}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        extra={
          <Button type="primary" onClick={saveSettings} loading={settingsLoading}>
            Save
          </Button>
        }
      >
        <Alert
          message="Default settings for new tokens"
          description="These defaults are applied when creating a new token. Individual token settings always override."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Form form={settingsForm} layout="vertical">
          <Divider titlePlacement="left">Permissions</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            <Form.Item name="defaultAllowBuy" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>Allow Buy</span>
            </Form.Item>
            <Form.Item name="defaultAllowSell" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>Allow Sell</span>
            </Form.Item>
            <Form.Item name="defaultAllowP2P" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>Allow P2P</span>
            </Form.Item>
            <Form.Item name="defaultAllowDeposit" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>Allow Deposit</span>
            </Form.Item>
            <Form.Item name="defaultAllowWithdraw" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>Allow Withdraw</span>
            </Form.Item>
          </div>

          <Divider titlePlacement="left">Trading Pairs</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            <Form.Item name="defaultAllowTradeUsd" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>USD Pair</span>
            </Form.Item>
            <Form.Item name="defaultAllowTradeUsdt" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>USDT Pair</span>
            </Form.Item>
            <Form.Item name="defaultAllowTradeEth" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>ETH Pair</span>
            </Form.Item>
            <Form.Item name="defaultAllowTradeTuit" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch /> <span style={{ marginLeft: 8 }}>TUIT Pair</span>
            </Form.Item>
          </div>

          <Divider titlePlacement="left">Transaction Limits</Divider>
          <Space size="large">
            <Form.Item name="defaultMinTransaction" label="Min (USD)">
              <InputNumber prefix="$" min={0} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="defaultMaxTransaction" label="Max (USD)">
              <InputNumber prefix="$" min={0} style={{ width: 150 }} />
            </Form.Item>
          </Space>

          <Divider titlePlacement="left">Mining Defaults</Divider>
          <Space size="large">
            <Form.Item name="defaultMiningBaseRate" label="Base Rate (tokens/hr)">
              <InputNumber min={0} step={0.01} precision={4} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="defaultMiningSessionHours" label="Session (hours)">
              <InputNumber min={1} max={720} precision={0} style={{ width: 150 }} />
            </Form.Item>
          </Space>

          <Divider />
          <Checkbox
            checked={applyToExisting}
            onChange={e => setApplyToExisting(e.target.checked)}
          >
            Also apply to all existing tokens
          </Checkbox>
          {applyToExisting && (
            <Alert
              message="Warning: This will overwrite individual token settings"
              description="All existing tokens will be reset to the default values configured above. Any per-token customizations will be lost."
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
            />
          )}
        </Form>
      </Drawer>
    </AdminLayout>
  );
}
