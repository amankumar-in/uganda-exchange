import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  Table,
  Button,
  Space,
  message,
  Upload,
  Modal,
  Typography,
  Image,
  Popconfirm,
  Tag,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
  FileOutlined,
  FileImageOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  SoundOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { listMedia, uploadMedia, deleteMediaFile, MediaFile } from '@/services/api/admin';

const { Text, Paragraph } = Typography;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

import { getBackendRootUrl } from '@/services/api/config';
const API_BASE = getBackendRootUrl();

function getFullUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return `${API_BASE}${url}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${url}`;
  return url;
}

function getFileIcon(type: string) {
  const style = { fontSize: 20, color: '#8c8c8c' };
  switch (type) {
    case 'image': return <FileImageOutlined style={{ ...style, color: '#1890ff' }} />;
    case 'video': return <VideoCameraOutlined style={{ ...style, color: '#722ed1' }} />;
    case 'audio': return <SoundOutlined style={{ ...style, color: '#13c2c2' }} />;
    case 'document': return <FileTextOutlined style={{ ...style, color: '#fa8c16' }} />;
    default: return <FileOutlined style={style} />;
  }
}

export default function AdminMediaPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listMedia();
      if (response.success) setFiles(response.files);
    } catch (error: any) {
      message.error(error.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    setUploading(true);
    try {
      const response = await uploadMedia(fileList);
      if (response.success) {
        message.success(response.message);
        fetchFiles();
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      const response = await deleteMediaFile(filename);
      if (response.success) {
        message.success('File deleted');
        setFiles((prev) => prev.filter((f) => f.filename !== filename));
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to delete file');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(getFullUrl(url));
    message.success('URL copied');
  };

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    beforeUpload: (file, fileList) => {
      if (fileList.indexOf(file) === fileList.length - 1) {
        handleUpload(fileList as unknown as File[]);
      }
      return false;
    },
  };

  const columns = [
    {
      title: '',
      key: 'preview',
      width: 60,
      render: (_: any, record: MediaFile) => (
        <div
          style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 4, overflow: 'hidden', cursor: 'pointer' }}
          onClick={() => { setPreviewFile(record); setPreviewVisible(true); }}
        >
          {record.type === 'image' ? (
            <img src={getFullUrl(record.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : getFileIcon(record.type)}
        </div>
      ),
    },
    {
      title: 'File',
      dataIndex: 'filename',
      key: 'filename',
      render: (filename: string, record: MediaFile) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ wordBreak: 'break-all', fontSize: 13 }}>{filename}</Text>
          <Tag style={{ fontSize: 10 }}>{record.type}</Tag>
        </Space>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 80,
      render: (size: number) => <Text type="secondary">{formatFileSize(size)}</Text>,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => (
        <Text copyable={{ text: getFullUrl(url), tooltips: ['Copy', 'Copied'] }} style={{ maxWidth: 200, fontSize: 12 }} ellipsis>
          {url}
        </Text>
      ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_: any, record: MediaFile) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setPreviewFile(record); setPreviewVisible(true); }} />
          <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyUrl(record.url)} />
          <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.filename)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>Media Manager - Admin</title>
      </Head>
      <AdminLayout selectedKey="media">
        <Space style={{ marginBottom: 16 }}>
          <Upload {...uploadProps} disabled={uploading}>
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>Upload Files</Button>
          </Upload>
          <Button icon={<ReloadOutlined />} onClick={fetchFiles} loading={loading}>Refresh</Button>
          <Text type="secondary">{files.length} files</Text>
        </Space>

        <Table
          columns={columns}
          dataSource={files}
          loading={loading}
          rowKey="filename"
          size="small"
          pagination={{ showSizeChanger: true, defaultPageSize: 20, showTotal: (t) => `${t} files` }}
        />

        <Modal
          title="File Preview"
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={[
            <Button key="copy" icon={<CopyOutlined />} onClick={() => previewFile && handleCopyUrl(previewFile.url)}>Copy URL</Button>,
            <Button key="close" type="primary" onClick={() => setPreviewVisible(false)}>Close</Button>,
          ]}
          width={600}
        >
          {previewFile && (
            <div>
              <div style={{ textAlign: 'center', background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16, minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {previewFile.type === 'image' ? (
                  <Image src={getFullUrl(previewFile.url)} alt={previewFile.filename} style={{ maxHeight: 300 }} />
                ) : previewFile.type === 'video' ? (
                  <video src={getFullUrl(previewFile.url)} controls style={{ maxWidth: '100%', maxHeight: 300 }} />
                ) : previewFile.type === 'audio' ? (
                  <audio src={getFullUrl(previewFile.url)} controls />
                ) : (
                  <div style={{ textAlign: 'center' }}>{getFileIcon(previewFile.type)}<div style={{ marginTop: 8 }}>No preview</div></div>
                )}
              </div>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div><Text type="secondary">Filename:</Text> <Text strong>{previewFile.filename}</Text></div>
                <div><Text type="secondary">Type:</Text> <Tag>{previewFile.type}</Tag></div>
                <div><Text type="secondary">Size:</Text> <Text>{formatFileSize(previewFile.size)}</Text></div>
                <div>
                  <Text type="secondary">URL:</Text>
                  <Paragraph copyable style={{ margin: 0, background: '#f5f5f5', padding: 6, borderRadius: 4, fontSize: 11 }}>
                    {getFullUrl(previewFile.url)}
                  </Paragraph>
                </div>
              </Space>
            </div>
          )}
        </Modal>
      </AdminLayout>
    </>
  );
}
