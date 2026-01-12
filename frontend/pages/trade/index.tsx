import React, { useEffect, useState, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, message } from 'antd';
import { LineChartOutlined, HistoryOutlined } from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { TradingChart, PairSelector, TradeForm, MobileTradePage } from '@/components/exchange';
import OrderStatusModal from '@/components/exchange/OrderStatusModal';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { useLayoutOptions } from '@/context/LayoutContext';
import { InternalOrder } from '@/services/api/coinbase';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;

// Inner component that uses the exchange context
function ExchangePageContent() {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showOrderBook, setShowOrderBook] = useState(true);
  const [orderStatusModalVisible, setOrderStatusModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InternalOrder | null>(null);
  const [isSimulatedFailure, setIsSimulatedFailure] = useState(false);
  
  const isDark = mode === 'dark';
  
  const {
    pairs,
    isLoadingPairs,
    selectedPair,
    setSelectedPair,
    currentPairData,
    currentPrice,
    priceChange,
    currentUsdVolume,
    candles,
    isLoadingCandles,
    candleGranularity,
    setCandleGranularity,
    getBalance,
    orders,
    isLoadingOrders,
    appMode,
    publicTrades,
    isLoadingTrades,
    orderBook,
    isLoadingOrderBook,
    executeTrade,
    isTrading,
    refreshOrders,
    refreshBalances,
  } = useExchange();

  // Set up layout options - fullWidth always true, show nav bar on mobile
  const { setExchangeData } = useLayoutOptions({
    fullWidth: true,
    hideMobileNav: false, // Always show bottom nav
  });

  const isMobile = mounted ? !screens.md : false;

  // Update exchange header data when pair changes
  useEffect(() => {
    if (selectedPair && currentPrice !== undefined && priceChange !== undefined) {
      setExchangeData({
        pair: selectedPair,
        price: currentPrice,
        change: priceChange,
        volume: formatVolume(currentUsdVolume),
        iconUrl: currentPairData?.iconUrl,
        baseAsset: currentPairData?.baseCurrency,
      });
    }
  }, [selectedPair, currentPrice, priceChange, currentUsdVolume, currentPairData, setExchangeData]);

  // Format USD volume for display
  const formatVolume = (volume: number): string => {
    if (isNaN(volume) || volume <= 0) return '$0';
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `$${(volume / 1e3).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formattedUsdVolume = formatVolume(currentUsdVolume);

  const isTablet = mounted ? (screens.md && !screens.lg) : false;
  
  const [baseAsset, quoteAsset] = selectedPair.split('-');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle pair from URL query param
  // Track if this is the first render to distinguish direct visits from navigation
  const isFirstRenderRef = React.useRef(true);
  
  useEffect(() => {
    if (!isLoadingPairs && pairs.length > 0 && router.isReady) {
      if (router.query.pair && typeof router.query.pair === 'string') {
        // If there's a pair in URL, use it
        const pairFromUrl = router.query.pair.toUpperCase();
        const pairExists = pairs.some(p => p.symbol === pairFromUrl);
        if (pairExists) {
          setSelectedPair(pairFromUrl);
        }
        isFirstRenderRef.current = false;
      } else if (isFirstRenderRef.current) {
        // First render with no query param (direct visit) - reset to default
        // In learner mode: BTC-USD (Popular pair), otherwise BTC-USD
        // In investor mode: BTC-USD
        setSelectedPair('BTC-USD');
        isFirstRenderRef.current = false;
      }
      // If navigating back to /trade after being on another page (not first render, no query param),
      // keep current selectedPair (don't reset)
    }
  }, [router.query.pair, router.isReady, pairs, setSelectedPair, isLoadingPairs, appMode]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/trade');
        return;
      }
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  // Handle trade execution
  const handleTrade = async (side: 'BUY' | 'SELL', amount: number, total: number) => {
    const [baseAsset, quoteAsset] = selectedPair.split('-');
    
    // Create pending order immediately
    const pendingOrder: InternalOrder = {
      id: `pending-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      transactionId: '',
      productId: selectedPair,
      asset: baseAsset,
      quote: quoteAsset,
      side,
      requestedAmount: side === 'BUY' ? amount : amount,
      filledAmount: 0,
      price: currentPrice || 0,
      totalValue: side === 'BUY' ? total : total,
      platformFee: total * 0.005,
      exchangeFee: 0,
      status: 'PENDING',
      coinbaseOrderId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    
    // Show modal immediately with pending order
    setCurrentOrder(pendingOrder);
    setIsSimulatedFailure(false); // Reset simulated failure flag
    setOrderStatusModalVisible(true);
    
    // Execute trade in background
    const result = await executeTrade(side, amount, total);
    
    if (result.success) {
      // Update modal with real order from API
      if (result.order) {
        setCurrentOrder(result.order);
        
        // If order is already completed, show success toast
        if (result.order.status === 'COMPLETED' && result.order.filledAmount > 0) {
          message.success(
            `${side} order completed! Filled ${result.order.filledAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${baseAsset} at $${result.order.price.toFixed(2)}`,
            5
          );
        } else if (result.order.status === 'PENDING') {
          // Start polling for order status
          pollOrderStatus(result.order.id);
        }
      } else {
        // If no order in response, refresh and try to get it
        await refreshOrders();
        await new Promise(resolve => setTimeout(resolve, 300));
        const latestOrders = orders.slice(0, 1);
        if (latestOrders.length > 0) {
          const order = latestOrders[0];
          setCurrentOrder(order);
          if (order.status === 'PENDING') {
            pollOrderStatus(order.id);
          }
        }
      }
    } else {
      // Update modal to show failed status
      setCurrentOrder({
        ...pendingOrder,
        status: 'FAILED',
      });
      
      // Track if this is a simulated failure in learner mode
      if (result.isSimulatedFailure) {
        setIsSimulatedFailure(true);
      } else {
        message.error('Unable to process trade at this time. Please try again later.');
      }
    }
  };

  // Poll for order status updates
  const pollOrderStatus = (orderId: string) => {
    let attempts = 0;
    const maxAttempts = 15; // Poll for up to 30 seconds (15 * 2s)
    
    const pollInterval = setInterval(async () => {
      attempts++;
      
      // Refresh orders
      await refreshOrders();
      
      // Wait a bit for state to update, then check orders
      setTimeout(() => {
        // Find the order in the updated orders list
        const updatedOrder = orders.find((o: any) => o.id === orderId);
        if (updatedOrder) {
          setCurrentOrder(updatedOrder);
          
          // If order is completed or failed, stop polling and show final toast
          if (updatedOrder.status === 'COMPLETED' || updatedOrder.status === 'FAILED' || updatedOrder.status === 'CANCELLED') {
            clearInterval(pollInterval);
            
            if (updatedOrder.status === 'COMPLETED' && updatedOrder.filledAmount > 0) {
              const [baseAsset] = selectedPair.split('-');
              message.success(
                `${updatedOrder.side} order completed! Filled ${updatedOrder.filledAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${baseAsset} at $${updatedOrder.price.toFixed(2)}`,
                5
              );
            } else if (updatedOrder.status === 'FAILED') {
              message.error('Order failed. Please try again.');
            }
            
            // Refresh balances after order completes
            refreshBalances();
          }
        }
      }, 300);
      
      // Stop polling after max attempts
      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
  };
  
  // Watch orders array for updates to current order
  useEffect(() => {
    if (currentOrder && orderStatusModalVisible) {
      const updatedOrder = orders.find((o: any) => o.id === currentOrder.id);
      if (updatedOrder && updatedOrder.status !== currentOrder.status) {
        setCurrentOrder(updatedOrder);
      }
    }
  }, [orders, currentOrder, orderStatusModalVisible]);

  const baseBalance = getBalance(baseAsset);
  const quoteBalance = getBalance(quoteAsset);

  const sectionStyle: React.CSSProperties = {
    marginBottom: token.marginSM,
  };

  // Don't render anything while checking auth or if not logged in
  if (isLoading || !user) {
    return null;
  }

  // Loading state
  if (pageLoading || isLoadingPairs) {
    // Mobile: Clean, minimal loading state
    if (isMobile) {
      return (
        <>
          <Head>
            <title>Trade - InTuition Exchange</title>
          </Head>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: token.marginLG,
            padding: token.paddingLG,
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${token.colorPrimary}20, ${token.colorPrimary}40)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <LineChartOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: token.fontSizeLG, 
                fontWeight: fontWeights.semibold,
                color: token.colorText,
                marginBottom: token.marginXS,
              }}>
                Loading Markets
              </div>
              <div style={{ 
                fontSize: token.fontSizeSM, 
                color: token.colorTextSecondary,
              }}>
                Fetching latest prices...
              </div>
            </div>
          </div>
        </>
      );
    }

    // Desktop: 3-column skeleton
    const PAIR_WIDTH = 300;
    const TRADE_WIDTH = 400;
    return (
      <>
        <Head>
          <title>Trade - InTuition Exchange</title>
        </Head>
        <div style={{ display: 'flex', width: '100%' }}>
            {/* Left - Markets skeleton */}
            <div style={{ 
              width: PAIR_WIDTH, 
              minWidth: PAIR_WIDTH, 
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              paddingRight: token.paddingMD,
            }}>
              <Skeleton.Input active style={{ width: '100%', marginBottom: token.marginSM }} />
              <div style={{ display: 'flex', gap: token.marginXS, marginBottom: token.marginMD }}>
                {[1,2,3,4].map(i => <Skeleton.Button key={i} active size="small" />)}
              </div>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, marginBottom: token.marginSM }}>
                  <Skeleton.Avatar active size="small" />
                  <Skeleton.Input active size="small" style={{ width: 80 }} />
                  <Skeleton.Input active size="small" style={{ width: 50 }} />
                </div>
              ))}
            </div>

            {/* Center - Chart skeleton */}
            <div style={{ flex: 1, minWidth: 0, borderRight: `1px solid ${token.colorBorderSecondary}`, padding: `0 ${token.paddingMD}px` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: token.marginMD }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                  <Skeleton.Avatar active size={40} />
                  <div>
                    <Skeleton.Input active size="small" style={{ width: 100, marginBottom: 4 }} />
                    <Skeleton.Input active size="small" style={{ width: 60 }} />
                  </div>
                </div>
                <div>
                  <Skeleton.Input active style={{ width: 100 }} />
                </div>
              </div>
              <Skeleton.Node active style={{ width: '100%', height: 280 }}>
                <LineChartOutlined style={{ fontSize: 40, color: token.colorTextQuaternary }} />
              </Skeleton.Node>
              <div style={{ marginTop: token.marginMD }}>
                <Skeleton active paragraph={{ rows: 3 }} title={false} />
              </div>
            </div>

            {/* Right - Trade form skeleton */}
            <div style={{ width: TRADE_WIDTH, minWidth: TRADE_WIDTH, padding: `0 ${token.paddingMD}px` }}>
              <div style={{ display: 'flex', gap: token.marginXS, marginBottom: token.marginMD }}>
                <Skeleton.Button active block />
                <Skeleton.Button active block />
              </div>
              <Skeleton.Input active style={{ width: '100%', marginBottom: token.marginSM }} />
              <Skeleton.Input active style={{ width: '100%', marginBottom: token.marginSM }} />
              <div style={{ display: 'flex', gap: token.marginXS, marginBottom: token.marginMD }}>
                {[1,2,3,4].map(i => <Skeleton.Button key={i} active size="small" style={{ flex: 1 }} />)}
              </div>
              <Skeleton.Button active block size="large" />
            </div>
        </div>
      </>
    );
  }

  // Mobile layout - New redesigned layout
  if (isMobile) {
    return (
      <>
        <Head>
          <title>Trade {selectedPair} - InTuition Exchange</title>
        </Head>
        <MobileTradePage
            pairs={pairs}
            selectedPair={selectedPair}
            onSelectPair={setSelectedPair}
            currentPrice={currentPrice}
            priceChange={priceChange}
            iconUrl={currentPairData?.iconUrl || `https://assets.coincap.io/assets/icons/${baseAsset.toLowerCase()}@2x.png`}
            candles={candles}
            isLoadingCandles={isLoadingCandles}
            candleGranularity={candleGranularity}
            onGranularityChange={setCandleGranularity}
            orders={orders}
            isLoadingOrders={isLoadingOrders}
            publicTrades={publicTrades}
            isLoadingTrades={isLoadingTrades}
            orderBook={orderBook}
            isLoadingOrderBook={isLoadingOrderBook}
            baseAsset={baseAsset}
            quoteAsset={quoteAsset}
            baseBalance={baseBalance}
            quoteBalance={quoteBalance}
            onTrade={handleTrade}
            isTrading={isTrading}
          />
        
        {/* Order Status Modal */}
        <OrderStatusModal
          visible={orderStatusModalVisible}
          order={currentOrder}
          onClose={() => {
            setOrderStatusModalVisible(false);
            setCurrentOrder(null);
            setIsSimulatedFailure(false);
          }}
          onStatusUpdate={(updatedOrder) => {
            setCurrentOrder(updatedOrder);
          }}
          isLearnerMode={appMode === 'learner'}
          isSimulatedFailure={isSimulatedFailure}
        />
      </>
    );
  }

  // Desktop layout - Fixed width side columns, flexible center, 100vh height
  const PAIR_COLUMN_WIDTH = 300;
  const TRADE_COLUMN_WIDTH = 400;

  return (
    <>
      <Head>
        <title>Trade {selectedPair} - InTuition Exchange</title>
      </Head>
      <div style={{ 
          display: 'flex', 
          width: '100%', 
          height: '100%',
          overflow: 'hidden',
          paddingTop: token.paddingMD,
        }}>
          {/* Left - Pairs (fixed width) */}
          {!isTablet && (
            <div style={{ 
              width: PAIR_COLUMN_WIDTH, 
              minWidth: PAIR_COLUMN_WIDTH, 
              maxWidth: PAIR_COLUMN_WIDTH,
              borderRight: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(102, 126, 234, 0.3)'}`,
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden',
            }}>
              <div style={{ height: '100%', paddingLeft: token.paddingMD, paddingRight: token.paddingSM }}>
                <PairSelector
                  pairs={pairs}
                  selectedPair={selectedPair}
                  onSelectPair={setSelectedPair}
                />
              </div>
            </div>
          )}

          {/* Middle - Chart & Market Data (flexible, 50-50 split) */}
          <div style={{ 
            flex: 1, 
            minWidth: 0,
            borderRight: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(102, 126, 234, 0.3)'}`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}>
            {/* Top Half - Chart with price header */}
            <div style={{ 
              flex: 1, 
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              borderBottom: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(102, 126, 234, 0.3)'}`,
              padding: `0 ${token.paddingMD}px`,
            }}>
              {isTablet && (
                <div style={{ marginBottom: token.marginXS }}>
                  <PairSelector pairs={pairs} selectedPair={selectedPair} onSelectPair={setSelectedPair} isMobile={true} />
                </div>
              )}

              {/* Chart - fills remaining space */}
              <div style={{ 
                flex: 1, 
                minHeight: 0,
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(102, 126, 234, 0.02)',
                borderRadius: token.borderRadiusSM,
                padding: token.paddingSM,
              }}>
                <TradingChart
                  candles={candles}
                  isLoading={isLoadingCandles}
                  granularity={candleGranularity}
                  onGranularityChange={setCandleGranularity}
                />
              </div>
            </div>

            {/* Bottom Half - Two columns: Trade History | Order Book/My Orders */}
            <div style={{ 
              flex: 1, 
              minHeight: 0,
              display: 'flex',
              gap: token.marginMD,
              padding: `${token.paddingXS}px ${token.paddingMD}px`,
              overflow: 'hidden',
            }}>
              {/* Left - Trade History */}
              <div style={{ 
                flex: 0.4, 
                minWidth: 0, 
                display: 'flex', 
                flexDirection: 'column',
                borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(102, 126, 234, 0.15)'}`,
                paddingRight: token.paddingMD,
              }}>
                <div style={{ 
                  fontSize: token.fontSizeSM, 
                  fontWeight: fontWeights.semibold, 
                  color: token.colorTextSecondary, 
                  marginBottom: token.marginXS,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  Trade History
                </div>
                <TradeHistoryCompact trades={publicTrades} isLoading={isLoadingTrades} />
              </div>
              {/* Right - Order Book / My Orders (toggleable) */}
              <div style={{ flex: 0.6, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                  fontSize: token.fontSizeSM, 
                  fontWeight: fontWeights.semibold, 
                  color: token.colorTextSecondary, 
                  marginBottom: token.marginXS,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}>
                  <span 
                    style={{ 
                      color: showOrderBook ? '#722ED1' : token.colorTextSecondary,
                      transition: 'color 0.2s ease',
                      marginRight: token.marginMD,
                    }}
                    onClick={() => setShowOrderBook(true)}
                  >
                    Order Book
                  </span>
                  <span 
                    style={{ 
                      color: !showOrderBook ? '#722ED1' : token.colorTextSecondary,
                      transition: 'color 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: token.marginXXS,
                    }}
                    onClick={() => setShowOrderBook(false)}
                  >
                    <HistoryOutlined style={{ fontSize: token.fontSizeSM }} />
                    My Orders
                  </span>
                </div>
                {showOrderBook ? (
                  <OrderBookCompact orderBook={orderBook} isLoading={isLoadingOrderBook} />
                ) : (
                  <OrderHistory orders={orders} isLoading={isLoadingOrders} />
                )}
              </div>
            </div>
          </div>

          {/* Right - Trade Form (fixed width) */}
          <div style={{ 
            width: TRADE_COLUMN_WIDTH, 
            minWidth: TRADE_COLUMN_WIDTH, 
            maxWidth: TRADE_COLUMN_WIDTH,
            flexShrink: 0,
            height: '100%',
            overflowY: 'auto',
            padding: `${token.paddingSM}px ${token.paddingMD}px`,
          }}>
            <TradeForm
              symbol={selectedPair}
              price={currentPrice}
              baseAsset={baseAsset}
              quoteAsset={quoteAsset}
              baseBalance={baseBalance}
              quoteBalance={quoteBalance}
              onTrade={handleTrade}
              isLoading={isTrading}
            />
          </div>
        </div>
      
      {/* Order Status Modal */}
      <OrderStatusModal
        visible={orderStatusModalVisible}
        order={currentOrder}
        onClose={() => {
          setOrderStatusModalVisible(false);
          setCurrentOrder(null);
          setIsSimulatedFailure(false);
        }}
        onStatusUpdate={(updatedOrder) => {
          setCurrentOrder(updatedOrder);
        }}
        isLearnerMode={appMode === 'learner'}
        isSimulatedFailure={isSimulatedFailure}
      />
    </>
  );
}

// Order history component - Shows all orders with time
function OrderHistory({ orders, isLoading }: { orders: any[]; isLoading: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (!orders || orders.length === 0) {
    return (
      <div style={{ 
        padding: token.paddingLG, 
        textAlign: 'center', 
        color: token.colorTextTertiary, 
        fontSize: token.fontSizeSM 
      }}>
        <HistoryOutlined style={{ fontSize: 24, marginRight: token.marginXS, opacity: 0.4 }} />
        No orders yet
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        fontSize: token.fontSize,
        color: token.colorTextSecondary,
        fontWeight: fontWeights.semibold,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        marginBottom: token.marginXS,
      }}>
        <span style={{ flex: 1 }}>Side/Pair</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Value</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Time</span>
      </div>
      {/* Scrollable content - show ALL orders */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        minHeight: 0,
      }}>
        {orders.map((order, index) => (
          <div
            key={order.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              fontSize: token.fontSize,
              backgroundColor: index % 2 === 0 
                ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(102, 126, 234, 0.02)')
                : 'transparent',
              transition: 'background-color 0.2s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark 
                ? 'rgba(255, 255, 255, 0.05)' 
                : 'rgba(102, 126, 234, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = index % 2 === 0 
                ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(102, 126, 234, 0.02)')
                : 'transparent';
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ 
                color: order.side === 'BUY' ? '#52c41a' : '#ff4d4f', 
                fontWeight: fontWeights.bold 
              }}>
                {order.side}
              </span>
              <span style={{ color: token.colorTextSecondary, marginLeft: token.marginXS }}>
                {order.productId}
              </span>
            </div>
            <div style={{ flex: 1, textAlign: 'right', color: token.colorText, fontWeight: fontWeights.semibold }}>
              ${order.totalValue.toFixed(2)}
            </div>
            <div style={{ 
              flex: 1, 
              textAlign: 'right', 
              color: token.colorTextTertiary,
              fontSize: token.fontSize,
            }}>
              {new Date(order.createdAt).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Trade History - Shows all trades with scroll
function TradeHistoryCompact({ trades, isLoading }: { trades: any[]; isLoading: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (!trades || trades.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        color: token.colorTextTertiary, 
        fontSize: token.fontSizeSM, 
        padding: token.paddingLG 
      }}>
        No trades
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        fontSize: token.fontSize,
        color: token.colorTextSecondary,
        fontWeight: fontWeights.semibold,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        marginBottom: token.marginXS,
      }}>
        <span style={{ flex: 1 }}>Price</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Size</span>
      </div>
      {/* Scrollable content - show ALL trades */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        minHeight: 0,
      }}>
        {trades.map((trade, idx) => (
          <div
            key={trade.trade_id || idx}
            style={{
              display: 'flex',
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              fontSize: token.fontSize,
              backgroundColor: idx % 2 === 0 
                ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(102, 126, 234, 0.02)')
                : 'transparent',
              transition: 'background-color 0.2s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark 
                ? 'rgba(255, 255, 255, 0.05)' 
                : 'rgba(102, 126, 234, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = idx % 2 === 0 
                ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(102, 126, 234, 0.02)')
                : 'transparent';
            }}
          >
            <span style={{ 
              flex: 1, 
              color: trade.side === 'BUY' ? '#52c41a' : '#ff4d4f',
              fontWeight: fontWeights.bold,
            }}>
              {parseFloat(trade.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ 
              flex: 1, 
              textAlign: 'right', 
              color: token.colorText,
              fontWeight: fontWeights.semibold,
            }}>
              {parseFloat(trade.size).toFixed(6)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Order Book - Two columns: Bids | Asks, shows all data
function OrderBookCompact({ orderBook, isLoading }: { orderBook: any; isLoading: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (!orderBook || (!orderBook.bids?.length && !orderBook.asks?.length)) {
    return (
      <div style={{ 
        textAlign: 'center', 
        color: token.colorTextTertiary, 
        fontSize: token.fontSizeSM, 
        padding: token.paddingLG 
      }}>
        No data
      </div>
    );
  }

  // Show ALL bids and asks
  const bids = orderBook.bids || [];
  const asks = orderBook.asks || [];
  const maxRows = Math.max(bids.length, asks.length);

  // Calculate max size for bar width
  const allSizes = [...bids, ...asks].map(o => parseFloat(o.size));
  const maxSize = Math.max(...allSizes, 0.0001);

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Two-column header */}
      <div style={{ display: 'flex', gap: token.marginMD }}>
        {/* Bids Header */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          fontSize: token.fontSize, 
          color: token.colorTextSecondary, 
          fontWeight: fontWeights.semibold, 
          borderBottom: `1px solid ${token.colorBorderSecondary}`, 
          padding: `${token.paddingSM}px ${token.paddingMD}px`,
          marginBottom: token.marginXS,
        }}>
          <span style={{ flex: 1 }}>Bid</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Size</span>
        </div>
        {/* Asks Header */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          fontSize: token.fontSize, 
          color: token.colorTextSecondary, 
          fontWeight: fontWeights.semibold, 
          borderBottom: `1px solid ${token.colorBorderSecondary}`, 
          padding: `${token.paddingSM}px ${token.paddingMD}px`,
          marginBottom: token.marginXS,
        }}>
          <span style={{ flex: 1 }}>Ask</span>
          <span style={{ flex: 1, textAlign: 'right' }}>Size</span>
        </div>
      </div>

      {/* Scrollable rows - show ALL data */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        minHeight: 0,
      }}>
        {Array.from({ length: maxRows }).map((_, idx) => {
          const bid = bids[idx];
          const ask = asks[idx];
          
          return (
            <div 
              key={idx} 
              style={{ 
                display: 'flex', 
                gap: token.marginMD,
                backgroundColor: idx % 2 === 0 
                  ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(102, 126, 234, 0.02)')
                  : 'transparent',
                padding: `${token.paddingXS}px ${token.paddingMD}px`,
                transition: 'background-color 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDark 
                  ? 'rgba(255, 255, 255, 0.05)' 
                  : 'rgba(102, 126, 234, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = idx % 2 === 0 
                  ? (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(102, 126, 234, 0.02)')
                  : 'transparent';
              }}
            >
              {/* Bid */}
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                padding: `${token.paddingXS}px 0`, 
                position: 'relative', 
                fontSize: token.fontSize,
              }}>
                {bid && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: `${(parseFloat(bid.size) / maxSize) * 100}%`,
                      backgroundColor: 'rgba(82, 196, 26, 0.15)',
                      zIndex: 0,
                    }} />
                    <span style={{ 
                      flex: 1, 
                      color: '#52c41a', 
                      position: 'relative', 
                      zIndex: 1,
                      fontWeight: fontWeights.bold,
                    }}>
                      {parseFloat(bid.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ 
                      flex: 1, 
                      textAlign: 'right', 
                      color: token.colorText, 
                      position: 'relative', 
                      zIndex: 1,
                      fontWeight: fontWeights.semibold,
                    }}>
                      {parseFloat(bid.size).toFixed(6)}
                    </span>
                  </>
                )}
              </div>
              {/* Ask */}
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                padding: `${token.paddingXS}px 0`, 
                position: 'relative', 
                fontSize: token.fontSize,
              }}>
                {ask && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `${(parseFloat(ask.size) / maxSize) * 100}%`,
                      backgroundColor: 'rgba(255, 77, 79, 0.15)',
                      zIndex: 0,
                    }} />
                    <span style={{ 
                      flex: 1, 
                      color: '#ff4d4f', 
                      position: 'relative', 
                      zIndex: 1,
                      fontWeight: fontWeights.bold,
                    }}>
                      {parseFloat(ask.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ 
                      flex: 1, 
                      textAlign: 'right', 
                      color: token.colorText, 
                      position: 'relative', 
                      zIndex: 1,
                      fontWeight: fontWeights.semibold,
                    }}>
                      {parseFloat(ask.size).toFixed(6)}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main page component
const ExchangePage: NextPageWithLayout = () => {
  return <ExchangePageContent />;
};

// Persistent layout - keeps DashboardLayout mounted across page navigations
ExchangePage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default ExchangePage;
