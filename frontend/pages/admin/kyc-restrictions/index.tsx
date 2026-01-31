import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Tag,
  Typography,
  Switch,
  Card,
  Form,
  Input,
  Select,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  StopOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';
import Link from 'next/link';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import {
  getAllowedCountries,
  createCountry,
  deleteCountry,
  toggleCountry,
  AllowedCountry,
  CreateCountryPayload,
} from '../../../services/api/kyc-restrictions';
import { getCountryOptions, getCountryByCode } from '../../../data/countries';

const { Text, Title } = Typography;
const { useToken } = theme;

export default function AdminKycRestrictionsPage() {
  const { token } = useToken();
  const [countries, setCountries] = useState<AllowedCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form] = Form.useForm();

  const fetchCountries = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAllowedCountries();
      if (response.success && response.countries) {
        setCountries(response.countries);
      } else {
        message.error(response.error || 'Failed to fetch countries');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch countries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

  const handleDelete = (countryCode: string, countryName: string) => {
    Modal.confirm({
      title: `Delete ${countryName}?`,
      content: 'This will remove the country and all its states from the allowed list. This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await deleteCountry(countryCode);
          if (result.success) {
            message.success(`${countryName} removed`);
            fetchCountries();
          } else {
            message.error(result.error || 'Failed to delete');
          }
        } catch (error: any) {
          message.error(error.message || 'Failed to delete');
        }
      },
    });
  };

  const handleToggleActive = async (countryCode: string, countryName: string, isActive: boolean) => {
    try {
      const result = await toggleCountry(countryCode, isActive);
      if (result.success) {
        message.success(`${countryName} is now ${isActive ? 'enabled' : 'disabled'}`);
        fetchCountries();
      } else {
        message.error(result.error || 'Failed to update');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to update');
    }
  };

  const handleAddCountry = async (values: CreateCountryPayload) => {
    setAdding(true);
    try {
      const result = await createCountry(values);
      if (result.success) {
        message.success(`${values.countryName} added successfully`);
        setAddModalVisible(false);
        form.resetFields();
        fetchCountries();
      } else {
        message.error(result.error || 'Failed to add country');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to add country');
    } finally {
      setAdding(false);
    }
  };

  const activeCountries = countries.filter((c) => c.isActive).length;
  const totalStates = countries.reduce((acc, c) => acc + c.allowedStates.length, 0);
  const activeStates = countries.reduce(
    (acc, c) => acc + c.allowedStates.filter((s) => s.isActive).length,
    0
  );

  const columns = [
    {
      title: 'Country',
      key: 'country',
      render: (_: any, record: AllowedCountry) => (
        <Space>
          <GlobalOutlined />
          <Link href={`/admin/kyc-restrictions/${record.countryCode}`}>
            <Text strong style={{ cursor: 'pointer' }}>
              {record.countryName}
            </Text>
          </Link>
          <Tag>{record.countryCode}</Tag>
        </Space>
      ),
    },
    {
      title: 'Allowed States',
      key: 'states',
      render: (_: any, record: AllowedCountry) => {
        if (record.allowAllStates) {
          return <Tag color="green">All</Tag>;
        }
        const active = record.allowedStates.filter((s) => s.isActive).length;
        if (active === 0 && record.allowedStates.length === 0) {
          return <Tag>All (none configured)</Tag>;
        }
        return <Tag color="blue">{active} state{active !== 1 ? 's' : ''}</Tag>;
      },
    },
    {
      title: 'Restrictions',
      key: 'status',
      render: (_: any, record: AllowedCountry) => (
        <Space>
          <Switch
            checked={record.isActive}
            onChange={(checked) => handleToggleActive(record.countryCode, record.countryName, checked)}
          />
          <Text type="secondary">{record.isActive ? 'Enforced' : 'Disabled'}</Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AllowedCountry) => (
        <Space>
          <Link href={`/admin/kyc-restrictions/${record.countryCode}`}>
            <Button size="small">Manage States</Button>
          </Link>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.countryCode, record.countryName)}
          />
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout title="KYC Restrictions" subtitle="Manage geographic restrictions for KYC verification" selectedKey="kyc-restrictions">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Stats */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Countries Configured"
                value={countries.length}
                suffix={`(${activeCountries} active)`}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="States Configured"
                value={totalStates}
                suffix={`(${activeStates} active)`}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Countries with Restrictions"
                value={countries.length}
                suffix="configured"
              />
            </Card>
          </Col>
        </Row>

        {/* Info Banner */}
        <Card size="small">
          <Text type="secondary">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            Countries not listed here are unrestricted. Add a country to control which states are allowed.
            Toggle "Restrictions" OFF to temporarily disable restrictions for a country.
          </Text>
        </Card>

        {/* Actions */}
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
            Add Country
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchCountries} loading={loading}>
            Refresh
          </Button>
        </Space>

        {/* Table */}
        <Table
          dataSource={countries}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'No countries configured. All locations are allowed.' }}
        />

        {/* Add Country Modal */}
        <Modal
          title="Add Country"
          open={addModalVisible}
          onCancel={() => {
            setAddModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddCountry}>
            <Form.Item
              name="countryCode"
              label="Country"
              rules={[{ required: true, message: 'Please select a country' }]}
            >
              <Select
                showSearch
                placeholder="Select a country"
                filterOption={(input, option) =>
                  (option?.searchValue as string)?.toLowerCase().includes(input.toLowerCase())
                }
                onChange={(value) => {
                  const country = getCountryByCode(value);
                  if (country) {
                    form.setFieldValue('countryName', country.name);
                  }
                }}
                options={getCountryOptions()}
              />
            </Form.Item>

            <Form.Item name="countryName" hidden>
              <Input />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={adding}>
                  Add
                </Button>
                <Button onClick={() => setAddModalVisible(false)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </AdminLayout>
  );
}
