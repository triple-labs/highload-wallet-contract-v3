/**
 * Exchange Deposit Address Generator
 * 
 * This example demonstrates how to generate unique deposit addresses for each
 * user by using different subwallet_id values. This eliminates the need for
 * memos/comments and provides a better user experience.
 * 
 * Usage:
 *   ts-node examples/exchange-address-generator.ts
 */

import { Address, Cell, toNano } from '@ton/core';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { compile } from '@ton/blueprint';

// Configuration
const BASE_SUBWALLET_ID = 0x10ad; // Base subwallet ID for exchange
const TIMEOUT = 3600; // 1 hour

/**
 * User to Address Mapping Database
 */
class AddressMappingDatabase {
    private userToAddress: Map<string, string> = new Map();
    private addressToUser: Map<string, string> = new Map();
    private userToSubwalletId: Map<string, number> = new Map();
    private nextUserId: number = 1;

    /**
     * Generate and store address mapping for a user
     */
    async createUserAddress(userId: string, address: string, subwalletId: number): Promise<void> {
        this.userToAddress.set(userId, address);
        this.addressToUser.set(address, userId);
        this.userToSubwalletId.set(userId, subwalletId);
        
        console.log(`✓ Mapped user ${userId} to address ${address} (subwallet: ${subwalletId})`);
    }

    /**
     * Get deposit address for a user
     */
    async getAddressForUser(userId: string): Promise<string | null> {
        return this.userToAddress.get(userId) || null;
    }

    /**
     * Get user ID from deposit address
     */
    async getUserForAddress(address: string): Promise<string | null> {
        return this.addressToUser.get(address) || null;
    }

    /**
     * Get subwallet ID for a user
     */
    async getSubwalletIdForUser(userId: string): Promise<number | null> {
        return this.userToSubwalletId.get(userId) || null;
    }

    /**
     * Get next available user ID number
     */
    getNextUserIdNumber(): number {
        return this.nextUserId++;
    }

    /**
     * Get all mappings (for export/backup)
     */
    getAllMappings(): Array<{ userId: string; address: string; subwalletId: number }> {
        const mappings: Array<{ userId: string; address: string; subwalletId: number }> = [];
        
        for (const [userId, address] of this.userToAddress.entries()) {
            const subwalletId = this.userToSubwalletId.get(userId);
            if (subwalletId !== undefined) {
                mappings.push({ userId, address, subwalletId });
            }
        }
        
        return mappings;
    }
}

/**
 * Address Generator for Exchange
 */
class ExchangeAddressGenerator {
    private code: Cell;
    private publicKey: Buffer;
    private db: AddressMappingDatabase;
    private baseSubwalletId: number;
    private timeout: number;

    constructor(code: Cell, publicKey: Buffer, baseSubwalletId: number = BASE_SUBWALLET_ID, timeout: number = TIMEOUT) {
        this.code = code;
        this.publicKey = publicKey;
        this.db = new AddressMappingDatabase();
        this.baseSubwalletId = baseSubwalletId;
        this.timeout = timeout;
    }

    /**
     * Generate unique deposit address for a user
     */
    async generateDepositAddress(userId: string): Promise<string> {
        // Check if user already has an address
        const existingAddress = await this.db.getAddressForUser(userId);
        if (existingAddress) {
            console.log(`ℹ️  User ${userId} already has address: ${existingAddress}`);
            return existingAddress;
        }

        // Generate unique subwallet ID for this user
        // Use a sequential number added to base subwallet ID
        const userIdNumber = this.db.getNextUserIdNumber();
        const subwalletId = this.baseSubwalletId + userIdNumber;

        // Create wallet with unique subwallet ID
        const wallet = HighloadWalletV3.createFromConfig(
            {
                publicKey: this.publicKey,
                subwalletId: subwalletId,
                timeout: this.timeout
            },
            this.code
        );

        const address = wallet.address.toString();

        // Store mapping in database
        await this.db.createUserAddress(userId, address, subwalletId);

        return address;
    }

