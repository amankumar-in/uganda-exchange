import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  DatePicker,
  Upload,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Image,
  Divider,
  Modal,
  message,
  Spin,
  Radio,
  Pagination,
  Empty,
} from 'antd';
import {
  UploadOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  LinkOutlined,
  FolderOpenOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { DemoCollegeCoin, ReferenceToken, listMedia, MediaFile } from '../../services/api/admin';
import { resolveUploadUrl } from '../../services/api/demo-college-coins';

const { TextArea } = Input;
const { Text } = Typography;

type IconSourceType = 'upload' | 'url' | 'media';

import { getBackendRootUrl } from '@/services/api/config';
const API_BASE = getBackendRootUrl();

function getFullMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${API_BASE}${url}`;
  return url;
}

interface CollegeCoinFormProps {
  initialData?: DemoCollegeCoin;
  referenceTokens: ReferenceToken[];
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
  isEdit?: boolean;
}

export const CollegeCoinForm: React.FC<CollegeCoinFormProps> = ({
  initialData,
  referenceTokens,
  onSubmit,
  loading = false,
  isEdit = false,
}) => {
  const router = useRouter();
  const [form] = Form.useForm();
  
  // Icon state
  const [iconSource, setIconSource] = useState<IconSourceType>('upload');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconUrl, setIconUrl] = useState<string>('');
  const [iconPreview, setIconPreview] = useState<string | null>(
    initialData?.iconUrl ? resolveUploadUrl(initialData.iconUrl) : null
  );
  
  // Media library modal state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaPage, setMediaPage] = useState(1);
  const MEDIA_PAGE_SIZE = 24; // 6 columns x 4 rows

  const fetchMediaFiles = useCallback(async () => {
    setMediaLoading(true);
    try {
      const response = await listMedia();
      if (response.success) {
        // Filter to only show images
        const images = response.files.filter((f) => f.type === 'image');
        setMediaFiles(images);
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to load media files');
    } finally {
      setMediaLoading(false);
    }
  }, []);

  // Filter and paginate media files
  const filteredMediaFiles = useMemo(() => {
    if (!mediaSearch.trim()) return mediaFiles;
    const searchLower = mediaSearch.toLowerCase().trim();
    return mediaFiles.filter((f) =>
      f.filename.toLowerCase().includes(searchLower)
    );
  }, [mediaFiles, mediaSearch]);

  const paginatedMediaFiles = useMemo(() => {
    const start = (mediaPage - 1) * MEDIA_PAGE_SIZE;
    return filteredMediaFiles.slice(start, start + MEDIA_PAGE_SIZE);
  }, [filteredMediaFiles, mediaPage]);

  // Reset pagination when search changes
  useEffect(() => {
    setMediaPage(1);
  }, [mediaSearch]);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue({
        ...initialData,
        genesisDate: initialData.genesisDate ? dayjs(initialData.genesisDate) : null,
        categories: initialData.categories?.join(', ') || '',
      });
      if (initialData.iconUrl) {
        setIconPreview(resolveUploadUrl(initialData.iconUrl));
        // If it's an external URL (not from uploads), set source to URL
        if (initialData.iconUrl.startsWith('http')) {
          setIconSource('url');
          setIconUrl(initialData.iconUrl);
        }
      }
    }
  }, [initialData, form]);

  const handleIconChange = (info: any) => {
    const file = info.file.originFileObj || info.file;
    if (file) {
      setIconFile(file);
      setIconUrl('');
      const reader = new FileReader();
      reader.onload = (e) => setIconPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
    return false;
  };

  const handleUrlChange = (url: string) => {
    setIconUrl(url);
    setIconFile(null);
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setIconPreview(url);
    } else {
      setIconPreview(null);
    }
  };

  const handleMediaSelect = (file: MediaFile) => {
    const fullUrl = getFullMediaUrl(file.url);
    setIconUrl(file.url); // Store the relative URL for the backend
    setIconFile(null);
    setIconPreview(fullUrl);
    setMediaModalOpen(false);
    setIconSource('media');
  };

  const openMediaLibrary = () => {
    setMediaSearch('');
    setMediaPage(1);
    fetchMediaFiles();
    setMediaModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    const categories = values.categories
      ? values.categories.split(',').map((c: string) => c.trim()).filter((c: string) => c)
      : [];

    // Determine which icon source to use
    let submitData: any = {
      ...values,
      categories,
      genesisDate: values.genesisDate?.toISOString() || null,
    };

    if (iconSource === 'upload' && iconFile) {
      submitData.icon = iconFile;
    } else if ((iconSource === 'url' || iconSource === 'media') && iconUrl) {
      submitData.iconUrl = iconUrl;
    }

    await onSubmit(submitData);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{ isActive: true, peggedPercentage: 10 }}
    >
      <Row gutter={48}>
        <Col xs={24} lg={12}>
          <Divider titlePlacement="start">Token Details</Divider>
          
          <Form.Item
            name="ticker"
            label="Ticker Symbol"
            rules={[
              { required: true, message: 'Required' },
              { max: 10, message: 'Max 10 chars' },
              { pattern: /^[A-Z0-9]+$/i, message: 'Letters/numbers only' },
            ]}
          >
            <Input placeholder="MIT" style={{ textTransform: 'uppercase' }} disabled={isEdit} />
          </Form.Item>

          <Form.Item name="name" label="Token Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="MIT Coin" />
          </Form.Item>

          <Form.Item label="Icon">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {/* Preview */}
              {iconPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Image
                    src={iconPreview}
                    alt="Icon"
                    width={48}
                    height={48}
                    style={{ borderRadius: 6, objectFit: 'cover' }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {iconSource === 'upload' && iconFile ? iconFile.name : iconUrl || 'Current icon'}
                  </Text>
                </div>
              )}

              {/* Source selector */}
              <Radio.Group
                value={iconSource}
                onChange={(e) => {
                  setIconSource(e.target.value);
                  // Clear current values when switching
                  if (e.target.value !== iconSource) {
                    setIconFile(null);
                    setIconUrl('');
                    if (!initialData?.iconUrl) {
                      setIconPreview(null);
                    }
                  }
                }}
                optionType="button"
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value="upload">
                  <UploadOutlined /> Upload
                </Radio.Button>
                <Radio.Button value="media">
                  <FolderOpenOutlined /> Media Library
                </Radio.Button>
                <Radio.Button value="url">
                  <LinkOutlined /> URL
                </Radio.Button>
              </Radio.Group>

              {/* Source-specific inputs */}
              {iconSource === 'upload' && (
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={handleIconChange}
                >
                  <Button icon={<UploadOutlined />}>
                    {iconFile ? 'Change File' : 'Select File'}
                  </Button>
                </Upload>
              )}

              {iconSource === 'media' && (
                <Button icon={<FolderOpenOutlined />} onClick={openMediaLibrary}>
                  Browse Media Library
                </Button>
              )}

              {iconSource === 'url' && (
                <Input
                  placeholder="https://example.com/icon.png"
                  value={iconUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  prefix={<LinkOutlined />}
                />
              )}
            </Space>
          </Form.Item>

          {/* Media Library Modal */}
          <Modal
            title="Select from Media Library"
            open={mediaModalOpen}
            onCancel={() => setMediaModalOpen(false)}
            footer={null}
            width={800}
            styles={{ body: { padding: '16px 24px' } }}
          >
            {mediaLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>Loading media files...</div>
              </div>
            ) : mediaFiles.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No images in media library. Upload images in Media Manager first."
                style={{ padding: 60 }}
              />
            ) : (
              <div>
                {/* Search and count */}
                <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                  <Col flex="auto">
                    <Input
                      placeholder="Search by filename..."
                      prefix={<SearchOutlined />}
                      value={mediaSearch}
                      onChange={(e) => setMediaSearch(e.target.value)}
                      allowClear
                    />
                  </Col>
                  <Col>
                    <Text type="secondary">
                      {filteredMediaFiles.length} of {mediaFiles.length} images
                    </Text>
                  </Col>
                </Row>

                {/* Image grid */}
                {paginatedMediaFiles.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={`No images match "${mediaSearch}"`}
                    style={{ padding: 40 }}
                  />
                ) : (
                  <Row gutter={[12, 12]}>
                    {paginatedMediaFiles.map((file) => (
                      <Col key={file.filename} xs={8} sm={6} md={4}>
                        <div
                          onClick={() => handleMediaSelect(file)}
                          className="media-item"
                          style={{
                            cursor: 'pointer',
                            border: '2px solid #d9d9d9',
                            borderRadius: 8,
                            padding: 6,
                            background: '#fff',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#1677ff';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,119,255,0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#d9d9d9';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              paddingTop: '100%',
                              position: 'relative',
                              background: '#f5f5f5',
                              borderRadius: 4,
                              overflow: 'hidden',
                            }}
                          >
                            <img
                              src={getFullMediaUrl(file.url)}
                              alt={file.filename}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <Text
                            style={{
                              display: 'block',
                              fontSize: 11,
                              marginTop: 6,
                              textAlign: 'center',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={file.filename}
                          >
                            {file.filename}
                          </Text>
                        </div>
                      </Col>
                    ))}
                  </Row>
                )}

                {/* Pagination */}
                {filteredMediaFiles.length > MEDIA_PAGE_SIZE && (
                  <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <Pagination
                      current={mediaPage}
                      pageSize={MEDIA_PAGE_SIZE}
                      total={filteredMediaFiles.length}
                      onChange={(page) => setMediaPage(page)}
                      showSizeChanger={false}
                      showQuickJumper={filteredMediaFiles.length > MEDIA_PAGE_SIZE * 5}
                      size="small"
                    />
                  </div>
                )}
              </div>
            )}
          </Modal>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider titlePlacement="start">Price Pegging</Divider>

          <Form.Item name="peggedToAsset" label="Reference Token" rules={[{ required: true, message: 'Required' }]}>
            <Select
              placeholder="Select token"
              showSearch
              optionFilterProp="label"
              options={referenceTokens.map((t) => ({ value: t.symbol, label: `${t.symbol} - ${t.name}` }))}
            />
          </Form.Item>

          <Form.Item
            name="peggedPercentage"
            label="Price Percentage"
            rules={[{ required: true, message: 'Required' }]}
            extra="Token price = Reference × (percentage / 100)"
          >
            <InputNumber min={0.0001} max={1000} step={0.1} precision={4} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
        </Col>

        <Col xs={24} lg={12}>
          <Divider titlePlacement="start">Marketing (Optional)</Divider>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Token description..." maxLength={2000} showCount />
          </Form.Item>

          <Form.Item name="categories" label="Categories" extra="Comma-separated">
            <Input placeholder="Education, College, DeFi" />
          </Form.Item>

          <Form.Item name="genesisDate" label="Genesis Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Divider titlePlacement="start">Links (Optional)</Divider>

          <Form.Item name="website" label="Website">
            <Input placeholder="https://example.edu" />
          </Form.Item>

          <Form.Item name="whitepaper" label="Whitepaper">
            <Input placeholder="https://example.edu/whitepaper.pdf" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="twitter" label="Twitter">
                <Input placeholder="@handle" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="discord" label="Discord">
                <Input placeholder="discord.gg/..." />
              </Form.Item>
            </Col>
          </Row>
        </Col>
      </Row>

      <Divider />

      <Space>
        <Button onClick={() => router.back()} icon={<ArrowLeftOutlined />}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
          {isEdit ? 'Save Changes' : 'Create Token'}
        </Button>
      </Space>
    </Form>
  );
};
