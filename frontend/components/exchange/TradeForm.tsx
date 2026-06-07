'use client';

import React, { useState, useEffect } from 'react';
import { theme, Button, Modal, message } from 'antd';
import { SwapOutlined, InfoCircleOutlined, ThunderboltOutlined, ClockCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { useThemeMode } from '@/context/ThemeContext';
import { useExchange } from '@/context/ExchangeContext';
import Image from 'next/image';
import PriceFormatter from './PriceFormatter';

const { useToken } = theme;

type OrderSide = 'BUY' | 'SELL';

interface TradeFormProps {
  symbol: string;
  price: number;
  baseAsset: string;
  quoteAsset: string;
  baseBalance?: number;
  quoteBalance?: number;
  onTrade?: (side: OrderSide, amount: number, total: number) => Promise<void>;
  isLoading?: boolean;
}

const TradeForm: React.FC<TradeFormProps> = ({
  symbol,
  price,
  baseAsset,
  quoteAsset,
  baseBalance = 0,
  quoteBalance = 0,
  onTrade,
  isLoading = false,
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const { pairs, currentPairData } = useExchange();
  const isDark = mode === 'dark';
  const [side, setSide] = useState<OrderSide>('BUY');

  // Get permission restrictions from current pair
  const permissions = currentPairData?.permissions;
  const isBuyRestricted = permissions && !permissions.allowBuy;
  const isSellRestricted = permissions && !permissions.allowSell;
  const [amount, setAmount] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const loading = isLoading;

  const isBuy = side === 'BUY';
  const amountNum = parseFloat(amount) || 0;
  const totalNum = parseFloat(total) || 0;
  
  // Calculate INR value for transaction limit checks.
  // For INR pairs: totalNum is already in INR.
  // For non-UGX pairs (USDT, ETH, TUIT): convert via quote-UGX pair price.
  const getInrValue = (): number => {
    if (quoteAsset === 'UGX') return totalNum;
    const quoteInrPair = pairs.find(p => p.symbol === `${quoteAsset}-UGX`);
    if (quoteInrPair && quoteInrPair.price > 0) {
      return totalNum * quoteInrPair.price;
    }
    return 0;
  };

  const inrValue = getInrValue();

  // Token-specific transaction limits (from admin settings, denominated in INR)
  const tokenMinAmount = permissions?.minTransactionAmount || 0;
  const tokenMaxAmount = permissions?.maxTransactionAmount || 0;
  const isBelowTokenMin = tokenMinAmount > 0 && totalNum > 0 && inrValue < tokenMinAmount;
  const isAboveTokenMax = tokenMaxAmount > 0 && totalNum > 0 && inrValue > tokenMaxAmount;

  // Reset form when pair changes
  useEffect(() => {
    setAmount('');
    setTotal('');
    setShowConfirm(false);
  }, [symbol, baseAsset, quoteAsset]);

  // Calculate total when amount changes
  const handleAmountChange = (value: string) => {
    setAmount(value);
    const num = parseFloat(value) || 0;
    if (num > 0 && price > 0) {
      const totalValue = num * price;
      // High precision for sub-penny totals
      let decimals = 8;
      if (quoteAsset === 'UGX') {
        decimals = totalValue < 0.001 ? 8 : (totalValue < 1 ? 6 : 2);
      }
      setTotal(totalValue.toFixed(decimals));
    } else {
      setTotal('');
    }
  };

  // Calculate amount when total changes
  const handleTotalChange = (value: string) => {
    setTotal(value);
    const num = parseFloat(value) || 0;
    if (num > 0 && price > 0) {
      setAmount((num / price).toFixed(8));
    } else {
      setAmount('');
    }
  };

  // Percentage buttons
  const handlePercentage = (percent: number) => {
    if (price <= 0) return; // Don't calculate if price is invalid
    
    // For USD, use dynamic precision based on value size
    const totalDecimals = quoteAsset === 'UGX' ? 6 : 8; 
    // Use appropriate precision multiplier
    const precisionMultiplier = quoteAsset === 'UGX' ? 100 : 100000000; 
    
    if (isBuy) {
      // For BUY: user pays the total amount
      const maxTotal = percent === 100 
        ? Math.floor(quoteBalance * precisionMultiplier) / precisionMultiplier
        : quoteBalance * (percent / 100);
        
      // If USD value is > 1 use 2 decimals, otherwise 6
      const decimals = (quoteAsset === 'UGX' && maxTotal >= 1) ? 2 : totalDecimals;
      
      setTotal(maxTotal.toFixed(decimals));
      if (price > 0) {
        setAmount((maxTotal / price).toFixed(8));
      }
    } else {
      // For SELL: user sells base asset
      const maxAmount = percent === 100
        ? Math.floor(baseBalance * 100000000) / 100000000
        : baseBalance * (percent / 100);
      setAmount(maxAmount.toFixed(8));
      if (price > 0) {
        const totalVal = maxAmount * price;
        const decimals = quoteAsset === 'UGX' ? (totalVal < 0.001 ? 8 : (totalVal < 1 ? 6 : 2)) : 8;
        setTotal(totalVal.toFixed(decimals));
      }
    }
  };

  // Handle trade submission
  const handleSubmit = async () => {
    if (!amountNum || !totalNum) return;
    
    // Double-check balance before submitting (in case balance changed)
    // For BUY: user pays totalNum (which includes our fee already deducted from amount sent to Coinbase)
    // So we check if they have enough for totalNum
    // Use small tolerance (0.01) for floating point precision issues
    if (isBuy && totalNum > quoteBalance + 0.01) {
      if (quoteBalance === 0) {
        message.error(`You don't have any ${quoteAsset} to complete this trade`);
      } else {
        message.error(`Insufficient ${quoteAsset} balance. You need ${totalNum.toFixed(2)} but only have ${quoteBalance.toFixed(2)}`);
      }
      setShowConfirm(false);
      return;
    }
    
    if (!isBuy && amountNum > baseBalance) {
      if (baseBalance === 0) {
        message.error(`You don't have any ${baseAsset} to sell`);
      } else {
        message.error(`Insufficient ${baseAsset} balance. You want to sell ${amountNum.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} but only have ${baseBalance.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })}`);
      }
      setShowConfirm(false);
      return;
    }
    
    setShowConfirm(false);
    
    try {
      if (onTrade) {
        await onTrade(side, amountNum, totalNum);
      }
      // Only clear form if trade was successful
      setAmount('');
      setTotal('');
    } catch (error: any) {
      // Error should already be handled by onTrade callback
      // This catch is just to prevent unhandled promise rejection
      if (process.env.NODE_ENV === 'development') {
        console.error('Trade failed in TradeForm:', error);
      }
    }
  };

  // Fee calculation (0.5%)
  // For BUY: fee on requested amount (totalNum)
  // For SELL: fee on user's perceived value (amountNum * price)
  const fee = isBuy 
    ? totalNum * 0.005  // BUY: fee on what user wants to spend
    : amountNum * price * 0.005;  // SELL: fee on user's perceived value (amount * price)
  
  // What user receives
  // BUY: amount of base asset (no fee deduction, fee is on quote)
  // SELL: total value minus our fee (but we need to account for Coinbase fees too - estimated)
  const receiveAmount = isBuy 
    ? amountNum  // BUY: user receives the amount of base asset
    : (amountNum * price) - fee;  // SELL: user receives perceived value minus our fee

  // Button disabled state - calculate once for consistent styling
  const isButtonDisabled =
    !amountNum ||
    amountNum <= 0 ||
    !totalNum ||
    totalNum <= 0 ||
    price <= 0 ||
    isBelowTokenMin ||
    isAboveTokenMax ||
    (isBuy && totalNum > quoteBalance + 0.01) ||
    (!isBuy && amountNum > baseBalance) ||
    (isBuy && isBuyRestricted) ||
    (!isBuy && isSellRestricted);

  // Custom input with addon - proper rounded corners
  const InputWithAddon = ({ 
    value, 
    onChange, 
    addon, 
    placeholder 
  }: { 
    value: string; 
    onChange: (v: string) => void; 
    addon: string; 
    placeholder: string;
  }) => (
    <div style={{
      display: 'flex',
      border: `2px solid ${token.colorBorder}`,
      borderRadius: token.borderRadiusSM,
      overflow: 'hidden',
      backgroundColor: token.colorBgContainer,
    }}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: `${token.paddingSM}px ${token.paddingMD}px`,
          border: 'none',
          outline: 'none',
          fontSize: token.fontSizeLG,
          fontWeight: fontWeights.medium,
          color: token.colorText,
          backgroundColor: 'transparent',
          minWidth: 0,
        }}
      />
      <div style={{
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        backgroundColor: token.colorBgLayout,
        color: token.colorTextSecondary,
        fontSize: token.fontSizeSM,
        fontWeight: fontWeights.semibold,
        display: 'flex',
        alignItems: 'center',
        borderLeft: `1px solid ${token.colorBorder}`,
      }}>
        {addon}
      </div>
    </div>
  );

  return (
    <div>
      {/* Buy/Sell Toggle - Segmented Control Style */}
      <div style={{
        display: 'flex',
        marginBottom: token.marginMD,
        gap: token.marginXS,
      }}>
        {/* Buy Toggle */}
        <div
          onClick={() => setSide('BUY')}
          style={{
            flex: 1,
            padding: `${token.paddingSM}px ${token.paddingMD}px`,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: side === 'BUY' ? 'rgba(24, 144, 255, 0.15)' : 'transparent',
            borderBottom: side === 'BUY' ? `3px solid #1890ff` : `1px solid ${token.colorBorderSecondary}`,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (side !== 'BUY') {
              e.currentTarget.style.borderBottomColor = '#1890ff';
              e.currentTarget.style.borderBottomWidth = '2px';
              e.currentTarget.style.backgroundColor = 'rgba(24, 144, 255, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (side !== 'BUY') {
              e.currentTarget.style.borderBottomColor = token.colorBorderSecondary;
              e.currentTarget.style.borderBottomWidth = '1px';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <span style={{
            fontSize: token.fontSize,
            fontWeight: side === 'BUY' ? fontWeights.bold : fontWeights.medium,
            color: side === 'BUY' ? '#1890ff' : token.colorTextSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Buy
          </span>
        </div>
        {/* Sell Toggle */}
        <div
          onClick={() => setSide('SELL')}
          style={{
            flex: 1,
            padding: `${token.paddingSM}px ${token.paddingMD}px`,
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: side === 'SELL' ? 'rgba(255, 77, 79, 0.15)' : 'transparent',
            borderBottom: side === 'SELL' ? `3px solid #ff4d4f` : `1px solid ${token.colorBorderSecondary}`,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (side !== 'SELL') {
              e.currentTarget.style.borderBottomColor = '#ff4d4f';
              e.currentTarget.style.borderBottomWidth = '2px';
              e.currentTarget.style.backgroundColor = 'rgba(255, 77, 79, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (side !== 'SELL') {
              e.currentTarget.style.borderBottomColor = token.colorBorderSecondary;
              e.currentTarget.style.borderBottomWidth = '1px';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <span style={{
            fontSize: token.fontSize,
            fontWeight: side === 'SELL' ? fontWeights.bold : fontWeights.medium,
            color: side === 'SELL' ? '#ff4d4f' : token.colorTextSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Sell
          </span>
        </div>
      </div>

      {/* Price Display - minimal */}
      <div style={{
        marginBottom: token.marginMD,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
          Price
        </span>
        <span style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: token.colorText }}>
          <PriceFormatter price={price} quote={quoteAsset} />
        </span>
      </div>

      {/* Amount Input */}
      <div style={{ marginBottom: token.marginSM }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: token.marginXS,
        }}>
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
            Amount
          </span>
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
            Avail: {baseBalance.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} {baseAsset}
          </span>
        </div>
        <InputWithAddon
          value={amount}
          onChange={handleAmountChange}
          addon={baseAsset}
          placeholder="0.00"
        />
      </div>

      {/* Percentage Buttons - minimal */}
      <div style={{
        display: 'flex',
        gap: token.marginXS,
        marginBottom: token.marginSM,
      }}>
        {[25, 50, 75, 100].map((percent) => (
          <div
            key={percent}
            onClick={() => handlePercentage(percent)}
            style={{
              flex: 1,
              padding: `${token.paddingXS}px 0`,
              textAlign: 'center',
              fontSize: token.fontSizeSM,
              fontWeight: fontWeights.medium,
              color: token.colorTextTertiary,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {percent}%
          </div>
        ))}
      </div>

      {/* Swap Icon */}
      <div style={{ textAlign: 'center', marginBottom: token.marginSM }}>
        <SwapOutlined 
          rotate={90}
          style={{ 
            fontSize: 14, 
            color: token.colorTextTertiary,
          }} 
        />
      </div>

      {/* Total Input */}
      <div style={{ marginBottom: token.marginMD }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: token.marginXS,
        }}>
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
            Total
          </span>
          <span style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>
            Avail: {quoteAsset === 'UGX'
              ? `UGX ${quoteBalance.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `${quoteBalance.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${quoteAsset}`
            }
          </span>
        </div>
        <InputWithAddon
          value={total}
          onChange={handleTotalChange}
          addon={quoteAsset}
          placeholder="0.00"
        />
      </div>

      {/* Permission Restriction Warnings */}
      <AnimatePresence>
        {permissions && isBuy && isBuyRestricted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: token.marginSM,
              padding: token.paddingSM,
              backgroundColor: token.colorErrorBg,
              borderRadius: token.borderRadiusSM,
              border: `1px solid ${token.colorErrorBorder}`,
              fontSize: token.fontSizeSM,
              color: token.colorError,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: token.marginXS }} />
            Buying {baseAsset} is currently not available.
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {permissions && !isBuy && isSellRestricted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: token.marginSM,
              padding: token.paddingSM,
              backgroundColor: token.colorErrorBg,
              borderRadius: token.borderRadiusSM,
              border: `1px solid ${token.colorErrorBorder}`,
              fontSize: token.fontSizeSM,
              color: token.colorError,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: token.marginXS }} />
            Selling {baseAsset} is currently not available.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token-specific Minimum Transaction Warning */}
      <AnimatePresence>
        {isBelowTokenMin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: token.marginSM,
              padding: token.paddingSM,
              backgroundColor: token.colorWarningBg,
              borderRadius: token.borderRadiusSM,
              border: `1px solid ${token.colorWarningBorder}`,
              fontSize: token.fontSizeSM,
              color: token.colorWarning,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: token.marginXS }} />
            Minimum transaction for {baseAsset} is UGX {tokenMinAmount.toFixed(2)} (current: UGX {inrValue.toFixed(2)})
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token-specific Maximum Transaction Warning */}
      <AnimatePresence>
        {isAboveTokenMax && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: token.marginSM,
              padding: token.paddingSM,
              backgroundColor: token.colorErrorBg,
              borderRadius: token.borderRadiusSM,
              border: `1px solid ${token.colorErrorBorder}`,
              fontSize: token.fontSizeSM,
              color: token.colorError,
            }}
          >
            <InfoCircleOutlined style={{ marginRight: token.marginXS }} />
            Maximum transaction for {baseAsset} is UGX {tokenMaxAmount.toFixed(2)} (current: UGX {inrValue.toFixed(2)})
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insufficient Balance Warning */}
      <AnimatePresence>
        {amountNum > 0 && (
          (isBuy && totalNum > quoteBalance + 0.01) || (!isBuy && amountNum > baseBalance) ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginBottom: token.marginSM,
                padding: token.paddingSM,
                backgroundColor: token.colorErrorBg,
                borderRadius: token.borderRadiusSM,
                border: `1px solid ${token.colorErrorBorder}`,
                fontSize: token.fontSizeSM,
                color: token.colorError,
              }}
            >
              <InfoCircleOutlined style={{ marginRight: token.marginXS }} />
              Insufficient balance. {isBuy 
                ? quoteBalance === 0 
                  ? `You don't have any ${quoteAsset} to complete this trade`
                  : totalNum > quoteBalance + 0.01
                    ? `You need ${totalNum.toFixed(2)} ${quoteAsset} but only have ${quoteBalance.toFixed(2)}`
                    : null
                : baseBalance === 0
                  ? `You don't have any ${baseAsset} to sell`
                  : amountNum > baseBalance
                    ? `You want to sell ${amountNum.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${baseAsset} but only have ${baseBalance.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 8 })}`
                    : null
              }
            </motion.div>
          ) : null
        )}
      </AnimatePresence>

      {/* Fee Info - inline */}
      <AnimatePresence>
        {amountNum > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginBottom: token.marginMD,
              fontSize: 11,
              color: token.colorTextSecondary,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>Fee (0.5%)</span>
              <span>
                {quoteAsset === 'UGX'
                  ? `UGX ${fee.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: fee < 0.001 ? 8 : (fee < 1 ? 6 : 2) })}`
                  : `${fee.toFixed(8)} ${quoteAsset}`
                }
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>You {isBuy ? 'receive' : 'get'}</span>
              <span style={{ color: token.colorText, fontWeight: fontWeights.semibold }}>
                {isBuy 
                  ? `${receiveAmount.toFixed(6)} ${baseAsset}`
                  : quoteAsset === 'UGX'
                  ? `UGX ${receiveAmount.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: receiveAmount < 0.001 ? 8 : (receiveAmount < 1 ? 6 : 2) })}`
                  : `${receiveAmount.toFixed(8)} ${quoteAsset}`
                }
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit Button */}
      <Button
        type="primary"
        size="large"
        block
        loading={loading}
        disabled={isButtonDisabled}
        onClick={() => setShowConfirm(true)}
        style={{
          height: token.controlHeightLG,
          borderRadius: token.borderRadiusSM,
          fontWeight: fontWeights.bold,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontSize: token.fontSize,
          background: isButtonDisabled 
            ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')
            : (isBuy ? '#52c41a' : '#ff4d4f'),
          border: 'none',
          color: isButtonDisabled ? token.colorTextDisabled : '#ffffff',
          opacity: isButtonDisabled ? 0.7 : 1,
          cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {isBuy ? 'Buy' : 'Sell'} {baseAsset}
      </Button>

      {/* Trading Info */}
      <div style={{
        marginTop: token.marginLG,
        padding: token.paddingMD,
        backgroundColor: token.colorBgLayout,
        borderRadius: token.borderRadiusSM,
        fontSize: token.fontSizeSM,
        color: token.colorTextSecondary,
        lineHeight: 1.5,
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: token.marginXS,
          marginBottom: token.marginXS,
        }}>
          <ThunderboltOutlined style={{ color: token.colorWarning, marginTop: 1 }} />
          <span>
            <strong style={{ color: token.colorText }}>Market Order</strong> – Executes at best available price. Final price may vary slightly.
          </span>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: token.marginXS,
          marginBottom: token.marginXS,
        }}>
          <ClockCircleOutlined style={{ color: token.colorPrimary, marginTop: 1 }} />
          <span>
            <strong style={{ color: token.colorText }}>Slippage</strong> – Price may change between order placement and execution (~0.1-0.5%).
          </span>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: token.marginXS,
        }}>
          <SafetyOutlined style={{ color: token.colorSuccess, marginTop: 1 }} />
          <span>
            <strong style={{ color: token.colorText }}>Best Execution</strong> – We route orders for optimal fill price across liquidity pools.
          </span>
        </div>
      </div>

      {/* College Coins CTA */}
      <div style={{ marginTop: 'auto', paddingTop: token.marginLG }}>
        <div style={{
          position: 'relative',
          backgroundImage: 'url(https://images.unsplash.com/photo-1637825891028-564f672aa42c?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: token.paddingMD,
          borderRadius: token.borderRadius,
          display: 'flex',
          alignItems: 'center',
          gap: token.marginMD,
        }}>
          {/* Dark overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: token.borderRadius,
            zIndex: 1,
          }} />
          <div style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            position: 'relative',
            zIndex: 2,
          }}>
            <Image
              src="/images/collegen-icon.svg"
              alt="College Coins"
              width={48}
              height={48}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div style={{ flex: 1, position: 'relative', zIndex: 2 }}>
            <div style={{
              fontSize: token.fontSize,
              fontWeight: fontWeights.bold,
              color: '#ffffff',
              marginBottom: token.marginXS,
            }}>
              Earn College Coins
            </div>
            <div style={{
              fontSize: token.fontSizeSM,
              color: '#ffffff',
              lineHeight: 1.5,
            }}>
              Complete tasks and earn TUIT tokens for your education. Trade them here or redeem for tuition credits.
            </div>
            <a
              href="https://coinsforcollege.org/college-coins"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: token.marginXS,
                fontSize: token.fontSizeSM,
                color: '#ffffff',
                fontWeight: fontWeights.semibold,
                textDecoration: 'none',
              }}
            >
              Learn more →
            </a>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        title={`Confirm ${side} Order`}
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleSubmit}
            style={{
              background: isBuy ? '#52c41a' : '#ff4d4f',
              color: '#ffffff',
              border: 'none',
            }}
          >
            Confirm {side}
          </Button>,
        ]}
      >
        <div style={{ padding: `${token.paddingMD}px 0` }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: token.marginSM,
            fontSize: token.fontSize,
          }}>
            <span style={{ color: token.colorTextSecondary }}>Type</span>
            <span style={{ 
              color: isBuy ? token.colorSuccess : token.colorError,
              fontWeight: fontWeights.bold,
            }}>
              Market {side}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: token.marginSM,
            fontSize: token.fontSize,
          }}>
            <span style={{ color: token.colorTextSecondary }}>Amount</span>
            <span style={{ color: token.colorText, fontWeight: fontWeights.semibold }}>
              {amountNum.toFixed(6)} {baseAsset}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: token.marginSM,
            fontSize: token.fontSize,
          }}>
            <span style={{ color: token.colorTextSecondary }}>Price</span>
            <span style={{ color: token.colorText }}>
              {quoteAsset === 'UGX' 
                ? `UGX ${price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: price < 0.001 ? 8 : (price < 1 ? 6 : 2) })}`
                : `${price.toLocaleString('en-UG', { maximumFractionDigits: 8 })} ${quoteAsset}`
              }
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: token.marginSM,
            fontSize: token.fontSize,
          }}>
            <span style={{ color: token.colorTextSecondary }}>Fee (0.5%)</span>
            <span style={{ color: token.colorText }}>
              {quoteAsset === 'UGX' 
                ? `UGX ${fee.toFixed(2)}`
                : `${fee.toFixed(8)} ${quoteAsset}`
              }
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: token.paddingSM,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            fontSize: token.fontSizeLG,
          }}>
            <span style={{ color: token.colorTextSecondary }}>You {isBuy ? 'pay' : 'receive'}</span>
            <span style={{ color: token.colorText, fontWeight: fontWeights.bold }}>
              {isBuy ? (
                // BUY: User pays totalNum
                quoteAsset === 'UGX' 
                  ? `UGX ${totalNum.toFixed(2)}`
                  : `${totalNum.toFixed(8)} ${quoteAsset}`
              ) : (
                // SELL: User receives receiveAmount
                quoteAsset === 'UGX'
                  ? `UGX ${receiveAmount.toFixed(2)}`
                  : `${receiveAmount.toFixed(8)} ${quoteAsset}`
              )}
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TradeForm;
