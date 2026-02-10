import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { CollegeCoinForm } from '../../../components/admin/CollegeCoinForm';
import {
  createCollegeCoin,
  getReferenceTokens,
  ReferenceToken,
} from '../../../services/api/admin';

export default function NewCollegeCoinPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [referenceTokens, setReferenceTokens] = useState<ReferenceToken[]>([]);

  useEffect(() => {
    const fetchReferenceTokens = async () => {
      try {
        const response = await getReferenceTokens();
        setReferenceTokens(response.tokens);
      } catch (error: any) {
        message.error('Failed to load reference tokens');
      }
    };
    fetchReferenceTokens();
  }, []);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    try {
      const result = await createCollegeCoin(data);
      message.success(result.message || 'Token created successfully');
      router.push('/admin/demo-college-coins');
    } catch (error: any) {
      message.error(error.message || 'Failed to create token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout selectedKey="demo-college-coins">
      <CollegeCoinForm
        referenceTokens={referenceTokens}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </AdminLayout>
  );
}
