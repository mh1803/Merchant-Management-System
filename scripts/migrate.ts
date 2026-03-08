#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from '../src/db';

async function run(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    await pool.query(sql);
    console.log(`Applied migration: ${file}`);
  }
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