    /**
     * Batch generate addresses for multiple users
     */
    async generateBatchAddresses(userIds: string[]): Promise<Map<string, string>> {
        const addresses = new Map<string, string>();

        console.log(`\n📋 Generating addresses for ${userIds.length} users...\n`);

        for (const userId of userIds) {
            const address = await this.generateDepositAddress(userId);
            addresses.set(userId, address);
        }

        return addresses;
    }

    /**
     * Get user ID from deposit address
     */
    async identifyUser(address: string): Promise<string | null> {
        return await this.db.getUserForAddress(address);
    }

    /**
     * Get database instance
     */
    getDatabase(): AddressMappingDatabase {
        return this.db;
    }

    /**
     * Display all generated addresses
     */
    displayAllAddresses(): void {
        const mappings = this.db.getAllMappings();
        
        console.log('\n📊 All Generated Deposit Addresses\n');
        console.log('═'.repeat(100));
        console.log(`${'User ID'.padEnd(20)} | ${'Subwallet ID'.padEnd(15)} | ${'Address'.padEnd(50)}`);
        console.log('─'.repeat(100));
        
        for (const mapping of mappings) {
            console.log(
                `${mapping.userId.padEnd(20)} | ` +
                `${mapping.subwalletId.toString().padEnd(15)} | ` +
                `${mapping.address}`
            );
        }
        
        console.log('═'.repeat(100));
        console.log(`\nTotal addresses: ${mappings.length}\n`);
    }

    /**
     * Export mappings to JSON (for backup)
     */
    exportMappings(): string {
        return JSON.stringify(this.db.getAllMappings(), null, 2);
    }
}

/**
 * Example usage
 */
async function main() {
    console.log('🚀 Exchange Deposit Address Generator\n');

    try {
        // Load highload wallet code
        const code = await compile('HighloadWalletV3');
        console.log('✓ Loaded HighloadWalletV3 contract code\n');

        // Your exchange's master public key
        // In production, load this from secure storage
        const publicKey = Buffer.alloc(32, 0);
        console.log('⚠️  Using mock public key - replace with your actual key in production!\n');

        // Initialize generator
        const generator = new ExchangeAddressGenerator(code, publicKey);

        // Example 1: Generate single address
        console.log('📍 Example 1: Generate single deposit address\n');
        const address1 = await generator.generateDepositAddress('user_alice');
        console.log(`   → Alice's deposit address: ${address1}\n`);

        // Example 2: Generate multiple addresses
        console.log('📍 Example 2: Generate batch addresses\n');
        const userIds = ['user_bob', 'user_charlie', 'user_diana', 'user_eve'];
        await generator.generateBatchAddresses(userIds);

        // Example 3: Look up user by address
        console.log('\n📍 Example 3: Identify user from address\n');
        const testAddress = address1;
        const identifiedUser = await generator.identifyUser(testAddress);
        console.log(`   Address: ${testAddress}`);
        console.log(`   → Belongs to: ${identifiedUser}\n`);

        // Display all generated addresses
        generator.displayAllAddresses();

        // Example 4: Export mappings
        console.log('📍 Example 4: Export address mappings\n');
        const exported = generator.exportMappings();
        console.log('   JSON export:');
        console.log(exported);

        console.log('\n✅ Address generation examples complete!\n');

        // Important notes
        console.log('📝 Important Notes:\n');
        console.log('   1. Store user-to-address mappings in your database');
        console.log('   2. Each user gets a unique subwallet_id and address');
        console.log('   3. No memos needed - address uniquely identifies the user');
        console.log('   4. Make sure to backup the mappings regularly');
        console.log('   5. Use the same master key pair for all deposit addresses');
        console.log('   6. Addresses are deterministic - same subwallet_id always generates same address\n');

    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

/**
 * Helper function to format address for display in UIs
 * Truncates long addresses to show first and last parts
 * Example: "EQABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz012345" 
 *       -> "EQABCDEFGH...vwxyz012345"
 */
function formatAddress(address: string): string {
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 10)}`;
}

/**
 * Calculate required subwallet ID range for N users
 */
function calculateSubwalletRange(baseId: number, userCount: number): { min: number; max: number } {
    return {
        min: baseId,
        max: baseId + userCount - 1
    };
}

// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}

export { 
    ExchangeAddressGenerator, 
    AddressMappingDatabase,
    formatAddress,
    calculateSubwalletRange 
};
