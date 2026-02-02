
import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Divider,
  Card,
  Radio,
  message,
  Modal,
  List,
  Avatar,
  Tag,
  Tooltip,
  Checkbox,
  Alert
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  LinkOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/router';
import { Token, CreateTokenDto } from '../../../types/token';
import { TokensApi } from '../../../services/api/tokens';
import { getTokenDetailsById } from '../../../services/api/coingecko';

interface TokenFormProps {
  initialData?: Token;
  isEdit?: boolean;
  onSubmit: (data: any) => Promise<void>;
  loading?: boolean;
}

export const TokenForm: React.FC<TokenFormProps> = ({
  initialData,
  isEdit = false,
  onSubmit,
  loading = false,
}) => {
  const router = useRouter();
  const [form] = Form.useForm();
  
  // Price Source Logic
  const [priceSource, setPriceSource] = useState<'coingecko' | 'contract' | 'manual'>('coingecko');
  
  // Search Widget State
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initialData) {
      form.setFieldsValue(initialData);
      
      // Determine initial price source
      if (initialData.contractAddress) {
        setPriceSource('contract');
      } else if (initialData.coingeckoId) {
        setPriceSource('coingecko');
      } else {
        setPriceSource('manual');
      }
    }
  }, [initialData, form]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await TokensApi.searchCoinGecko(searchQuery);
      setSearchResults(results);
    } catch (error) {
      message.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = async (coin: any) => {
    // 1. Set basic info immediately
    form.setFieldsValue({
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      coingeckoId: coin.id,
      iconUrl: coin.large || coin.thumb,
    });
    setPriceSource('coingecko');
    setSearchModalOpen(false);
    message.success(`Selected ${coin.name}`);

    // 2. Fetch full details for metadata
    const hideLoading = message.loading('Fetching token metadata...', 0);
    try {
      // Use ID-based fetch for accuracy
      const details = await getTokenDetailsById(coin.id);
      if (details) {
        form.setFieldsValue({
          description: details.description || '',
          website: details.links?.homepage?.[0] || '',
          twitter: details.links?.twitter_screen_name || '',
          discord: details.links?.chat_url?.[0] || '',
          whitepaper: details.links?.whitepaper || '',
        });
        message.success('Metadata auto-filled!');
      }
    } catch (err) {
      console.error('Failed to fetch metadata', err);
      // Non-critical, just ignore
    } finally {
      hideLoading();
    }
  };

  const handleSubmit = async (values: any) => {
    // Clean up based on Price Source
    const cleanValues = { ...values };

    // Force numeric conversion for fields that might come as strings from API/Form
    // Backend validation requires numbers, not strings.
    if (cleanValues.manualPrice !== undefined) cleanValues.manualPrice = Number(cleanValues.manualPrice);
    if (cleanValues.minTransactionAmount !== undefined) cleanValues.minTransactionAmount = Number(cleanValues.minTransactionAmount);
    if (cleanValues.maxTransactionAmount !== undefined) cleanValues.maxTransactionAmount = Number(cleanValues.maxTransactionAmount);
    
    if (priceSource === 'coingecko') {
      cleanValues.contractAddress = null;
      cleanValues.chain = null;
    } else if (priceSource === 'contract') {
      cleanValues.coingeckoId = null;
    } else {
      // Manual
      cleanValues.coingeckoId = null;
      cleanValues.contractAddress = null;
      cleanValues.chain = null;
    }

    await onSubmit(cleanValues);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        isActive: true,
        manualPrice: 0,
        minTransactionAmount: 10,
        maxTransactionAmount: 5000,
        ...initialData
      }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        {/* Basic Identity */}
        <Card title="Token Identity" extra={<Tag color="blue">Step 1</Tag>}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="name" label="Token Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Bitcoin" prefix={<DollarOutlined />} />
              </Form.Item>
              <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}>
                <Input placeholder="e.g. BTC" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Find on CoinGecko" style={{ marginBottom: 0 }}>
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />} 
                  onClick={() => setSearchModalOpen(true)}
                >
                  Open Smart Search Widget
                </Button>
                <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                  Search to auto-fill Name, Symbol, and ID.
                </div>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="iconUrl" label="Icon URL">
            <Input placeholder="https://..." prefix={<LinkOutlined />} />
          </Form.Item>
          
           <Form.Item name="isActive" valuePropName="checked" label="Active Status">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Card>

        {/* Price Discovery */}
        <Card title="Price Discovery" extra={<Tag color="purple">Step 2</Tag>}>
          <Radio.Group 
            value={priceSource} 
            onChange={e => setPriceSource(e.target.value)}
            buttonStyle="solid"
            style={{ marginBottom: 24 }}
          >
            <Radio.Button value="coingecko">CoinGecko ID (Standard)</Radio.Button>
            <Radio.Button value="contract">Contract Address (DEX)</Radio.Button>
            <Radio.Button value="manual">Manual Price (Fixed)</Radio.Button>
          </Radio.Group>

          {priceSource === 'coingecko' && (
             <Form.Item name="coingeckoId" label="CoinGecko ID" help="Use the Search Widget above to find this.">
               <Input placeholder="e.g. bitcoin" disabled />
             </Form.Item>
          )}

          {priceSource === 'contract' && (
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item name="contractAddress" label="Contract Address" rules={[{ required: true }]}>
                  <Input placeholder="0x..." prefix={<SafetyCertificateOutlined />} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="chain" label="Chain Slug" rules={[{ required: true }]}>
                  <Input placeholder="ethereum" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item 
            name="manualPrice" 
            label="Manual Price (USD)" 
            rules={[{ required: true }]}
            help={priceSource !== 'manual' ? "Used as fallback if API fails." : "Primary price source."}
          >
             <InputNumber 
               style={{ width: '100%' }} 
               prefix="$" 
               min={0} 
               precision={8}
             />
          </Form.Item>
        </Card>

        {/* Permissions & Controls */}
        <Card title="Permissions & Controls" extra={<Tag color="orange">Step 3</Tag>}>
          <Row gutter={[24, 24]}>
            {/* MARKET ACCESS */}
            <Col span={8}>
              <Divider>Market Access</Divider>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <Form.Item name="allowBuy" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Allow Buying</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Users can purchase this token on the exchange
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <Form.Item name="allowSell" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Allow Selling</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Users can sell this token on the exchange
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Form.Item name="allowP2P" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Allow P2P Trading</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Users can create peer-to-peer ads and trades
                  </div>
                </div>
              </div>
            </Col>

            {/* WALLET OPERATIONS */}
            <Col span={8}>
              <Divider>Wallet Operations</Divider>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <Form.Item name="allowDeposit" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Allow Deposits</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Users can deposit this token from external wallets
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Form.Item name="allowWithdraw" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <Switch />
                </Form.Item>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Allow Withdrawals</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Users can withdraw this token to external wallets
                  </div>
                </div>
              </div>
            </Col>

            {/* TRADING PAIRS */}
            <Col span={8}>
              <Divider>Trading Pairs</Divider>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                Enable quote currencies users can trade this token against
              </div>

              <Form.Item name="allowTradeUsd" valuePropName="checked" style={{ marginBottom: 8 }}>
                <Checkbox>USD Pair (TOKEN-USD)</Checkbox>
              </Form.Item>
              <Form.Item name="allowTradeUsdt" valuePropName="checked" style={{ marginBottom: 8 }}>
                <Checkbox>USDT Pair (TOKEN-USDT)</Checkbox>
              </Form.Item>
              <Form.Item name="allowTradeEth" valuePropName="checked" style={{ marginBottom: 8 }}>
                <Checkbox>ETH Pair (TOKEN-ETH)</Checkbox>
              </Form.Item>
              <Form.Item name="allowTradeTuit" valuePropName="checked">
                <Checkbox>TUIT Pair (TOKEN-TUIT)</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Transaction Limits */}
        <Card title="Transaction Limits" extra={<Tag color="green">Step 4</Tag>}>
          <Alert
            message="Per-Transaction Limits"
            description="These limits apply to each individual transaction in USD equivalent. Set to 0 for no limit."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="minTransactionAmount"
                label="Minimum Transaction Amount (USD)"
                tooltip="Users cannot trade less than this USD value per transaction"
              >
                <InputNumber style={{ width: '100%' }} prefix="$" min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maxTransactionAmount"
                label="Maximum Transaction Amount (USD)"
                tooltip="Users cannot trade more than this USD value per transaction"
              >
                <InputNumber style={{ width: '100%' }} prefix="$" min={0} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
        
        {/* Metadata */}
        <Card title="Metadata (Optional)">
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="website" label="Website"><Input prefix={<GlobalOutlined />} /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="twitter" label="Twitter"><Input prefix="@" /></Form.Item>
            </Col>
          </Row>
        </Card>

        <Divider />
        
        <Space size="large">
          <Button size="large" icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Cancel
          </Button>
          <Button 
            type="primary" 
            size="large" 
            htmlType="submit" 
            loading={loading}
            icon={<SaveOutlined />}
          >
            {isEdit ? 'Save Changes' : 'List Token'}
          </Button>
        </Space>

      </Space>

      {/* Search Modal */}
      <Modal
        title="Search CoinGecko"
        open={searchModalOpen}
        onCancel={() => setSearchModalOpen(false)}
        footer={null}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input 
            placeholder="Search e.g. 'Tuition' or 'Pepe'" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            onPressEnter={handleSearch} 
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} loading={searching}>
             Search
          </Button>
        </Space.Compact>
        
        <List
          itemLayout="horizontal"
          dataSource={searchResults}
          loading={searching}
          renderItem={(item: any) => (
            <List.Item 
              actions={[<Button size="small" onClick={() => selectSearchResult(item)}>Select</Button>]}
            >
              <List.Item.Meta
                avatar={<Avatar src={item.thumb} />}
                title={`${item.name} (${item.symbol})`}
                description={`ID: ${item.id} | Rank: #${item.market_cap_rank || 'N/A'}`}
              />
            </List.Item>
          )}
        />
      </Modal>

    </Form>
  );
};
