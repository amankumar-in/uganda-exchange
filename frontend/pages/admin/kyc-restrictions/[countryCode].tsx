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
  Checkbox,
  Breadcrumb,
  Row,
  Col,
  Statistic,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { State, IState } from 'country-state-city';
import {
  getCountryWithStates,
  updateCountry,
  addStates,
  toggleState,
  deleteState,
  bulkToggleStates,
  AllowedCountry,
  AllowedState,
  CreateStatePayload,
} from '../../../services/api/kyc-restrictions';

const { Text, Title } = Typography;

interface ReferenceState {
  code: string;
  name: string;
}

export default function AdminCountryStatesPage() {
  const router = useRouter();
  const { countryCode } = router.query;

  const [country, setCountry] = useState<AllowedCountry | null>(null);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [form] = Form.useForm();

  // Get all states for this country from country-state-city library
  const referenceStates: ReferenceState[] = React.useMemo(() => {
    if (!countryCode || typeof countryCode !== 'string') return [];
    const states = State.getStatesOfCountry(countryCode.toUpperCase());
    return states.map((state: IState) => ({
      code: state.isoCode,
      name: state.name,
    }));
  }, [countryCode]);

  const fetchCountry = useCallback(async () => {
    if (!countryCode || typeof countryCode !== 'string') return;

    setLoading(true);
    try {
      const response = await getCountryWithStates(countryCode);
      if (response.success && response.country) {
        setCountry(response.country);
      } else {
        message.error(response.error || 'Failed to fetch country');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch country');
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => {
    fetchCountry();
  }, [fetchCountry]);

  const handleToggleAllowAllStates = async (allowAllStates: boolean) => {
    if (!countryCode || typeof countryCode !== 'string') return;

    try {
      const result = await updateCountry(countryCode, { allowAllStates });
      if (result.success) {
        message.success(`All states ${allowAllStates ? 'allowed' : 'restricted to configured list'}`);
        fetchCountry();
      } else {
        message.error(result.error || 'Failed to update');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to update');
    }
  };

  const handleToggleState = async (stateId: string, stateName: string, isActive: boolean) => {
    try {
      const result = await toggleState(stateId, isActive);
      if (result.success) {
        message.success(`${stateName} is now ${isActive ? 'enabled' : 'disabled'}`);
        fetchCountry();
      } else {
        message.error(result.error || 'Failed to update');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to update');
    }
  };

  const handleDeleteState = (stateId: string, stateName: string) => {
    Modal.confirm({
      title: `Delete ${stateName}?`,
      content: 'This will remove the state from the allowed list.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const result = await deleteState(stateId);
          if (result.success) {
            message.success(`${stateName} removed`);
            fetchCountry();
          } else {
            message.error(result.error || 'Failed to delete');
          }
        } catch (error: any) {
          message.error(error.message || 'Failed to delete');
        }
      },
    });
  };

  const handleAddStates = async () => {
    if (!countryCode || typeof countryCode !== 'string') return;
    if (selectedStates.length === 0) {
      message.warning('Please select at least one state');
      return;
    }

    setAdding(true);
    try {
      // Map selected state codes to CreateStatePayload
      const states: CreateStatePayload[] = selectedStates.map((code) => {
        const ref = referenceStates.find((r) => r.code === code);
        return {
          stateCode: code,
          stateName: ref?.name || code,
          isActive: true,
        };
      });

      const result = await addStates(countryCode, states);
      if (result.success) {
        message.success(`${states.length} state(s) added`);
        setAddModalVisible(false);
        setSelectedStates([]);
        fetchCountry();
      } else {
        message.error(result.error || 'Failed to add states');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to add states');
    } finally {
      setAdding(false);
    }
  };

  const handleAddCustomState = async (values: { stateCode: string; stateName: string }) => {
    if (!countryCode || typeof countryCode !== 'string') return;

    setAdding(true);
    try {
      const result = await addStates(countryCode, [
        { stateCode: values.stateCode, stateName: values.stateName, isActive: true },
      ]);
      if (result.success) {
        message.success(`${values.stateName} added`);
        form.resetFields();
        fetchCountry();
      } else {
        message.error(result.error || 'Failed to add state');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to add state');
    } finally {
      setAdding(false);
    }
  };

  const handleBulkToggle = async (isActive: boolean) => {
    if (!countryCode || typeof countryCode !== 'string') return;
    if (selectedRowKeys.length === 0) {
      message.warning('Please select states first');
      return;
    }

    try {
      // Get state codes from selected IDs
      const stateCodes = country?.allowedStates
        .filter((s) => selectedRowKeys.includes(s.id))
        .map((s) => s.stateCode) || [];

      const result = await bulkToggleStates(countryCode, stateCodes, isActive);
      if (result.success) {
        message.success(`${stateCodes.length} state(s) ${isActive ? 'enabled' : 'disabled'}`);
        setSelectedRowKeys([]);
        fetchCountry();
      } else {
        message.error(result.error || 'Failed to update');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to update');
    }
  };

  // Filter out already added states from reference list
  const availableReferenceStates = referenceStates.filter(
    (ref) => !country?.allowedStates.some((s) => s.stateCode === ref.code)
  );

  const activeStates = country?.allowedStates.filter((s) => s.isActive).length || 0;
  const totalStates = country?.allowedStates.length || 0;

  const columns = [
    {
      title: 'State/Region',
      key: 'state',
      render: (_: any, record: AllowedState) => (
        <Space>
          <Text strong>{record.stateName}</Text>
          <Tag>{record.stateCode}</Tag>
        </Space>
      ),
    },
    {
      title: 'Allowed',
      key: 'status',
      render: (_: any, record: AllowedState) => (
        <Space>
          <Switch
            checked={record.isActive}
            onChange={(checked) => handleToggleState(record.id, record.stateName, checked)}
            disabled={country?.allowAllStates}
          />
          <Text type="secondary">
            {country?.allowAllStates ? 'All allowed' : record.isActive ? 'Yes' : 'No'}
          </Text>
        </Space>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: AllowedState) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteState(record.id, record.stateName)}
        />
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  };

  if (!country && !loading) {
    return (
      <AdminLayout title="Country Not Found" selectedKey="kyc-restrictions">
        <Card>
          <Text>Country not found. <Link href="/admin/kyc-restrictions">Go back</Link></Text>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={country?.countryName || 'Loading...'}
      subtitle={`Manage allowed states/regions for ${country?.countryCode || ''}`}
      selectedKey="kyc-restrictions"
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Breadcrumb */}
        <Breadcrumb>
          <Breadcrumb.Item>
            <Link href="/admin/kyc-restrictions">KYC Restrictions</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>{country?.countryName}</Breadcrumb.Item>
        </Breadcrumb>

        {/* Back Button */}
        <Link href="/admin/kyc-restrictions">
          <Button icon={<ArrowLeftOutlined />}>Back to Countries</Button>
        </Link>

        {/* Stats */}
        <Row gutter={16}>
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
                title="Allow All States"
                value={country?.allowAllStates ? 'Yes' : 'No'}
                valueStyle={{ color: country?.allowAllStates ? '#52c41a' : '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Country Status"
                value={country?.isActive ? 'Active' : 'Inactive'}
                valueStyle={{ color: country?.isActive ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Settings */}
        <Card title="How it works" size="small">
          <Space direction="vertical" size="middle">
            <div>
              <Space>
                <Switch
                  checked={country?.allowAllStates}
                  onChange={handleToggleAllowAllStates}
                  loading={loading}
                />
                <Text strong>Allow all states</Text>
              </Space>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {country?.allowAllStates
                  ? 'All states in this country are allowed. The list below is ignored.'
                  : 'Only states in the list below (with toggle ON) are allowed.'}
              </Text>
            </div>
          </Space>
        </Card>

        {/* Actions */}
        <Space>
          {referenceStates.length > 0 && availableReferenceStates.length > 0 && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              Add from List ({availableReferenceStates.length} available)
            </Button>
          )}
          <Button icon={<PlusOutlined />} onClick={() => setBulkModalVisible(true)}>
            Add Custom State
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchCountry} loading={loading}>
            Refresh
          </Button>
          {selectedRowKeys.length > 0 && (
            <>
              <Button onClick={() => handleBulkToggle(true)}>
                Enable Selected ({selectedRowKeys.length})
              </Button>
              <Button danger onClick={() => handleBulkToggle(false)}>
                Disable Selected ({selectedRowKeys.length})
              </Button>
            </>
          )}
        </Space>

        {/* Table */}
        <Table
          dataSource={country?.allowedStates || []}
          columns={columns}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={false}
          locale={{ emptyText: 'No states configured. Add states to restrict by region.' }}
        />

        {/* Add from Reference Modal */}
        <Modal
          title="Add States from Reference List"
          open={addModalVisible}
          onCancel={() => {
            setAddModalVisible(false);
            setSelectedStates([]);
          }}
          onOk={handleAddStates}
          okText={`Add ${selectedStates.length} State(s)`}
          okButtonProps={{ disabled: selectedStates.length === 0, loading: adding }}
          width={600}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">
              Select states to add to the allowed list. Already configured states are not shown.
            </Text>
            <Divider />
            <Space>
              <Button
                size="small"
                onClick={() => setSelectedStates(availableReferenceStates.map((s) => s.code))}
              >
                Select All
              </Button>
              <Button size="small" onClick={() => setSelectedStates([])}>
                Clear
              </Button>
            </Space>
            <Checkbox.Group
              value={selectedStates}
              onChange={(values) => setSelectedStates(values as string[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[8, 8]}>
                {availableReferenceStates.map((state) => (
                  <Col span={12} key={state.code}>
                    <Checkbox value={state.code}>
                      {state.name} ({state.code})
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </Space>
        </Modal>

        {/* Add Custom State Modal */}
        <Modal
          title="Add Custom State"
          open={bulkModalVisible}
          onCancel={() => {
            setBulkModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddCustomState}>
            <Form.Item
              name="stateCode"
              label="State Code"
              rules={[
                { required: true, message: 'Please enter state code' },
                { max: 10, message: 'Code must be 10 characters or less' },
              ]}
            >
              <Input placeholder="e.g., CA, NY, TX" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item
              name="stateName"
              label="State Name"
              rules={[{ required: true, message: 'Please enter state name' }]}
            >
              <Input placeholder="e.g., California, New York, Texas" />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={adding}>
                  Add State
                </Button>
                <Button onClick={() => setBulkModalVisible(false)}>Cancel</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </AdminLayout>
  );
}
