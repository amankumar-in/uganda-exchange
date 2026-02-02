'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, Button, message, theme, Typography, Select, Space, Empty, Divider, Tag, Alert } from 'antd';
import { BankOutlined, ArrowRightOutlined, PlusOutlined, CheckCircleOutlined, ExperimentOutlined } from '@ant-design/icons';
import { createWithdrawal, getBankAccounts, type BankAccount } from '@/services/api/fiat';
import { fontWeights } from '@/theme/themeConfig';
import { useExchange } from '@/context/ExchangeContext';
import { motion, AnimatePresence } from 'motion/react';

const { useToken } = theme;
const { Text } = Typography;

interface WithdrawModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableBalance: number;
}

export default function WithdrawModal({ visible, onClose, onSuccess, availableBalance }: WithdrawModalProps) {
  const [form] = Form.useForm();
  const { token } = useToken();
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [simulationSuccess, setSimulationSuccess] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { appMode } = useExchange();
  const isLearnerMode = appMode === 'learner';

  // Load bank accounts when modal opens
  useEffect(() => {
    if (visible) {
      loadBankAccounts();
      setSimulationSuccess(false);
      setWithdrawAmount(null);
      setErrorMessage(null);
    } else {
      form.resetFields();
    }
  }, [visible]);

  const loadBankAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const accounts = await getBankAccounts();
      setBankAccounts(accounts);
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
        form.setFieldsValue({ bankAccountId: accounts[0].id });
      }
    } catch (error: any) {
      message.error('Failed to load bank accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };


  const handleSubmit = async (values: { amount: number; bankAccountId: string }) => {
    if (!isLearnerMode && !values.bankAccountId) {
      message.error('Please select a bank account');
      return;
    }

    setLoading(true);
    try {
      if (isLearnerMode) {
        // Learner mode - simulate withdrawal
        await new Promise(resolve => setTimeout(resolve, 800));
        setWithdrawAmount(values.amount);
        setSimulationSuccess(true);
      } else {
        // Real mode
        await createWithdrawal(values.bankAccountId, values.amount);
        message.success('Withdrawal request submitted successfully');
        onSuccess();
        onClose();
        form.resetFields();
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulationComplete = () => {
    setSimulationSuccess(false);
    setWithdrawAmount(null);
    form.resetFields();
    onSuccess();
    onClose();
  };


  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      title={
        <Space>
          {isLearnerMode ? <ExperimentOutlined style={{ color: '#F59E0B' }} /> : <BankOutlined />}
          <span>{isLearnerMode ? 'Simulate Withdrawal' : 'Withdraw Funds'}</span>
          {isLearnerMode && <Tag color="orange">Learner Mode</Tag>}
        </Space>
      }
      width={420}
      zIndex={1100}
      styles={{
        body: {
          padding: token.paddingLG,
        },
      }}
    >
      <AnimatePresence mode="wait">
        {simulationSuccess && withdrawAmount ? (
          <motion.div
            key="simulation-success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: 'center', padding: token.paddingMD }}
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                type: 'spring',
                stiffness: 200,
                damping: 15,
                delay: 0.2,
              }}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: token.marginLG,
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
              }}
            >
              <ExperimentOutlined
                style={{
                  fontSize: 40,
                  color: '#fff',
                }}
              />
            </motion.div>

            {/* Learner Mode Badge */}
            <Tag color="orange" style={{ marginBottom: token.marginMD, fontSize: token.fontSize }}>
              <ExperimentOutlined /> Learner Mode Simulation
            </Tag>

            {/* Success Title */}
            <Typography.Title
              level={3}
              style={{
                marginBottom: token.marginSM,
                fontWeight: fontWeights.bold,
                color: token.colorText,
              }}
            >
              Simulated Withdrawal Complete!
            </Typography.Title>

            {/* Amount */}
            <Text
              style={{
                fontSize: token.fontSizeHeading4,
                color: '#F59E0B',
                fontWeight: fontWeights.semibold,
                display: 'block',
                marginBottom: token.marginMD,
              }}
            >
              -${withdrawAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>

            {/* Explanation */}
            <div
              style={{
                padding: token.paddingMD,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderRadius: token.borderRadius,
                border: '1px solid rgba(245, 158, 11, 0.3)',
                marginBottom: token.marginLG,
              }}
            >
              <Text
                style={{
                  fontSize: token.fontSize,
                  color: token.colorTextSecondary,
                  display: 'block',
                }}
              >
                This is a <strong>simulated withdrawal</strong> for practice purposes.
                <br />
                No real money was transferred. Your virtual balance remains unchanged.
              </Text>
            </div>

            {/* Close Button */}
            <Button
              type="primary"
              size="large"
              onClick={handleSimulationComplete}
              style={{
                height: token.controlHeightLG,
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.semibold,
                paddingLeft: token.paddingXL,
                paddingRight: token.paddingXL,
                backgroundColor: '#F59E0B',
                borderColor: '#F59E0B',
              }}
            >
              Got it!
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Learner Mode Banner */}
            {isLearnerMode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: token.marginXS,
                  padding: token.paddingSM,
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: token.borderRadius,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: token.marginMD,
                }}
              >
                <ExperimentOutlined style={{ color: '#F59E0B' }} />
                <Text style={{ fontSize: token.fontSizeSM, color: '#D97706' }}>
                  Learner Mode - This withdrawal will be simulated
                </Text>
              </div>
            )}

            {/* Error Alert */}
            {errorMessage && (
              <Alert
                type="error"
                showIcon
                message="Withdrawal Failed"
                description={errorMessage}
                closable
                onClose={() => setErrorMessage(null)}
                style={{ marginBottom: token.marginMD }}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ amount: undefined }}
            >
              {/* Available Balance */}
              <div style={{
                padding: token.paddingMD,
                backgroundColor: token.colorBgLayout,
                borderRadius: token.borderRadius,
                marginBottom: token.marginLG,
              }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Available Balance {isLearnerMode && '(Virtual)'}</Text>
                <div style={{ fontSize: token.fontSizeHeading3, fontWeight: fontWeights.bold, color: token.colorText }}>
                  ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Bank Account Selection - Only show for investor mode */}
              {!isLearnerMode && (
                <Form.Item
                  label="Bank Account"
                  name="bankAccountId"
                  rules={[{ required: true, message: 'Please select a bank account' }]}
                >
                  {loadingAccounts ? (
                    <div style={{ textAlign: 'center', padding: token.paddingLG }}>
                      <Text type="secondary">Loading bank accounts...</Text>
                    </div>
                  ) : bankAccounts.length === 0 ? (
                    <Empty
                      description="No bank accounts added"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    >
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          onClose();
                          window.location.href = '/portfolio/bank-accounts/add';
                        }}
                      >
                        Add Bank Account
                      </Button>
                    </Empty>
                  ) : (
                    <Select
                      placeholder="Select a bank account"
                      value={selectedAccountId || undefined}
                      onChange={(value) => {
                        setSelectedAccountId(value);
                        form.setFieldsValue({ bankAccountId: value });
                      }}
                      dropdownRender={(menu) => (
                        <>
                          {menu}
                          <Divider style={{ margin: '8px 0' }} />
                          <Button
                            type="text"
                            icon={<PlusOutlined />}
                            block
                            onClick={() => {
                              onClose();
                              window.location.href = '/portfolio/bank-accounts/add';
                            }}
                            style={{ textAlign: 'left' }}
                          >
                            Add New Bank Account
                          </Button>
                        </>
                      )}
                    >
                      {bankAccounts.map((account) => (
                        <Select.Option key={account.id} value={account.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: fontWeights.medium }}>
                                {account.accountName}
                              </div>
                              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                                •••• {account.last4} {account.isVerified && <CheckCircleOutlined style={{ color: token.colorSuccess }} />}
                              </Text>
                            </div>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                  )}
                </Form.Item>
              )}

              {/* For learner mode, show a placeholder bank info */}
              {isLearnerMode && (
                <div style={{
                  padding: token.paddingMD,
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  borderRadius: token.borderRadius,
                  border: '1px dashed rgba(245, 158, 11, 0.3)',
                  marginBottom: token.marginMD,
                }}>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: 4 }}>
                    Destination
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                    <BankOutlined style={{ color: '#F59E0B' }} />
                    <Text style={{ fontWeight: fontWeights.medium }}>Simulated Bank Account</Text>
                  </div>
                </div>
              )}

              {/* Amount */}
              <Form.Item
                label="Amount"
                name="amount"
                rules={[
                  { required: true, message: 'Please enter an amount' },
                  { type: 'number', min: 10, message: 'Minimum withdrawal is $10' },
                  { type: 'number', max: availableBalance, message: 'Amount exceeds available balance' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0.00"
                  min={10}
                  max={availableBalance}
                  precision={2}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as unknown as number}
                />
              </Form.Item>

              {/* Info */}
              <div style={{
                padding: token.paddingMD,
                backgroundColor: isLearnerMode ? 'rgba(245, 158, 11, 0.1)' : token.colorInfoBg,
                borderRadius: token.borderRadius,
                marginBottom: token.marginLG,
              }}>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {isLearnerMode ? (
                    <>
                      <ExperimentOutlined /> In Learner Mode, withdrawals are simulated. No real money will be transferred.
                    </>
                  ) : (
                    <>
                      <BankOutlined /> Withdrawals typically take 2-3 business days to process. Instant payouts are available for verified accounts (additional fee applies).
                    </>
                  )}
                </Text>
              </div>

              {/* Submit */}
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading}
                  icon={isLearnerMode ? <ExperimentOutlined /> : <ArrowRightOutlined />}
                  disabled={!isLearnerMode && bankAccounts.length === 0}
                  style={isLearnerMode ? {
                    backgroundColor: '#F59E0B',
                    borderColor: '#F59E0B',
                  } : undefined}
                >
                  {isLearnerMode ? 'Simulate Withdrawal' : 'Request Withdrawal'}
                </Button>
              </Form.Item>
            </Form>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

