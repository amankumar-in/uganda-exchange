import React, { useState, useEffect } from 'react';
import { message, Spin } from 'antd';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { CollegeCoinForm } from '../../../components/admin/CollegeCoinForm';
import {
  getCollegeCoin,
  updateCollegeCoin,
  getReferenceTokens,
  DemoCollegeCoin,
  ReferenceToken,
} from '../../../services/api/admin';

export default function EditCollegeCoinPage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [coin, setCoin] = useState<DemoCollegeCoin | null>(null);
  const [referenceTokens, setReferenceTokens] = useState<ReferenceToken[]>([]);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;

    const fetchData = async () => {
      setFetching(true);
      try {
        const [coinResponse, tokensResponse] = await Promise.all([
          getCollegeCoin(id),
          getReferenceTokens(),
        ]);
        setCoin(coinResponse.coin);
        setReferenceTokens(tokensResponse.tokens);
      } catch (error: any) {
        message.error('Failed to load token data');
        router.push('/admin/demo-college-coins');
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [id, router]);

  const handleSubmit = async (data: any) => {
    if (!id || typeof id !== 'string') return;

    setLoading(true);
    try {
      const result = await updateCollegeCoin(id, data);
      message.success(result.message || 'Token updated successfully');
      router.push('/admin/demo-college-coins');
    } catch (error: any) {
      message.error(error.message || 'Failed to update token');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <AdminLayout selectedKey="demo-college-coins">
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      </AdminLayout>
    );
  }

  if (!coin) {
    return (
      <AdminLayout selectedKey="demo-college-coins">
        <div style={{ textAlign: 'center', padding: 48 }}>
          Token not found
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout selectedKey="demo-college-coins">
      <CollegeCoinForm
        initialData={coin}
        referenceTokens={referenceTokens}
        onSubmit={handleSubmit}
        loading={loading}
        isEdit
      />
    </AdminLayout>
  );
}
