#!/usr/bin/env tsx
/**
 * Generate bcrypt hash for access code "test123"
 */

import { hash } from 'bcryptjs';

async function generateHash() {
  const accessCode = 'test123';
  const hashed = await hash(accessCode, 10);
  
  console.log('');
  console.log('Access Code: test123');
  console.log('Hash:', hashed);
  console.log('');
}

generateHash();
