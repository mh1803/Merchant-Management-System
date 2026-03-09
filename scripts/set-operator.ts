#!/usr/bin/env node
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createOrUpdateOperator } from '../src/db/authRepository';
import { pool } from '../src/db';
import { OperatorRole } from '../src/types/auth';
import { z } from 'zod';

interface OperatorSetInput {
  email: string;
  password: string;
  role: OperatorRole;
}

const operatorSetSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'operator'])
}) satisfies z.ZodType<OperatorSetInput>;

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }

  return process.argv[index + 1];
}

function normalizeEmail(email: string | null): string {
  return String(email || '').trim().toLowerCase();
}

async function run(): Promise<void> {
  const email = normalizeEmail(argValue('--email'));
  const password = argValue('--password');
  const role = (argValue('--role') || 'operator') as OperatorRole;

  if (!email || !password) {
    console.error('Usage: npm run operator:set -- --email <email> --password <password> [--role admin|operator]');
    process.exit(1);
  }

  const result = operatorSetSchema.safeParse({ email, password, role });
  if (!result.success) {
    const messages = result.error.issues.map((item) => item.message).join('; ');
    console.error(`Validation failed: ${messages}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const operator = await createOrUpdateOperator({
    email,
    passwordHash,
    role
  });

  console.log(`Operator saved: ${operator.email} (${operator.role}) [${operator.id}]`);
  console.log(`Auth storage backend: ${process.env.AUTH_STORAGE || 'postgres'}`);
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
