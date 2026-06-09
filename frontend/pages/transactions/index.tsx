import React, { useEffect, useState, useMemo, useCallback, memo, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, Empty, message, Select, Tag } from 'antd';
import {
  SwapOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FilterOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LeftOutlined,
  RightOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import { useThemeMode } from '@/context/ThemeContext';
import { getOrders, InternalOrder } from '@/services/api/coinbase';
import { getLearnerOrders, LearnerOrder } from '@/services/api/learner';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;

type FilterTab = 'all' | 'trades' | 'deposits' | 'withdrawals';

interface Transaction {
  id: string;
  transactionId: string;
  type: 'trade' | 'deposit' | 'withdrawal';
  asset: string;
  amount: number;
  value: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
  side?: 'BUY' | 'SELL';
  date: Date;
  reference?: string | null;
  iconUrl?: string;
}

// Filter pill component
const FilterPill = memo(({
  active,
  onClick,
  children,
  icon,
  count,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  compact?: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        padding: compact 
          ? `${token.paddingXS}px ${token.paddingSM}px`
          : `${token.paddingSM}px ${token.paddingMD}px`,
        borderRadius: 50,
        border: 'none',
        cursor: 'pointer',
        fontSize: compact ? token.fontSizeSM : token.fontSize,
        fontWeight: fontWeights.semibold,
        transition: 'all 0.2s',
        background: active 
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.08)',
        color: active ? '#fff' : token.colorText,
        boxShadow: active ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {icon}
      {children}
      {count !== undefined && count > 0 && (
        <span
          style={{
            background: active ? 'rgba(255,255,255,0.25)' : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(102, 126, 234, 0.2)'),
            borderRadius: 10,
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: fontWeights.bold,
            marginLeft: 2,
          }}
        >
          {count}
        </span>
      )}
    </motion.button>
  );
});
FilterPill.displayName = 'FilterPill';

