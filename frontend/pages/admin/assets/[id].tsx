
import React, { useEffect, useState } from 'react';
import { message, Spin } from 'antd';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { TokenForm } from '../../../components/admin/assets/TokenForm';
import { TokensApi } from '../../../services/api/tokens';
import { Token } from '../../../types/token';

export default function EditTokenPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [token, setToken] = useState<Token | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchToken(id);
    }
  }, [id]);

  const fetchToken = async (tokenId: string) => {
    setFetching(true);
    try {
      const data = await TokensApi.getOne(tokenId);
      setToken(data);
    } catch (error) {
      message.error('Failed to load token');
      router.push('/admin/assets');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (values: any) => {
    if (!id || typeof id !== 'string') return;
    
    setLoading(true);
    try {
      await TokensApi.update(id, values);
      message.success('Token updated successfully');
      router.push('/admin/assets');
    } catch (error: any) {
      message.error(error.message || 'Failed to update token');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <AdminLayout selectedKey="assets" title="Edit Token">
        <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout selectedKey="assets" title={`Edit ${token?.symbol}`}>
       <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {token && <TokenForm initialData={token} isEdit onSubmit={handleSubmit} loading={loading} />}
      </div>
    </AdminLayout>
  );
}
