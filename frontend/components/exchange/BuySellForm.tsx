'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { theme, Button, Modal, Drawer, message, Input, Empty, Grid } from 'antd';
import { 
  SwapOutlined, 
  InfoCircleOutlined, 
  SearchOutlined,
  DownOutlined,
  CheckOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import { useExchange } from '@/context/ExchangeContext';
import { useAuth } from '@/context/AuthContext';
import { InternalOrder } from '@/services/api/coinbase';
import OrderStatusModal from './OrderStatusModal';
import PriceFormatter from './PriceFormatter';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type OrderSide = 'BUY' | 'SELL';

// Percentage chips component - minimal style
interface PercentageChipsProps {
  onPercentageClick: (percent: number) => void;
  token: any;
  isDark: boolean;
}

const PercentageChips: React.FC<PercentageChipsProps> = ({ onPercentageClick, token, isDark }) => (
  <div style={{
    display: 'flex',
    gap: token.marginXS,
    marginTop: token.marginSM,
  }}>
    {[25, 50, 75, 100].map((percent) => (
      <motion.div
        key={percent}
        onClick={() => onPercentageClick(percent)}
        whileTap={{ scale: 0.95 }}
        style={{
          flex: 1,
          padding: `6px 0`,
          fontSize: 12,
          fontWeight: fontWeights.semibold,
          color: isDark ? token.colorPrimary : '#799EFF',
          background: isDark ? token.colorPrimaryBg : '#ffffff',
          border: `1px solid ${isDark ? token.colorPrimaryBorder : 'rgba(121, 158, 255, 0.5)'}`,
          borderRadius: token.borderRadius,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          textAlign: 'center',
          boxShadow: isDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        {percent === 100 ? 'MAX' : `${percent}%`}
      </motion.div>
    ))}
  </div>
);

interface TradingPair {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  quote: string;
  baseCurrency: string;
  quoteCurrency: string;
  iconUrl: string;
  isDemoCollegeCoin?: boolean;
  permissions?: {
    allowBuy: boolean;
    allowSell: boolean;
    allowP2P: boolean;
    minTransactionAmount: number;
    maxTransactionAmount: number;
  };
}

interface BuySellFormProps {
  onTrade?: (side: OrderSide, asset: string, amount: number, total: number) => Promise<void>;
  isLoading?: boolean;
  initialAsset?: string;
}

const BuySellForm: React.FC<BuySellFormProps> = ({
  onTrade,
  isLoading = false,
  initialAsset,
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const { user } = useAuth();
  const isDark = mode === 'dark';
  const isLearnerMode = user?.appMode === 'LEARNER';
  
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isMobile = mounted ? !screens.md : true;
  
  const { 
    pairs, 
    isLoadingPairs, 
    getBalance, 
    isTrading,
    refreshBalances,
    refreshOrders,
    appMode,
    executeTrade,
  } = useExchange();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get only UGX pairs for simplicity
  // In learner mode, include college coins as well
  const usdPairs = useMemo(() => {
    return pairs
      .filter(p => {
        // Always include UGX pairs
        if (p.quote === 'UGX') {
          // In learner mode, include all UGX pairs (both regular and college coins)
          // In investor mode, exclude college coins
          if (isLearnerMode) return true;
          return !(p as TradingPair).isDemoCollegeCoin;
        }
        return false;
      })
      .sort((a, b) => {
        const aIsCollege = (a as TradingPair).isDemoCollegeCoin ? 1 : 0;
        const bIsCollege = (b as TradingPair).isDemoCollegeCoin ? 1 : 0;
        
        // In learner mode: college coins FIRST, then by volume
        // In investor mode: college coins hidden anyway, just sort by volume
        if (isLearnerMode && aIsCollege !== bIsCollege) {
          return bIsCollege - aIsCollege; // College coins first (1 > 0)
        }
        
        const aVol = (a as any)._usdVolume || 0;
        const bVol = (b as any)._usdVolume || 0;
        return bVol - aVol;
      });
  }, [pairs, isLearnerMode]);
  
  const [side, setSide] = useState<OrderSide>('BUY');
  const [selectedAsset, setSelectedAsset] = useState<string>(initialAsset || 'BTC');
  const [amount, setAmount] = useState<string>(''); // Token amount
  const [cashAmount, setCashAmount] = useState<string>(''); // UGX amount
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatusModalVisible, setOrderStatusModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InternalOrder | null>(null);
  const [isSimulatedFailure, setIsSimulatedFailure] = useState(false);
  
  // Update selected asset when initialAsset prop changes (e.g., from URL query)
  // Or when in learner mode, default to first college coin once pairs load
  useEffect(() => {
    if (initialAsset && initialAsset !== selectedAsset) {
      setSelectedAsset(initialAsset);
    } else if (!initialAsset && isLearnerMode && pairs.length > 0) {
      // Default to first college coin in learner mode
      const firstCollegeCoin = pairs.find(p => (p as TradingPair).isDemoCollegeCoin && p.quote === 'UGX');
      if (firstCollegeCoin && selectedAsset === 'BTC') {
        setSelectedAsset(firstCollegeCoin.baseCurrency);
      }
    }
  }, [initialAsset, isLearnerMode, pairs]);
  
  const loading = isLoading || isTrading || isSubmitting;
  const isBuy = side === 'BUY';

  // Get selected pair data
  const selectedPair = useMemo(() => {
    return usdPairs.find(p => p.baseCurrency === selectedAsset) || null;
  }, [usdPairs, selectedAsset]);

  const price = selectedPair?.price || 0;

  // Get permission restrictions from selected pair
  const permissions = (selectedPair as TradingPair | null)?.permissions;
  const isBuyRestricted = permissions && !permissions.allowBuy;
  const isSellRestricted = permissions && !permissions.allowSell;

  // Balances
  const cashBalance = getBalance('UGX');
  const tokenBalance = getBalance(selectedAsset);

  // Parsed amounts
  const amountNum = parseFloat(amount) || 0;
  const cashAmountNum = parseFloat(cashAmount) || 0;

  // Token-specific transaction limits (from admin settings)
  const tokenMinAmount = permissions?.minTransactionAmount || 0;
  const tokenMaxAmount = permissions?.maxTransactionAmount || 0;
  const isBelowTokenMin = tokenMinAmount > 0 && cashAmountNum > 0 && cashAmountNum < tokenMinAmount;
  const isAboveTokenMax = tokenMaxAmount > 0 && cashAmountNum > 0 && cashAmountNum > tokenMaxAmount;
  
  // Filter tokens for picker
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return usdPairs;
    const q = searchQuery.toLowerCase();
    return usdPairs.filter(
      p => p.baseCurrency.toLowerCase().includes(q) || 
           p.name.toLowerCase().includes(q)
    );
  }, [usdPairs, searchQuery]);
  
  // Reset form when asset changes
  useEffect(() => {
    setAmount('');
    setCashAmount('');
    setShowConfirm(false);
  }, [selectedAsset]);
  
  // Helper to restrict UGX input to 2 decimal places
  const restrictCashDecimals = (value: string): string => {
    // Allow empty string
    if (!value) return value;
    // Check if it has more than 2 decimal places
    const parts = value.split('.');
    if (parts.length === 2 && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].slice(0, 2)}`;
    }
    return value;
  };

  // Calculate token amount from cash (BUY)
  const handleCashAmountChange = (value: string) => {
    const restricted = restrictCashDecimals(value);
    setCashAmount(restricted);
    const num = parseFloat(restricted) || 0;
    if (num > 0 && price > 0) {
      setAmount((num / price).toFixed(8));
    } else {
      setAmount('');
    }
  };
  
  // Calculate cash amount from token (SELL)
  const handleTokenAmountChange = (value: string) => {
    setAmount(value);
    const num = parseFloat(value) || 0;
    if (num > 0 && price > 0) {
      const totalVal = num * price;
      const decimals = totalVal < 0.001 ? 8 : (totalVal < 1 ? 6 : 2);
      setCashAmount(totalVal.toFixed(decimals));
    } else {
      setCashAmount('');
    }
  };
  
  // Percentage buttons
  const handlePercentage = (percent: number) => {
    if (price <= 0) return;
    
    if (isBuy) {
      // For BUY: percentage of UGX balance
      const maxCash = percent === 100 
        ? Math.floor(cashBalance * 100) / 100 
        : cashBalance * (percent / 100);
      setCashAmount(maxCash.toFixed(2));
      if (price > 0) {
        setAmount((maxCash / price).toFixed(8));
      }
    } else {
      // For SELL: percentage of token balance
      const maxAmount = tokenBalance * (percent / 100);
      setAmount(maxAmount.toFixed(8));
      if (price > 0) {
        setCashAmount((maxAmount * price).toFixed(2));
      }
    }
  };
  
  // Handle trade submission
  const handleSubmit = async () => {
    if (!amountNum || !cashAmountNum || !selectedPair) return;
    
    // Validate balance
    if (isBuy && cashAmountNum > cashBalance + 0.01) {
      message.error(`Insufficient UGX balance. You need UGX ${cashAmountNum.toFixed(2)} but only have UGX ${cashBalance.toFixed(2)}`);
      setShowConfirm(false);
      return;
    }
    
    if (!isBuy && amountNum > tokenBalance) {
      message.error(`Insufficient ${selectedAsset} balance. You want to sell ${amountNum.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} but only have ${tokenBalance.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })}`);
      setShowConfirm(false);
      return;
    }
    
    setShowConfirm(false);
    setIsSubmitting(true);
    
    // Create pending order for immediate feedback
    const productId = `${selectedAsset}-UGX`;
    const pendingOrder: InternalOrder = {
      id: `pending-${Date.now()}`,
      transactionId: '',
      productId,
      asset: selectedAsset,
      quote: 'UGX',
      side,
      requestedAmount: isBuy ? cashAmountNum : amountNum,
      filledAmount: 0,
      price,
      totalValue: cashAmountNum,
      platformFee: fee,
      exchangeFee: 0,
      status: 'PENDING',
      coinbaseOrderId: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    
    // Show modal immediately with pending status
    setCurrentOrder(pendingOrder);
    setIsSimulatedFailure(false); // Reset simulated failure flag
    setOrderStatusModalVisible(true);
    
    try {
      if (onTrade) {
        await onTrade(side, selectedAsset, amountNum, cashAmountNum);
        // Update order to completed
        setCurrentOrder({
          ...pendingOrder,
          status: 'COMPLETED',
          filledAmount: amountNum,
          completedAt: new Date().toISOString(),
        });
      } else {
        // Use executeTrade from context - handles both learner and investor mode
        // Pass productId directly to avoid race condition with async state updates
        const result = await executeTrade(side, amountNum, cashAmountNum, productId);
        
        if (result.success && result.order) {
          // Update with actual order data
          setCurrentOrder(result.order);
          // Refresh balances and orders
          await Promise.all([refreshBalances(), refreshOrders()]);
          // Clear form on success
          setAmount('');
          setCashAmount('');
          
          // Handle simulated failure in learner mode - modal will show educational content
          if (result.isSimulatedFailure) {
            setIsSimulatedFailure(true);
          }
        } else {
          // Update order to failed
          setCurrentOrder({
            ...pendingOrder,
            status: 'FAILED',
          });
          
          // Track simulated failure for modal display
          if (result.isSimulatedFailure) {
            setIsSimulatedFailure(true);
          }
        }
      }
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Trade failed:', error);
      }
      // Update order to failed
      setCurrentOrder({
        ...pendingOrder,
        status: 'FAILED',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Fee calculation (0.5%)
  const fee = cashAmountNum * 0.005;
  
  // What user receives
  const receiveAmount = isBuy 
    ? amountNum 
    : cashAmountNum - fee;

  // Button disabled state - calculate once for consistent styling
  const isButtonDisabled =
    !selectedPair ||
    !cashAmountNum ||
    cashAmountNum <= 0 ||
    isBelowTokenMin ||
    isAboveTokenMax ||
    !amountNum ||
    amountNum <= 0 ||
    price <= 0 ||
    (isBuy && cashAmountNum > cashBalance + 0.01) ||
    (!isBuy && amountNum > tokenBalance) ||
    (isBuy && isBuyRestricted) ||
    (!isBuy && isSellRestricted);

  // State for fee details expansion
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  
  return (
    <div style={{
      backgroundColor: isMobile ? 'transparent' : token.colorBgContainer,
      borderRadius: isMobile ? 0 : token.borderRadiusLG,
      padding: isMobile ? 0 : token.paddingLG,
      maxWidth: 420,
      width: '100%',
    }}>
      {/* Buy/Sell Toggle - Tab style with underline */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        marginBottom: token.marginMD,
      }}>
        {(['BUY', 'SELL'] as OrderSide[]).map((s) => {
          const isActive = side === s;
          
          return (
            <div
              key={s}
              onClick={() => setSide(s)}
              style={{
                flex: 1,
                padding: `${token.paddingSM}px ${token.paddingMD}px`,
                cursor: 'pointer',
                fontSize: token.fontSize,
                fontWeight: isActive ? fontWeights.bold : fontWeights.medium,
                color: isActive 
                  ? (s === 'BUY' ? '#22C55E' : '#EF4444')
                  : token.colorTextTertiary,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {s === 'BUY' ? 'Buy' : 'Sell'}
              {isActive && (
                <motion.div
                  layoutId="buySellIndicator"
                  style={{
                    position: 'absolute',
                    bottom: -1,
                    left: '20%',
                    right: '20%',
                    height: 2,
                    background: s === 'BUY' ? '#22C55E' : '#EF4444',
                    borderRadius: 1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Token Selector - Clickable with rich purple gradient in light mode */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowTokenPicker(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginSM,
          padding: isMobile ? `${token.paddingSM}px ${token.paddingLG}px` : `${token.paddingMD}px ${token.paddingLG}px`,
          marginBottom: token.marginMD,
          cursor: 'pointer',
          borderRadius: token.borderRadius,
          // Light mode: rich purple gradient background with white text
          // Dark mode: keep claymorphic style
          background: isDark
            ? `linear-gradient(145deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)`
            : `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
          boxShadow: isDark
            ? `
              4px 4px 12px rgba(0,0,0,0.4),
              -2px -2px 8px rgba(139, 92, 246, 0.15),
              inset 2px 2px 4px rgba(255,255,255,0.05),
              inset -2px -2px 4px rgba(0,0,0,0.2)
            `
            : `0 4px 16px rgba(102, 126, 234, 0.4)`,
          border: isDark 
            ? '1px solid rgba(139, 92, 246, 0.2)' 
            : 'none',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!isDark) {
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDark) {
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.4)';
          }
        }}
      >
        {selectedPair ? (
          <>
            <img
              src={selectedPair.iconUrl}
              alt={selectedPair.baseCurrency}
              width={40}
              height={40}
              style={{ 
                borderRadius: '50%',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: `2px solid ${isDark ? 'transparent' : 'rgba(255, 255, 255, 0.4)'}`,
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selectedPair.baseCurrency}&background=667eea&color=fff&size=72`;
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                <span style={{ 
                  fontSize: token.fontSizeLG, 
                  color: isDark ? token.colorTextSecondary : 'rgba(255, 255, 255, 0.8)', 
                  fontWeight: fontWeights.semibold,
                }}>
                  {selectedPair.baseCurrency}
                </span>
                <span style={{ 
                  fontSize: token.fontSizeLG, 
                  color: isDark ? token.colorTextTertiary : 'rgba(255, 255, 255, 0.6)', 
                }}>
                  •
                </span>
                <span style={{ 
                  fontSize: token.fontSizeLG, 
                  color: isDark ? token.colorText : '#ffffff', 
                  fontWeight: fontWeights.bold,
                }}>
                  UGX {price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: price < 0.001 ? 8 : (price < 1 ? 6 : 2) })}
                </span>
              </div>
              <span style={{ 
                fontSize: token.fontSize, 
                color: isDark ? token.colorTextTertiary : 'rgba(255, 255, 255, 0.9)', 
                fontWeight: fontWeights.medium,
              }}>
                {selectedPair.name}
              </span>
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ 
                fontSize: token.fontSize, 
                color: isDark ? '#8B5CF6' : '#ffffff',
                fontWeight: fontWeights.bold,
              }}>
                Change
              </span>
              <DownOutlined style={{ 
                color: isDark ? '#8B5CF6' : '#ffffff', 
                fontSize: 18,
                fontWeight: fontWeights.bold,
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: isDark 
                ? `linear-gradient(135deg, ${token.colorPrimary}40, ${token.colorPrimary}20)`
                : 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isDark 
                ? 'inset 1px 1px 2px rgba(255,255,255,0.1), inset -1px -1px 2px rgba(0,0,0,0.2)'
                : 'none',
              border: isDark ? 'none' : '2px solid rgba(255, 255, 255, 0.4)',
            }}>
              <span style={{ fontSize: 20 }}>🪙</span>
            </div>
            <span style={{ 
              color: isDark ? token.colorText : '#ffffff', 
              flex: 1, 
              fontWeight: fontWeights.semibold,
              fontSize: token.fontSizeLG,
            }}>
              Select token
            </span>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ 
                fontSize: token.fontSize, 
                color: isDark ? '#8B5CF6' : '#ffffff',
                fontWeight: fontWeights.bold,
              }}>
                Change
              </span>
              <DownOutlined style={{ 
                color: isDark ? '#8B5CF6' : '#ffffff', 
                fontSize: 18,
                fontWeight: fontWeights.bold,
              }} />
            </div>
          </>
        )}
      </motion.div>
      
      {/* Amount Section */}
      <div style={{ marginBottom: token.marginMD }}>
        {/* Primary input (You pay / You sell) */}
        <div style={{ marginBottom: token.marginSM }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6,
          }}>
            <span style={{ 
              fontSize: token.fontSize, 
              color: isDark ? token.colorTextSecondary : token.colorText,
              fontWeight: fontWeights.medium,
            }}>
              {isBuy ? 'You pay' : 'You sell'}
            </span>
            <span 
              onClick={() => handlePercentage(100)}
              style={{ 
                fontSize: token.fontSizeSM, 
                color: isDark ? token.colorPrimary : '#667eea', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: fontWeights.semibold,
              }}
            >
              <WalletOutlined style={{ fontSize: token.fontSizeSM }} />
              {isBuy 
                ? `UGX ${cashBalance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `${tokenBalance.toFixed(tokenBalance < 1 ? 4 : 2)} ${selectedAsset}`
              }
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: isMobile 
              ? token.colorBgContainer 
              : (isDark ? token.colorBgLayout : '#ffffff'),
            borderRadius: token.borderRadius,
            padding: isMobile ? `${token.paddingSM}px` : `${token.paddingMD}px`,
            border: isMobile 
              ? `1px solid ${token.colorBorderSecondary}` 
              : (isDark ? 'none' : '1px solid rgba(0, 0, 0, 0.2)'),
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}>
            <input
              type="number"
              value={isBuy ? cashAmount : amount}
              onChange={(e) => isBuy ? handleCashAmountChange(e.target.value) : handleTokenAmountChange(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: isMobile ? 20 : 24,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                backgroundColor: 'transparent',
                minWidth: 0,
              }}
            />
            <span style={{ 
              color: isDark ? token.colorTextSecondary : token.colorText, 
              fontSize: token.fontSize, 
              fontWeight: fontWeights.semibold 
            }}>
              {isBuy ? 'UGX' : selectedAsset}
            </span>
          </div>
          
          {/* Percentage chips */}
          <PercentageChips onPercentageClick={handlePercentage} token={token} isDark={isDark} />
        </div>
        
        {/* Arrow divider */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          margin: isMobile ? 0 : `${token.marginSM}px 0`,
        }}>
          <SwapOutlined 
            rotate={90}
            style={{ 
              fontSize: 16, 
              color: token.colorTextTertiary,
              padding: 8,
              background: isMobile ? token.colorBgContainer : token.colorBgLayout,
              borderRadius: '50%',
              border: isMobile ? `1px solid ${token.colorBorderSecondary}` : 'none',
            }} 
          />
        </div>
        
        {/* Secondary input (You get) */}
        <div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ 
              fontSize: token.fontSize, 
              color: isDark ? token.colorTextSecondary : token.colorText,
              fontWeight: fontWeights.medium,
            }}>
              You get (estimate)
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: isMobile 
              ? token.colorBgContainer 
              : (isDark ? token.colorBgLayout : '#ffffff'),
            borderRadius: token.borderRadius,
            padding: isMobile ? `${token.paddingSM}px` : `${token.paddingMD}px`,
            border: isMobile 
              ? `1px solid ${token.colorBorderSecondary}` 
              : (isDark ? 'none' : '1px solid rgba(0, 0, 0, 0.2)'),
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}>
            <input
              type="number"
              value={isBuy ? amount : cashAmount}
              onChange={(e) => {
                if (isBuy) {
                  const v = e.target.value;
                  setAmount(v);
                  const num = parseFloat(v) || 0;
                  if (num > 0 && price > 0) {
                    const totalVal = num * price;
                    const decimals = totalVal < 0.001 ? 8 : (totalVal < 1 ? 6 : 2);
                    setCashAmount(totalVal.toFixed(decimals));
                  } else {
                    setCashAmount('');
                  }
                } else {
                  const v = restrictCashDecimals(e.target.value);
                  setCashAmount(v);
                  const num = parseFloat(v) || 0;
                  if (num > 0 && price > 0) {
                    setAmount((num / price).toFixed(8));
                  } else {
                    setAmount('');
                  }
                }
              }}
              placeholder="0.00"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: isMobile ? 20 : 24,
                fontWeight: fontWeights.bold,
                color: isBuy ? token.colorSuccess : token.colorText,
                backgroundColor: 'transparent',
                minWidth: 0,
              }}
            />
            <span style={{ 
              color: isDark ? token.colorTextSecondary : token.colorText, 
              fontSize: token.fontSize, 
              fontWeight: fontWeights.semibold 
            }}>
              {isBuy ? selectedAsset : 'UGX'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Permission Restriction Warnings */}
      <AnimatePresence>
        {permissions && isBuy && isBuyRestricted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              marginBottom: token.marginSM,
              fontSize: token.fontSize,
              color: token.colorError,
              fontWeight: fontWeights.medium,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            Buying {selectedAsset} is currently not available.
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {permissions && !isBuy && isSellRestricted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              marginBottom: token.marginSM,
              fontSize: token.fontSize,
              color: token.colorError,
              fontWeight: fontWeights.medium,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            Selling {selectedAsset} is currently not available.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token-specific Minimum Transaction Warning */}
      <AnimatePresence>
        {isBelowTokenMin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              marginBottom: token.marginSM,
              fontSize: token.fontSize,
              color: token.colorWarning,
              fontWeight: fontWeights.medium,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            Minimum transaction for {selectedAsset} is UGX {tokenMinAmount.toFixed(2)} (current: UGX {cashAmountNum.toFixed(2)})
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token-specific Maximum Transaction Warning */}
      <AnimatePresence>
        {isAboveTokenMax && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              marginBottom: token.marginSM,
              fontSize: token.fontSize,
              color: token.colorError,
              fontWeight: fontWeights.medium,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            Maximum transaction for {selectedAsset} is UGX {tokenMaxAmount.toFixed(2)} (current: UGX {cashAmountNum.toFixed(2)})
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insufficient Balance Warning - Minimal */}
      <AnimatePresence>
        {(cashAmountNum > 0 || amountNum > 0) && cashAmountNum >= 1 && (
          (isBuy && cashAmountNum > cashBalance + 0.01) || (!isBuy && amountNum > tokenBalance) ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                marginBottom: token.marginSM,
                fontSize: token.fontSize,
                color: token.colorError,
                fontWeight: fontWeights.medium,
              }}
            >
              <InfoCircleOutlined style={{ marginRight: 4 }} />
              {isBuy 
                ? `Insufficient funds (need UGX ${cashAmountNum.toFixed(2)})`
                : `Insufficient ${selectedAsset}`
              }
            </motion.div>
          ) : null
        )}
      </AnimatePresence>
      
      {/* Fee Summary - Collapsible */}
      <AnimatePresence>
        {cashAmountNum > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ marginBottom: token.marginMD }}
          >
            {/* Summary line - always visible */}
            <div 
              onClick={() => setShowFeeDetails(!showFeeDetails)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                padding: `${token.paddingXS}px 0`,
                fontSize: token.fontSize,
                color: isDark ? token.colorTextSecondary : token.colorText,
                fontWeight: fontWeights.medium,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Fee UGX {fee.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: fee < 0.001 ? 8 : (fee < 1 ? 6 : 2) })}
                <DownOutlined style={{ 
                  fontSize: 10, 
                  transform: showFeeDetails ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.2s',
                }} />
              </span>
              <span style={{ 
                color: isBuy ? token.colorSuccess : token.colorText, 
                fontWeight: fontWeights.semibold 
              }}>
                → {isBuy 
                  ? `${receiveAmount.toFixed(6)} ${selectedAsset}`
                  : `UGX ${receiveAmount.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: receiveAmount < 0.001 ? 8 : (receiveAmount < 1 ? 6 : 2) })}`
                }
              </span>
            </div>
            
            {/* Expanded details */}
            <AnimatePresence>
              {showFeeDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ 
                    fontSize: token.fontSizeSM, 
                    color: isDark ? token.colorTextTertiary : token.colorTextSecondary,
                    paddingTop: token.paddingXS,
                    borderTop: `1px dashed ${token.colorBorderSecondary}`,
                    marginTop: token.marginXS,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Price</span>
                    <span>UGX {price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: price < 1 ? 4 : 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Fee (0.5%)</span>
                    <span>UGX {fee.toFixed(2)}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Submit Button - Sticky on mobile */}
      {isMobile ? (
        <>
          {/* Sticky button container */}
          <div style={{
            position: 'fixed',
            bottom: 72, // Above navbar (72px nav + 16px margin + 16px padding - 10px)
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 420,
            padding: `${token.paddingSM}px 0`,
            paddingBottom: token.paddingMD,
            background: `linear-gradient(to top, ${token.colorBgLayout} 70%, transparent)`,
            zIndex: 100,
          }}>
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              disabled={isButtonDisabled}
              onClick={() => setShowConfirm(true)}
              style={{
                height: 48,
                borderRadius: token.borderRadius,
                fontWeight: fontWeights.bold,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontSize: token.fontSizeLG,
                background: isButtonDisabled 
                  ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')
                  : (isBuy ? token.colorSuccess : token.colorError),
                border: 'none',
                color: isButtonDisabled ? token.colorTextDisabled : '#ffffff',
                opacity: isButtonDisabled ? 0.7 : 1,
                cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {isBuy ? 'Buy' : 'Sell'} {selectedAsset}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            disabled={isButtonDisabled}
            onClick={() => setShowConfirm(true)}
            style={{
              height: 56,
              borderRadius: token.borderRadius,
              fontWeight: fontWeights.bold,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontSize: token.fontSizeLG,
              background: isButtonDisabled 
                ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')
                : (isBuy ? token.colorSuccess : token.colorError),
              border: 'none',
              color: isButtonDisabled ? token.colorTextDisabled : '#ffffff',
              opacity: isButtonDisabled ? 0.7 : 1,
              cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {isBuy ? 'Buy' : 'Sell'} {selectedAsset}
          </Button>
          
          {/* Market Order Info */}
          <div style={{
            marginTop: token.marginMD,
            fontSize: token.fontSizeSM,
            color: isDark ? token.colorTextTertiary : token.colorTextSecondary,
            textAlign: 'center',
            lineHeight: 1.5,
            fontWeight: fontWeights.medium,
          }}>
            Market order • Executes at best available price
          </div>
        </>
      )}
      
      {/* Token Picker - Drawer (bottom sheet) on mobile, Modal on desktop */}
      {isMobile ? (
        <Drawer
          title="Select Token"
          placement="bottom"
          open={showTokenPicker}
          onClose={() => {
            setShowTokenPicker(false);
            setSearchQuery('');
          }}
          height="70vh"
          zIndex={1100}
          styles={{
            header: {
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            },
            body: {
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <div style={{ padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                borderRadius: token.borderRadius,
                background: token.colorBgLayout,
              }}
              allowClear
            />
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: `0 ${token.paddingXS}px ${token.paddingSM}px`,
          }}>
            {filteredTokens.length === 0 ? (
              <Empty description="No tokens found" />
            ) : (
              filteredTokens.map((pair) => {
                const isSelected = pair.baseCurrency === selectedAsset;
                const balance = getBalance(pair.baseCurrency);
                
                return (
                  <div
                    key={pair.baseCurrency}
                    onClick={() => {
                      setSelectedAsset(pair.baseCurrency);
                      setShowTokenPicker(false);
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: token.marginSM,
                      padding: `${token.paddingSM}px ${token.paddingMD}px`,
                      cursor: 'pointer',
                      borderRadius: token.borderRadius,
                      backgroundColor: isSelected ? token.colorPrimaryBg : 'transparent',
                    }}
                  >
                    <img
                      src={pair.iconUrl}
                      alt={pair.baseCurrency}
                      width={40}
                      height={40}
                      style={{ borderRadius: '50%', flexShrink: 0 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.baseCurrency}&background=667eea&color=fff&size=80`;
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: fontWeights.semibold, color: token.colorText, fontSize: token.fontSize }}>
                          {pair.baseCurrency}
                        </span>
                        {(pair as TradingPair).isDemoCollegeCoin && (
                          <span style={{ fontSize: 10, color: '#fff', background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)', padding: '2px 6px', borderRadius: 4 }}>
                            College
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {pair.name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: token.fontSize, color: token.colorText, fontWeight: fontWeights.medium }}>
                        <PriceFormatter price={pair.price} />
                      </div>
                      {balance > 0 && (
                        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>{balance.toFixed(balance < 1 ? 4 : 2)}</div>
                      )}
                    </div>
                    {isSelected && <CheckOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />}
                  </div>
                );
              })
            )}
          </div>
        </Drawer>
      ) : (
        <Modal
          title="Select Token"
          open={showTokenPicker}
          onCancel={() => {
            setShowTokenPicker(false);
            setSearchQuery('');
          }}
          footer={null}
          width={480}
          centered
          destroyOnClose={false}
          styles={{
            header: {
              padding: `${token.paddingSM}px ${token.paddingMD}px`,
              marginBottom: 0,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            },
            body: {
              padding: 0,
            },
            mask: {
              backdropFilter: 'blur(4px)',
            },
          }}
        >
          <div style={{ padding: `${token.paddingSM}px ${token.paddingMD}px` }}>
            <Input
              prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Search tokens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                borderRadius: token.borderRadius,
                background: token.colorBgLayout,
              }}
              allowClear
            />
          </div>
          <div style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: `0 ${token.paddingXS}px ${token.paddingSM}px`,
          }}>
            {filteredTokens.length === 0 ? (
              <Empty description="No tokens found" />
            ) : (
              filteredTokens.map((pair) => {
                const isSelected = pair.baseCurrency === selectedAsset;
                const balance = getBalance(pair.baseCurrency);
                
                return (
                  <div
                    key={pair.baseCurrency}
                    onClick={() => {
                      setSelectedAsset(pair.baseCurrency);
                      setShowTokenPicker(false);
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: token.marginSM,
                      padding: `${token.paddingSM}px ${token.paddingMD}px`,
                      cursor: 'pointer',
                      borderRadius: token.borderRadius,
                      backgroundColor: isSelected 
                        ? token.colorPrimaryBg
                        : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = token.colorFillTertiary;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <img
                      src={pair.iconUrl}
                      alt={pair.baseCurrency}
                      width={40}
                      height={40}
                      style={{ borderRadius: '50%', flexShrink: 0 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${pair.baseCurrency}&background=667eea&color=fff&size=80`;
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontWeight: fontWeights.semibold,
                          color: token.colorText,
                          fontSize: token.fontSize,
                        }}>
                          {pair.baseCurrency}
                        </span>
                        {(pair as TradingPair).isDemoCollegeCoin && (
                          <span style={{
                            fontSize: 10,
                            color: '#fff',
                            background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}>
                            College
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: token.fontSizeSM,
                        color: token.colorTextTertiary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {pair.name}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: token.fontSize,
                        color: token.colorText,
                        fontWeight: fontWeights.medium,
                      }}>
                        <PriceFormatter price={pair.price} />
                      </div>
                      {balance > 0 && (
                        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
                          {balance.toFixed(balance < 1 ? 4 : 2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <CheckOutlined style={{ color: token.colorPrimary, fontSize: 16 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Modal>
      )}
      
      {/* Confirmation - Drawer on mobile, Modal on desktop */}
      {isMobile ? (
        <Drawer
          title={null}
          placement="bottom"
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          height="auto"
          zIndex={1100}
          closable={false}
          styles={{
            body: {
              padding: token.paddingLG,
            },
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: token.marginMD }}>
            <div style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
            }} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: token.marginLG }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: isBuy ? token.colorSuccess : token.colorError,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              marginBottom: token.marginSM,
            }}>
              {selectedPair && (
                <img
                  src={selectedPair.iconUrl}
                  alt={selectedAsset}
                  width={36}
                  height={36}
                  style={{ borderRadius: '50%' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selectedAsset}&background=667eea&color=fff&size=80`;
                  }}
                />
              )}
            </div>
            <div style={{
              fontSize: token.fontSizeLG,
              fontWeight: fontWeights.bold,
              color: token.colorText,
            }}>
              Confirm {side}
            </div>
          </div>
          
          <div style={{
            background: token.colorBgLayout,
            borderRadius: token.borderRadius,
            padding: token.paddingMD,
            marginBottom: token.marginLG,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Type</span>
              <span style={{ color: isBuy ? token.colorSuccess : token.colorError, fontWeight: fontWeights.bold, fontSize: token.fontSizeSM }}>
                Market {side}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Amount</span>
              <span style={{ color: token.colorText, fontWeight: fontWeights.semibold, fontSize: token.fontSizeSM }}>
                {amountNum.toFixed(6)} {selectedAsset}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Price</span>
              <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
                <PriceFormatter price={price} />
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Fee (0.5%)</span>
              <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
                <PriceFormatter price={fee} />
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: token.paddingSM,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}>
              <span style={{ color: token.colorTextSecondary }}>You {isBuy ? 'pay' : 'receive'}</span>
              <span style={{ color: token.colorText, fontWeight: fontWeights.bold }}>
                {isBuy 
                  ? `$${cashAmountNum.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: cashAmountNum < 1 ? 6 : 2 })}` 
                  : `$${receiveAmount.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: receiveAmount < 1 ? 6 : 2 })}`}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: token.marginSM, paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
            <Button
              size="large"
              onClick={() => setShowConfirm(false)}
              style={{ flex: 1, height: 48, borderRadius: token.borderRadius }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={loading}
              style={{
                flex: 1,
                height: 48,
                borderRadius: token.borderRadius,
                background: isBuy ? token.colorSuccess : token.colorError,
                border: 'none',
              }}
            >
              Confirm {side}
            </Button>
          </div>
        </Drawer>
      ) : (
        <Modal
          title={null}
          open={showConfirm}
          onCancel={() => setShowConfirm(false)}
          footer={null}
          centered
          width={360}
          zIndex={1100}
          styles={{
            body: {
              padding: token.paddingLG,
            },
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: token.marginMD }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: isBuy ? token.colorSuccess : token.colorError,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              marginBottom: token.marginSM,
            }}>
              {selectedPair && (
                <img
                  src={selectedPair.iconUrl}
                  alt={selectedAsset}
                  width={36}
                  height={36}
                  style={{ borderRadius: '50%' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${selectedAsset}&background=667eea&color=fff&size=80`;
                  }}
                />
              )}
            </div>
            <div style={{
              fontSize: token.fontSizeLG,
              fontWeight: fontWeights.bold,
              color: token.colorText,
            }}>
              Confirm {side}
            </div>
          </div>
          
          <div style={{
            background: token.colorBgLayout,
            borderRadius: token.borderRadius,
            padding: token.paddingMD,
            marginBottom: token.marginMD,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginXS }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Type</span>
              <span style={{ color: isBuy ? token.colorSuccess : token.colorError, fontWeight: fontWeights.bold, fontSize: token.fontSizeSM }}>
                Market {side}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginXS }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Amount</span>
              <span style={{ color: token.colorText, fontWeight: fontWeights.semibold, fontSize: token.fontSizeSM }}>
                {amountNum.toFixed(6)} {selectedAsset}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginXS }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Price</span>
              <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
                <PriceFormatter price={price} />
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginXS }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Fee (0.5%)</span>
              <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
                <PriceFormatter price={fee} />
              </span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingTop: token.paddingXS,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
              marginTop: token.marginXS,
            }}>
              <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>You {isBuy ? 'pay' : 'receive'}</span>
              <span style={{ color: token.colorText, fontWeight: fontWeights.bold, fontSize: token.fontSizeSM }}>
                {isBuy 
                  ? `$${cashAmountNum.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: cashAmountNum < 1 ? 6 : 2 })}` 
                  : `$${receiveAmount.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: receiveAmount < 1 ? 6 : 2 })}`}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: token.marginSM }}>
            <Button
              size="large"
              onClick={() => setShowConfirm(false)}
              style={{ flex: 1, height: 44, borderRadius: token.borderRadius }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={loading}
              style={{
                flex: 1,
                height: 44,
                borderRadius: token.borderRadius,
                background: isBuy ? token.colorSuccess : token.colorError,
                border: 'none',
              }}
            >
              Confirm {side}
            </Button>
          </div>
        </Modal>
      )}
      
      {/* Order Status Modal (Bottom Sheet on mobile) */}
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
    </div>
  );
};

export default BuySellForm;

