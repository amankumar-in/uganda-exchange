import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { theme, Button, Space, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import OrderStatusModal from '@/components/exchange/OrderStatusModal';
import { InternalOrder } from '@/services/api/coinbase';
import { fontWeights } from '@/theme/themeConfig';

const { useToken } = theme;
const { Title, Text } = Typography;

export default function ModalSandboxPage() {
  const { token } = useToken();
  const [mounted, setMounted] = useState(false);
  const [orderStatusModalVisible, setOrderStatusModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InternalOrder | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate mock order data
  const createMockOrder = (side: 'BUY' | 'SELL'): InternalOrder => {
    const productId = side === 'BUY' ? 'BTC-USD' : 'ETH-USD';
    const [asset, quote] = productId.split('-');
    const requestedAmount = side === 'BUY' ? 100 : 0.1; // BUY: $100 worth, SELL: 0.1 ETH
    const price = side === 'BUY' ? 89276 : 3113.48; // Mock prices
    const filledAmount = side === 'BUY' ? 0.00112033 : 0.1; // Mock filled amounts
    const totalValue = side === 'BUY' ? 100 : 311.35;
    const platformFee = totalValue * 0.005; // 0.5% fee

    return {
      id: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      transactionId: '',
      productId,
      asset,
      quote,
      side,
      requestedAmount,
      filledAmount: 0, // Start with 0, will update when completed
      price,
      totalValue: 0, // Start with 0, will update when completed
      platformFee: 0, // Start with 0, will update when completed
      exchangeFee: 0,
      status: 'PENDING',
      coinbaseOrderId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
  };

  // Simulate order flow
  const simulateOrder = async (side: 'BUY' | 'SELL') => {
    if (isSimulating) return;

    setIsSimulating(true);
    
    // Create initial pending order
    const mockOrder = createMockOrder(side);
    setCurrentOrder(mockOrder);
    setOrderStatusModalVisible(true);

    // Simulate order processing (PENDING → COMPLETED)
    setTimeout(() => {
      const completedOrder: InternalOrder = {
        ...mockOrder,
        status: 'COMPLETED',
        filledAmount: side === 'BUY' ? 0.00112033 : 0.1,
        totalValue: side === 'BUY' ? 100 : 311.35,
        platformFee: (side === 'BUY' ? 100 : 311.35) * 0.005,
        completedAt: new Date().toISOString(),
      };
      setCurrentOrder(completedOrder);
      setIsSimulating(false);
    }, 2500); // 2.5 seconds delay
  };

  const handleBuy = () => {
    simulateOrder('BUY');
  };

  const handleSell = () => {
    simulateOrder('SELL');
  };

  const handleCloseModal = () => {
    setOrderStatusModalVisible(false);
    setCurrentOrder(null);
    setIsSimulating(false);
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Modal Sandbox - UG Coin</title>
        <meta name="description" content="Design and test order status modal" />
      </Head>

      <DashboardLayout activeKey={undefined} fullWidth={false}>
        <div
          style={{
            maxWidth: 800,
            margin: '0 auto',
            padding: token.paddingXL,
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              width: '100%',
              textAlign: 'center',
            }}
          >
            <Title
              level={2}
              style={{
                marginBottom: token.marginMD,
                fontWeight: fontWeights.bold,
                color: token.colorText,
              }}
            >
              Order Modal Sandbox
            </Title>
            <Text
              style={{
                fontSize: token.fontSizeLG,
                color: token.colorTextSecondary,
                display: 'block',
                marginBottom: token.marginXL,
              }}
            >
              Test the order status modal with simulated Buy/Sell orders
            </Text>

            <Space
              direction="vertical"
              size="large"
              style={{
                width: '100%',
                maxWidth: 400,
              }}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowUpOutlined />}
                  onClick={handleBuy}
                  disabled={isSimulating}
                  block
                  style={{
                    height: token.controlHeightLG * 1.2,
                    fontSize: token.fontSizeLG,
                    fontWeight: fontWeights.semibold,
                    background: `linear-gradient(135deg, ${token.colorSuccess} 0%, ${token.colorSuccess}dd 100%)`,
                    border: 'none',
                    boxShadow: `0 4px 16px ${token.colorSuccess}30`,
                  }}
                >
                  Simulate Buy Order
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowDownOutlined />}
                  onClick={handleSell}
                  disabled={isSimulating}
                  block
                  danger
                  style={{
                    height: token.controlHeightLG * 1.2,
                    fontSize: token.fontSizeLG,
                    fontWeight: fontWeights.semibold,
                    background: `linear-gradient(135deg, ${token.colorError} 0%, ${token.colorError}dd 100%)`,
                    border: 'none',
                    boxShadow: `0 4px 16px ${token.colorError}30`,
                  }}
                >
                  Simulate Sell Order
                </Button>
              </motion.div>
            </Space>

            {isSimulating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  marginTop: token.marginXL,
                  padding: token.paddingMD,
                  backgroundColor: token.colorInfoBg,
                  borderRadius: token.borderRadius,
                  border: `1px solid ${token.colorInfoBorder}`,
                }}
              >
                <Text style={{ color: token.colorInfo, fontSize: token.fontSizeSM }}>
                  Order simulation in progress... Modal should be visible.
                </Text>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Order Status Modal */}
        <OrderStatusModal
          visible={orderStatusModalVisible}
          order={currentOrder}
          onClose={handleCloseModal}
          onStatusUpdate={(updatedOrder) => {
            setCurrentOrder(updatedOrder);
          }}
        />
      </DashboardLayout>
    </>
  );
}

