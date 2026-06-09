import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Tag,
  Typography,
  Tabs,
  Empty,
  Popconfirm,
  AutoComplete,
} from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import {
  getUserBalances,
  adjustUserBalance,
  resetLearnerAccount,
  UserBalances as UserBalancesType,
  BalanceItem,
} from '../../../services/api/admin';
import { TokensApi } from '../../../services/api/tokens';
import { Token } from '../../../types/token';

const { Text } = Typography;

interface UserBalancesProps {
  userId: string;
}

export const UserBalances: React.FC<UserBalancesProps> = ({ userId }) => {
  const [balances, setBalances] = useState<UserBalancesType | null>(null);
  const [loading, setLoading] = useState(true);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [adjustMode, setAdjustMode] = useState<'live' | 'learner'>('live');
  const [form] = Form.useForm();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [assetSearch, setAssetSearch] = useState('');

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const response = await getUserBalances(userId);
      setBalances(response.balances);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [userId]);

  useEffect(() => {
    TokensApi.getAll().then(setTokens).catch(() => {});
  }, []);

  // Build autocomplete options sorted by relevance: exact match > starts-with > contains
  const assetOptions = useMemo(() => {
    // Always include USD as a base option
    const allSymbols = ['UGX', ...tokens.map(t => t.symbol)];
    const unique = [...new Set(allSymbols)];
    if (!assetSearch) {
      return unique.map(s => {
        const token = tokens.find(t => t.symbol === s);
        return {
          value: s,
          label: (
            <span>
              <strong>{s}</strong>
              {token ? <span style={{ color: '#888', marginLeft: 8 }}>{token.name}</span> : null}
            </span>
          ),
        };
      });
    }
    const q = assetSearch.toUpperCase();
    const filtered = unique.filter(s =>
      s.toUpperCase().includes(q) ||
      tokens.find(t => t.symbol === s && t.name.toUpperCase().includes(q))
    );
    filtered.sort((a, b) => {
      const aU = a.toUpperCase();
      const bU = b.toUpperCase();
      const aExact = aU === q;
      const bExact = bU === q;
      if (aExact !== bExact) return aExact ? -1 : 1;
      const aStarts = aU.startsWith(q);
      const bStarts = bU.startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      if (aStarts && bStarts) {
        if (aU.length !== bU.length) return aU.length - bU.length;
      }
      const aSymbolMatch = aU.includes(q);
      const bSymbolMatch = bU.includes(q);
      if (aSymbolMatch !== bSymbolMatch) return aSymbolMatch ? -1 : 1;
      return aU.localeCompare(bU);
    });
    return filtered.map(s => {
      const token = tokens.find(t => t.symbol === s);
      return {
        value: s,
        label: (
          <span>
            <strong>{s}</strong>
            {token ? <span style={{ color: '#888', marginLeft: 8 }}>{token.name}</span> : null}
          </span>
        ),
      };
    });
  }, [tokens, assetSearch]);

  const knownAssets = useMemo(() => {
    const set = new Set(['UGX', ...tokens.map(t => t.symbol.toUpperCase())]);
    return set;
  }, [tokens]);

  const handleAdjust = async (values: { asset: string; amount: number; reason?: string }) => {
    const assetUpper = values.asset.toUpperCase();

    if (!knownAssets.has(assetUpper)) {
      Modal.confirm({
        title: 'Asset not found',
        content: `"${values.asset}" does not exist as a registered asset. Do you want to create a balance for this asset anyway?`,
        okText: 'Yes, proceed',
        cancelText: 'Cancel',
        onOk: async () => {
          try {
            await adjustUserBalance(userId, {
              ...values,
              asset: assetUpper,
              mode: adjustMode,
            });
            message.success(`Balance adjusted: ${values.amount > 0 ? '+' : ''}${values.amount} ${assetUpper}`);
            setAdjustModalVisible(false);
            form.resetFields();
            setAssetSearch('');
            fetchBalances();
          } catch (error: any) {
            message.error(error.message);
          }
        },
      });
      return;
    }

    try {
      await adjustUserBalance(userId, {
        ...values,
        asset: assetUpper,
        mode: adjustMode,
      });
      message.success(`Balance adjusted: ${values.amount > 0 ? '+' : ''}${values.amount} ${assetUpper}`);
      setAdjustModalVisible(false);
      form.resetFields();
      setAssetSearch('');
      fetchBalances();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleResetLearner = async () => {
    try {
      await resetLearnerAccount(userId);
      message.success('Learner account reset to UGX 1,00,000');
      fetchBalances();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const columns = [
    {
      title: 'Asset',
      dataIndex: 'asset',
      key: 'asset',
      render: (asset: string) => <Tag>{asset}</Tag>,
    },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      render: (val: number, record: BalanceItem) => (
        <Text strong>
          {record.asset === 'UGX' ? `UGX ${val.toFixed(2)}` : val.toFixed(8)}
        </Text>
      ),
    },
    {
      title: 'Available',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      render: (val: number, record: BalanceItem) => (
        <Text type="success">
          {record.asset === 'UGX' ? `UGX ${val.toFixed(2)}` : val.toFixed(8)}
        </Text>
      ),
    },
    {
      title: 'Locked',
      dataIndex: 'lockedBalance',
      key: 'lockedBalance',
      render: (val: number, record: BalanceItem) => (
        <Text type={val > 0 ? 'warning' : 'secondary'}>
          {record.asset === 'UGX' ? `UGX ${val.toFixed(2)}` : val.toFixed(8)}
        </Text>
      ),
    },
  ];

  const openAdjustModal = (mode: 'live' | 'learner') => {
    setAdjustMode(mode);
    setAdjustModalVisible(true);
  };

  // Combine learner fiat + crypto for display
  const learnerBalances: BalanceItem[] = [];
  if (balances?.learner.fiat) {
    learnerBalances.push(balances.learner.fiat);
  }
  learnerBalances.push(...(balances?.learner.crypto || []));

  return (
    <div>
      <Tabs
        destroyInactiveTabPane
        items={[
          {
            key: 'live',
            label: 'Live Balances',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button icon={<ReloadOutlined />} onClick={fetchBalances} loading={loading}>
                    Refresh
                  </Button>
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    onClick={() => openAdjustModal('live')}
                  >
                    Adjust Balance
                  </Button>
                </Space>
                {balances?.live && balances.live.length > 0 ? (
                  <Table
                    columns={columns}
                    dataSource={balances.live}
                    rowKey="asset"
                    loading={loading}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="No live balances" />
                )}
              </div>
            ),
          },
          {
            key: 'learner',
            label: 'Learner Balances',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button icon={<ReloadOutlined />} onClick={fetchBalances} loading={loading}>
                    Refresh
                  </Button>
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    onClick={() => openAdjustModal('learner')}
                  >
                    Adjust Balance
                  </Button>
                  <Popconfirm
                    title="Reset Learner Account"
                    description="Delete all learner trades and reset to UGX 1,00,000?"
                    onConfirm={handleResetLearner}
                    okText="Reset"
                    cancelText="Cancel"
                  >
                    <Button danger>
                      Reset Account
                    </Button>
                  </Popconfirm>
                </Space>
                {learnerBalances.length > 0 ? (
                  <Table
                    columns={columns}
                    dataSource={learnerBalances}
                    rowKey="asset"
                    loading={loading}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="No learner balances" />
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={`Adjust ${adjustMode === 'live' ? 'Live' : 'Learner'} Balance`}
        open={adjustModalVisible}
        onCancel={() => {
          setAdjustModalVisible(false);
          form.resetFields();
          setAssetSearch('');
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleAdjust} layout="vertical">
          <Form.Item
            name="asset"
            label="Asset"
            rules={[{ required: true, message: 'Required' }]}
          >
            <AutoComplete
              options={assetOptions}
              onSearch={setAssetSearch}
              placeholder="Type to search: UGX, BTC, ETH..."
              filterOption={false}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: 'Required' }]}
            extra="Positive to add, negative to subtract"
          >
            <InputNumber style={{ width: '100%' }} placeholder="100 or -50" step={0.01} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason (optional)"
          >
            <Input.TextArea placeholder="Reason for adjustment" rows={2} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">Apply</Button>
            <Button onClick={() => setAdjustModalVisible(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};
