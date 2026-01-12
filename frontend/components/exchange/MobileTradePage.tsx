'use client';

import React, { useState } from 'react';
import { theme, Drawer, Skeleton } from 'antd';
import { HistoryOutlined, BookOutlined, UserOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import MobileTradeHeader from './MobileTradeHeader';
import TradeFormModal from './TradeFormModal';
import TradingChart from './TradingChart';
import PairSelector from './PairSelector';
import PriceFormatter from './PriceFormatter';

const { useToken } = theme;

interface TradingPair {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  quote: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  iconUrl?: string;
}

interface MobileTradePageProps {
  pairs: TradingPair[];
  selectedPair: string;
  onSelectPair: (symbol: string) => void;
  currentPrice: number;
  priceChange: number;
  iconUrl?: string;
  candles: any[];
  isLoadingCandles: boolean;
  candleGranularity: string;
  onGranularityChange: (gran: string) => void;
  orders: any[];
  isLoadingOrders: boolean;
  publicTrades: any[];
  isLoadingTrades: boolean;
  orderBook: any;
  isLoadingOrderBook: boolean;
  baseAsset: string;
  quoteAsset: string;
  baseBalance: number;
  quoteBalance: number;
  onTrade: (side: 'BUY' | 'SELL', amount: number, total: number) => Promise<void>;
  isTrading: boolean;
}

type TabKey = 'history' | 'orderbook' | 'myorders';

const MobileTradePage: React.FC<MobileTradePageProps> = ({
  pairs,
  selectedPair,
  onSelectPair,
  currentPrice,
  priceChange,
  iconUrl,
  candles,
  isLoadingCandles,
  candleGranularity,
  onGranularityChange,
  orders,
  isLoadingOrders,
  publicTrades,
  isLoadingTrades,
  orderBook,
  isLoadingOrderBook,
  baseAsset,
  quoteAsset,
  baseBalance,
  quoteBalance,
  onTrade,
  isTrading,
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [pairDrawerOpen, setPairDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('history');
  const [tradeModalVisible, setTradeModalVisible] = useState(false);
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');

  const handleOpenTrade = (side: 'BUY' | 'SELL') => {
    setTradeSide(side);
    setTradeModalVisible(true);
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'history', label: 'History', icon: <HistoryOutlined /> },
    { key: 'orderbook', label: 'Order Book', icon: <BookOutlined /> },
    { key: 'myorders', label: 'My Orders', icon: <UserOutlined /> },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: isDark 
          ? 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)'
          : 'linear-gradient(180deg, #f8f9fc 0%, #ffffff 100%)',
      }}
    >
      {/* Header with Token Selector */}
      <MobileTradeHeader
        pair={selectedPair}
        price={currentPrice}
        priceChange={priceChange}
        iconUrl={iconUrl}
        onPairClick={() => setPairDrawerOpen(true)}
      />

      {/* Chart Section - fixed height with overflow hidden */}
      <div
        style={{
          flexShrink: 0,
          flexGrow: 0,
          height: 180,
          padding: `0 ${token.paddingMD}px`,
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          overflow: 'hidden',
        }}
      >
        <TradingChart
          candles={candles}
          isLoading={isLoadingCandles}
          granularity={candleGranularity}
          onGranularityChange={onGranularityChange}
        />
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          padding: `${token.paddingXS}px ${token.paddingMD}px`,
          gap: token.marginXS,
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'}`,
          background: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.01)',
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: `${token.paddingSM}px`,
              borderRadius: 10,
              fontSize: token.fontSizeSM,
              fontWeight: activeTab === tab.key ? fontWeights.bold : fontWeights.medium,
              color: activeTab === tab.key 
                ? (isDark ? '#ffffff' : '#6366F1')
                : token.colorTextSecondary,
              backgroundColor: activeTab === tab.key 
                ? (isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)')
                : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </div>
        ))}
      </div>

      {/* Tab Content - with bottom padding for fixed buttons + nav bar */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: `${token.paddingSM}px ${token.paddingMD}px`,
          paddingBottom: 150, // Space for fixed buttons (48px) + nav bar (~100px)
        }}
      >
        {activeTab === 'history' && (
          <TradeHistoryMobile trades={publicTrades} isLoading={isLoadingTrades} />
        )}
        {activeTab === 'orderbook' && (
          <OrderBookMobile orderBook={orderBook} isLoading={isLoadingOrderBook} />
        )}
        {activeTab === 'myorders' && (
          <MyOrdersMobile orders={orders} isLoading={isLoadingOrders} />
        )}
      </div>

      {/* Compact Buy/Sell Buttons - positioned above bottom nav */}
      <div
        style={{
          position: 'fixed',
          bottom: 90, // Above bottom nav (72px height + 16px margin + 16px spacing)
          left: token.paddingMD,
          right: token.paddingMD,
          display: 'flex',
          gap: token.marginSM,
          zIndex: 90,
        }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handleOpenTrade('BUY')}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 20,
            border: 'none',
            background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
            color: '#ffffff',
            fontSize: token.fontSizeSM,
            fontWeight: fontWeights.bold,
            letterSpacing: '0.03em',
            cursor: 'pointer',
            boxShadow: isDark 
              ? '0 4px 16px rgba(34, 197, 94, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)'
              : '0 4px 12px rgba(34, 197, 94, 0.35)',
          }}
        >
          BUY {baseAsset}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => handleOpenTrade('SELL')}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 20,
            border: 'none',
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            color: '#ffffff',
            fontSize: token.fontSizeSM,
            fontWeight: fontWeights.bold,
            letterSpacing: '0.03em',
            cursor: 'pointer',
            boxShadow: isDark 
              ? '0 4px 16px rgba(239, 68, 68, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)'
              : '0 4px 12px rgba(239, 68, 68, 0.35)',
          }}
        >
          SELL {baseAsset}
        </motion.button>
      </div>

      {/* Pair Selector Drawer */}
      <Drawer
        title="Select Trading Pair"
        placement="bottom"
        height="70vh"
        open={pairDrawerOpen}
        onClose={() => setPairDrawerOpen(false)}
        zIndex={token.zIndexPopupBase + 100}
        styles={{ 
          body: { padding: token.paddingMD },
          header: { 
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          },
        }}
      >
        <PairSelector
          pairs={pairs}
          selectedPair={selectedPair}
          onSelectPair={(symbol) => {
            onSelectPair(symbol);
            setPairDrawerOpen(false);
          }}
        />
      </Drawer>

      {/* Trade Form Modal */}
      <TradeFormModal
        visible={tradeModalVisible}
        onClose={() => setTradeModalVisible(false)}
        side={tradeSide}
        symbol={selectedPair}
        price={currentPrice}
        baseAsset={baseAsset}
        quoteAsset={quoteAsset}
        baseBalance={baseBalance}
        quoteBalance={quoteBalance}
        onTrade={onTrade}
        isLoading={isTrading}
      />
    </div>
  );
};

