# Exchange Integration Guide for Highload Wallet V3

This guide explains how to integrate TON Highload Wallet V3 with cryptocurrency exchanges for automated deposit and withdrawal processing.

## Overview

Highload Wallet V3 is designed for high-throughput operations, making it ideal for exchanges that need to process large volumes of deposits and withdrawals efficiently. This wallet can handle up to **8,380,415 messages per timeout period**.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Setting Up Deposit Monitoring](#setting-up-deposit-monitoring)
4. [Processing User Deposits](#processing-user-deposits)
5. [Generating Unique Deposit Addresses](#generating-unique-deposit-addresses)
6. [Batch Withdrawals](#batch-withdrawals)
7. [Security Best Practices](#security-best-practices)
8. [Example Code](#example-code)

## Prerequisites

- Node.js 18+ and npm
- TON blockchain API access (via public RPC or your own node)
- Secure key management system for wallet private keys
- Database for tracking user deposits and withdrawals

## Architecture Overview

### Recommended Exchange Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Exchange Backend                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Deposit    │  │  Withdrawal  │  │    Fund      │    │
│  │   Monitor    │  │   Processor  │  │  Aggregator  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│          │                  │                 │            │
│          └──────────┬───────┴─────────────────┘            │
│                     │                                       │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Highload Wallet V3    │
         │  (Exchange Hot Wallet)  │
         └────────────────────────┘
```

### Two Approaches for Deposit Handling

#### Approach 1: Single Master Address
- All users deposit to the same highload wallet address
- Users include a unique memo/comment to identify themselves
- Simpler infrastructure but requires proper memo handling

#### Approach 2: Unique Addresses Per User (Recommended)
- Generate unique deposit addresses for each user using subwallet_id
- No memo required - address uniquely identifies the user
- Better user experience and easier tracking

## Setting Up Deposit Monitoring

### 1. Install Dependencies

```bash
npm install @ton/ton @ton/core @ton/crypto
```

### 2. Monitor Incoming Transactions

You need to continuously monitor the blockchain for new transactions to your exchange wallet(s). See `examples/exchange-deposit-monitor.ts` for a complete implementation.

Key steps:
1. Poll the blockchain for new transactions
2. Parse transaction data to extract sender, amount, and memo
3. Credit user accounts in your database
4. Mark transactions as processed to avoid double-crediting

## Processing User Deposits

When a deposit is detected:

1. **Validate the transaction**
   - Check minimum deposit amount
   - Verify transaction is confirmed (not bounced)
   - Check for sufficient gas fees

2. **Identify the user**
   - If using unique addresses: map address to user_id
   - If using memo: parse comment field for user identifier

3. **Credit the account**
   - Add balance to user's account
   - Store transaction hash for audit trail
   - Notify user of successful deposit

4. **Handle edge cases**
   - Duplicate transaction detection
   - Partial confirmations
   - Invalid memos or addresses

## Generating Unique Deposit Addresses

Use different `subwallet_id` values to generate unique addresses for each user:

```typescript
import { HighloadWalletV3 } from './wrappers/HighloadWalletV3';

function generateDepositAddress(userId: number, publicKey: Buffer, code: Cell): Address {
    // Use a unique subwallet_id for each user
    // Recommended format: base_id + user_id
    const subwalletId = 0x10ad + userId;
    
    const wallet = HighloadWalletV3.createFromConfig(
        {
            publicKey: publicKey,
            subwalletId: subwalletId,
            timeout: 3600 // 1 hour
        },
        code
    );
    
    return wallet.address;
}
```

**Important**: Store the mapping between `subwallet_id` and `user_id` in your database!

## Batch Withdrawals

Highload Wallet V3 excels at batch operations. Instead of sending withdrawals one by one, batch them together:

```typescript
const withdrawals = [
    { to: user1Address, amount: toNano('10') },
    { to: user2Address, amount: toNano('25') },
    { to: user3Address, amount: toNano('50') },
    // ... up to 254 per batch
];

// See examples/exchange-batch-withdrawal.ts for complete code
```

**Benefits**:
- Lower transaction fees
- Faster processing
- Better blockchain efficiency

## Security Best Practices

### 1. Key Management
- **Never** store private keys in code or version control
- Use hardware security modules (HSM) or secure key vaults
- Implement multi-signature schemes for large withdrawals
- Rotate keys periodically

### 2. Transaction Validation
- Always verify transaction confirmations
- Implement minimum confirmation blocks (recommended: 3+)
- Check for bounce messages
- Validate transaction amounts against limits

### 3. Rate Limiting
- Implement withdrawal limits per user/time period
- Use query_id tracking to prevent replay attacks
- Monitor for suspicious patterns

### 4. Timeout Configuration
- Use timeout between 1-24 hours (recommended: 1-4 hours for exchanges)
- Never set timeout to 0 (will cause contract issues)
- Plan batch operations around timeout period

### 5. Monitoring & Alerts
- Track wallet balance continuously
- Alert on low balance for gas fees
- Monitor failed transactions
- Log all operations for audit trail

### 6. Subwallet ID Usage
- Use unique `subwallet_id` (recommended: `0x10ad` + offset)
- Don't reuse subwallet IDs across different wallet types
- Keep a registry of all used subwallet IDs

### 7. Query ID Management
- Always use HighloadQueryId for proper sequencing
- Store last used query_id in database
- Never reuse query IDs within timeout period
- Handle query_id exhaustion (reset after timeout)

## Example Code

The following examples are provided in the `examples/` directory:

### 1. Exchange Deposit Monitor (`examples/exchange-deposit-monitor.ts`)
Monitors the blockchain for incoming deposits and credits user accounts.

### 2. Batch Withdrawal Processor (`examples/exchange-batch-withdrawal.ts`)
Processes multiple user withdrawals in a single batch transaction.

### 3. Deposit Address Generator (`examples/exchange-address-generator.ts`)
Generates unique deposit addresses for users using different subwallet IDs.

## Testing

Before going to production:

1. **Test on Testnet**
   - Deploy wallet on testnet
   - Process test deposits and withdrawals
   - Verify all edge cases

2. **Load Testing**
   - Test with maximum batch size (254 messages)
   - Verify timeout handling
   - Test query_id sequencing

3. **Security Audit**
   - Review key management implementation
   - Verify transaction validation logic
   - Test for replay attacks

## Useful Links

- [TON Blockchain Documentation](https://docs.ton.org/)
- [Highload Wallet V3 Contract](https://github.com/ton-blockchain/highload-wallet-contract-v3)
- [TON Center API](https://toncenter.com/)
- [Withdrawal Examples](https://github.com/toncenter/examples)

## Support

For issues or questions:
- Open an issue on GitHub
- Join TON Dev Chat
- Review audit reports in `audits/` directory

## License

See LICENSE file for details.
