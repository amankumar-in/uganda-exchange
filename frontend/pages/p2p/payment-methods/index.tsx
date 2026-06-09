import React, { useState, useEffect, ReactElement } from 'react';
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
  Form,
  Input,
  Select,
  Switch,
  message,
  Empty,
  Spin,
  Popconfirm,
  Grid,
  Drawer,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../../_app';
import {
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  type PaymentMethod,
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
  getPaymentMethodFields,
} from '@/services/api/p2p';
import Link from 'next/link';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Text, Title } = Typography;

const PAYMENT_TYPES: PaymentMethodType[] = [
  'BANK_TRANSFER',
  'MOBILE_MONEY',
  'PAYPAL',
  'VENMO',
  'ZELLE',
  'CASH_APP',
  'WISE',
  'REVOLUT',
  'OTHER',
];

const PaymentMethodsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const screens = useBreakpoint();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const [mounted, setMounted] = useState(false);

  // State
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();
  const selectedType = Form.useWatch('type', form);

  const isMobile = mounted ? !screens.md : false;

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const result = await getPaymentMethods();
      setMethods(result);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleOpenModal = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      form.setFieldsValue({
        type: method.type,
        name: method.name,
        ...method.details,
      });
    } else {
      setEditingMethod(null);
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingMethod(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const { type, name, ...detailValues } = values;
      const details: Record<string, string> = {};
      
      // Only include fields relevant to the type
      const fields = getPaymentMethodFields(type);
      fields.forEach(field => {
        if (detailValues[field.key]) {
          details[field.key] = detailValues[field.key];
        }
      });

      if (editingMethod) {
        await updatePaymentMethod(editingMethod.id, { name, details });
        message.success('Payment method updated');
      } else {
        await createPaymentMethod({ type, name, details });
        message.success('Payment method created');
      }

      handleCloseModal();
      fetchMethods();
    } catch (err: unknown) {
      if ((err as { errorFields?: unknown }).errorFields) return; // Form validation error
      const error = err as Error;
      message.error(error.message || 'Failed to save payment method');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePaymentMethod(id);
      message.success('Payment method deleted');
      setMethods(methods.filter(m => m.id !== id));
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to delete payment method');
    }
  };

  const handleToggleActive = async (method: PaymentMethod) => {
    try {
      await updatePaymentMethod(method.id, { isActive: !method.isActive });
      setMethods(methods.map(m => 
        m.id === method.id ? { ...m, isActive: !m.isActive } : m
      ));
      message.success(`Payment method ${method.isActive ? 'disabled' : 'enabled'}`);
    } catch (err: unknown) {
      const error = err as Error;
      message.error(error.message || 'Failed to update payment method');
    }
  };

  const getIcon = (type: PaymentMethodType) => {
    switch (type) {
      case 'BANK_TRANSFER':
        return <BankOutlined />;
      default:
        return <CreditCardOutlined />;
    }
  };

  const renderMethodCard = (method: PaymentMethod) => (
    <Card
      key={method.id}
      size="small"
      style={{
        marginBottom: token.marginSM,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : token.colorBorderSecondary}`,
        opacity: method.isActive ? 1 : 0.6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: token.borderRadius,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            {getIcon(method.type)}
          </div>
          <div>
            <Text strong>{method.name}</Text>
            <br />
            <Tag style={{ margin: 0, marginTop: 4 }}>
              {PAYMENT_METHOD_LABELS[method.type]}
            </Tag>
          </div>
        </Space>
        <Space>
          <Switch
            size="small"
            checked={method.isActive}
            onChange={() => handleToggleActive(method)}
          />
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(method)}
          />
          <Popconfirm
            title="Delete this payment method?"
            onConfirm={() => handleDelete(method.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      </div>

      {/* Details Preview */}
      <div style={{ marginTop: token.marginSM, paddingLeft: 52 }}>
        {Object.entries(method.details).slice(0, 2).map(([key, value]) => (
          <div key={key}>
            <Text type="secondary" style={{ fontSize: 11 }}>{key}: </Text>
            <Text style={{ fontSize: 12 }}>{value}</Text>
          </div>
        ))}
      </div>
    </Card>
  );

  // Modal or Drawer based on screen size
  const FormContent = (
    <Form form={form} layout="vertical" requiredMark={false}>
      <Form.Item
        name="type"
        label="Payment Type"
        rules={[{ required: true, message: 'Select a payment type' }]}
      >
        <Select
          placeholder="Select payment type"
          disabled={!!editingMethod}
          options={PAYMENT_TYPES.map(t => ({
            label: PAYMENT_METHOD_LABELS[t],
            value: t,
          }))}
        />
      </Form.Item>

      <Form.Item
        name="name"
        label="Name"
        rules={[{ required: true, message: 'Enter a name for this method' }]}
      >
        <Input placeholder="e.g., My Main Bank Account" />
      </Form.Item>

      {selectedType && getPaymentMethodFields(selectedType).map(field => (
        <Form.Item
          key={field.key}
          name={field.key}
          label={field.label}
          rules={field.required ? [{ required: true, message: `${field.label} is required` }] : undefined}
        >
          {field.key === 'instructions' ? (
            <Input.TextArea rows={3} placeholder={`Enter ${field.label.toLowerCase()}`} />
          ) : (
            <Input placeholder={`Enter ${field.label.toLowerCase()}`} />
          )}
        </Form.Item>
      ))}
    </Form>
  );

  return (
    <>
      <Head>
        <title>Payment Methods | P2P | UG Coin</title>
      </Head>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: token.marginLG,
        }}>
          <div>
            <Link href="/p2p">
              <Button type="text" icon={<ArrowLeftOutlined />} style={{ padding: 0, marginBottom: token.marginXS }}>
                Back to Marketplace
              </Button>
            </Link>
            <Title level={4} style={{ margin: 0 }}>Payment Methods</Title>
            <Text type="secondary">Add payment methods to use in your P2P ads</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Add
          </Button>
        </div>

        {/* Method List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: token.paddingXL }}>
            <Spin size="large" />
          </div>
        ) : methods.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No payment methods added yet"
          >
            <Button type="primary" onClick={() => handleOpenModal()}>
              Add Payment Method
            </Button>
          </Empty>
        ) : (
          <div>{methods.map(renderMethodCard)}</div>
        )}
      </div>

      {/* Modal/Drawer */}
      {isMobile ? (
        <Drawer
          title={editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
          placement="bottom"
          height="80vh"
          open={modalOpen}
          onClose={handleCloseModal}
          styles={{
            wrapper: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            },
          }}
          footer={
            <Space style={{ width: '100%' }}>
              <Button block onClick={handleCloseModal}>Cancel</Button>
              <Button block type="primary" loading={submitting} onClick={handleSubmit}>
                {editingMethod ? 'Update' : 'Create'}
              </Button>
            </Space>
          }
        >
          {FormContent}
        </Drawer>
      ) : (
        <Modal
          title={editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
          open={modalOpen}
          onCancel={handleCloseModal}
          onOk={handleSubmit}
          okText={editingMethod ? 'Update' : 'Create'}
          confirmLoading={submitting}
        >
          {FormContent}
        </Modal>
      )}
    </>
  );
};

PaymentMethodsPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default PaymentMethodsPage;


