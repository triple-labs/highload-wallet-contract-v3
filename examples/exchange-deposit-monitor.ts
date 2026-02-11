/**
 * Exchange Deposit Monitor
 * 
 * This example demonstrates how to monitor incoming deposits to a highload wallet
 * for an exchange. It continuously polls the blockchain for new transactions and
 * processes deposits by crediting user accounts.
 * 
 * Usage:
 *   ts-node examples/exchange-deposit-monitor.ts
 */

import { TonClient, Address, Transaction } from '@ton/ton';
import { sleep } from '../utils';

// Configuration
const EXCHANGE_WALLET_ADDRESS = 'YOUR_EXCHANGE_WALLET_ADDRESS'; // Replace with your exchange wallet address
const API_ENDPOINT = 'https://toncenter.com/api/v2/jsonRPC'; // Or your own node
const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds
const MIN_CONFIRMATIONS = 3; // Minimum block confirmations before crediting
const MIN_DEPOSIT_AMOUNT = 1000000000n; // Minimum 1 TON (in nanotons)

interface UserDeposit {
    userId: string;
    transactionHash: string;
    amount: bigint;
    sender: string;
    timestamp: number;
    confirmations: number;
}

/**
 * Database interface - replace with your actual database implementation
 */
class DepositDatabase {
    private processedTxs: Set<string> = new Set();
    private pendingDeposits: Map<string, UserDeposit> = new Map();

    async isTransactionProcessed(txHash: string): Promise<boolean> {
        // TODO: Check your database if this transaction was already processed
        return this.processedTxs.has(txHash);
    }

    async markTransactionProcessed(txHash: string): Promise<void> {
        // TODO: Mark transaction as processed in your database
        this.processedTxs.add(txHash);
        console.log(`✓ Transaction ${txHash} marked as processed`);
    }

    async creditUserAccount(userId: string, amount: bigint, txHash: string): Promise<void> {
        // TODO: Credit the user's account in your database
        console.log(`💰 Credited ${amount} nanotons to user ${userId} (tx: ${txHash})`);
    }

    async getUserByAddress(address: string): Promise<string | null> {
        // TODO: Look up user by deposit address in your database
        // If using unique addresses per user, map address -> user_id
        return null;
    }

    async getUserByMemo(memo: string): Promise<string | null> {
        // TODO: Parse memo/comment to extract user ID
        // Format could be: "DEPOSIT:USER123" or just "USER123"
        if (memo.startsWith('DEPOSIT:')) {
            return memo.substring(8);
        }
        return memo;
    }

    async addPendingDeposit(deposit: UserDeposit): Promise<void> {
        this.pendingDeposits.set(deposit.transactionHash, deposit);
    }

    async getPendingDeposits(): Promise<UserDeposit[]> {
        return Array.from(this.pendingDeposits.values());
    }

    async removePendingDeposit(txHash: string): Promise<void> {
        this.pendingDeposits.delete(txHash);
    }
}

/**
 * Deposit Monitor Class
 */
class DepositMonitor {
    private client: TonClient;
    private db: DepositDatabase;
    private lastProcessedLt: string | null = null;
    private running = false;

    constructor(apiEndpoint: string) {
        this.client = new TonClient({ endpoint: apiEndpoint });
        this.db = new DepositDatabase();
    }

    /**
     * Extract comment/memo from transaction
     */
    private extractComment(transaction: Transaction): string | null {
        try {
            if (!transaction.inMessage) return null;
            
            const body = transaction.inMessage.body;
            if (!body) return null;

            const slice = body.beginParse();
            
            // Check for text comment (op = 0)
            if (slice.remainingBits >= 32) {
                const op = slice.loadUint(32);
                if (op === 0 && slice.remainingBits >= 8) {
                    // Text comment
                    return slice.loadStringTail();
                }
            }
            
            return null;
        } catch (e) {
            console.error('Error extracting comment:', e);
            return null;
        }
    }

