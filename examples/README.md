# Exchange Integration Examples

This directory contains practical examples for integrating Highload Wallet V3 with cryptocurrency exchanges.

## Overview

These examples demonstrate the complete workflow for exchange integration:

1. **Deposit Monitoring** - Track incoming deposits from users
2. **Batch Withdrawals** - Process multiple withdrawals efficiently
3. **Address Generation** - Create unique deposit addresses per user

## Prerequisites

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Examples

### 1. Deposit Monitor (`exchange-deposit-monitor.ts`)

Monitors the blockchain for incoming deposits and credits user accounts.

**Features:**
- Continuous transaction polling
- Minimum confirmation tracking
- User identification via address or memo
- Duplicate transaction prevention
- Automatic balance crediting

**Usage:**
```typescript
import { DepositMonitor } from './examples/exchange-deposit-monitor';

const monitor = new DepositMonitor('https://toncenter.com/api/v2/jsonRPC');
await monitor.start();
```

**Configuration:**
- `EXCHANGE_WALLET_ADDRESS` - Your exchange's wallet address
- `POLL_INTERVAL_MS` - How often to check for new transactions (default: 10s)
- `MIN_CONFIRMATIONS` - Minimum confirmations before crediting (default: 3)
- `MIN_DEPOSIT_AMOUNT` - Minimum deposit amount in nanotons (default: 1 TON)

### 2. Batch Withdrawal Processor (`exchange-batch-withdrawal.ts`)

Processes multiple user withdrawals in a single batch transaction for efficiency.

**Features:**
- Batch processing (up to 254 withdrawals per batch)
- Automatic query ID management
- Gas optimization with PAY_GAS_SEPARATELY mode
- Error handling for invalid addresses
- Transaction tracking

**Usage:**
```typescript
import { BatchWithdrawalProcessor } from './examples/exchange-batch-withdrawal';

const processor = new BatchWithdrawalProcessor(
    apiEndpoint,
    walletAddress,
    keyPair,
    subwalletId,
    timeout
);

await processor.processBatch();
```

**Benefits:**
- Lower gas fees per withdrawal
- Faster processing times
- Better blockchain efficiency
- Can process up to 254 withdrawals in one transaction

### 3. Deposit Address Generator (`exchange-address-generator.ts`)

Generates unique deposit addresses for each user using different subwallet IDs.

**Features:**
- Unique address per user
- No memos required
- Deterministic address generation
- User identification from address
- Address mapping export/backup

**Usage:**
```typescript
import { ExchangeAddressGenerator } from './examples/exchange-address-generator';

const generator = new ExchangeAddressGenerator(code, publicKey);

// Generate address for a user
const address = await generator.generateDepositAddress('user123');

// Later, identify user from address
const userId = await generator.identifyUser(address);
```

**Advantages over memo-based approach:**
- Better UX - users don't need to include memos
- Less error-prone - no typos in memos
- Easier tracking - address directly maps to user
- Professional appearance

## Running the Examples

### Run Deposit Monitor

```bash
ts-node examples/exchange-deposit-monitor.ts
```

Make sure to configure `EXCHANGE_WALLET_ADDRESS` before running.

### Run Batch Withdrawal

```bash
ts-node examples/exchange-batch-withdrawal.ts
```

This will process any pending withdrawals in your database.

### Run Address Generator

```bash
ts-node examples/exchange-address-generator.ts
```

This demonstrates how to generate and manage deposit addresses.

## Integration Guide

For a complete integration guide, see [EXCHANGE_INTEGRATION.md](../EXCHANGE_INTEGRATION.md) in the root directory.

### Quick Start Integration

1. **Deploy Highload Wallet V3**
   ```typescript
   const wallet = HighloadWalletV3.createFromConfig({
       publicKey: keyPair.publicKey,
       subwalletId: 0x10ad,
       timeout: 3600
   }, code);
   ```

2. **Generate Deposit Addresses**
   ```typescript
   const generator = new ExchangeAddressGenerator(code, publicKey);
   const userAddress = await generator.generateDepositAddress(userId);
   ```

3. **Monitor Deposits**
   ```typescript
   const monitor = new DepositMonitor(apiEndpoint);
   await monitor.start();
   ```

4. **Process Withdrawals**
   ```typescript
   const processor = new BatchWithdrawalProcessor(...);
   await processor.processBatch();
   ```

## Database Integration

These examples use simple in-memory databases for demonstration. In production:

- Replace `DepositDatabase` with your actual database (PostgreSQL, MySQL, MongoDB, etc.)
- Replace `WithdrawalDatabase` with your withdrawal queue implementation
- Replace `AddressMappingDatabase` with your user-address mapping storage

Example PostgreSQL schema:

```sql
-- User deposit addresses
CREATE TABLE deposit_addresses (
    user_id VARCHAR(255) PRIMARY KEY,
    address VARCHAR(255) NOT NULL UNIQUE,
    subwallet_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposit transactions
CREATE TABLE deposits (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL UNIQUE,
    amount BIGINT NOT NULL,
    sender VARCHAR(255) NOT NULL,
    memo TEXT,
    confirmations INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    credited_at TIMESTAMP
);

-- Withdrawal requests
CREATE TABLE withdrawals (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    tx_hash VARCHAR(255),
    batch_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);
```

## Security Considerations

### Key Management
- **Never** commit private keys to version control
- Use environment variables or secure vaults for keys
- Consider HSM for production environments
- Implement key rotation policies

### Transaction Validation
- Always verify minimum confirmations
- Check for bounced transactions
- Validate addresses before sending
- Implement withdrawal limits

### Monitoring
- Set up alerts for low wallet balance
- Monitor failed transactions
- Track unusual deposit patterns
- Log all operations for audit trail

## Testing

Test on testnet before production:

```bash
# Run tests
npm test

# Test on testnet
TESTNET=true ts-node examples/exchange-deposit-monitor.ts
```

## Common Issues

### Issue: Transactions not detected
**Solution**: 
- Check `EXCHANGE_WALLET_ADDRESS` is correct
- Verify API endpoint is accessible
- Ensure wallet has been deployed and funded

### Issue: Query ID exhausted
**Solution**: 
- Wait for timeout period to pass
- Implement query ID rotation
- Consider using multiple wallets for high volume

### Issue: User not identified
**Solution**: 
- Verify address mapping in database
- Check memo format if using memo-based approach
- Ensure case-sensitive address comparison

## Performance Tips

1. **Batch Operations**
   - Group withdrawals together (up to 254 per batch)
   - Process deposits in bulk where possible
   - Use appropriate poll intervals

2. **Database Optimization**
   - Index frequently queried fields (tx_hash, user_id, address)
   - Use connection pooling
   - Implement caching for address mappings

3. **Network Efficiency**
   - Use local TON node for lower latency
   - Implement retry logic with exponential backoff
   - Cache blockchain data where appropriate

## Support

- See [EXCHANGE_INTEGRATION.md](../EXCHANGE_INTEGRATION.md) for detailed documentation
- Check [README.md](../README.md) for general project information
- Review [SECURITY.md](../SECURITY.md) for security best practices
- Open issues on GitHub for bugs or questions

## License

See [LICENSE](../LICENSE) file for details.
