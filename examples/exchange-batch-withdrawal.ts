/**
 * Exchange Batch Withdrawal Processor
 * 
 * This example demonstrates how to process multiple user withdrawals in a single
 * batch transaction using Highload Wallet V3. This is much more efficient than
 * sending individual transactions.
 * 
 * Usage:
 *   ts-node examples/exchange-batch-withdrawal.ts
 */

import { Address, toNano, SendMode, beginCell, internal, OutActionSendMsg } from '@ton/core';
import { TonClient } from '@ton/ton';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { KeyPair } from 'ton-crypto';

// Configuration
const API_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC';
const SUBWALLET_ID = 0x10ad; // Your exchange wallet subwallet ID
const TIMEOUT = 3600; // 1 hour timeout
const MAX_BATCH_SIZE = 254; // Maximum messages per batch
const TEST_USER_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c'; // Replace with real user address

interface WithdrawalRequest {
    userId: string;
    address: string;
    amount: bigint;
    withdrawalId: string;
}

/**
 * Database interface for withdrawal management
 */
class WithdrawalDatabase {
    private pendingWithdrawals: Map<string, WithdrawalRequest> = new Map();
    private processedWithdrawals: Set<string> = new Set();

    async getPendingWithdrawals(limit: number = MAX_BATCH_SIZE): Promise<WithdrawalRequest[]> {
        // TODO: Get pending withdrawals from your database
        const withdrawals = Array.from(this.pendingWithdrawals.values()).slice(0, limit);
        return withdrawals;
    }

    async markWithdrawalProcessing(withdrawalId: string): Promise<void> {
        // TODO: Mark withdrawal as being processed in your database
        console.log(`⏳ Marking withdrawal ${withdrawalId} as processing`);
    }

    async markWithdrawalCompleted(withdrawalId: string, txHash: string): Promise<void> {
        // TODO: Mark withdrawal as completed in your database
        this.processedWithdrawals.add(withdrawalId);
        this.pendingWithdrawals.delete(withdrawalId);
        console.log(`✅ Withdrawal ${withdrawalId} completed (tx: ${txHash})`);
    }

    async markWithdrawalFailed(withdrawalId: string, error: string): Promise<void> {
        // TODO: Mark withdrawal as failed in your database
        console.error(`❌ Withdrawal ${withdrawalId} failed: ${error}`);
    }

    // Test method to add sample withdrawals
    addTestWithdrawal(request: WithdrawalRequest): void {
        this.pendingWithdrawals.set(request.withdrawalId, request);
    }
}

/**
 * Batch Withdrawal Processor
 */
class BatchWithdrawalProcessor {
    private client: TonClient;
    private wallet: HighloadWalletV3;
    private db: WithdrawalDatabase;
    private keyPair: KeyPair;
    private lastQueryId: HighloadQueryId;

    constructor(
        apiEndpoint: string,
        walletAddress: Address,
        keyPair: KeyPair,
        subwalletId: number,
        timeout: number
    ) {
        this.client = new TonClient({ endpoint: apiEndpoint });
        this.wallet = HighloadWalletV3.createFromAddress(walletAddress);
        this.db = new WithdrawalDatabase();
        this.keyPair = keyPair;
        this.lastQueryId = new HighloadQueryId();
        
        console.log(`💼 Initialized withdrawal processor for wallet: ${walletAddress.toString()}`);
    }

    /**
     * Create outgoing messages for withdrawals
     */
    private async createWithdrawalMessages(withdrawals: WithdrawalRequest[]): Promise<OutActionSendMsg[]> {
        const messages: OutActionSendMsg[] = [];

        for (const withdrawal of withdrawals) {
            try {
                const destAddress = Address.parse(withdrawal.address);

                // Create internal transfer message
                const message: OutActionSendMsg = {
                    type: 'sendMsg',
                    mode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                    outMsg: internal({
                        to: destAddress,
                        value: withdrawal.amount,
                        bounce: false,
                        body: beginCell()
                            .storeUint(0, 32) // text comment op
                            .storeStringTail(`Withdrawal: ${withdrawal.withdrawalId}`)
                            .endCell()
                    })
                };

                messages.push(message);
                console.log(`  📤 ${withdrawal.userId}: ${withdrawal.amount} nanotons to ${withdrawal.address}`);

            } catch (e) {
                console.error(`  ⚠️  Invalid withdrawal ${withdrawal.withdrawalId}:`, e);
                await this.db.markWithdrawalFailed(withdrawal.withdrawalId, `Invalid address: ${e}`);
            }
        }

        return messages;
    }

    /**
     * Get next available query ID
     */
    private getNextQueryId(): HighloadQueryId {
        if (this.lastQueryId.hasNext()) {
            this.lastQueryId = this.lastQueryId.getNext();
            return this.lastQueryId;
        } else {
            throw new Error('Query ID exhausted. Wait for timeout period to reset.');
        }
    }

