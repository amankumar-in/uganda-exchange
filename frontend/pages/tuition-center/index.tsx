import React, { useState, useEffect, ReactElement } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { theme, Grid, Progress } from 'antd';
import { motion } from 'motion/react';
import {
  SafetyCertificateOutlined,
  CustomerServiceOutlined,
  PieChartOutlined,
  BankOutlined,
  LockOutlined,
  RocketOutlined,
  BookOutlined,
  ClockCircleOutlined,
  ReadOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { fontWeights } from '@/theme/themeConfig';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/context/ThemeContext';
import type { NextPageWithLayout } from '../_app';

const { useToken } = theme;
const { useBreakpoint } = Grid;

interface LearningModule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  colorLight: string;
  colorDark: string;
  emoji: string;
  progress: number;
  lessons: number;
  duration: string;
  difficulty: 'Beginner' | 'Easy' | 'Intermediate';
  comingSoon?: boolean;
}

const learningModules: LearningModule[] = [
  {
    id: 'kyc-101',
    title: 'KYC 101',
    description: 'Learn why we verify your identity and how it keeps your money safe!',
    icon: <SafetyCertificateOutlined />,
    color: '#10B981',
    colorLight: '#6EE7B7',
    colorDark: '#047857',
    emoji: '🛡️',
    progress: 0,
    lessons: 4,
    duration: '10 min',
    difficulty: 'Beginner',
  },
  {
    id: 'customer-support',
    title: 'Getting Help',
    description: 'Discover how to contact our friendly support team when you need assistance.',
    icon: <CustomerServiceOutlined />,
    color: '#8B5CF6',
    colorLight: '#C4B5FD',
    colorDark: '#5B21B6',
    emoji: '💬',
    progress: 0,
    lessons: 3,
    duration: '8 min',
    difficulty: 'Beginner',
  },
  {
    id: 'portfolio-basics',
    title: 'Your Portfolio',
    description: 'Understand what your portfolio shows and how to read your investments.',
    icon: <PieChartOutlined />,
    color: '#F59E0B',
    colorLight: '#FCD34D',
    colorDark: '#B45309',
    emoji: '📊',
    progress: 0,
    lessons: 5,
    duration: '15 min',
    difficulty: 'Easy',
  },
  {
    id: 'savings-101',
    title: 'Savings 101',
    description: 'Learn the magic of saving money and watch it grow over time!',
    icon: <BankOutlined />,
    color: '#EC4899',
    colorLight: '#F9A8D4',
    colorDark: '#9D174D',
    emoji: '🐷',
    progress: 0,
    lessons: 6,
    duration: '12 min',
    difficulty: 'Beginner',
  },
  {
    id: 'security-tips',
    title: 'Stay Safe Online',
    description: 'Important tips to protect your account and keep hackers away!',
    icon: <LockOutlined />,
    color: '#EF4444',
    colorLight: '#FCA5A5',
    colorDark: '#991B1B',
    emoji: '🔐',
    progress: 0,
    lessons: 4,
    duration: '10 min',
    difficulty: 'Easy',
  },
  {
    id: 'crypto-adventure',
    title: 'Crypto Adventure',
    description: 'Explore the exciting world of digital currencies in a fun way!',
    icon: <RocketOutlined />,
    color: '#06B6D4',
    colorLight: '#67E8F9',
    colorDark: '#0E7490',
    emoji: '🚀',
    progress: 0,
    lessons: 8,
    duration: '20 min',
    difficulty: 'Intermediate',
    comingSoon: true,
  },
];

const TuitionCenterPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { token } = useToken();
  const { user, isLoading } = useAuth();
  const { mode } = useThemeMode();
  const screens = useBreakpoint();
  const [mounted, setMounted] = useState(false);
  const [completedModules, setCompletedModules] = useState<string[]>([]);

  const isDark = mode === 'dark';
  const isMobile = mounted ? !screens.md : false;
  const isSmallScreen = mounted ? !screens.lg : false; // Mobile + Tablet (< 992px)

  useEffect(() => {
    setMounted(true);
    // Load completed modules from localStorage
    const completed = JSON.parse(localStorage.getItem('completedModules') || '[]');
    setCompletedModules(completed);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login?redirect=/tuition-center');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Tuition Center - UG Coin</title>
        <meta name="description" content="Learn about investing and finance in a fun way!" />
      </Head>

      {/* Page Header */}
      <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: token.marginLG,
            flexWrap: 'wrap',
            gap: token.marginSM,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>
            <BookOutlined style={{ fontSize: isMobile ? 28 : 36, color: token.colorPrimary }} />
            <h1
              style={{
                fontSize: isMobile ? token.fontSizeHeading4 : token.fontSizeHeading3,
                fontWeight: fontWeights.bold,
                color: token.colorText,
                margin: 0,
              }}
            >
              Tuition Center
            </h1>
          </div>
          
          {/* Progress - simple text */}
          <span style={{
            fontSize: token.fontSize,
            color: token.colorTextSecondary,
          }}>
            {completedModules.length}/{learningModules.length} completed
          </span>
        </div>

        {/* Learning Modules - Claymorphic Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isSmallScreen ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? token.marginMD : token.marginLG,
          }}
        >
          {learningModules.map((module, index) => {
            // Only KYC-101 is active for now
            const isActive = module.id === 'kyc-101';
            const isDisabled = module.comingSoon || !isActive;
            
            return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              whileHover={isDisabled ? {} : { y: -4 }}
              whileTap={isDisabled ? {} : { scale: 0.98 }}
              onClick={() => {
                if (isActive) {
                  router.push('/tuition-center/kyc-101');
                }
              }}
              style={{
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.45 : 1,
                filter: isDisabled ? 'grayscale(90%) brightness(0.85)' : 'none',
                position: 'relative',
              }}
            >
              {/* Flat Card */}
              <div
                style={{
                  position: 'relative',
                  borderRadius: 24,
                  padding: isMobile ? token.paddingMD : token.paddingLG,
                  // Flat colored background
                  background: isDark
                    ? module.colorDark
                    : module.color,
                  overflow: 'hidden',
                }}
              >
                {/* Coming Soon Overlay for disabled modules */}
                {isDisabled && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      background: 'rgba(0,0,0,0.5)',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: 20,
                      fontSize: token.fontSizeSM,
                      fontWeight: fontWeights.bold,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      zIndex: 10,
                    }}
                  >
                    <LockOutlined /> Soon
                  </div>
                )}
                {/* Content */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: token.marginMD,
                    marginBottom: token.marginMD,
                  }}
                >
                  {/* Emoji - flat container */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: isDark
                        ? 'rgba(255,255,255,0.15)'
                        : 'rgba(255,255,255,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                      flexShrink: 0,
                    }}
                  >
                    {module.emoji}
                  </div>
                  
                  {/* Text - light color for contrast on colored bg */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, marginBottom: 4 }}>
                      <h3
                        style={{
                          fontSize: token.fontSizeHeading5,
                          fontWeight: fontWeights.bold,
                          color: '#ffffff',
                          margin: 0,
                        }}
                      >
                        {module.title}
                      </h3>
                      {module.comingSoon && (
                        <span
                          style={{
                            fontSize: token.fontSizeSM,
                            fontWeight: fontWeights.bold,
                            color: '#ffffff',
                            background: isDark
                              ? 'rgba(255,255,255,0.2)'
                              : 'rgba(255,255,255,0.25)',
                            padding: '3px 10px',
                            borderRadius: 12,
                          }}
                        >
                          Soon
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: token.fontSize,
                        color: 'rgba(255,255,255,0.9)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {module.description}
                    </p>
                  </div>
                </div>

                {/* Footer - flat panel */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: `${token.paddingSM}px ${token.paddingMD}px`,
                    borderRadius: 12,
                    background: isDark
                      ? 'rgba(0,0,0,0.25)'
                      : 'rgba(0,0,0,0.15)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginMD }}>
                    {/* Difficulty pill - flat */}
                    <span
                      style={{
                        fontSize: token.fontSize,
                        fontWeight: fontWeights.bold,
                        color: '#ffffff',
                        padding: '4px 12px',
                        background: isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(255,255,255,0.25)',
                        borderRadius: 20,
                      }}
                    >
                      {module.difficulty}
                    </span>
                    <span style={{ 
                      fontSize: token.fontSize, 
                      color: 'rgba(255,255,255,0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <ClockCircleOutlined /> {module.duration}
                    </span>
                    <span style={{ 
                      fontSize: token.fontSize, 
                      color: 'rgba(255,255,255,0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <ReadOutlined /> {module.lessons}
                    </span>
                  </div>

                  {module.progress > 0 ? (
                    <div style={{ width: 80 }}>
                      <Progress
                        percent={module.progress}
                        size="small"
                        strokeColor="#ffffff"
                        trailColor="rgba(255,255,255,0.2)"
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                  ) : !module.comingSoon ? (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: isDark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(255,255,255,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 16,
                      }}
                    >
                      <ArrowRightOutlined />
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          );
          })}
        </div>
    </>
  );
};

// Persistent layout - keeps DashboardLayout mounted across page navigations
TuitionCenterPage.getLayout = (page: ReactElement) => (
  <DashboardLayout>{page}</DashboardLayout>
);

export default TuitionCenterPage;
