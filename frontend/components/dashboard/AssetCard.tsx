'use client';

import React from 'react';
import { theme, Grid, Tooltip } from 'antd';
import { ExportOutlined, LineChartOutlined } from '@ant-design/icons';
import { fontWeights } from '@/theme/themeConfig';

const { useToken } = theme;
const { useBreakpoint } = Grid;

interface AssetCardProps {
  symbol: string;
  name: string;
  balance: string;
  value: string;
  change?: number;
  icon?: React.ReactNode;
  iconUrl?: string;
  color?: string;
  onClick?: () => void;
  onTransfer?: () => void;
  onTrade?: () => void;
  disabledActions?: boolean;
}

const AssetCard: React.FC<AssetCardProps> = ({
  symbol,
  name,
  balance,
  value,
  change,
  icon,
  iconUrl,
  color,
  onClick,
  onTransfer,
  onTrade,
  disabledActions = false,
}) => {
  const { token } = useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.xl;
  const isBelowLg = !screens.lg;
  const isBelowXl = !screens.xl;
  const accentColor = color || token.colorPrimary;

  const basePadding = isMobile ? token.paddingSM : token.paddingMD;
  const cardStyle: React.CSSProperties = {
    backgroundColor: token.colorBgContainer,
    borderRadius: token.borderRadius,
    paddingTop: basePadding,
    paddingBottom: basePadding,
    paddingLeft: isBelowXl ? '5px' : basePadding,
    paddingRight: isBelowXl ? '5px' : basePadding,
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? token.marginXS : token.marginMD,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'background-color 0.2s ease',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  };

  const iconContainerStyle: React.CSSProperties = {
    width: isMobile ? token.controlHeight : token.controlHeightLG,
    height: isMobile ? token.controlHeight : token.controlHeightLG,
    borderRadius: '50%',
    backgroundColor: iconUrl ? 'transparent' : accentColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: token.colorWhite,
    fontSize: isMobile ? token.fontSize : token.fontSizeLG,
    fontWeight: fontWeights.bold,
    flexShrink: 0,
    overflow: 'hidden',
  };

  const nameSectionStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginXXS,
    overflow: 'hidden',
  };

  const symbolStyle: React.CSSProperties = {
    fontSize: isMobile ? token.fontSizeSM : token.fontSizeLG,
    fontWeight: fontWeights.semibold,
    color: token.colorText,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: token.fontSizeSM,
    color: token.colorTextSecondary,
    lineHeight: 1.2,
    display: isMobile ? 'none' : 'block',
  };

  const valueSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: token.marginSM,
    flexShrink: 0,
    textAlign: 'right',
  };

  const balanceStyle: React.CSSProperties = {
    fontSize: isMobile ? token.fontSizeSM : token.fontSize,
    fontWeight: fontWeights.semibold,
    color: token.colorText,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: isMobile ? token.fontSizeSM : token.fontSize,
    color: token.colorTextSecondary,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };

  const changeStyle: React.CSSProperties = {
    fontSize: isMobile ? token.fontSizeSM : token.fontSize,
    fontWeight: fontWeights.medium,
    color: change && change >= 0 ? token.colorSuccess : token.colorError,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  };

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: isBelowLg ? 0 : token.marginXS,
    flexShrink: 0,
    alignItems: 'center',
  };

  const buttonBaseStyle: React.CSSProperties = {
    height: isMobile ? token.controlHeightSM : token.controlHeight,
    minWidth: 'auto',
    padding: isMobile ? `0 ${token.paddingXS}px` : isTablet ? `0 ${token.paddingXS}px` : `0 ${token.paddingMD}px`,
    fontSize: token.fontSizeSM,
    fontWeight: fontWeights.medium,
    borderRadius: token.borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isBelowLg ? 2 : token.marginXXS,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    background: isBelowLg ? 'transparent' : undefined,
    margin: 0,
  };

  const sendButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isBelowLg ? 'transparent' : token.colorPrimaryBg,
    color: token.colorPrimary,
    opacity: disabledActions ? 0.4 : 1,
    cursor: disabledActions ? 'not-allowed' : 'pointer',
  };

  const receiveButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: isBelowLg ? 'transparent' : token.colorSuccessBg,
    color: token.colorSuccess,
    marginLeft: isBelowLg ? 4 : 0,
    opacity: disabledActions ? 0.4 : 1,
    cursor: disabledActions ? 'not-allowed' : 'pointer',
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.backgroundColor = token.colorBgTextHover;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = token.colorBgContainer;
      }}
    >
      {/* Icon */}
      <div style={iconContainerStyle}>
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={symbol}
            width={isMobile ? token.controlHeight : token.controlHeightLG}
            height={isMobile ? token.controlHeight : token.controlHeightLG}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.style.backgroundColor = accentColor;
                parent.textContent = symbol.charAt(0);
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.justifyContent = 'center';
              }
            }}
          />
        ) : icon ? (
          icon
        ) : (
          symbol.charAt(0)
        )}
      </div>

      {/* Name Section */}
      <div style={nameSectionStyle}>
        <div style={symbolStyle}>{symbol}</div>
        <div style={nameStyle}>{name}</div>
      </div>

      {/* Value Section - Single row on both mobile and desktop */}
      <div style={valueSectionStyle}>
        <div style={valueStyle}>{value}</div>
        <div style={balanceStyle}>{balance}</div>
        {change !== undefined && !isMobile && !isTablet && (
          <div style={changeStyle}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </div>
        )}
      </div>

      {/* Actions - Same buttons on mobile and desktop */}
      {/* Actions - Same buttons on mobile and desktop */}
      <div style={actionsStyle}>
        {/* Transfer Button - Always Disabled for now */}
        <Tooltip title="Deposit and withdrawal for this asset is coming soon">
          <button
            style={{
              ...buttonBaseStyle,
              backgroundColor: isBelowLg ? 'transparent' : token.colorFillSecondary,
              color: token.colorTextDisabled,
              cursor: 'not-allowed',
              opacity: 0.6,
            }}
            disabled
          >
            <ExportOutlined />
            <span>Transfer</span>
          </button>
        </Tooltip>

        {/* Trade Button */}
        {onTrade && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTrade();
            }}
            style={{
              ...buttonBaseStyle,
              backgroundColor: isBelowLg ? 'transparent' : token.colorPrimaryBg,
              color: token.colorPrimary,
            }}
          >
            <LineChartOutlined />
            <span>Trade</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AssetCard;
