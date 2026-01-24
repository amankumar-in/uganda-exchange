import React, { useEffect, useState } from 'react';
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

  const handleAdjust = async (values: { asset: string; amount: number; reason: string }) => {
    try {
      await adjustUserBalance(userId, {
        ...values,
        mode: adjustMode,
      });
      message.success(`Balance adjusted: ${values.amount > 0 ? '+' : ''}${values.amount} ${values.asset}`);
      setAdjustModalVisible(false);
      form.resetFields();
      fetchBalances();
    } catch (error: any) {
      message.error(error.message);
    }
  };

  const handleResetLearner = async () => {
    try {
      await resetLearnerAccount(userId);
      message.success('Learner account reset to $100,000');
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
          {record.asset === 'USD' ? `$${val.toFixed(2)}` : val.toFixed(8)}
        </Text>
      ),
    },
    {
      title: 'Available',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      render: (val: number, record: BalanceItem) => (
        <Text type="success">
          {record.asset === 'USD' ? `$${val.toFixed(2)}` : val.toFixed(8)}
        </Text>
      ),
    },
    {
      title: 'Locked',
      dataIndex: 'lockedBalance',
      key: 'lockedBalance',
      render: (val: number, record: BalanceItem) => (
        <Text type={val > 0 ? 'warning' : 'secondary'}>
          {record.asset === 'USD' ? `$${val.toFixed(2)}` : val.toFixed(8)}
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
                    description="Delete all learner trades and reset to $100,000?"
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
        }}
        footer={null}
      >
        <Form form={form} onFinish={handleAdjust} layout="vertical">
          <Form.Item
            name="asset"
            label="Asset"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="USD, BTC, ETH, etc." />
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
            label="Reason"
            rules={[{ required: true, message: 'Required' }]}
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
