import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  theme,
  Grid,
  Typography,
  Card,
  Tabs,
  Form,
  Input,
  Button,
  Steps,
  Alert,
  Descriptions,
  Tag,
  Space,
  Divider,
  message,
  Spin,
} from 'antd';
import {
  WalletOutlined,
  MailOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  SendOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import {
  TuitTransferApi,
  VestingData,
  UserTransfer,
  UserConversionRequest,
} from '@/services/api/tuit-transfer';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Title, Text, Paragraph } = Typography;

const TuitTransferPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const { mode } = useThemeMode();
  const { user, isLoading } = useAuth();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('flow1');

  const isMobile = mounted ? !screens.md : false;
  const isDark = mode === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=/tuit-transfer');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Link TUIT Wallet | Intuition Exchange</title>
      </Head>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 400px',
            gap: token.marginLG,
            alignItems: 'start',
          }}
        >
          {/* Form Column - Shows first on mobile */}
          <div style={{ order: isMobile ? 1 : 2 }}>
            <Card
              style={{
                position: isMobile ? 'relative' : 'sticky',
                top: isMobile ? 0 : 24,
                background: token.colorBgContainer,
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                destroyInactiveTabPane
                items={[
                  {
                    key: 'flow1',
                    label: (
                      <span>
                        <LinkOutlined /> Transfer Allocation
                      </span>
                    ),
                    children: <Flow1Form userEmail={user.email} />,
                  },
                  {
                    key: 'flow2',
                    label: (
                      <span>
                        <SendOutlined /> Convert Tokens
                      </span>
                    ),
                    children: <Flow2Form />,
                  },
                ]}
              />
            </Card>
          </div>

          {/* Guide Column */}
          <div style={{ order: isMobile ? 2 : 1 }}>
            <GuideSection activeTab={activeTab} isDark={isDark} token={token} />
          </div>
        </div>
      </motion.div>
    </>
  );
};

TuitTransferPage.getLayout = (page) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default TuitTransferPage;

// ============================================
// Guide Section
// ============================================

interface GuideSectionProps {
  activeTab: string;
  isDark: boolean;
  token: any;
}

