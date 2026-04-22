import React, { useState } from 'react';
import {
  Descriptions,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Typography,
  Empty,
  Divider,
  Alert,
  Image,
  theme,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { FullAdminUser, updateKycStatus } from '../../../services/api/admin';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { useToken } = theme;

interface UserKycProps {
  user: FullAdminUser;
  onRefresh: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  SUBMITTED: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <ClockCircleOutlined />,
  SUBMITTED: <ExclamationCircleOutlined />,
  APPROVED: <CheckCircleOutlined />,
  REJECTED: <CloseCircleOutlined />,
};

import { getBackendRootUrl } from '@/services/api/config';

// Photos come back from backend as `/api/uploads/kyc/<file>` — prepend the backend root.
function resolveMediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${getBackendRootUrl()}${path}`;
}

function formatDate(d: string | null | undefined): string {
  return d ? new Date(d).toLocaleString() : '—';
}

function formatBool(b: boolean | null | undefined): React.ReactNode {
  if (b === true) return <Tag color="green">Yes</Tag>;
  if (b === false) return <Tag color="red">No</Tag>;
  return <Text type="secondary">—</Text>;
}

export const UserKyc: React.FC<UserKycProps> = ({ user, onRefresh }) => {
  const { token } = useToken();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [form] = Form.useForm();

  const handleStatusChange = async (values: { reviewNotes?: string }) => {
    if (!pendingStatus) return;
    setLoading(true);
    try {
      await updateKycStatus(user.id, {
        status: pendingStatus,
        reviewNotes: values.reviewNotes,
      });
      message.success(`KYC status updated to ${pendingStatus}`);
      setModalVisible(false);
      form.resetFields();
      setPendingStatus(null);
      onRefresh();
    } catch (error) {
      const err = error as { message?: string };
      message.error(err.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const openStatusModal = (status: 'APPROVED' | 'REJECTED') => {
    setPendingStatus(status);
    setModalVisible(true);
  };

  if (!user.kyc) {
    return <Empty description="No KYC record — user hasn't started verification" />;
  }

  const kyc = user.kyc;
  const aadhaarPhotoUrl = resolveMediaUrl(kyc.aadhaarPhotoUrl);
  const selfieUrl = resolveMediaUrl(kyc.selfieUrl);
  const nameMatch = kyc.aadhaarName && kyc.panName
    ? kyc.aadhaarName.trim().toLowerCase() === kyc.panName.trim().toLowerCase()
    : null;

  return (
    <div>
      {/* Status Banner */}
      <Space align="center" size="middle" style={{ marginBottom: token.marginMD }}>
        <Title level={5} style={{ margin: 0 }}>KYC Status:</Title>
        <Tag color={STATUS_COLORS[kyc.status]} icon={STATUS_ICONS[kyc.status]} style={{ fontSize: 14 }}>
          {kyc.status}
        </Tag>
        <Text type="secondary">Step {kyc.currentStep} / 6</Text>
        {kyc.autoDecidedAt && <Text type="secondary">· auto-decided {formatDate(kyc.autoDecidedAt)}</Text>}
      </Space>

      {kyc.status === 'SUBMITTED' && (
        <Alert
          message="Awaiting Review"
          type="info"
          showIcon
          style={{ marginBottom: token.marginMD }}
          action={
            <Space>
              <Button type="primary" size="small" onClick={() => openStatusModal('APPROVED')}>Approve</Button>
              <Button danger size="small" onClick={() => openStatusModal('REJECTED')}>Reject</Button>
            </Space>
          }
        />
      )}

      {kyc.status === 'APPROVED' && (
        <Alert message="KYC Approved" type="success" showIcon style={{ marginBottom: token.marginMD }} />
      )}

      {kyc.status === 'REJECTED' && (
        <Alert
          message="KYC Rejected"
          description={kyc.rejectionReason || kyc.reviewNotes || 'No reason recorded'}
          type="error"
          showIcon
          style={{ marginBottom: token.marginMD }}
          action={<Button size="small" onClick={() => openStatusModal('APPROVED')}>Override Approve</Button>}
        />
      )}

      {/* Photos */}
      {(aadhaarPhotoUrl || selfieUrl) && (
        <>
          <Divider titlePlacement="start">Photos</Divider>
          <Space size="large" wrap>
            {aadhaarPhotoUrl && (
              <div style={{ textAlign: 'center' }}>
                <Image width={140} height={140} src={aadhaarPhotoUrl} alt="Aadhaar photo" style={{ objectFit: 'cover', borderRadius: token.borderRadius }} />
                <div style={{ marginTop: token.marginXS, fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                  From Aadhaar (UIDAI)
                </div>
              </div>
            )}
            {selfieUrl && (
              <div style={{ textAlign: 'center' }}>
                <Image width={140} height={140} src={selfieUrl} alt="Selfie" style={{ objectFit: 'cover', borderRadius: token.borderRadius }} />
                <div style={{ marginTop: token.marginXS, fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
                  User selfie
                </div>
              </div>
            )}
          </Space>
        </>
      )}

      {/* PAN */}
      <Divider titlePlacement="start">PAN</Divider>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="PAN">
          {kyc.pan ? <Text copyable>{kyc.pan}</Text> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          {kyc.panStatus ? <Tag color={kyc.panStatus.toLowerCase().includes('valid') ? 'green' : 'orange'}>{kyc.panStatus}</Tag> : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Name (as per PAN)" span={2}>{kyc.panName || '—'}</Descriptions.Item>
        <Descriptions.Item label="DOB">{kyc.panDob ? new Date(kyc.panDob).toLocaleDateString() : '—'}</Descriptions.Item>
        <Descriptions.Item label="Verified At">{formatDate(kyc.panVerifiedAt)}</Descriptions.Item>
        <Descriptions.Item label="Name Match">{formatBool(kyc.panNameMatch)}</Descriptions.Item>
        <Descriptions.Item label="DOB Match">{formatBool(kyc.panDobMatch)}</Descriptions.Item>
        <Descriptions.Item label="Aadhaar Seeded" span={2}>{kyc.panAadhaarSeeding || '—'}</Descriptions.Item>
      </Descriptions>

      {/* Aadhaar */}
      <Divider titlePlacement="start">Aadhaar</Divider>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="Aadhaar (last 4)">
          {kyc.aadhaarLast4 ? `XXXX XXXX ${kyc.aadhaarLast4}` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Verified At">{formatDate(kyc.aadhaarVerifiedAt)}</Descriptions.Item>
        <Descriptions.Item label="Name (as per Aadhaar)" span={2}>{kyc.aadhaarName || '—'}</Descriptions.Item>
        <Descriptions.Item label="DOB">
          {kyc.aadhaarDob ? new Date(kyc.aadhaarDob).toLocaleDateString() : kyc.aadhaarYob || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Gender">{kyc.aadhaarGender || '—'}</Descriptions.Item>
        <Descriptions.Item label="Care Of" span={2}>{kyc.aadhaarCareOf || '—'}</Descriptions.Item>
      </Descriptions>

      {/* Cross-checks */}
      <Divider titlePlacement="start">Cross-Checks</Divider>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="PAN ↔ Aadhaar Linked">{formatBool(kyc.panAadhaarLinked)}</Descriptions.Item>
        <Descriptions.Item label="PAN name = Aadhaar name">{formatBool(nameMatch)}</Descriptions.Item>
      </Descriptions>

      {/* Address */}
      <Divider titlePlacement="start">Address</Divider>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="House / Street" span={2}>{kyc.street1 || '—'}</Descriptions.Item>
        <Descriptions.Item label="Flat / Landmark" span={2}>{kyc.street2 || '—'}</Descriptions.Item>
        <Descriptions.Item label="City">{kyc.city || '—'}</Descriptions.Item>
        <Descriptions.Item label="State">{kyc.region || '—'}</Descriptions.Item>
        <Descriptions.Item label="PIN">{kyc.postalCode || '—'}</Descriptions.Item>
        <Descriptions.Item label="Country">{kyc.country || '—'}</Descriptions.Item>
      </Descriptions>

      {(kyc.reviewedAt || kyc.reviewNotes) && (
        <>
          <Divider titlePlacement="start">Review History</Divider>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Reviewed By">{kyc.reviewedBy || '—'}</Descriptions.Item>
            <Descriptions.Item label="Reviewed At">{formatDate(kyc.reviewedAt)}</Descriptions.Item>
            <Descriptions.Item label="Notes">{kyc.reviewNotes || '—'}</Descriptions.Item>
          </Descriptions>
        </>
      )}

      {/* Manual Override */}
      <Divider titlePlacement="start">Manual Override</Divider>
      <Space>
        <Select
          placeholder="Change Status"
          style={{ width: 160 }}
          onChange={(val) => openStatusModal(val as 'APPROVED' | 'REJECTED')}
          options={[
            { value: 'APPROVED', label: 'Approve' },
            { value: 'REJECTED', label: 'Reject' },
          ]}
        />
        <Text type="secondary">Manually override KYC decision</Text>
      </Space>

      <Modal
        title={`${pendingStatus === 'APPROVED' ? 'Approve' : 'Reject'} KYC`}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); form.resetFields(); setPendingStatus(null); }}
        footer={null}
      >
        <Form form={form} onFinish={handleStatusChange} layout="vertical">
          <Form.Item
            name="reviewNotes"
            label={pendingStatus === 'REJECTED' ? 'Rejection Reason' : 'Notes (optional)'}
            rules={pendingStatus === 'REJECTED' ? [{ required: true, message: 'Required' }] : []}
          >
            <TextArea rows={3} placeholder={pendingStatus === 'REJECTED' ? 'Reason shown to user...' : 'Internal notes...'} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} danger={pendingStatus === 'REJECTED'}>
              {pendingStatus === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
            <Button onClick={() => setModalVisible(false)}>Cancel</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};
