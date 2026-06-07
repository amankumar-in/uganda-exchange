'use client';

import React, { useState, useEffect } from 'react';
import { theme, Button, message } from 'antd';
import { SwapOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import PriceFormatter from './PriceFormatter';
import { useThemeMode } from '@/context/ThemeContext';
import { useExchange } from '@/context/ExchangeContext';

const { useToken } = theme;

type OrderSide = 'BUY' | 'SELL';

interface TradeFormModalProps {
  visible: boolean;
  onClose: () => void;
  side: OrderSide;
  symbol: string;
  price: number;
  baseAsset: string;
  quoteAsset: string;
  baseBalance?: number;
  quoteBalance?: number;
  onTrade?: (side: OrderSide, amount: number, total: number) => Promise<void>;
  isLoading?: boolean;
}

const TradeFormModal: React.FC<TradeFormModalProps> = ({
  visible,
  onClose,
  side,
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
  const { pairs } = useExchange();
  const isDark = mode === 'dark';

  const [amount, setAmount] = useState<string>('');
  const [total, setTotal] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);

  const isBuy = side === 'BUY';
  const amountNum = parseFloat(amount) || 0;
  const totalNum = parseFloat(total) || 0;
  
  // INR value for limit checks — convert non-UGX quote via {quote}-UGX pair
  const getInrValue = (): number => {
    if (quoteAsset === 'UGX') return totalNum;
    const quoteInrPair = pairs.find(p => p.symbol === `${quoteAsset}-UGX`);
    if (quoteInrPair && quoteInrPair.price > 0) {
      return totalNum * quoteInrPair.price;
    }
    return 0;
  };

  const inrValue = getInrValue();

  // Get current pair data for icon and permissions
  const currentPair = pairs.find(p => p.symbol === symbol || p.baseCurrency === baseAsset);

  // Get permission restrictions from current pair
  const permissions = (currentPair as any)?.permissions;
  const isBuyRestricted = permissions && !permissions.allowBuy;
  const isSellRestricted = permissions && !permissions.allowSell;

  // Token-specific transaction limits (from admin settings)
  const tokenMinAmount = permissions?.minTransactionAmount || 0;
  const tokenMaxAmount = permissions?.maxTransactionAmount || 0;
  const isBelowTokenMin = tokenMinAmount > 0 && totalNum > 0 && inrValue < tokenMinAmount;
  const isAboveTokenMax = tokenMaxAmount > 0 && totalNum > 0 && inrValue > tokenMaxAmount;

  // Reset form when modal opens/closes or pair changes
  useEffect(() => {
    if (visible) {
      setAmount('');
      setTotal('');
      setShowConfirm(false);
    }
  }, [visible, symbol]);

  // Calculate total when amount changes
  const handleAmountChange = (value: string) => {
    setAmount(value);
    const num = parseFloat(value) || 0;
    if (num > 0 && price > 0) {
      const totalValue = num * price;
      // High precision for sub-penny totals
      let decimals = 2;
      if (quoteAsset === 'UGX') {
        decimals = totalValue < 0.001 ? 8 : (totalValue < 1 ? 6 : 2);
      } else {
        decimals = 8;
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
    if (price <= 0) return;
    
    const totalDecimals = quoteAsset === 'UGX' ? 2 : 8;
    const precisionMultiplier = quoteAsset === 'UGX' ? 100 : 100000000;
    
    if (isBuy) {
      const maxTotal = percent === 100 
        ? Math.floor(quoteBalance * precisionMultiplier) / precisionMultiplier
        : quoteBalance * (percent / 100);
      
      const decimals = quoteAsset === 'UGX' ? (maxTotal < 1 ? 6 : 2) : 8;
      setTotal(maxTotal.toFixed(decimals));
      if (price > 0) {
        setAmount((maxTotal / price).toFixed(8));
      }
    } else {
      const maxAmount = percent === 100
        ? Math.floor(baseBalance * 100000000) / 100000000
        : baseBalance * (percent / 100);
      setAmount(maxAmount.toFixed(8));
      if (price > 0) {
        setTotal((maxAmount * price).toFixed(totalDecimals));
      }
    }
  };

  // Handle trade submission
  const handleSubmit = async () => {
    if (!amountNum || !totalNum) return;
    
    if (isBuy && totalNum > quoteBalance + 0.01) {
      message.error(`Insufficient ${quoteAsset} balance`);
      setShowConfirm(false);
      return;
    }
    
    if (!isBuy && amountNum > baseBalance) {
      message.error(`Insufficient ${baseAsset} balance`);
      setShowConfirm(false);
      return;
    }
    
    // Close the entire modal immediately before processing
    // This prevents the form from reappearing while order status shows
    setShowConfirm(false);
    onClose();
    
    try {
      if (onTrade) {
        await onTrade(side, amountNum, totalNum);
      }
      setAmount('');
      setTotal('');
    } catch (error: any) {
      console.error('Trade failed:', error);
    }
  };

  // Fee calculation (0.5%)
  const fee = isBuy ? totalNum * 0.005 : amountNum * price * 0.005;
  const receiveAmount = isBuy ? amountNum : (amountNum * price) - fee;

  // Check if balance is insufficient
  const insufficientBalance = (isBuy && totalNum > quoteBalance + 0.01) || (!isBuy && amountNum > baseBalance);

  // Button disabled state - calculate once for consistent styling
  const isButtonDisabled =
    !amountNum ||
    amountNum <= 0 ||
    !totalNum ||
    totalNum <= 0 ||
    price <= 0 ||
    isBelowTokenMin ||
    isAboveTokenMax ||
    insufficientBalance ||
    (isBuy && isBuyRestricted) ||
    (!isBuy && isSellRestricted);

  // Custom input with addon
  const InputWithAddon = ({ 
    value, 
    onChange, 
    addon, 
    placeholder,
    label,
    balance,
  }: { 
    value: string; 
    onChange: (v: string) => void; 
    addon: string; 
    placeholder: string;
    label: string;
    balance: string;
  }) => (
    <div style={{ marginBottom: token.marginMD }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: token.marginXS,
      }}>
        <span style={{ 
          fontSize: token.fontSizeSM, 
          color: token.colorTextSecondary,
          fontWeight: fontWeights.medium,
        }}>
          {label}
        </span>
        <span style={{ 
          fontSize: token.fontSizeSM, 
          color: token.colorTextTertiary,
        }}>
          Avail: {balance}
        </span>
      </div>
      <div style={{
        display: 'flex',
        border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
        transition: 'all 0.2s ease',
      }}>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: `${token.paddingMD}px ${token.paddingLG}px`,
            border: 'none',
            outline: 'none',
            fontSize: token.fontSizeXL,
            fontWeight: fontWeights.bold,
            color: token.colorText,
            backgroundColor: 'transparent',
            minWidth: 0,
          }}
        />
        <div style={{
          padding: `${token.paddingMD}px ${token.paddingLG}px`,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          color: token.colorTextSecondary,
          fontSize: token.fontSize,
          fontWeight: fontWeights.semibold,
          display: 'flex',
          alignItems: 'center',
          borderLeft: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        }}>
          {addon}
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Compact Header with Price */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${token.paddingSM}px ${token.paddingLG}px ${token.paddingMD}px`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
          {/* BUY/SELL Badge */}
          <div
            style={{
              padding: `${token.paddingXS}px ${token.paddingSM}px`,
              borderRadius: 8,
              background: isBuy 
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
              color: isBuy ? '#22C55E' : '#EF4444',
              fontSize: token.fontSizeSM,
              fontWeight: fontWeights.bold,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isBuy ? 'Buy' : 'Sell'}
          </div>
          {/* Token Icon + Ticker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
            {currentPair?.iconUrl && (
              <img
                src={currentPair.iconUrl}
                alt={baseAsset}
                width={28}
                height={28}
                style={{ borderRadius: '50%', flexShrink: 0 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseAsset}&background=667eea&color=fff&size=56`;
                }}
              />
            )}
            <span
              style={{
                fontSize: token.fontSizeLG,
                fontWeight: fontWeights.bold,
                color: token.colorText,
              }}
            >
              {baseAsset}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
            Price
          </div>
          <div style={{ 
            fontSize: token.fontSizeLG, 
            fontWeight: fontWeights.bold, 
            color: token.colorText,
          }}>
            <PriceFormatter price={price} quote={quoteAsset} />
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div style={{ flex: 1, padding: `0 ${token.paddingLG}px`, overflowY: 'auto' }}>
        {/* For BUY: Total first (what you pay), then Amount (what you get) */}
        {/* For SELL: Amount first (what you sell), then Total (what you get) */}
        
        {isBuy ? (
          <>
            {/* Total Input - What you pay */}
            <InputWithAddon
              value={total}
              onChange={handleTotalChange}
              addon={quoteAsset}
              placeholder="0.00"
              label="You Pay"
              balance={quoteAsset === 'UGX' 
                ? `UGX ${quoteBalance.toFixed(2)}`
                : `${quoteBalance.toFixed(4)} ${quoteAsset}`
              }
            />

            {/* Percentage Buttons - % of your paying balance */}
            <div style={{
              display: 'flex',
              gap: token.marginXS,
              marginBottom: token.marginMD,
            }}>
              {[25, 50, 75, 100].map((percent) => (
                <div
                  key={percent}
                  onClick={() => handlePercentage(percent)}
                  style={{
                    flex: 1,
                    padding: `${token.paddingXS}px`,
                    textAlign: 'center',
                    fontSize: token.fontSizeSM,
                    fontWeight: fontWeights.semibold,
                    color: token.colorTextSecondary,
                    border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  {percent}%
                </div>
              ))}
            </div>

            {/* Swap Icon */}
            <div style={{ textAlign: 'center', margin: `${token.marginXS}px 0` }}>
              <SwapOutlined 
                rotate={90}
                style={{ 
                  fontSize: 18, 
                  color: token.colorTextTertiary,
                  padding: token.paddingXS,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 8,
                }} 
              />
            </div>

            {/* Amount Input - What you receive */}
            <InputWithAddon
              value={amount}
              onChange={handleAmountChange}
              addon={baseAsset}
              placeholder="0.00"
              label="You Receive"
              balance={`${baseBalance.toFixed(4)} ${baseAsset}`}
            />
          </>
        ) : (
          <>
            {/* Amount Input - What you sell */}
            <InputWithAddon
              value={amount}
              onChange={handleAmountChange}
              addon={baseAsset}
              placeholder="0.00"
              label="You Sell"
              balance={`${baseBalance.toFixed(4)} ${baseAsset}`}
            />

            {/* Percentage Buttons - % of your crypto balance */}
            <div style={{
              display: 'flex',
              gap: token.marginXS,
              marginBottom: token.marginMD,
            }}>
              {[25, 50, 75, 100].map((percent) => (
                <div
                  key={percent}
                  onClick={() => handlePercentage(percent)}
                  style={{
                    flex: 1,
                    padding: `${token.paddingXS}px`,
                    textAlign: 'center',
                    fontSize: token.fontSizeSM,
                    fontWeight: fontWeights.semibold,
                    color: token.colorTextSecondary,
                    border: `1.5px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  {percent}%
                </div>
              ))}
            </div>

            {/* Swap Icon */}
            <div style={{ textAlign: 'center', margin: `${token.marginXS}px 0` }}>
              <SwapOutlined 
                rotate={90}
                style={{ 
                  fontSize: 18, 
                  color: token.colorTextTertiary,
                  padding: token.paddingXS,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 8,
                }} 
              />
            </div>

            {/* Total Input - What you receive */}
            <InputWithAddon
              value={total}
              onChange={handleTotalChange}
              addon={quoteAsset}
              placeholder="0.00"
              label="You Receive"
              balance={quoteAsset === 'UGX' 
                ? `UGX ${quoteBalance.toFixed(2)}`
                : `${quoteBalance.toFixed(4)} ${quoteAsset}`
              }
            />
          </>
        )}

        {/* Permission Restriction Warnings */}
        <AnimatePresence>
          {permissions && isBuy && isBuyRestricted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginBottom: token.marginMD,
                padding: token.paddingMD,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: token.fontSizeSM,
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
              }}
            >
              <InfoCircleOutlined />
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
                marginBottom: token.marginMD,
                padding: token.paddingMD,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: token.fontSizeSM,
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
              }}
            >
              <InfoCircleOutlined />
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
                marginBottom: token.marginMD,
                padding: token.paddingMD,
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(251, 191, 36, 0.2)',
                fontSize: token.fontSizeSM,
                color: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
              }}
            >
              <InfoCircleOutlined />
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
                marginBottom: token.marginMD,
                padding: token.paddingMD,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: token.fontSizeSM,
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
              }}
            >
              <InfoCircleOutlined />
              Maximum transaction for {baseAsset} is UGX {tokenMaxAmount.toFixed(2)} (current: UGX {inrValue.toFixed(2)})
            </motion.div>
          )}
        </AnimatePresence>

        {/* Insufficient Balance Warning */}
        <AnimatePresence>
          {amountNum > 0 && insufficientBalance && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginBottom: token.marginMD,
                padding: token.paddingMD,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 12,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: token.fontSizeSM,
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                gap: token.marginXS,
              }}
            >
              <InfoCircleOutlined />
              Insufficient balance
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fee Info */}
        <AnimatePresence>
          {amountNum > 0 && !insufficientBalance && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                marginBottom: token.marginMD,
                padding: token.paddingMD,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                borderRadius: 12,
                fontSize: token.fontSizeSM,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginXS, color: token.colorTextSecondary }}>
                <span>Fee (0.5%)</span>
                <span>
                  {quoteAsset === 'UGX'
                    ? `UGX ${fee.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: fee < 0.001 ? 8 : (fee < 1 ? 6 : 2) })}`
                    : `${fee.toFixed(8)} ${quoteAsset}`
                  }
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: token.colorTextSecondary }}>You {isBuy ? 'receive' : 'get'}</span>
                <span style={{ color: token.colorText, fontWeight: fontWeights.bold }}>
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
      </div>

      {/* Submit Button */}
      <div
        style={{
          padding: `${token.paddingSM}px ${token.paddingLG}px`,
          paddingBottom: `calc(${token.paddingSM}px + env(safe-area-inset-bottom, 8px))`,
        }}
      >
        <Button
          type="primary"
          size="large"
          block
          loading={isLoading}
          disabled={isButtonDisabled}
          onClick={() => setShowConfirm(true)}
          style={{
            height: 52,
            borderRadius: 14,
            fontWeight: fontWeights.bold,
            fontSize: token.fontSize,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isButtonDisabled ? token.colorTextDisabled : '#ffffff',
            background: isButtonDisabled 
              ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)')
              : (isBuy 
                ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
                : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'),
            border: 'none',
            boxShadow: isButtonDisabled 
              ? 'none'
              : (isBuy
                ? '0 6px 20px rgba(34, 197, 94, 0.35)'
                : '0 6px 20px rgba(239, 68, 68, 0.35)'),
            opacity: isButtonDisabled ? 0.7 : 1,
            cursor: isButtonDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {isBuy ? 'Buy' : 'Sell'} {baseAsset}
        </Button>
      </div>
    </div>
  );

  // Common bottom sheet styles
  const bottomSheetStyle = {
    position: 'fixed' as const,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1101,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    background: isDark 
      ? 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)'
      : 'linear-gradient(180deg, #ffffff 0%, #f8f9fc 100%)',
    boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  };

  // Confirmation content
  const confirmationContent = (
    <div style={{ padding: token.paddingLG }}>
      {/* Drag handle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: token.marginMD }}>
        <div style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
        }} />
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: token.marginLG }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isBuy 
            ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
            : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          marginBottom: token.marginSM,
          overflow: 'hidden',
        }}>
          {currentPair?.iconUrl ? (
            <img
              src={currentPair.iconUrl}
              alt={baseAsset}
              width={36}
              height={36}
              style={{ borderRadius: '50%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${baseAsset}&background=667eea&color=fff&size=72`;
              }}
            />
          ) : (
            <span style={{ color: '#ffffff', fontSize: 24, fontWeight: fontWeights.bold }}>
              {isBuy ? '↓' : '↑'}
            </span>
          )}
        </div>
        <div style={{
          fontSize: token.fontSizeLG,
          fontWeight: fontWeights.bold,
          color: token.colorText,
        }}>
          Confirm {side} Order
        </div>
      </div>
      
      {/* Order Details */}
      <div style={{
        background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        padding: token.paddingMD,
        marginBottom: token.marginLG,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Type</span>
          <span style={{ color: isBuy ? '#22C55E' : '#EF4444', fontWeight: fontWeights.bold, fontSize: token.fontSizeSM }}>
            Market {side}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Amount</span>
          <span style={{ color: token.colorText, fontWeight: fontWeights.semibold, fontSize: token.fontSizeSM }}>
            {amountNum.toFixed(6)} {baseAsset}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Price</span>
          <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
            {quoteAsset === 'UGX' 
              ? `UGX ${price.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: price < 0.001 ? 8 : (price < 1 ? 6 : 2) })}`
              : `${price.toFixed(8)} ${quoteAsset}`
            }
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: token.marginSM }}>
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>Fee (0.5%)</span>
          <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>
            {quoteAsset === 'UGX' ? `UGX ${fee.toFixed(2)}` : `${fee.toFixed(8)} ${quoteAsset}`}
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: token.paddingSM,
          borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        }}>
          <span style={{ color: token.colorTextSecondary }}>You {isBuy ? 'pay' : 'receive'}</span>
          <span style={{ color: token.colorText, fontWeight: fontWeights.bold }}>
            {isBuy 
              ? (quoteAsset === 'UGX' ? `UGX ${totalNum.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: totalNum < 1 ? 6 : 2 })}` : `${totalNum.toFixed(8)} ${quoteAsset}`)
              : (quoteAsset === 'UGX' ? `UGX ${receiveAmount.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: receiveAmount < 1 ? 6 : 2 })}` : `${receiveAmount.toFixed(8)} ${quoteAsset}`)
            }
          </span>
        </div>
      </div>
      
      {/* Buttons */}
      <div style={{ display: 'flex', gap: token.marginSM, paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <Button
          size="large"
          onClick={() => setShowConfirm(false)}
          style={{ flex: 1, height: 48, borderRadius: 12 }}
        >
          Back
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={handleSubmit}
          loading={isLoading}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            background: isBuy 
              ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)'
              : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            border: 'none',
          }}
        >
          Confirm {side}
        </Button>
      </div>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              if (showConfirm) {
                setShowConfirm(false);
              } else {
                onClose();
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1100,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          {/* Form Bottom Sheet - hidden when confirming */}
          {!showConfirm && (
            <motion.div
              key="form-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              style={{ ...bottomSheetStyle, maxHeight: '90vh' }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: `${token.paddingSM}px 0` }}>
                <div style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
                }} />
              </div>
              {modalContent}
            </motion.div>
          )}

          {/* Confirmation Bottom Sheet - shown when confirming */}
          {showConfirm && (
            <motion.div
              key="confirm-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              style={bottomSheetStyle}
            >
              {confirmationContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default TradeFormModal;

