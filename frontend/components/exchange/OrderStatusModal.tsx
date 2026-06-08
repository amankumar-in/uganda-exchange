import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spin, Typography, Button, theme } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, CloseOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { InternalOrder } from '@/services/api/coinbase';
import { fontWeights } from '@/theme/themeConfig';
import { throttle } from '@/utils/debounce';
import PriceFormatter from './PriceFormatter';

const { Text, Title } = Typography;
const { useToken } = theme;

interface OrderStatusModalProps {
  visible: boolean;
  order: InternalOrder | null;
  onClose: () => void;
  onStatusUpdate?: (order: InternalOrder) => void;
  isLearnerMode?: boolean;
  isSimulatedFailure?: boolean;
}

export default function OrderStatusModal({
  visible,
  order,
  onClose,
  isLearnerMode = false,
  isSimulatedFailure = false,
}: OrderStatusModalProps) {
  const { token } = useToken();
  const [currentOrder, setCurrentOrder] = useState<InternalOrder | null>(order);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    setMounted(true);
    // Throttle resize handler to reduce main thread work
    const checkMobile = throttle(() => {
      setIsMobile(window.innerWidth < 768);
    }, 150);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  if (!mounted || !currentOrder) return null;

  const isLoading = currentOrder.status === 'PENDING';
  const isSuccess = currentOrder.status === 'COMPLETED';
  const isFailed = currentOrder.status === 'FAILED' || currentOrder.status === 'CANCELLED';

  const [baseAsset, quoteAsset] = currentOrder.productId.split('-');

  // Status configuration
  const statusConfig = {
    loading: {
      color: token.colorPrimary,
      bg: token.colorPrimaryBg,
      icon: <LoadingOutlined />,
      title: 'Processing Order',
      subtitle: `${currentOrder.side} ${baseAsset} order is being executed`,
    },
    success: {
      color: token.colorSuccess,
      bg: token.colorSuccessBg,
      icon: <CheckCircleOutlined />,
      title: 'Order Completed',
      subtitle: `${currentOrder.side} ${baseAsset} order has been successfully executed`,
    },
    failed: {
      color: token.colorError,
      bg: token.colorErrorBg,
      icon: <CloseCircleOutlined />,
      title: 'Order Failed',
      subtitle: `Unable to complete ${currentOrder.side} ${baseAsset} order`,
    },
    // Special learner mode failure - educational and encouraging
    learnerFailed: {
      color: '#F59E0B', // Amber/warning color instead of error red
      bg: 'rgba(245, 158, 11, 0.1)',
      icon: <CloseCircleOutlined />,
      title: 'Trade Not Executed',
      subtitle: `This is a simulated failure — part of learning!`,
    },
  };

  // Use learner failure config when in learner mode with simulated failure
  const config = isLoading 
    ? statusConfig.loading 
    : isSuccess 
      ? statusConfig.success 
      : (isLearnerMode && isSimulatedFailure)
        ? statusConfig.learnerFailed
        : statusConfig.failed;

  const modalContent = (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isLoading ? onClose : undefined}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              zIndex: 9998,
              cursor: isLoading ? 'default' : 'pointer',
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0, x: '-50%', y: '-50%' }}
            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, x: '-50%', y: '-50%' }}
            exit={isMobile ? { y: '100%' } : { scale: 0.95, opacity: 0, x: '-50%', y: '-50%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              ...(isMobile
                ? {
                    bottom: 0,
                    left: 0,
                    right: 0,
                  }
                : {
                    top: '50%',
                    left: '50%',
                    width: '100%',
                    maxWidth: 440,
                  }),
              zIndex: 9999,
              maxHeight: isMobile ? '90vh' : 'auto',
            }}
          >
            {/* Drag Handle (Mobile Only) */}
            {isMobile && (
              <div
                style={{
                  width: '100%',
                  paddingTop: token.paddingSM,
                  paddingBottom: token.paddingSM,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: token.colorBorder,
                  }}
                />
              </div>
            )}

            {/* Modal Content */}
            <div
              style={{
                backgroundColor: token.colorBgContainer,
                borderRadius: isMobile ? `${token.borderRadiusLG}px ${token.borderRadiusLG}px 0 0` : token.borderRadiusLG,
                border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
                overflow: 'hidden',
                maxHeight: isMobile ? 'calc(90vh - 20px)' : 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header Section */}
              <div
                style={{
                  position: 'relative',
                  padding: `${token.paddingXL}px ${token.paddingXL}px ${token.paddingLG}px`,
                  backgroundColor: config.bg,
                  borderBottom: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
                }}
              >
                {/* Close Button */}
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={onClose}
                  style={{
                    position: 'absolute',
                    top: token.paddingMD,
                    right: token.paddingMD,
                    color: token.colorTextSecondary,
                    minWidth: 32,
                    height: 32,
                  }}
                />

                {/* Status Icon & Title */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginMD }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      backgroundColor: config.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 36,
                    }}
                  >
                    {isLoading ? (
                      <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#fff' }} spin />} />
                    ) : (
                      config.icon
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <Title
                      level={4}
                      style={{
                        margin: 0,
                        marginBottom: token.marginXS,
                        color: token.colorText,
                        fontWeight: fontWeights.bold,
                        fontSize: token.fontSizeHeading4,
                      }}
                    >
                      {config.title}
                    </Title>
                    <Text
                      style={{
                        color: token.colorTextSecondary,
                        fontSize: token.fontSize,
                      }}
                    >
                      {config.subtitle}
                    </Text>
                  </div>
                </div>
              </div>

              {/* Order Details Section */}
              {(isSuccess && currentOrder.filledAmount > 0) || isFailed ? (
                <div style={{ padding: token.paddingXL, flex: 1, overflowY: 'auto' }}>
                  {/* Order Information */}
                  {isSuccess && currentOrder.filledAmount > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginMD }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}>
                            Amount
                          </Text>
                          <Text
                            strong
                            style={{
                              fontSize: token.fontSizeLG,
                              color: token.colorText,
                              fontWeight: fontWeights.semibold,
                            }}
                          >
                            {currentOrder.filledAmount.toFixed(8)} {baseAsset}
                          </Text>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}>
                            Price
                          </Text>
                          <Text
                            strong
                            style={{
                              fontSize: token.fontSizeLG,
                              color: token.colorText,
                              fontWeight: fontWeights.semibold,
                            }}
                          >
                            <PriceFormatter price={currentOrder.price} style={{ fontWeight: 'inherit', fontSize: 'inherit' }} />
                          </Text>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSize }}>
                            Total Value
                          </Text>
                          <Text
                            strong
                            style={{
                              fontSize: token.fontSizeLG,
                              color: config.color,
                              fontWeight: fontWeights.semibold,
                            }}
                          >
                            {(currentOrder.totalValue || 0).toFixed(2)} {quoteAsset}
                          </Text>
                        </div>
                      </div>
                  )}

                  {/* Error Message */}
                  {isFailed && (
                    <div
                        style={{
                          padding: token.paddingMD,
                          backgroundColor: isLearnerMode && isSimulatedFailure ? 'rgba(245, 158, 11, 0.1)' : token.colorErrorBg,
                          borderRadius: token.borderRadius,
                          border: `${token.lineWidth}px solid ${isLearnerMode && isSimulatedFailure ? 'rgba(245, 158, 11, 0.3)' : `${token.colorError}30`}`,
                        }}
                      >
                        {isLearnerMode && isSimulatedFailure ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
                            <Text style={{ color: '#D97706', fontSize: token.fontSize, fontWeight: 600 }}>
                              🎓 This is a learning moment!
                            </Text>
                            <Text style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM, lineHeight: 1.5 }}>
                              In real trading, orders can fail due to market conditions, network issues, or exchange limits. 
                              This simulated failure helps you practice handling these situations.
                            </Text>
                            <div style={{ 
                              marginTop: token.marginXS,
                              padding: token.paddingSM,
                              backgroundColor: 'rgba(74, 222, 128, 0.1)',
                              borderRadius: token.borderRadiusSM,
                              border: '1px solid rgba(74, 222, 128, 0.2)',
                            }}>
                              <Text style={{ color: '#22C55E', fontSize: token.fontSizeSM }}>
                                ✓ No funds were lost — your virtual balance is unchanged. Check your portfolio to confirm, then try again!
                              </Text>
                            </div>
                          </div>
                        ) : (
                          <Text style={{ color: token.colorError, fontSize: token.fontSize }}>
                            Your order could not be completed. Please try again later.
                          </Text>
                        )}
                      </div>
                  )}
                </div>
              ) : null}

              {/* Footer Action */}
              <div
                style={{
                  padding: token.paddingXL,
                  borderTop: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
                  backgroundColor: token.colorBgLayout,
                }}
              >
                <Button
                  type="primary"
                  size="large"
                  onClick={onClose}
                  block
                  style={{
                    height: token.controlHeightLG,
                    fontSize: token.fontSizeLG,
                    fontWeight: fontWeights.semibold,
                    borderRadius: token.borderRadius,
                    backgroundColor: config.color,
                    borderColor: config.color,
                  }}
                >
                  {isLoading ? 'Dismiss' : 'Got it'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
