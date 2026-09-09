#!/usr/bin/env tsx
/**
 * Generate scrypt hash for access code
 */

import { hashAccessCode } from '../src/modules/auth/auth.service.js';

async function generateHash() {
  const accessCode = process.argv[2] || 'test123';
  const hashed = await hashAccessCode(accessCode);
  
  console.log('');
  console.log('Access Code:', accessCode);
  console.log('Scrypt Hash:', hashed);
  console.log('');
}

generateHash();