// Transaction card for mobile
const TransactionCard = memo(({
  transaction,
  onCardClick,
  compact,
}: {
  transaction: Transaction;
  onCardClick?: () => void;
  compact?: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const getTypeIcon = () => {
    if (transaction.type === 'trade') {
      return transaction.side === 'BUY' ? <ArrowDownOutlined /> : <ArrowUpOutlined />;
    }
    if (transaction.type === 'deposit') return <ArrowDownOutlined />;
    return <ArrowUpOutlined />;
  };

  const getTypeColor = () => {
    if (transaction.type === 'trade') {
      return transaction.side === 'BUY' ? '#16C47F' : '#fc6f03';
    }
    if (transaction.type === 'deposit') return '#16C47F';
    return '#fc6f03';
  };

  const getTypeGradient = () => {
    const color = getTypeColor();
    return `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`;
  };

  const getTypeLabel = () => {
    if (transaction.type === 'trade') {
      return transaction.side === 'BUY' ? 'Bought' : 'Sold';
    }
    if (transaction.type === 'deposit') return 'Deposited';
    return 'Withdrew';
  };

  const getStatusIcon = () => {
    switch (transaction.status) {
      case 'COMPLETED': return <CheckCircleOutlined style={{ color: '#16C47F' }} />;
      case 'PENDING': return <ClockCircleOutlined style={{ color: '#d6ac20' }} />;
      case 'FAILED':
      case 'CANCELLED': return <CloseCircleOutlined style={{ color: '#fc6f03' }} />;
      default: return null;
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today, ${d.toLocaleTimeString('en-UG', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${d.toLocaleTimeString('en-UG', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return d.toLocaleDateString('en-UG', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      onClick={onCardClick}
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%)'
          : 'linear-gradient(135deg, #fff 0%, #f8f9ff 100%)',
        borderRadius: token.borderRadiusLG,
        padding: compact ? token.paddingSM : token.paddingMD,
        cursor: onCardClick ? 'pointer' : 'default',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)'}`,
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle type indicator on left */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: getTypeColor(),
          borderRadius: '4px 0 0 4px',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
        {/* Icon */}
        <div
          style={{
            width: compact ? 40 : 48,
            height: compact ? 40 : 48,
            borderRadius: '50%',
            background: getTypeGradient(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getTypeColor(),
            fontSize: compact ? 16 : 20,
            flexShrink: 0,
          }}
        >
          {transaction.iconUrl ? (
            <img
              src={transaction.iconUrl}
              alt={transaction.asset}
              width={compact ? 24 : 28}
              height={compact ? 24 : 28}
              style={{ borderRadius: '50%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling!.removeAttribute('style');
              }}
            />
          ) : null}
          {!transaction.iconUrl && getTypeIcon()}
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
            <span
              style={{
                fontSize: compact ? token.fontSize : token.fontSizeLG,
                fontWeight: fontWeights.semibold,
                color: token.colorText,
              }}
            >
              {getTypeLabel()} {transaction.asset}
            </span>
            {getStatusIcon()}
          </div>
          <div
            style={{
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: token.marginXS,
            }}
          >
            <span>{formatDate(transaction.date)}</span>
            <span style={{ opacity: 0.5 }}>•</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(transaction.transactionId);
                message.success({
                  content: `Copied: ${transaction.transactionId}`,
                  duration: 2,
                });
              }}
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                padding: '1px 4px',
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {transaction.transactionId}
            </span>
          </div>
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: compact ? token.fontSize : token.fontSizeLG,
              fontWeight: fontWeights.bold,
              color: token.colorText,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {transaction.type === 'trade' && transaction.side === 'BUY' ? '+' : ''}
            {transaction.type === 'deposit' ? '+' : transaction.type === 'withdrawal' ? '-' : ''}
            {transaction.type === 'trade' && transaction.side === 'SELL' ? '-' : ''}
            {transaction.amount.toLocaleString('en-UG', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: transaction.amount < 1 ? 6 : 2,
            })} {transaction.asset}
          </div>
          <div
            style={{
              fontSize: token.fontSizeSM,
              color: token.colorTextSecondary,
              marginTop: 2,
            }}
          >
            UGX {transaction.value.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
TransactionCard.displayName = 'TransactionCard';

// Transaction row for desktop list view
const TransactionRow = memo(({
  transaction,
  onRowClick,
}: {
  transaction: Transaction;
  onRowClick?: () => void;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const getTypeIcon = () => {
    if (transaction.type === 'trade') {
      return transaction.side === 'BUY' ? <ArrowDownOutlined /> : <ArrowUpOutlined />;
    }
    if (transaction.type === 'deposit') return <ArrowDownOutlined />;
    return <ArrowUpOutlined />;
  };

  const getTypeColor = () => {
    if (transaction.type === 'trade') {
      return transaction.side === 'BUY' ? '#16C47F' : '#fc6f03';
    }
    if (transaction.type === 'deposit') return '#16C47F';
    return '#fc6f03';
  };

  const getTypeLabel = () => {
    if (transaction.type === 'trade') {
      return transaction.side === 'BUY' ? 'Buy' : 'Sell';
    }
    if (transaction.type === 'deposit') return 'Deposit';
    return 'Withdrawal';
  };

  const getStatusBadge = () => {
    const colors: Record<string, { bg: string; text: string }> = {
      COMPLETED: { bg: 'rgba(22, 196, 127, 0.12)', text: '#16C47F' },
      PENDING: { bg: 'rgba(214, 172, 32, 0.12)', text: '#d6ac20' },
      FAILED: { bg: 'rgba(252, 111, 3, 0.12)', text: '#fc6f03' },
      CANCELLED: { bg: 'rgba(150, 150, 150, 0.12)', text: '#999' },
    };
    const style = colors[transaction.status] || colors.PENDING;
    
    return (
      <span
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          background: style.bg,
          color: style.text,
          fontSize: token.fontSizeSM,
          fontWeight: fontWeights.medium,
        }}
      >
        {transaction.status}
      </span>
    );
  };

  // Check if this is a buy/deposit or sell/withdrawal for row coloring
  const isBuyOrDeposit = transaction.type === 'deposit' || (transaction.type === 'trade' && transaction.side === 'BUY');
  
  // Row border color for clear visual distinction
  const getBorderColor = () => {
    if (isBuyOrDeposit) {
      return '#16C47F'; // Green for buy/deposit
    }
    return '#fc6f03'; // Orange for sell/withdrawal
  };

  // Use the transaction ID from the database
  const displayId = transaction.transactionId;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      whileHover={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(102, 126, 234, 0.05)' }}
      onClick={onRowClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px',
        alignItems: 'center',
        gap: token.marginMD,
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        borderLeft: `4px solid ${getBorderColor()}`,
        cursor: onRowClick ? 'pointer' : 'default',
        transition: 'background-color 0.15s',
      }}
    >
      {/* Type & Asset */}
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${getTypeColor()}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getTypeColor(),
            fontSize: 14,
          }}
        >
          {transaction.iconUrl ? (
            <img
              src={transaction.iconUrl}
              alt={transaction.asset}
              width={24}
              height={24}
              style={{ borderRadius: '50%' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${transaction.asset}&background=667eea&color=fff&size=48`;
              }}
            />
          ) : getTypeIcon()}
        </div>
        <div>
          <div style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
            {getTypeLabel()} {transaction.asset}
          </div>
          <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
            {new Date(transaction.date).toLocaleDateString('en-UG', { 
              month: 'short', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>

      {/* Amount */}
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
          {transaction.amount.toLocaleString('en-UG', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: transaction.amount < 1 ? 6 : 4,
          })}
        </div>
        <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
          {transaction.asset}
        </div>
      </div>

      {/* Value */}
      <div style={{ fontWeight: fontWeights.semibold, color: token.colorText, fontVariantNumeric: 'tabular-nums' }}>
        UGX {transaction.value.toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      {/* Status */}
      <div>{getStatusBadge()}</div>

      {/* Transaction ID */}
      <div
        title="Click to copy"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(displayId);
          message.success({
            content: `Copied: ${displayId}`,
            duration: 2,
            style: { marginTop: '10vh' },
          });
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          color: token.colorTextSecondary,
          fontSize: token.fontSizeSM,
          fontFamily: 'monospace',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: token.borderRadiusSM,
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(102, 126, 234, 0.1)';
          e.currentTarget.style.color = token.colorPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
          e.currentTarget.style.color = token.colorTextSecondary;
        }}
      >
        {displayId}
      </div>
    </motion.div>
  );
});
TransactionRow.displayName = 'TransactionRow';

// Pagination component
const Pagination = memo(({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  isMobile,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  isMobile?: boolean;
}) => {
  const { token } = useToken();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = isMobile ? 3 : 5;
    
    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 3) {
        // Near start
        for (let i = 2; i <= Math.min(maxVisiblePages, totalPages - 1); i++) {
          pages.push(i);
        }
        if (totalPages > maxVisiblePages) {
          pages.push('ellipsis');
        }
      } else if (currentPage >= totalPages - 2) {
        // Near end
        pages.push('ellipsis');
        for (let i = Math.max(totalPages - maxVisiblePages + 1, 2); i <= totalPages - 1; i++) {
          pages.push(i);
        }
      } else {
        // In middle
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          if (i > 1 && i < totalPages) {
            pages.push(i);
          }
        }
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const buttonStyle = (disabled: boolean, active?: boolean) => ({
    width: isMobile ? 32 : 36,
    height: isMobile ? 32 : 36,
    borderRadius: 8,
    border: 'none',
    background: active 
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : disabled 
        ? 'transparent'
        : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.08)',
    color: active 
      ? '#fff' 
      : disabled 
        ? token.colorTextDisabled 
        : token.colorText,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: isMobile ? 12 : 14,
    fontWeight: active ? fontWeights.semibold : fontWeights.medium,
    transition: 'all 0.2s',
    flexShrink: 0,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginMD,
        padding: `${token.paddingMD}px 0`,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
        marginTop: token.marginMD,
      }}
    >
      {/* Items info */}
      <div
        style={{
          fontSize: token.fontSizeSM,
          color: token.colorTextSecondary,
          order: isMobile ? 2 : 0,
        }}
      >
        Showing {startItem}-{endItem} of {totalItems} transactions
      </div>

      {/* Page controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 4 : 6,
          order: isMobile ? 1 : 0,
        }}
      >
        {/* First page */}
        {!isMobile && (
          <motion.button
            whileHover={currentPage > 1 ? { scale: 1.05 } : {}}
            whileTap={currentPage > 1 ? { scale: 0.95 } : {}}
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            style={buttonStyle(currentPage === 1)}
            title="First page"
          >
            <DoubleLeftOutlined />
          </motion.button>
        )}
        
        {/* Previous */}
        <motion.button
          whileHover={currentPage > 1 ? { scale: 1.05 } : {}}
          whileTap={currentPage > 1 ? { scale: 0.95 } : {}}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={buttonStyle(currentPage === 1)}
          title="Previous page"
        >
          <LeftOutlined />
        </motion.button>

        {/* Page numbers */}
        {pageNumbers.map((page, idx) => (
          page === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              style={{
                padding: '0 4px',
                color: token.colorTextSecondary,
                fontSize: 12,
              }}
            >
              •••
            </span>
          ) : (
            <motion.button
              key={page}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPageChange(page)}
              style={buttonStyle(false, currentPage === page)}
            >
              {page}
            </motion.button>
          )
        ))}

        {/* Next */}
        <motion.button
          whileHover={currentPage < totalPages ? { scale: 1.05 } : {}}
          whileTap={currentPage < totalPages ? { scale: 0.95 } : {}}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          style={buttonStyle(currentPage === totalPages || totalPages === 0)}
          title="Next page"
        >
          <RightOutlined />
        </motion.button>

        {/* Last page */}
        {!isMobile && (
          <motion.button
            whileHover={currentPage < totalPages ? { scale: 1.05 } : {}}
            whileTap={currentPage < totalPages ? { scale: 0.95 } : {}}
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            style={buttonStyle(currentPage === totalPages || totalPages === 0)}
            title="Last page"
          >
            <DoubleRightOutlined />
          </motion.button>
        )}
      </div>

      {/* Page size selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: token.marginXS,
          order: isMobile ? 3 : 0,
        }}
      >
        <span style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary }}>
          Per page:
        </span>
        <Select
          value={pageSize}
          onChange={onPageSizeChange}
          size="small"
          style={{ width: 70 }}
          options={[
            { value: 10, label: '10' },
            { value: 20, label: '20' },
            { value: 50, label: '50' },
            { value: 100, label: '100' },
          ]}
        />
      </div>
    </div>
  );
});
Pagination.displayName = 'Pagination';

const TransactionsPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { pairs, appMode } = useExchange();
  const isLearnerMode = appMode === 'learner';
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  // Data state
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Filter state
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : true;
  const isTablet = mounted ? screens.md && !screens.lg : false;
  const useCompactFilters = isMobile || isTablet;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/transactions');
        return;
      }
      // Allow access regardless of KYC - banner in DashboardLayout handles notification
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  // Fetch all orders and fiat transactions (we need all for combined sorting)
  const fetchAllData = useCallback(async () => {
    if (!user) return;
    
    setLoadingOrders(true);

    try {
      // Fetch orders based on mode
      if (isLearnerMode) {
        const learnerResult = await getLearnerOrders({ limit: 500 });
        // Convert LearnerOrder to InternalOrder format
        const convertedOrders: InternalOrder[] = learnerResult.orders.map((order: LearnerOrder) => ({
          id: order.id,
          transactionId: order.transactionId,
          coinbaseOrderId: null, // Learner orders don't have Coinbase order ID
          productId: order.productId,
          asset: order.asset,
          quote: order.quote,
          side: order.side,
          requestedAmount: order.requestedAmount,
          filledAmount: order.filledAmount,
          price: order.price,
          totalValue: order.totalValue,
          platformFee: order.platformFee,
          exchangeFee: order.exchangeFee,
          status: order.status,
          createdAt: order.createdAt, // Keep as string
          completedAt: order.completedAt, // Keep as string | null
        }));
        setOrders(convertedOrders);
      } else {
        const ordersResult = await getOrders({ limit: 500 });
        setOrders(ordersResult.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [user, isLearnerMode]);

  // Fetch data when page loads
  useEffect(() => {
    if (!pageLoading && user) {
      fetchAllData();
    }
  }, [pageLoading, user, fetchAllData]);

  // Get icon URL for an asset
  const getIconUrl = useCallback((asset: string) => {
    if (asset === 'UGX') return undefined;
    const pair = pairs.find(p => p.baseCurrency === asset);
    return pair?.iconUrl || `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`;
  }, [pairs]);

  // Combine and transform all transactions
  const allTransactions = useMemo((): Transaction[] => {
    const result: Transaction[] = [];

    // Add trade orders
    orders.forEach(order => {
      result.push({
        id: `trade-${order.id}`,
        transactionId: order.transactionId,
        type: 'trade',
        asset: order.asset,
        amount: order.filledAmount,
        value: order.totalValue,
        status: order.status as 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED',
        side: order.side,
        date: new Date(order.createdAt),
        iconUrl: getIconUrl(order.asset),
      });
    });

    // Sort by date descending
    result.sort((a, b) => b.date.getTime() - a.date.getTime());
    return result;
  }, [orders, getIconUrl]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];

    // Filter by tab
    if (activeTab === 'trades') {
      result = result.filter(t => t.type === 'trade');
    } else if (activeTab === 'deposits') {
      result = result.filter(t => t.type === 'deposit');
    } else if (activeTab === 'withdrawals') {
      result = result.filter(t => t.type === 'withdrawal');
    }

    return result;
  }, [allTransactions, activeTab]);

  // Paginated transactions
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, pageSize]);

  // Total pages
  const totalPages = useMemo(() => 
    Math.ceil(filteredTransactions.length / pageSize),
  [filteredTransactions.length, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top of transactions
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Count by type
  const counts = useMemo(() => ({
    all: allTransactions.length,
    trades: allTransactions.filter(t => t.type === 'trade').length,
    deposits: allTransactions.filter(t => t.type === 'deposit').length,
    withdrawals: allTransactions.filter(t => t.type === 'withdrawal').length,
  }), [allTransactions]);

  // Group transactions by date for mobile (using paginated transactions)
  const groupedByDate = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    
    paginatedTransactions.forEach(tx => {
      const d = new Date(tx.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (d.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (d.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else if (d.getFullYear() === today.getFullYear()) {
        key = d.toLocaleDateString('en-UG', { month: 'long', day: 'numeric' });
      } else {
        key = d.toLocaleDateString('en-UG', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    
    return groups;
  }, [paginatedTransactions]);

  const isLoadingAll = loadingOrders;

  // Don't render anything while checking auth or if not logged in
  if (isLoading || !user) {
    return null;
  }

  if (pageLoading) {
    return (
      <>
        <Head><title>Transactions - UG Coin</title></Head>
        <Skeleton active paragraph={{ rows: 12 }} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Transactions - UG Coin</title>
        <meta name="description" content="View your transaction history" />
      </Head>

      {/* Header with filters */}
      <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: token.marginLG }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? token.marginMD : token.marginLG,
          }}>
            {/* Title area */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: token.marginSM,
            }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: token.borderRadius,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                }}
              >
                <HistoryOutlined />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
                  <h1 style={{ 
                    fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading3, 
                    fontWeight: fontWeights.bold,
                    margin: 0,
                    color: token.colorText,
                  }}>
                    Transactions
                  </h1>
                  {isLearnerMode && (
                    <Tag
                      icon={<ExperimentOutlined />}
                      color="orange"
                      style={{ margin: 0 }}
                    >
                      Learner Mode
                    </Tag>
                  )}
                </div>
                <p style={{
                  fontSize: token.fontSizeSM,
                  color: token.colorTextSecondary,
                  margin: 0,
                }}>
                  {counts.all} total {isLearnerMode ? 'simulated ' : ''}transactions
                </p>
              </div>
            </div>

            {/* Filter pills */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: token.marginXS,
                marginLeft: isMobile ? 0 : 'auto',
              }}
            >
              <FilterPill
                active={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
                icon={<FilterOutlined />}
                count={counts.all}
                compact={useCompactFilters}
              >
                All
              </FilterPill>
              <FilterPill
                active={activeTab === 'trades'}
                onClick={() => setActiveTab('trades')}
                icon={<SwapOutlined />}
                count={counts.trades}
                compact={useCompactFilters}
              >
                Trades
              </FilterPill>
              <FilterPill
                active={activeTab === 'deposits'}
                onClick={() => setActiveTab('deposits')}
                icon={<ArrowDownOutlined />}
                count={counts.deposits}
                compact={useCompactFilters}
              >
                Deposits
              </FilterPill>
              <FilterPill
                active={activeTab === 'withdrawals'}
                onClick={() => setActiveTab('withdrawals')}
                icon={<ArrowUpOutlined />}
                count={counts.withdrawals}
                compact={useCompactFilters}
              >
                Withdrawals
              </FilterPill>
            </div>
          </div>
        </motion.div>

        {/* Transactions List */}
        {isLoadingAll ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: token.marginSM 
          }}>
            {[...Array(6)].map((_, i) => (
              <Skeleton.Button 
                key={i} 
                active 
                block 
                style={{ height: isMobile ? 80 : 60, borderRadius: token.borderRadiusLG }} 
              />
            ))}
          </div>
        ) : filteredTransactions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: token.paddingXL * 2,
              textAlign: 'center',
              background: isDark ? 'rgba(255,255,255,0.02)' : token.colorBgContainer,
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                marginBottom: token.marginLG,
              }}
            >
              <HistoryOutlined style={{ fontSize: 32, color: '#667eea' }} />
            </div>
            <Empty
              description={
                activeTab !== 'all'
                  ? `No ${activeTab} yet`
                  : 'No transactions yet'
              }
            />
            {activeTab === 'all' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/trade')}
                style={{
                  marginTop: token.marginLG,
                  padding: `${token.paddingSM}px ${token.paddingLG}px`,
                  borderRadius: 50,
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontWeight: fontWeights.semibold,
                  fontSize: token.fontSize,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: token.marginXS,
                }}
              >
                <SwapOutlined />
                Start Trading
              </motion.button>
            )}
          </motion.div>
        ) : (
          <>
            {/* Mobile: Card view grouped by date */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginLG }}>
                {Object.entries(groupedByDate).map(([date, transactions]) => (
                  <div key={date}>
                    <div
                      style={{
                        fontSize: token.fontSizeSM,
                        fontWeight: fontWeights.semibold,
                        color: token.colorTextSecondary,
                        marginBottom: token.marginSM,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      {date}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
                      <AnimatePresence mode="popLayout">
                        {transactions.map((tx) => (
                          <TransactionCard
                            key={tx.id}
                            transaction={tx}
                            compact={false}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Table view */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  borderRadius: token.borderRadiusLG,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(102, 126, 234, 0.1)'}`,
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px',
                    gap: token.marginMD,
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                    borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(102, 126, 234, 0.1)'}`,
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(102, 126, 234, 0.03)',
                  }}
                >
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Transaction
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Amount
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Value
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Status
                  </div>
                  <div style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>
                    ID
                  </div>
                </div>

                {/* Rows */}
                <AnimatePresence mode="popLayout">
                  {paginatedTransactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Pagination */}
            {filteredTransactions.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                totalItems={filteredTransactions.length}
                isMobile={isMobile}
              />
            )}
          </>
        )}

        {/* Summary stats at bottom on mobile - shows totals for all filtered transactions (not just current page) */}
        {!isLoadingAll && filteredTransactions.length > 0 && isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              marginTop: token.marginXL,
              padding: token.paddingLG,
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.15)'}`,
            }}
          >
            <div style={{ fontSize: token.fontSizeSM, color: token.colorTextSecondary, marginBottom: token.marginXS }}>
              Summary (All {activeTab === 'all' ? 'Transactions' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: token.marginMD }}>
              <div>
                <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>Total In</div>
                <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: '#16C47F' }}>
                  +${filteredTransactions
                    .filter(t => t.type === 'deposit' || (t.type === 'trade' && t.side === 'BUY'))
                    .reduce((sum, t) => sum + t.value, 0)
                    .toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: token.fontSizeSM, color: token.colorTextTertiary }}>Total Out</div>
                <div style={{ fontSize: token.fontSizeLG, fontWeight: fontWeights.bold, color: '#fc6f03' }}>
                  -${filteredTransactions
                    .filter(t => t.type === 'withdrawal' || (t.type === 'trade' && t.side === 'SELL'))
                    .reduce((sum, t) => sum + t.value, 0)
                    .toLocaleString('en-UG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
    </>
  );
};

// Persistent layout - keeps DashboardLayout mounted across page navigations
TransactionsPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default TransactionsPage;