function GuideSection({ activeTab, isDark, token }: GuideSectionProps) {
  return (
    <div>
      <Title level={3} style={{ marginBottom: token.marginMD }}>
        Transfer/Convert Your TUIT Balance
      </Title>

      <Paragraph style={{ fontSize: 16, color: token.colorTextSecondary, marginBottom: token.marginLG }}>
        Transfer your TUIT token allocation to your Intuition Exchange account. Choose the option that applies to you.
      </Paragraph>

      {activeTab === 'flow1' ? (
        <Flow1Guide isDark={isDark} token={token} />
      ) : (
        <Flow2Guide isDark={isDark} token={token} />
      )}

      {/* Help Section */}
      <Card
        style={{
          marginTop: token.marginLG,
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Title level={5} style={{ marginBottom: token.marginSM }}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          Need Help?
        </Title>
        <Paragraph style={{ marginBottom: 8, color: token.colorTextSecondary }}>
          If you&apos;re having trouble or your information doesn&apos;t match our records:
        </Paragraph>
        <ul style={{ paddingLeft: 20, margin: 0, color: token.colorTextSecondary }}>
          <li>Contact your investment manager</li>
          <li>
            Email <a href="mailto:help@intuitionexchange.com">help@intuitionexchange.com</a> with your Name, Email, and Wallet Address
          </li>
        </ul>
      </Card>
    </div>
  );
}

function Flow1Guide({ token }: { isDark: boolean; token: any }) {
  return (
    <>
      <Title level={5}>Transfer from Vesting Contract</Title>
      <Paragraph style={{ color: token.colorTextSecondary }}>
        For tokens still in the vesting contract. We&apos;ll check your available balance and credit it to your account.
      </Paragraph>
      <ul style={{ paddingLeft: 20, color: token.colorTextSecondary, marginBottom: token.marginMD }}>
        <li>Enter the email and wallet from your TUIT allocation</li>
        <li>Verify with a code sent to your email</li>
        <li>Your available balance gets credited instantly</li>
      </ul>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Note: Use the email from your allocation, not your account email. One transfer per wallet.
      </Text>
    </>
  );
}

function Flow2Guide({ token }: { isDark: boolean; token: any }) {
  return (
    <>
      <Title level={5}>Convert Already Withdrawn Tokens</Title>
      <Paragraph style={{ color: token.colorTextSecondary }}>
        For tokens you&apos;ve already withdrawn from the vesting contract to your personal wallet.
      </Paragraph>
      <ul style={{ paddingLeft: 20, color: token.colorTextSecondary, marginBottom: token.marginMD }}>
        <li>Transfer TUIT tokens to our deposit wallet</li>
        <li>Submit the transaction hash</li>
        <li>We verify and credit your account (1-2 business days)</li>
      </ul>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Note: Only send TUIT tokens. One conversion per user.
      </Text>
    </>
  );
}

// ============================================
// Flow 1 Form
// ============================================

interface Flow1FormProps {
  userEmail: string;
}

function Flow1Form({ userEmail }: Flow1FormProps) {
  const { token } = useToken();
  const [form] = Form.useForm();
  const [step, setStep] = useState<'input' | 'verify' | 'review' | 'success'>('input');
  const [loading, setLoading] = useState(false);
  const [investorName, setInvestorName] = useState('');
  const [vestingData, setVestingData] = useState<VestingData | null>(null);
  const [authorizedWalletId, setAuthorizedWalletId] = useState('');
  const [transferHistory, setTransferHistory] = useState<UserTransfer[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyWallet, setVerifyWallet] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await TuitTransferApi.getUserTransfers();
      setTransferHistory(history);
      if (history.length > 0) {
        setStep('success');
      }
    } catch (error) {
      // Ignore error, just show form
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInitiate = async (values: { email: string; walletAddress: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await TuitTransferApi.initiateTransfer(values.email, values.walletAddress);
      setInvestorName(result.name);
      setVerifyEmail(values.email);
      setVerifyWallet(values.walletAddress);
      setStep('verify');
      message.success('Verification code sent to your email');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to initiate transfer');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (values: { code: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await TuitTransferApi.verifyAndGetVesting(verifyEmail, verifyWallet, values.code);
      setVestingData(result.vestingData);
      setAuthorizedWalletId(result.authorizedWalletId);
      setInvestorName(result.name);
      setStep('review');
    } catch (error: any) {
      setErrorMessage(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await TuitTransferApi.confirmTransfer(authorizedWalletId, verifyEmail);
      message.success('Transfer completed successfully!');
      loadHistory();
      setStep('success');
    } catch (error: any) {
      setErrorMessage(error.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: string) => {
    return parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  if (historyLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  // Show history if already transferred
  if (step === 'success' && transferHistory.length > 0) {
    return (
      <div>
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Transfer Complete"
          description="Your TUIT allocation has been successfully transferred to your account."
          style={{ marginBottom: token.marginMD }}
        />

        <Title level={5}>Transfer History</Title>
        {transferHistory.map((transfer) => (
          <Card key={transfer.id} size="small" style={{ marginBottom: token.marginSM }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Investor">{transfer.name}</Descriptions.Item>
              <Descriptions.Item label="Wallet">
                <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {transfer.walletAddress.slice(0, 10)}...{transfer.walletAddress.slice(-6)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Amount Credited">
                <Text strong style={{ color: token.colorSuccess }}>
                  {formatNumber(transfer.amountCredited)} TUIT
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(transfer.createdAt).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        ))}

        <Divider />
        <Text type="secondary">
          Want to transfer from another wallet?
        </Text>
        <Button
          type="link"
          onClick={() => {
            setStep('input');
            form.resetFields();
          }}
        >
          Start New Transfer
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Steps
        size="small"
        responsive={false}
        current={step === 'input' ? 0 : step === 'verify' ? 1 : step === 'review' ? 2 : 3}
        items={[
          { title: 'Enter Info' },
          { title: 'Verify' },
          { title: 'Review' },
        ]}
        style={{ marginBottom: token.marginLG }}
      />

      {step === 'input' && (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleInitiate}
          initialValues={{ email: userEmail }}
        >
          {errorMessage && (
            <Alert
              type="error"
              showIcon
              message="Transfer Failed"
              description={errorMessage}
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: token.marginMD }}
            />
          )}

          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: token.marginMD }}>
            Enter the email and wallet from your TUIT allocation. It may be different from your account email.
          </Text>

          <Form.Item
            name="email"
            label="Allocation Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Invalid email address' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="email@example.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="walletAddress"
            label="Wallet Address"
            rules={[
              { required: true, message: 'Wallet address is required' },
              { pattern: /^0x[a-fA-F0-9]{40}$/, message: 'Invalid Ethereum address' },
            ]}
          >
            <Input
              prefix={<WalletOutlined />}
              placeholder="0x..."
              size="large"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block size="large">
            Send Verification Code <ArrowRightOutlined />
          </Button>
        </Form>
      )}

      {step === 'verify' && (
        <Form layout="vertical" onFinish={handleVerify}>
          {errorMessage && (
            <Alert
              type="error"
              showIcon
              message="Verification Failed"
              description={errorMessage}
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: token.marginMD }}
            />
          )}

          <Alert
            type="success"
            showIcon
            message={`Hello, ${investorName}!`}
            description="We've sent a verification code to your email. Please enter it below."
            style={{ marginBottom: token.marginMD }}
          />

          <Form.Item
            name="code"
            label="Verification Code"
            rules={[
              { required: true, message: 'Code is required' },
              { len: 6, message: 'Code must be 6 digits' },
            ]}
          >
            <Input
              prefix={<SafetyOutlined />}
              placeholder="000000"
              size="large"
              maxLength={6}
            />
          </Form.Item>

          <Space style={{ width: '100%' }} direction="vertical">
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              Verify <ArrowRightOutlined />
            </Button>
            <Button type="text" onClick={() => setStep('input')} block>
              Back
            </Button>
          </Space>
        </Form>
      )}

      {step === 'review' && vestingData && (
        <div>
          {errorMessage && (
            <Alert
              type="error"
              showIcon
              message="Transfer Failed"
              description={errorMessage}
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: token.marginMD }}
            />
          )}

          <Alert
            type="success"
            showIcon
            message="Verification Successful"
            description={`Account verified for ${investorName}`}
            style={{ marginBottom: token.marginMD }}
          />

          <Card
            title="Your TUIT Allocation"
            size="small"
            style={{ marginBottom: token.marginMD }}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Total Allocated">
                {formatNumber(vestingData.totalAllocated)} TUIT
              </Descriptions.Item>
              <Descriptions.Item label="Unlocked">
                {formatNumber(vestingData.unlocked)} TUIT
              </Descriptions.Item>
              <Descriptions.Item label="Already Withdrawn">
                {formatNumber(vestingData.withdrawn)} TUIT
              </Descriptions.Item>
              <Descriptions.Item label="Available to Transfer">
                <Text strong style={{ color: token.colorSuccess, fontSize: 18 }}>
                  {formatNumber(vestingData.availableToWithdraw)} TUIT
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {parseFloat(vestingData.availableToWithdraw) > 0 ? (
            <Space style={{ width: '100%' }} direction="vertical">
              <Button
                type="primary"
                onClick={handleConfirm}
                loading={loading}
                block
                size="large"
              >
                <CheckCircleOutlined /> Confirm Transfer
              </Button>
              <Button type="text" onClick={() => setStep('input')} block>
                Cancel
              </Button>
            </Space>
          ) : (
            <Alert
              type="warning"
              showIcon
              message="No Tokens Available"
              description="All your allocated tokens have already been withdrawn. If you have tokens in your personal wallet, use the 'Convert Tokens' option instead."
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Flow 2 Form
// ============================================

function Flow2Form() {
  const { token } = useToken();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [conversionHistory, setConversionHistory] = useState<UserConversionRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [hasApproved, setHasApproved] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await TuitTransferApi.getUserConversions();
      setConversionHistory(history);
      setHasApproved(history.some((h) => h.status === 'APPROVED'));
    } catch (error) {
      // Ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (values: { txHash: string }) => {
    setLoading(true);
    try {
      await TuitTransferApi.submitConversion(values.txHash);
      message.success('Conversion request submitted! We will review it shortly.');
      form.resetFields();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || 'Failed to submit conversion request');
    } finally {
      setLoading(false);
    }
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

  const formatNumber = (value: string | null) => {
    if (!value) return '-';
    return parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  if (historyLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  // Show history if user has any requests
  if (conversionHistory.length > 0) {
    return (
      <div>
        {hasApproved && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="Conversion Complete"
            description="Your token conversion has been approved and credited to your account."
            style={{ marginBottom: token.marginMD }}
          />
        )}

        <Title level={5}>Conversion History</Title>
        {conversionHistory.map((request) => (
          <Card key={request.id} size="small" style={{ marginBottom: token.marginSM }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Tag color={getStatusColor(request.status)}>{request.status}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(request.createdAt).toLocaleDateString()}
              </Text>
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Transaction">
                <a
                  href={`https://etherscan.io/tx/${request.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                >
                  {request.txHash.slice(0, 10)}...{request.txHash.slice(-6)}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="Amount">
                {formatNumber(request.amount)} TUIT
              </Descriptions.Item>
              {request.reviewNotes && (
                <Descriptions.Item label="Notes">{request.reviewNotes}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        ))}

        {!hasApproved && !conversionHistory.some((h) => h.status === 'PENDING') && (
          <>
            <Divider />
            <Text type="secondary">
              Previous request was rejected?
            </Text>
            <Button type="link" onClick={() => setConversionHistory([])}>
              Submit New Request
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Text type="secondary" style={{ display: 'block', marginBottom: token.marginMD }}>
        For tokens you&apos;ve already withdrawn from the vesting contract to your personal wallet.
      </Text>

      <div style={{ marginBottom: token.marginMD }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Step 1: Transfer your TUIT tokens
        </Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Deposit Wallet Address:
        </Text>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: token.colorBgTextHover,
            padding: '10px 12px',
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        >
          <Text ellipsis style={{ flex: 1 }}>
            0x111A17090a3a4aF810Df2e8694c06205AFDb14A2
          </Text>
          <Button size="small" icon={<CopyOutlined />} onClick={() => {
            navigator.clipboard.writeText('0x111A17090a3a4aF810Df2e8694c06205AFDb14A2');
            message.success('Address copied');
          }} />
        </div>
      </div>

      <div style={{ marginBottom: token.marginMD }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Step 2: Submit the transaction hash
        </Text>
        <Form.Item
          name="txHash"
          style={{ marginBottom: 8 }}
          rules={[
            { required: true, message: 'Transaction hash is required' },
            { pattern: /^0x[a-fA-F0-9]{64}$/, message: 'Invalid transaction hash' },
          ]}
        >
          <Input
            prefix={<SendOutlined />}
            placeholder="0x..."
            size="large"
          />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Find this on{' '}
          <a href="https://etherscan.io" target="_blank" rel="noopener noreferrer">
            Etherscan
          </a>{' '}
          after your transfer confirms.
        </Text>
      </div>

      <Button type="primary" htmlType="submit" loading={loading} block size="large">
        Submit for Review
      </Button>
    </Form>
  );
}