// Trade History Component for Mobile
function TradeHistoryMobile({ trades, isLoading }: { trades: any[]; isLoading: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (!trades || trades.length === 0) {
    return (
      <div style={{ 
        padding: token.paddingXL, 
        textAlign: 'center', 
        color: token.colorTextTertiary,
      }}>
        <HistoryOutlined style={{ fontSize: 32, marginBottom: token.marginSM, opacity: 0.3 }} />
        <div>No trades yet</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: `${token.paddingXS}px 0`,
        marginBottom: token.marginXS,
        fontSize: token.fontSizeSM,
        color: token.colorTextSecondary,
        fontWeight: fontWeights.semibold,
      }}>
        <span style={{ flex: 1 }}>Price</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Size</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Time</span>
      </div>
      
      {/* Trades */}
      {trades.slice(0, 20).map((trade, idx) => (
        <div
          key={trade.trade_id || idx}
          style={{
            display: 'flex',
            padding: `${token.paddingSM}px 0`,
            borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'}`,
            fontSize: token.fontSize,
          }}
        >
          <span style={{ 
            flex: 1, 
            color: trade.side === 'BUY' ? '#22C55E' : '#EF4444',
            fontWeight: fontWeights.semibold,
          }}>
            <PriceFormatter price={Number(trade.price)} />
          </span>
          <span style={{ flex: 1, textAlign: 'right', color: token.colorText }}>
            {parseFloat(trade.size).toFixed(6)}
          </span>
          <span style={{ flex: 1, textAlign: 'right', color: token.colorTextTertiary, fontSize: token.fontSizeSM }}>
            {new Date(trade.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}

// Order Book Component for Mobile
function OrderBookMobile({ orderBook, isLoading }: { orderBook: any; isLoading: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (!orderBook || (!orderBook.bids?.length && !orderBook.asks?.length)) {
    return (
      <div style={{ 
        padding: token.paddingXL, 
        textAlign: 'center', 
        color: token.colorTextTertiary,
      }}>
        <BookOutlined style={{ fontSize: 32, marginBottom: token.marginSM, opacity: 0.3 }} />
        <div>No order book data</div>
      </div>
    );
  }

  const bids = orderBook.bids?.slice(0, 8) || [];
  const asks = orderBook.asks?.slice(0, 8) || [];
  const maxSize = Math.max(
    ...bids.map((b: any) => parseFloat(b.size)),
    ...asks.map((a: any) => parseFloat(a.size)),
    0.0001
  );

  return (
    <div style={{ display: 'flex', gap: token.marginMD }}>
      {/* Bids */}
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: token.fontSizeSM, 
          color: '#22C55E', 
          fontWeight: fontWeights.bold, 
          marginBottom: token.marginSM,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Bids
        </div>
        {bids.map((bid: any, idx: number) => (
          <div
            key={idx}
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'space-between',
              padding: `${token.paddingXS}px ${token.paddingSM}px`,
              fontSize: token.fontSizeSM,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: `${(parseFloat(bid.size) / maxSize) * 100}%`,
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                borderRadius: 4,
              }}
            />
            <span style={{ color: '#22C55E', fontWeight: fontWeights.semibold, zIndex: 1 }}>
              <PriceFormatter price={parseFloat(bid.price)} />
            </span>
            <span style={{ color: token.colorText, zIndex: 1 }}>
              {parseFloat(bid.size).toFixed(4)}
            </span>
          </div>
        ))}
      </div>

      {/* Asks */}
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: token.fontSizeSM, 
          color: '#EF4444', 
          fontWeight: fontWeights.bold, 
          marginBottom: token.marginSM,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Asks
        </div>
        {asks.map((ask: any, idx: number) => (
          <div
            key={idx}
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'space-between',
              padding: `${token.paddingXS}px ${token.paddingSM}px`,
              fontSize: token.fontSizeSM,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: `${(parseFloat(ask.size) / maxSize) * 100}%`,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderRadius: 4,
              }}
            />
            <span style={{ color: '#EF4444', fontWeight: fontWeights.semibold, zIndex: 1 }}>
              <PriceFormatter price={parseFloat(ask.price)} />
            </span>
            <span style={{ color: token.colorText, zIndex: 1 }}>
              {parseFloat(ask.size).toFixed(4)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// My Orders Component for Mobile
function MyOrdersMobile({ orders, isLoading }: { orders: any[]; isLoading: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (!orders || orders.length === 0) {
    return (
      <div style={{ 
        padding: token.paddingXL, 
        textAlign: 'center', 
        color: token.colorTextTertiary,
      }}>
        <UserOutlined style={{ fontSize: 32, marginBottom: token.marginSM, opacity: 0.3 }} />
        <div>No orders yet</div>
        <div style={{ fontSize: token.fontSizeSM, marginTop: token.marginXS }}>
          Your orders will appear here
        </div>
      </div>
    );
  }

  return (
    <div>
      {orders.slice(0, 15).map((order, idx) => (
        <div
          key={order.id || idx}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: token.marginXS,
            padding: `${token.paddingMD}px`,
            marginBottom: token.marginSM,
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
              <span style={{ 
                color: order.side === 'BUY' ? '#22C55E' : '#EF4444',
                fontWeight: fontWeights.bold,
                fontSize: token.fontSizeSM,
                padding: `2px ${token.paddingXS}px`,
                backgroundColor: order.side === 'BUY' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                borderRadius: 4,
              }}>
                {order.side}
              </span>
              <span style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
                {order.productId}
              </span>
            </div>
            <span style={{ 
              fontSize: token.fontSizeSM, 
              color: order.status === 'COMPLETED' ? '#22C55E' : token.colorTextSecondary,
              fontWeight: fontWeights.medium,
            }}>
              {order.status}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: token.fontSizeSM }}>
            <span style={{ color: token.colorTextSecondary }}>
              {order.filledAmount?.toFixed(6) || order.requestedAmount?.toFixed(6)} @ <PriceFormatter price={order.price} />
            </span>
            <span style={{ color: token.colorText, fontWeight: fontWeights.semibold }}>
              ${order.totalValue?.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: order.totalValue < 1 ? 6 : 2 
              })}
            </span>
          </div>
          <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
            {new Date(order.createdAt).toLocaleString('en-US', { 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit', 
              minute: '2-digit',
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MobileTradePage;

