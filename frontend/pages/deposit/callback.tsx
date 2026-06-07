import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Spin, Result, Button, Typography } from 'antd';
import { getDepositStatus } from '@/services/api/fiat';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

const { Text } = Typography;

export default function DepositCallbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    const { OrderMerchantReference } = router.query;
    
    if (!OrderMerchantReference || typeof OrderMerchantReference !== 'string') {
      setError('Invalid callback parameters received from payment gateway.');
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        // Poll status with a small delay to allow IPN to process if it arrived at the exact same time
        await new Promise(r => setTimeout(r, 2000));
        
        let attempts = 0;
        let finalStatus = 'PENDING';
        
        // Poll up to 5 times (10 seconds total)
        while (attempts < 5) {
          const res = await getDepositStatus(OrderMerchantReference);
          finalStatus = res.status;
          
          if (finalStatus !== 'PENDING' && finalStatus !== 'PROCESSING') {
            break;
          }
          
          attempts++;
          await new Promise(r => setTimeout(r, 2000));
        }

        if (finalStatus === 'COMPLETED') {
          router.replace('/portfolio?deposit_success=1');
        } else if (finalStatus === 'FAILED' || finalStatus === 'CANCELLED') {
          setError('Payment failed or was cancelled.');
          setLoading(false);
        } else {
          // If still pending, it might take a moment.
          router.replace('/portfolio?deposit_pending=1');
        }
      } catch (err: any) {
        console.error('Error verifying deposit status:', err);
        setError('Failed to verify deposit status. Your account will be credited automatically once the payment clears.');
        setLoading(false);
      }
    };

    checkStatus();
  }, [router.isReady, router.query, router]);

  return (
    <DashboardLayout>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh' 
      }}>
        {loading ? (
          <div style={{ textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 24 }}>
              <Text strong>Verifying your payment...</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">Please do not refresh or close this page.</Text>
            </div>
          </div>
        ) : (
          <Result
            status="error"
            title="Deposit Failed"
            subTitle={error}
            extra={[
              <Button 
                type="primary" 
                key="console" 
                onClick={() => router.replace('/portfolio')}
              >
                Return to Portfolio
              </Button>
            ]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
