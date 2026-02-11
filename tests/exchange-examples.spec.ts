/**
 * Integration tests for exchange examples
 * These tests verify that the example code is correctly structured
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Exchange Examples', () => {
    const examplesDir = path.join(__dirname, '..', 'examples');
    
    it('should have exchange-deposit-monitor.ts example', () => {
        const filePath = path.join(examplesDir, 'exchange-deposit-monitor.ts');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('DepositMonitor');
        expect(content).toContain('class DepositDatabase');
        expect(content).toContain('export');
    });
    
    it('should have exchange-batch-withdrawal.ts example', () => {
        const filePath = path.join(examplesDir, 'exchange-batch-withdrawal.ts');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('BatchWithdrawalProcessor');
        expect(content).toContain('class WithdrawalDatabase');
        expect(content).toContain('export');
    });
    
    it('should have exchange-address-generator.ts example', () => {
        const filePath = path.join(examplesDir, 'exchange-address-generator.ts');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('ExchangeAddressGenerator');
        expect(content).toContain('class AddressMappingDatabase');
        expect(content).toContain('export');
    });
    
    it('should have examples README', () => {
        const filePath = path.join(examplesDir, 'README.md');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('Exchange Integration Examples');
        expect(content).toContain('Deposit Monitor');
        expect(content).toContain('Batch Withdrawal');
        expect(content).toContain('Address Generator');
    });
    
    it('should have main exchange integration guide', () => {
        const filePath = path.join(__dirname, '..', 'EXCHANGE_INTEGRATION.md');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('Exchange Integration Guide');
        expect(content).toContain('Prerequisites');
        expect(content).toContain('Security Best Practices');
        expect(content).toContain('Architecture Overview');
    });
    
    it('main README should reference exchange integration', () => {
        const filePath = path.join(__dirname, '..', 'README.md');
        expect(fs.existsSync(filePath)).toBe(true);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('Exchange Integration');
        expect(content).toContain('EXCHANGE_INTEGRATION.md');
    });
});
