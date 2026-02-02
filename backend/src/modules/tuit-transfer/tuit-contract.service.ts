import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

const VESTING_CONTRACT_ADDRESS = '0x6D6154fc96503B80Cc7Ebb3990D46d94EDCbA433';
const TUIT_TOKEN_ADDRESS = '0x963Cd3E835D81ce8e4AE4836E654336DAB4298E9';
const DEPOSIT_WALLET_ADDRESS = '0x111A17090a3a4aF810Df2e8694c06205AFDb14A2';

const LINEAR_VESTING_ABI = [
  {
    type: 'function',
    name: 'totalTokens',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'unlockedTokens',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableTokensForWithdrawal',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vestingSchedules',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'totalAmount', type: 'uint256' },
      { name: 'releasedAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
];

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
];

// Transfer event ABI for parsing transaction logs
const TRANSFER_EVENT_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
];

const RPC_ENDPOINTS = [
  // 'https://eth.llamarpc.com',
  // 'https://rpc.ankr.com/eth',
  'https://ethereum.publicnode.com',
  'https://1rpc.io/eth',
];

export interface VestingData {
  walletAddress: string;
  totalAllocated: string;
  unlocked: string;
  withdrawn: string;
  availableToWithdraw: string;
}

export interface TransferInfo {
  from: string;
  to: string;
  amount: string;
  isValidDeposit: boolean;
}

@Injectable()
export class TuitContractService implements OnModuleInit {
  private readonly logger = new Logger(TuitContractService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private vestingContract: ethers.Contract | null = null;
  private tokenContract: ethers.Contract | null = null;

  async onModuleInit() {
    await this.initializeProvider();
  }

  private async initializeProvider(): Promise<void> {
    for (const rpc of RPC_ENDPOINTS) {
      try {
        this.logger.log(`Trying RPC: ${rpc}`);
        const provider = new ethers.JsonRpcProvider(rpc);
        await provider.getBlockNumber();
        this.provider = provider;
        this.vestingContract = new ethers.Contract(
          VESTING_CONTRACT_ADDRESS,
          LINEAR_VESTING_ABI,
          provider,
        );
        this.tokenContract = new ethers.Contract(
          TUIT_TOKEN_ADDRESS,
          [...ERC20_ABI, ...TRANSFER_EVENT_ABI],
          provider,
        );
        this.logger.log(`Connected to Ethereum via ${rpc}`);
        return;
      } catch (e) {
        this.logger.warn(`RPC ${rpc} failed: ${e.message}`);
      }
    }
    this.logger.error('All RPC endpoints failed');
  }

  private async ensureProvider(): Promise<void> {
    if (!this.provider || !this.vestingContract) {
      await this.initializeProvider();
      if (!this.provider || !this.vestingContract) {
        throw new Error('Unable to connect to Ethereum network');
      }
    }
  }

  /**
   * Get vesting data for a wallet address
   */
  async getVestingData(walletAddress: string): Promise<VestingData> {
    await this.ensureProvider();

    try {
      const [total, unlocked, available, schedule] = await Promise.all([
        this.vestingContract!.totalTokens(walletAddress),
        this.vestingContract!.unlockedTokens(walletAddress),
        this.vestingContract!.availableTokensForWithdrawal(walletAddress),
        this.vestingContract!.vestingSchedules(walletAddress),
      ]);

      return {
        walletAddress,
        totalAllocated: ethers.formatEther(total),
        unlocked: ethers.formatEther(unlocked),
        withdrawn: ethers.formatEther(schedule.releasedAmount),
        availableToWithdraw: ethers.formatEther(available),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch vesting data for ${walletAddress}: ${error.message}`);
      throw new Error(`Failed to fetch vesting data: ${error.message}`);
    }
  }

  /**
   * Verify a transaction hash and check if it's a valid TUIT transfer to our deposit wallet
   */
  async verifyTransferTransaction(txHash: string): Promise<TransferInfo | null> {
    await this.ensureProvider();

    try {
      const tx = await this.provider!.getTransaction(txHash);
      if (!tx) {
        return null;
      }

      const receipt = await this.provider!.getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) {
        return null;
      }

      // Parse transfer events from the transaction
      const iface = new ethers.Interface(TRANSFER_EVENT_ABI);

      for (const log of receipt.logs) {
        // Check if this log is from the TUIT token contract
        if (log.address.toLowerCase() !== TUIT_TOKEN_ADDRESS.toLowerCase()) {
          continue;
        }

        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const from = parsed.args.from;
            const to = parsed.args.to;
            const value = parsed.args.value;

            const isValidDeposit =
              to.toLowerCase() === DEPOSIT_WALLET_ADDRESS.toLowerCase();

            return {
              from,
              to,
              amount: ethers.formatEther(value),
              isValidDeposit,
            };
          }
        } catch {
          // Not a transfer event, continue
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to verify transaction ${txHash}: ${error.message}`);
      throw new Error(`Failed to verify transaction: ${error.message}`);
    }
  }

  /**
   * Get contract addresses for reference
   */
  getContractAddresses() {
    return {
      vestingContract: VESTING_CONTRACT_ADDRESS,
      tuitToken: TUIT_TOKEN_ADDRESS,
      depositWallet: DEPOSIT_WALLET_ADDRESS,
    };
  }
}
