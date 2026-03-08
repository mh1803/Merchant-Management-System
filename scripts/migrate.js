#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function run() {
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
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