    /**
     * Process a batch of withdrawals
     */
    async processBatch(): Promise<void> {
        try {
            console.log('\n🔄 Processing withdrawal batch...');
            
            // Get pending withdrawals
            const withdrawals = await this.db.getPendingWithdrawals(MAX_BATCH_SIZE);
            
            if (withdrawals.length === 0) {
                console.log('✓ No pending withdrawals');
                return;
            }

            console.log(`📋 Found ${withdrawals.length} pending withdrawal(s)`);

            // Mark as processing
            for (const withdrawal of withdrawals) {
                await this.db.markWithdrawalProcessing(withdrawal.withdrawalId);
            }

            // Create messages
            const messages = await this.createWithdrawalMessages(withdrawals);

            if (messages.length === 0) {
                console.log('⚠️  No valid messages to send');
                return;
            }

            // Get next query ID
            const queryId = this.getNextQueryId();
            console.log(`🔢 Using query ID: ${queryId.getQueryId()} (shift: ${queryId.getShift()}, bit: ${queryId.getBitNumber()})`);

            // Send batch
            const createdAt = Math.floor(Date.now() / 1000);
            
            console.log('📡 Sending batch transaction...');
            
            await this.wallet.sendBatch(
                this.client.provider(this.wallet.address),
                this.keyPair.secretKey,
                messages,
                SUBWALLET_ID,
                queryId,
                TIMEOUT,
                createdAt
            );

            // In a real implementation, you would:
            // 1. Wait for transaction confirmation
            // 2. Verify transaction status
            // 3. Mark withdrawals as completed
            
            // For now, simulate transaction hash.
            // NOTE: This is intentionally non-deterministic and intended for demo/testing only.
            // Format: "batch_<queryId>_<unix_timestamp_seconds>", where the timestamp is based on
            // the current wall-clock time. In production, always use the actual transaction hash
            // obtained from the blockchain instead of this simulated value.
            const simulatedTxHash = `batch_${queryId.getQueryId()}_${createdAt}`;
            
            console.log(`✅ Batch sent successfully!`);
            console.log(`   Transaction: ${simulatedTxHash}`);
            
            // TODO: In production, implement proper transaction confirmation:
            // 1. Wait for transaction to be included in a block
            // 2. Verify transaction status using the actual transaction hash
            // 3. Check for bounce messages indicating failures
            // 4. Only mark as completed after sufficient confirmations
            
            // For demo purposes only - mark as completed with simulated hash
            for (const withdrawal of withdrawals) {
                await this.db.markWithdrawalCompleted(withdrawal.withdrawalId, simulatedTxHash);
            }

        } catch (e) {
            console.error('❌ Error processing batch:', e);
            throw e;
        }
    }

    /**
     * Get database instance (for testing)
     */
    getDatabase(): WithdrawalDatabase {
        return this.db;
    }
}

/**
 * Example usage
 */
async function main() {
    console.log('🚀 Exchange Batch Withdrawal Processor\n');

    // In a real implementation, load these from secure storage or environment variables.
    // For this example, we expect hex-encoded keys to be provided via environment variables.
    const publicKeyHex = process.env.EXAMPLE_PUBLIC_KEY_HEX;
    const secretKeyHex = process.env.EXAMPLE_SECRET_KEY_HEX;

    if (!publicKeyHex || !secretKeyHex) {
        throw new Error(
            'Example key pair not configured. Set EXAMPLE_PUBLIC_KEY_HEX (32-byte hex) ' +
            'and EXAMPLE_SECRET_KEY_HEX (64-byte hex) environment variables before running this example.'
        );
    }

    const mockKeyPair: KeyPair = {
        publicKey: Buffer.from(publicKeyHex, 'hex'),
        secretKey: Buffer.from(secretKeyHex, 'hex')
    };

    // Your exchange's highload wallet address
    const rawWalletAddress = process.env.EXCHANGE_WALLET_ADDRESS;
    if (!rawWalletAddress) {
        throw new Error('EXCHANGE_WALLET_ADDRESS environment variable is not set. Please configure your highload wallet address before running this example.');
    }
    if (rawWalletAddress === 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAU') {
        throw new Error('EXCHANGE_WALLET_ADDRESS is set to a placeholder zero address. Please replace it with your real highload wallet address.');
    }

    let walletAddress: Address;
    try {
        walletAddress = Address.parse(rawWalletAddress);
    } catch (err) {
        throw new Error('Failed to parse EXCHANGE_WALLET_ADDRESS as a valid TON address: ' + (err instanceof Error ? err.message : String(err)));
    }

    // Initialize processor
    const processor = new BatchWithdrawalProcessor(
        API_ENDPOINT,
        walletAddress,
        mockKeyPair,
        SUBWALLET_ID,
        TIMEOUT
    );

    // Add some test withdrawals
    const db = processor.getDatabase();
    
    db.addTestWithdrawal({
        userId: 'user123',
        address: TEST_USER_ADDRESS,
        amount: toNano('10'),
        withdrawalId: 'wd_001'
    });

    db.addTestWithdrawal({
        userId: 'user456',
        address: TEST_USER_ADDRESS,
        amount: toNano('25.5'),
        withdrawalId: 'wd_002'
    });

    db.addTestWithdrawal({
        userId: 'user789',
        address: TEST_USER_ADDRESS,
        amount: toNano('100'),
        withdrawalId: 'wd_003'
    });

    // Process batch
    try {
        await processor.processBatch();
    } catch (e) {
        console.error('Failed to process batch:', e);
        process.exit(1);
    }

    console.log('\n✅ Batch processing complete!\n');
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { BatchWithdrawalProcessor, WithdrawalDatabase, WithdrawalRequest };
