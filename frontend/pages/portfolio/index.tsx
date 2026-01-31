import React, { useEffect, useState, useMemo, useRef, ReactElement } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { theme, Grid, Skeleton, Row, Col, Button, Table, Tag, Empty, Modal, Typography, Card } from 'antd';
import {
  WalletOutlined,
  SwapOutlined,
  PlusOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  QrcodeOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  BankOutlined,
  LineChartOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import AssetCard from '@/components/dashboard/AssetCard';
import PortfolioGrowthChart from '@/components/dashboard/PortfolioGrowthChart';
import MobilePortfolioCard from '@/components/dashboard/MobilePortfolioCard';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useExchange } from '@/context/ExchangeContext';
import DepositModal from '@/components/wallet/DepositModal';
import WithdrawModal from '@/components/wallet/WithdrawModal';
import { getFiatTransactions, syncPaymentStatus } from '@/services/api/fiat';
import { createPortfolioSnapshot } from '@/services/api/learner';
import { createInvestorPortfolioSnapshot } from '@/services/api/assets';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;
const { Title, Text } = Typography;

const WalletPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const {
    balances,
    isLoadingBalances,
    orders,
    isLoadingOrders,
    pairs,
    refreshBalances,
    refreshOrders,
    appMode,
  } = useExchange();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [ordersVisible, setOrdersVisible] = useState(false);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [depositSuccessVisible, setDepositSuccessVisible] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | null>(null);
  const previousBalanceRef = useRef<number>(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Wait for client-side mount to avoid hydration mismatch with useBreakpoint
  const isMobile = mounted ? !screens.md : false;
  const isTablet = mounted ? (screens.md && !screens.xl) : false;

  // Set mounted state for hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login?redirect=/portfolio');
        return;
      }
      // Allow access regardless of KYC - banner in DashboardLayout handles notification
      setPageLoading(false);
    }
  }, [user, isLoading, router]);

  // Refresh balances and orders when page loads
  useEffect(() => {
    if (!pageLoading && user) {
      refreshBalances();
      refreshOrders();
    }
  }, [pageLoading, user, refreshBalances, refreshOrders]);

  // Create portfolio snapshot when page loads (for growth chart) - both modes
  useEffect(() => {
    if (!pageLoading && user && balances.length > 0 && pairs.length > 0) {
      const createSnapshot = async () => {
        try {
          // Build crypto prices from current pairs
          const cryptoPrices: Record<string, number> = {};
          pairs.forEach(pair => {
            if (pair.symbol.endsWith('-USD')) {
              const asset = pair.symbol.replace('-USD', '');
              cryptoPrices[asset] = pair.price;
            }
          });
          
          if (appMode === 'learner') {
            await createPortfolioSnapshot(cryptoPrices);
          } else {
            await createInvestorPortfolioSnapshot(cryptoPrices);
          }
        } catch (error) {
          console.error('Failed to create portfolio snapshot:', error);
        }
      };
      createSnapshot();
    }
  }, [pageLoading, user, appMode, balances.length, pairs.length]);

  // Handle deposit success redirect from Stripe
  useEffect(() => {
    if (router.query.deposit === 'success') {
      // Close modal if open
      setDepositModalVisible(false);
      
      // Try to sync payment status (fallback if webhook didn't process)
      const syncPayment = async () => {
        try {
          // Get latest deposit transaction
          const { transactions } = await getFiatTransactions({ type: 'DEPOSIT', limit: 1 });
          if (transactions.length > 0) {
            setDepositAmount(transactions[0].amount);
            if (transactions[0].status === 'PENDING') {
              // Try to sync payment status (webhook hasn't processed yet)
              await syncPaymentStatus(transactions[0].id);
            }
          }
        } catch (error) {
          console.error('Failed to sync payment status:', error);
        }
      };
      
      syncPayment();
      
      // Store current balance for comparison (after balances are loaded)
      const currentBalance = balances.find((b) => b.asset === 'USD')?.balance || 0;
      previousBalanceRef.current = currentBalance;
      
      // Refresh balances immediately
      refreshBalances();
      
      // Smart polling: stop when balance updates or after max attempts
      let attempts = 0;
      const maxAttempts = 5;
      
      pollIntervalRef.current = setInterval(() => {
        attempts++;
        refreshBalances();
        
        // Stop if max attempts reached
        if (attempts >= maxAttempts) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }, 2000);
      
      // Show success modal
      setDepositSuccessVisible(true);
      
      // Clear query parameter from URL
      router.replace('/portfolio', undefined, { shallow: true });
    }
    
    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [router.query.deposit, refreshBalances, router, balances]);
  
  // Stop polling when balance updates
  useEffect(() => {
    if (pollIntervalRef.current) {
      const currentBalance = balances.find((b) => b.asset === 'USD')?.balance || 0;
      if (currentBalance > previousBalanceRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [balances]);

  // Separate USD and crypto assets
  const usdBalance = useMemo(() => {
    const usd = balances.find((b) => b.asset === 'USD');
    return usd ? {
      symbol: 'USD',
      name: 'US Dollar',
      balance: usd.balance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      availableBalance: usd.availableBalance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      lockedBalance: usd.lockedBalance.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      value: `$${usd.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: 0,
      color: '#4CAF50',
      iconUrl: undefined,
    } : null;
  }, [balances]);

  // Always show these 4 tokens: BTC, ETH, USDT, TUIT
  const REQUIRED_ASSETS = ['BTC', 'ETH', 'USDT', 'TUIT'];

  // Calculate USD values for crypto balances using current prices
  // Always show the 4 required assets, even with zero balance
  const cryptoAssetsWithValues = useMemo(() => {
    // Get asset color and name mapping
    const assetInfo: Record<string, { name: string; color: string }> = {
      BTC: { name: 'Bitcoin', color: '#F7931A' },
      ETH: { name: 'Ethereum', color: '#627EEA' },
      USDT: { name: 'Tether', color: '#26A17B' },
    };

    // Create a map of existing balances
    const balanceMap = new Map(
      balances
        .filter((b) => b.asset !== 'USD')
        .map((b) => [b.asset, b])
    );

    // Process required assets first (in order)
    const requiredAssets = REQUIRED_ASSETS.map((asset) => {
      const balance = balanceMap.get(asset) || {
        asset,
        balance: 0,
        availableBalance: 0,
        lockedBalance: 0,
      };

      // Find price from pairs (look for USD pairs)
      const usdPair = pairs.find(
        (p) => p.baseCurrency === asset && p.quote === 'USD',
      );
      const price = usdPair?.price || 0;
      const usdValue = balance.balance * price;

      const info = assetInfo[asset];
      const name = info?.name || usdPair?.name || asset;
      const color = info?.color || token.colorPrimary;

      // Icon priority:
      // 1. usdPair.iconUrl (Real data from backend/mapped pairs)
      // 2. Safe fallback for TUIT (initials) if no icon provided
      // 3. CoinCap fallback for others
      const iconUrl = usdPair?.iconUrl || (asset === 'TUIT' ? undefined : `https://assets.coincap.io/assets/icons/${asset.toLowerCase()}@2x.png`);

      return {
        symbol: asset,
        name,
        balance: balance.balance.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }),
        availableBalance: balance.availableBalance.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }),
        lockedBalance: balance.lockedBalance.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }),
        value: usdValue > 0 
          ? `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
          : '$0.00',
        change: usdPair?.change || 0,
        color,
        iconUrl,
      };
    });

    // Add any other assets the user has (not in required list)
    const otherAssets = balances
      .filter((b) => b.asset !== 'USD' && !REQUIRED_ASSETS.includes(b.asset))
      .map((balance) => {
        // Check both regular pairs and college coin pairs
        const usdPair = pairs.find(
          (p) => p.baseCurrency === balance.asset && (p.quote === 'USD' || p.isCollegeCoin),
        );
        const price = usdPair?.price || 0;
        const usdValue = balance.balance * price;

        // Use iconUrl from pair data (for college coins) or fallback to CoinCap
        const iconUrl = usdPair?.iconUrl || `https://assets.coincap.io/assets/icons/${balance.asset.toLowerCase()}@2x.png`;

        return {
          symbol: balance.asset,
          name: usdPair?.name || balance.asset,
          balance: balance.balance.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 8,
          }),
          availableBalance: balance.availableBalance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
          }),
          lockedBalance: balance.lockedBalance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8,
          }),
          value: usdValue > 0 
            ? `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
            : '$0.00',
          change: usdPair?.change || 0,
          color: token.colorPrimary,
          iconUrl,
        };
      });

    // Combine and sort by USD value (descending) - purely by value, not token count
    const allAssets = [...requiredAssets, ...otherAssets];
    return allAssets.sort((a, b) => {
      const aValue = parseFloat(a.value.replace(/[^0-9.-]/g, '')) || 0;
      const bValue = parseFloat(b.value.replace(/[^0-9.-]/g, '')) || 0;
      
      // Sort by value (descending) - highest value first
      if (bValue !== aValue) {
        return bValue - aValue;
      }
      
      // If values are equal (both zero), maintain required assets order
      const aIsRequired = REQUIRED_ASSETS.includes(a.symbol);
      const bIsRequired = REQUIRED_ASSETS.includes(b.symbol);
      if (aIsRequired && bIsRequired) {
        return REQUIRED_ASSETS.indexOf(a.symbol) - REQUIRED_ASSETS.indexOf(b.symbol);
      }
      if (aIsRequired) return -1;
      if (bIsRequired) return 1;
      return 0;
    });
  }, [balances, pairs, token.colorPrimary]);
  
  // Combine for total calculations
  const assetsWithValues = useMemo(() => {
    const all = [...cryptoAssetsWithValues];
    if (usdBalance) {
      all.push(usdBalance);
    }
    return all;
  }, [cryptoAssetsWithValues, usdBalance]);

  // Calculate total balances
  const totalBalance = useMemo(() => {
    return assetsWithValues.reduce((sum, asset) => {
      const value = parseFloat(asset.value.replace(/[^0-9.-]/g, '')) || 0;
      return sum + value;
    }, 0);
  }, [assetsWithValues]);

  const cryptoBalance = useMemo(() => {
    return assetsWithValues
      .filter((a) => a.symbol !== 'USD')
      .reduce((sum, asset) => {
        const value = parseFloat(asset.value.replace(/[^0-9.-]/g, '')) || 0;
        return sum + value;
      }, 0);
  }, [assetsWithValues]);

  const fiatBalance = useMemo(() => {
    const usdAsset = assetsWithValues.find((a) => a.symbol === 'USD');
    return usdAsset ? parseFloat(usdAsset.value.replace(/[^0-9.-]/g, '')) || 0 : 0;
  }, [assetsWithValues]);

  const sectionStyle: React.CSSProperties = {
    marginBottom: token.marginXL,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: token.fontSizeHeading4,
    fontWeight: fontWeights.bold,
    color: token.colorText,
    marginBottom: token.marginMD,
  };

  const actionButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: token.marginSM,
    flexWrap: isMobile ? 'nowrap' : 'wrap',
    overflowX: isMobile ? 'auto' : 'visible',
  };

  const buttonStyle: React.CSSProperties = {
    height: token.controlHeightLG,
    fontSize: isMobile ? token.fontSizeSM : token.fontSize,
    fontWeight: fontWeights.semibold,
    borderRadius: token.borderRadiusLG,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: token.marginXS,
    flex: isMobile ? 1 : 'none',
    minWidth: isMobile ? 0 : 'auto',
    whiteSpace: 'nowrap',
    padding: isMobile ? `0 ${token.paddingSM}px` : `0 ${token.paddingMD}px`,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  // Orders table columns
  const orderColumns = [
    {
      title: 'Pair',
      dataIndex: 'productId',
      key: 'productId',
      render: (text: string) => <span style={{ fontWeight: fontWeights.medium }}>{text}</span>,
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'BUY' ? 'green' : 'red'} icon={side === 'BUY' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
          {side}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'filledAmount',
      key: 'filledAmount',
      render: (amount: number, record: any) => `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })} ${record.asset}`,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number, record: any) => `$${price.toFixed(2)}`,
    },
    {
      title: 'Total',
      dataIndex: 'totalValue',
      key: 'totalValue',
      render: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          COMPLETED: 'green',
          PENDING: 'orange',
          FAILED: 'red',
          CANCELLED: 'default',
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: Date) => new Date(date).toLocaleDateString(),
    },
  ];

  // Don't render anything while checking auth or if not logged in
  if (isLoading || !user) {
    return null;
  }

  if (pageLoading) {
    return (
      <>
        <Head>
          <title>Wallet - InTuition Exchange</title>
        </Head>
        <Skeleton active paragraph={{ rows: 12 }} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Wallet - InTuition Exchange</title>
        <meta name="description" content="Manage your crypto assets" />
      </Head>

      {/* Balance Stats */}
      <motion.div
          style={sectionStyle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Row gutter={[token.marginMD, token.marginMD]}>
            {/* Mobile: Unified portfolio card with chart */}
            {isMobile ? (
              <Col xs={24}>
                <MobilePortfolioCard
                  totalBalance={totalBalance}
                  cryptoBalance={cryptoBalance}
                  cashBalance={fiatBalance}
                  mode={appMode}
                  onDepositClick={() => setDepositModalVisible(true)}
                />
              </Col>
            ) : isTablet ? (
              /* Tablet: 2 cards with all data */
              <>
                <Col xs={24} sm={12} style={{ display: 'flex' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                    <StatCard
                      title="Total Balance"
                      value={`$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      subtitle={`Crypto: $${cryptoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • Cash: $${fiatBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<WalletOutlined />}
                      gradient="linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
                      showDepositButton={false}
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12} style={{ display: 'flex' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                    <StatCard
                      title="Crypto Balance"
                      value={`$${cryptoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      subtitle={`${assetsWithValues.filter((a) => a.symbol !== 'USD').length} assets • Cash: $${fiatBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<SwapOutlined />}
                      color={token.colorSuccess}
                    />
                  </div>
                </Col>
              </>
            ) : (
              /* Desktop: 3 cards */
              <>
                <Col xs={24} sm={12} xl={8} style={{ display: 'flex' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                    <StatCard
                      title="Total Balance"
                      value={`$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      icon={<WalletOutlined />}
                      gradient="linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
                      showDepositButton={false}
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={8} style={{ display: 'flex' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                    <StatCard
                      title="Crypto Balance"
                      value={`$${cryptoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      subtitle={`${assetsWithValues.filter((a) => a.symbol !== 'USD').length} assets`}
                      icon={<SwapOutlined />}
                      color={token.colorSuccess}
                    />
                  </div>
                </Col>
                <Col xs={24} sm={12} xl={8} style={{ display: 'flex' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                    <StatCard
                      title="Cash Balance"
                      value={`$${fiatBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      subtitle="USD"
                      icon={<PlusOutlined />}
                      color={token.colorWarning}
                    />
                  </div>
                </Col>
              </>
            )}
          </Row>
        </motion.div>

        {/* Portfolio Growth Chart - Desktop/Tablet only */}
        {!isMobile && (
          <motion.div
            style={sectionStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <Card
              style={{
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
              styles={{
                body: {
                  padding: token.paddingMD,
                },
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, marginBottom: token.marginSM }}>
                <LineChartOutlined style={{ fontSize: token.fontSizeLG, color: appMode === 'learner' ? '#F59E0B' : '#6366F1' }} />
                <span style={{ fontWeight: fontWeights.semibold, color: token.colorText }}>
                  Portfolio Growth
                </span>
                <Tag color={appMode === 'learner' ? 'orange' : 'blue'} style={{ marginLeft: 'auto' }}>
                  {appMode === 'learner' ? 'Learner Mode' : 'Investor Mode'}
                </Tag>
              </div>
              <PortfolioGrowthChart mode={appMode} height={350} currentBalance={totalBalance} />
            </Card>
          </motion.div>
        )}

        {/* Action Buttons */}
        {!isMobile && (
          <motion.div
            style={sectionStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div style={actionButtonsStyle}>
              <Button
                type="primary"
                style={buttonStyle}
                onClick={() => setDepositModalVisible(true)}
              >
                <PlusOutlined /> Deposit Cash
              </Button>
              <Button 
                style={buttonStyle}
                onClick={() => setWithdrawModalVisible(true)}
              >
                <ArrowUpOutlined /> Withdraw
              </Button>
              <Button 
                style={buttonStyle}
                onClick={() => router.push('/portfolio/bank-accounts')}
              >
                <BankOutlined /> Bank Accounts
              </Button>
              <Button style={{ ...buttonStyle, opacity: 0.4 }} disabled>
                <StopOutlined /> Crypto Deposit
              </Button>
            </div>
          </motion.div>
        )}
        
        {/* Mobile Action Buttons */}
        {isMobile && (
          <motion.div
            style={sectionStyle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div style={actionButtonsStyle}>
              <Button 
                style={{
                  ...buttonStyle,
                  backgroundColor: token.colorSuccessBg,
                  color: token.colorSuccess,
                  border: `1px solid ${token.colorSuccess}40`,
                }}
                onClick={() => setWithdrawModalVisible(true)}
              >
                <ArrowUpOutlined />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Withdraw</span>
              </Button>
              <Button 
                style={{
                  ...buttonStyle,
                  backgroundColor: token.colorPrimaryBg,
                  color: token.colorPrimary,
                  border: `1px solid ${token.colorPrimary}40`,
                }}
                onClick={() => router.push('/portfolio/bank-accounts')}
              >
                <BankOutlined />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Banks</span>
              </Button>
              <Button 
                style={{
                  ...buttonStyle,
                  backgroundColor: token.colorWarningBg,
                  color: token.colorWarning,
                  border: `1px solid ${token.colorWarning}40`,
                  opacity: 0.4,
                }}
                disabled
              >
                <StopOutlined />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Crypto</span>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Crypto Assets - Always show at least 4 tokens */}
        <motion.div
          style={sectionStyle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div style={sectionTitleStyle}>Crypto Assets</div>
          {isLoadingBalances ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
              {cryptoAssetsWithValues.map((asset, index) => (
                <motion.div
                  key={asset.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                >
                  <AssetCard
                    symbol={asset.symbol}
                    name={asset.name}
                    balance={asset.balance}
                    value={asset.value}
                    change={asset.change}
                    color={asset.color}
                    iconUrl={asset.iconUrl}
                    onTrade={() => {
                      router.push(`/trade?pair=${asset.symbol}-USD`);
                    }}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Orders - Collapsible */}
        <motion.div
          style={sectionStyle}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Button
            type="default"
            icon={<HistoryOutlined />}
            onClick={() => setOrdersVisible(!ordersVisible)}
            style={{
              ...buttonStyle,
              marginBottom: ordersVisible ? token.marginMD : 0,
            }}
          >
            {ordersVisible ? 'Hide' : 'Show'} Recent Orders
          </Button>
          {ordersVisible && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {isLoadingOrders ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : orders.length === 0 ? (
                <Empty description="No orders yet" />
              ) : (
                <Table
                  columns={orderColumns}
                  dataSource={orders.slice(0, 10).map((order) => ({ ...order, key: order.id }))}
                  pagination={false}
                  size="small"
                />
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Deposit Modal */}
        <DepositModal
          visible={depositModalVisible}
          onClose={() => setDepositModalVisible(false)}
          onSuccess={() => {
            refreshBalances();
            setDepositModalVisible(false);
          }}
        />

        {/* Withdraw Modal */}
        <WithdrawModal
          visible={withdrawModalVisible}
          onClose={() => setWithdrawModalVisible(false)}
          onSuccess={() => {
            refreshBalances();
            setWithdrawModalVisible(false);
          }}
          availableBalance={fiatBalance}
        />

        {/* Deposit Success Modal */}
        <AnimatePresence>
          {depositSuccessVisible && (
            <Modal
              open={depositSuccessVisible}
              onCancel={() => setDepositSuccessVisible(false)}
              footer={null}
              centered
              closable={true}
              width={500}
              styles={{
                body: {
                  padding: token.paddingXL,
                  textAlign: 'center',
                },
              }}
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', duration: 0.5 }}
              >
                {/* Success Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                    delay: 0.2,
                  }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${token.colorSuccess} 0%, ${token.colorSuccess} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    marginBottom: token.marginLG,
                    boxShadow: `0 8px 24px ${token.colorSuccess}40`,
                  }}
                >
                  <CheckCircleOutlined
                    style={{
                      fontSize: 48,
                      color: '#fff',
                    }}
                  />
                </motion.div>

                {/* Success Message */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Title
                    level={3}
                    style={{
                      marginBottom: token.marginMD,
                      fontWeight: fontWeights.bold,
                      color: token.colorText,
                    }}
                  >
                    Deposit Successful!
                  </Title>
                  {depositAmount && (
                    <Text
                      style={{
                        fontSize: token.fontSizeHeading4,
                        color: token.colorSuccess,
                        fontWeight: fontWeights.semibold,
                        display: 'block',
                        marginBottom: token.marginMD,
                      }}
                    >
                      +${depositAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                  )}
                  <Text
                    style={{
                      fontSize: token.fontSize,
                      color: token.colorTextSecondary,
                      display: 'block',
                      marginBottom: token.marginLG,
                    }}
                  >
                    Your balance has been updated successfully.
                  </Text>
                </motion.div>

                {/* Close Button */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => setDepositSuccessVisible(false)}
                    style={{
                      height: token.controlHeightLG,
                      fontSize: token.fontSizeLG,
                      fontWeight: fontWeights.semibold,
                      paddingLeft: token.paddingXL,
                      paddingRight: token.paddingXL,
                    }}
                  >
                    Got it!
                  </Button>
                </motion.div>
              </motion.div>
            </Modal>
          )}
        </AnimatePresence>
    </>
  );
};

// Persistent layout - keeps DashboardLayout mounted across page navigations
WalletPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default WalletPage;
