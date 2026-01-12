
import React, { useState } from 'react';
import { Card, message } from 'antd';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { TokenForm } from '../../../components/admin/assets/TokenForm';
import { TokensApi } from '../../../services/api/tokens';

export default function NewTokenPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await TokensApi.create(values);
      message.success('Token created successfully');
      router.push('/admin/assets');
    } catch (error: any) {
      message.error(error.message || 'Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout selectedKey="assets" title="Add New Token">
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <TokenForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </AdminLayout>
  );
}