    /**
     * Process a single transaction
     */
    private async processTransaction(tx: Transaction): Promise<void> {
        try {
            // Get transaction hash
            const txHash = tx.hash().toString('hex');

            // Check if already processed
            if (await this.db.isTransactionProcessed(txHash)) {
                return;
            }

            // Check if it's an incoming transaction
            if (!tx.inMessage || tx.inMessage.info.type !== 'internal') {
                return;
            }

            const sender = tx.inMessage.info.src;
            const amount = tx.inMessage.info.value.coins;

            // Validate minimum deposit amount
            if (amount < MIN_DEPOSIT_AMOUNT) {
                console.log(`⚠️  Deposit too small: ${amount} nanotons from ${sender} (minimum: ${MIN_DEPOSIT_AMOUNT})`);
                await this.db.markTransactionProcessed(txHash);
                return;
            }

            // Check if transaction bounced (failed)
            if (tx.description.type !== 'generic' || tx.description.aborted) {
                console.log(`⚠️  Transaction bounced or aborted: ${txHash}`);
                await this.db.markTransactionProcessed(txHash);
                return;
            }

            // Extract memo/comment to identify user
            const comment = this.extractComment(tx);
            
            // Try to identify user
            let userId: string | null = null;
            
            // Method 1: Try to identify by address (if using unique addresses)
            userId = await this.db.getUserByAddress(sender.toString());
            
            // Method 2: Try to identify by memo/comment
            if (!userId && comment) {
                userId = await this.db.getUserByMemo(comment);
            }

            if (!userId) {
                console.log(`⚠️  Could not identify user for deposit from ${sender} (memo: "${comment}")`);
                await this.db.markTransactionProcessed(txHash);
                return;
            }

            // Add to pending deposits for confirmation tracking
            const deposit: UserDeposit = {
                userId,
                transactionHash: txHash,
                amount,
                sender: sender.toString(),
                timestamp: Date.now(),
                confirmations: 0
            };

            await this.db.addPendingDeposit(deposit);
            
            console.log(`📥 New deposit detected: ${amount} nanotons from ${sender} to user ${userId}`);
            console.log(`   Transaction: ${txHash}`);
            console.log(`   Memo: "${comment || 'none'}"`);

        } catch (e) {
            console.error('Error processing transaction:', e);
        }
    }

    /**
     * Process pending deposits that have enough confirmations
     */
    private async processPendingDeposits(currentSeqno: number): Promise<void> {
        const pending = await this.db.getPendingDeposits();

        for (const deposit of pending) {
            // In a real implementation, track block seqno per transaction
            // For simplicity, we'll confirm after a time delay
            const timeSinceDeposit = Date.now() - deposit.timestamp;
            const estimatedConfirmations = Math.floor(timeSinceDeposit / 5000); // ~5s per block

            if (estimatedConfirmations >= MIN_CONFIRMATIONS) {
                try {
                    // Credit user account
                    await this.db.creditUserAccount(
                        deposit.userId,
                        deposit.amount,
                        deposit.transactionHash
                    );

                    // Mark as processed
                    await this.db.markTransactionProcessed(deposit.transactionHash);
                    await this.db.removePendingDeposit(deposit.transactionHash);

                    console.log(`✅ Deposit confirmed for user ${deposit.userId}: ${deposit.amount} nanotons`);
                } catch (e) {
                    console.error(`Error processing confirmed deposit ${deposit.transactionHash}:`, e);
                }
            }
        }
    }

    /**
     * Poll for new transactions
     */
    private async pollTransactions(): Promise<void> {
        try {
            const address = Address.parse(EXCHANGE_WALLET_ADDRESS);
            
            // Get recent transactions
            const transactions = await this.client.getTransactions(address, {
                limit: 100,
                lt: this.lastProcessedLt || undefined
            });

            if (transactions.length === 0) {
                return;
            }

            // Process transactions in chronological order (oldest first)
            const sortedTxs = [...transactions].reverse();
            
            for (const tx of sortedTxs) {
                await this.processTransaction(tx);
            }

            // Update last processed logical time
            if (transactions.length > 0) {
                this.lastProcessedLt = transactions[0].lt.toString();
            }

            // Get current seqno for confirmation tracking
            const masterchainInfo = await this.client.getMasterchainInfo();
            // masterchainInfo has different structure depending on client version
            const currentSeqno = (masterchainInfo as any).last?.seqno || (masterchainInfo as any).latestSeqno || 0;
            await this.processPendingDeposits(currentSeqno);

        } catch (e) {
            console.error('Error polling transactions:', e);
        }
    }

    /**
     * Start monitoring
     */
    async start(): Promise<void> {
        console.log('🚀 Starting deposit monitor...');
        console.log(`📍 Monitoring address: ${EXCHANGE_WALLET_ADDRESS}`);
        console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms`);
        console.log(`✓  Min confirmations: ${MIN_CONFIRMATIONS}`);
        console.log(`💎 Min deposit: ${MIN_DEPOSIT_AMOUNT} nanotons`);
        console.log('');

        this.running = true;

        while (this.running) {
            await this.pollTransactions();
            await sleep(POLL_INTERVAL_MS);
        }
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        console.log('🛑 Stopping deposit monitor...');
        this.running = false;
    }
}

/**
 * Main entry point
 */
async function main() {
    // Validate configuration
    if (EXCHANGE_WALLET_ADDRESS === 'YOUR_EXCHANGE_WALLET_ADDRESS') {
        console.error('❌ Error: Please set EXCHANGE_WALLET_ADDRESS in the configuration');
        process.exit(1);
    }

    const monitor = new DepositMonitor(API_ENDPOINT);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        monitor.stop();
        process.exit(0);
    });

    await monitor.start();
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { DepositMonitor, DepositDatabase, UserDeposit };
