import React, { useEffect } from 'react';
import { Layout, Menu, Typography, Space, Button, theme } from 'antd';
import {
  UserOutlined,
  ThunderboltOutlined,
  LogoutOutlined,
  HomeOutlined,
  FolderOutlined,
  TeamOutlined,
  DollarOutlined,
  GlobalOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;
const { useToken } = theme;

interface AdminLayoutProps {
  children: React.ReactNode;
  selectedKey?: string;
  title?: string;
  subtitle?: string;
  hideHeader?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  selectedKey = 'users',
  title,
  subtitle,
  hideHeader = false,
}) => {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { mode } = useThemeMode();
  const { token } = useToken();
  
  const isDark = mode === 'dark';

  // Redirect if not admin
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Don't render if not admin
  if (isLoading || !user || user.role !== 'ADMIN') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: token.colorBgContainer,
        color: token.colorText,
      }}>
        Loading...
      </div>
    );
  }

  const menuItems = [
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <Link href="/admin/users">Users</Link>,
    },
    {
      key: 'p2p-disputes',
      icon: <TeamOutlined />,
      label: <Link href="/admin/p2p/disputes">P2P Disputes</Link>,
    },
    {
      key: 'kyc-restrictions',
      icon: <GlobalOutlined />,
      label: <Link href="/admin/kyc-restrictions">KYC Restrictions</Link>,
    },
    {
      key: 'assets',
      icon: <DollarOutlined />,
      label: <Link href="/admin/assets">Asset Manager</Link>,
    },
    {
      key: 'college-coins',
      icon: <ThunderboltOutlined />,
      label: <Link href="/admin/college-coins">Demo College Coins</Link>,
    },
    {
      key: 'media',
      icon: <FolderOutlined />,
      label: <Link href="/admin/media">Media Manager</Link>,
    },
    {
      key: 'tuit-transfer',
      icon: <SwapOutlined />,
      label: <Link href="/admin/tuit-transfer">TUIT Transfer</Link>,
    },
  ];

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        theme={isDark ? 'dark' : 'light'}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: isDark ? token.colorBgContainer : '#fff',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ padding: '16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <Space direction="vertical" size={4}>
            <Title level={4} style={{ margin: 0, color: token.colorText }}>
              Intuition Admin
            </Title>
            <Typography.Text style={{ color: token.colorTextSecondary, fontSize: 12 }}>
              {user.email}
            </Typography.Text>
          </Space>
        </div>

        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ borderRight: 0, background: 'transparent' }}
        />

        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          padding: '16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Link href="/dashboard" style={{ width: '100%' }}>
              <Button 
                type="text" 
                icon={<HomeOutlined />}
                block
                style={{ color: token.colorText, textAlign: 'left' }}
              >
                User Dashboard
              </Button>
            </Link>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              block
              onClick={handleLogout}
              style={{ color: token.colorText, textAlign: 'left' }}
            >
              Logout
            </Button>
          </Space>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 240, background: isDark ? token.colorBgLayout : '#f5f5f5' }}>
        {!hideHeader && (
          <Header style={{
            padding: '0 24px',
            height: 'auto',
            minHeight: 64,
            lineHeight: 'normal',
            paddingTop: 16,
            paddingBottom: 16,
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
          }}>
            <div>
              <Title level={4} style={{ margin: 0, color: token.colorText }}>
                {title || (
                  <>
                    {selectedKey === 'users' && 'User Management'}
                    {selectedKey === 'p2p-disputes' && 'P2P Disputes'}
                    {selectedKey === 'kyc-restrictions' && 'KYC Restrictions'}
                    {selectedKey === 'college-coins' && 'Demo College Coins (Learner Mode)'}
                    {selectedKey === 'media' && 'Media Manager'}
                  </>
                )}
              </Title>
              {subtitle && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {subtitle}
                </Typography.Text>
              )}
            </div>
          </Header>
        )}

        <Content style={{ 
          margin: '24px', 
          padding: 24, 
          minHeight: 280, 
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
