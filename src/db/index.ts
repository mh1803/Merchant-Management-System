import { Pool } from 'pg';

// One shared pool is used across repositories so connection management stays centralized.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
