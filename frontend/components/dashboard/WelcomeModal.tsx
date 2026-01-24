'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, theme } from 'antd';
import {
  CloseOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'motion/react';
import { fontWeights } from '@/theme/themeConfig';
import { Balance } from '@/services/api/assets';
import { throttle } from '@/utils/debounce';

const { useToken } = theme;

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
  balances: Balance[];
  pairs: Array<{
    baseCurrency: string;
    name: string;
    iconUrl: string;
    price: number;
    isCollegeCoin?: boolean;
  }>;
}

export default function WelcomeModal({
  visible,
  onClose,
  balances,
  pairs,
}: WelcomeModalProps) {
  const { token } = useToken();
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

  if (!mounted) return null;

  // Get USD balance
  const usdBalance = balances.find((b) => b.asset === 'USD');
  const cashAmount = usdBalance?.balance || 0;

  // Get college coin balances with names
  const collegeCoinsReceived = balances
    .filter((b) => b.asset !== 'USD' && b.balance > 0)
    .map((b) => {
      const pair = pairs.find(
        (p) => p.baseCurrency === b.asset && p.isCollegeCoin
      );
      return {
        asset: b.asset,
        name: pair?.name || b.asset,
        iconUrl:
          pair?.iconUrl ||
          `https://ui-avatars.com/api/?name=${b.asset}&background=667eea&color=fff&size=64`,
        balance: b.balance,
        value: pair ? b.balance * pair.price : 0,
      };
    })
    .filter((c) => c.value > 0); // Only show coins with value

  const totalCryptoValue = collegeCoinsReceived.reduce(
    (sum, c) => sum + c.value,
    0
  );

  const modalContent = (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
              cursor: 'pointer',
            }}
          />

          {/* Modal Container */}
          <motion.div
            initial={
              isMobile
                ? { y: '100%' }
                : { scale: 0.95, opacity: 0, x: '-50%', y: '-50%' }
            }
            animate={
              isMobile
                ? { y: 0 }
                : { scale: 1, opacity: 1, x: '-50%', y: '-50%' }
            }
            exit={
              isMobile
                ? { y: '100%' }
                : { scale: 0.95, opacity: 0, x: '-50%', y: '-50%' }
            }
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
                    maxWidth: 400,
                  }),
              zIndex: 9999,
            }}
          >
            {/* Drag Handle (Mobile Only) */}
            {isMobile && (
              <div
                style={{
                  width: '100%',
                  paddingTop: token.paddingSM,
                  paddingBottom: token.paddingXS,
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'transparent',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                  }}
                />
              </div>
            )}

            {/* Modal Content */}
            <div
              style={{
                backgroundColor: token.colorBgContainer,
                borderRadius: isMobile
                  ? `${token.borderRadiusLG * 2}px ${token.borderRadiusLG * 2}px 0 0`
                  : token.borderRadiusLG,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -4px 30px rgba(0,0,0,0.2)',
              }}
            >
              {/* Compact Header - Single Row */}
              <div
                style={{
                  position: 'relative',
                  padding: `${token.paddingMD}px ${token.paddingLG}px`,
                  background:
                    'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: token.marginSM,
                }}
              >
                {/* Close Button */}
                {!isMobile && (
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={onClose}
                    style={{
                      position: 'absolute',
                      top: token.paddingSM,
                      right: token.paddingSM,
                      color: 'rgba(255,255,255,0.8)',
                      minWidth: 28,
                      height: 28,
                    }}
                  />
                )}

                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 15,
                    delay: 0.1,
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <GiftOutlined style={{ fontSize: 22, color: '#fff' }} />
                </motion.div>

                {/* Title */}
                <div>
                  <motion.h2
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    style={{
                      margin: 0,
                      color: '#fff',
                      fontSize: token.fontSizeLG,
                      fontWeight: fontWeights.bold,
                    }}
                  >
                    Welcome to InTuition Exchange! 🎉
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                      margin: 0,
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: token.fontSizeSM,
                    }}
                  >
                    We&apos;ve loaded your account with virtual funds to practice trading risk-free.
                  </motion.p>
                </div>
              </div>

              {/* Content */}
              <div
                style={{
                  padding: token.paddingMD,
                  paddingTop: token.paddingLG,
                }}
              >
                {/* Cash Balance */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: token.paddingSM,
                    background: token.colorBgLayout,
                    borderRadius: token.borderRadius,
                    marginBottom: token.marginMD,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background:
                          'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: fontWeights.bold,
                        fontSize: 16,
                      }}
                    >
                      $
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: fontWeights.semibold,
                          color: token.colorText,
                          fontSize: token.fontSize,
                        }}
                      >
                        Virtual Cash
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: token.colorTextTertiary,
                        }}
                      >
                        USD
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: fontWeights.bold,
                      color: token.colorSuccess,
                      fontSize: token.fontSizeLG,
                    }}
                  >
                    $
                    {cashAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </motion.div>

                {/* College Coins - Single Row Grid */}
                {collegeCoinsReceived.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div
                      style={{
                        fontSize: token.fontSizeSM,
                        color: token.colorTextSecondary,
                        marginBottom: token.marginXS,
                      }}
                    >
                      College Coins (~$
                      {totalCryptoValue.toLocaleString('en-US', {
                        maximumFractionDigits: 0,
                      })}
                      )
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${Math.min(collegeCoinsReceived.length, 4)}, 1fr)`,
                        gap: token.marginXS,
                        background: token.colorBgLayout,
                        borderRadius: token.borderRadius,
                        padding: token.paddingSM,
                      }}
                    >
                      {collegeCoinsReceived.slice(0, 4).map((coin, index) => (
                        <motion.div
                          key={coin.asset}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.35 + index * 0.05 }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            padding: token.paddingXS,
                          }}
                        >
                          <img
                            src={coin.iconUrl}
                            alt={coin.asset}
                            width={32}
                            height={32}
                            style={{ borderRadius: '50%', marginBottom: 4 }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${coin.asset}&background=8B5CF6&color=fff&size=64`;
                            }}
                          />
                          <div
                            style={{
                              fontWeight: fontWeights.semibold,
                              color: token.colorText,
                              fontSize: token.fontSizeSM,
                              lineHeight: 1.2,
                            }}
                          >
                            {coin.asset}
                          </div>
                          <div
                            style={{
                              fontSize: 10,
                              color: token.colorTextTertiary,
                            }}
                          >
                            ~$
                            {coin.value.toLocaleString('en-US', {
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Motivational Challenge Card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  style={{
                    marginTop: token.marginMD,
                    padding: token.paddingMD,
                    background: 'linear-gradient(135deg, rgba(13, 115, 119, 0.12) 0%, rgba(20, 145, 155, 0.08) 100%)',
                    borderRadius: token.borderRadiusLG,
                    border: '1px solid rgba(13, 115, 119, 0.2)',
                  }}
                >
                  <div
                    style={{
                      fontSize: token.fontSize,
                      fontWeight: fontWeights.semibold,
                      color: token.colorText,
                      marginBottom: 4,
                    }}
                  >
                    Think you can turn $100K into{' '}
                    <span style={{ color: '#0d7377' }}>$1,000,000</span>?
                  </div>
                  <div
                    style={{
                      fontSize: token.fontSizeSM,
                      color: token.colorTextSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    Master the markets, build your strategy, and climb the leaderboard.
                    Who knows? The best traders might find something special waiting for them. 👀
                  </div>
                </motion.div>
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: token.paddingMD,
                  paddingTop: token.paddingXS,
                  paddingBottom: isMobile ? token.paddingLG : token.paddingMD,
                }}
              >
                <Button
                  type="primary"
                  size="large"
                  onClick={onClose}
                  block
                  style={{
                    height: 46,
                    fontSize: token.fontSize,
                    fontWeight: fontWeights.bold,
                    borderRadius: token.borderRadius,
                    background:
                      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  Start Your Journey
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

