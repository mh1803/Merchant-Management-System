const crypto = require('crypto');
const { pool } = require('./index');

const memoryState = {
  operatorsById: new Map(),
  operatorIdByEmail: new Map(),
  refreshSessionsByJti: new Map()
};

function storageMode() {
  return process.env.AUTH_STORAGE || 'postgres';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function mapOperatorFromDb(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    failedLoginAttempts: row.failed_login_attempts,
    lockoutUntil: row.lockout_until ? new Date(row.lockout_until).getTime() : null
  };
}

async function getOperatorByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (storageMode() === 'memory') {
    const operatorId = memoryState.operatorIdByEmail.get(normalizedEmail);
    if (!operatorId) {
      return null;
    }

    const operator = memoryState.operatorsById.get(operatorId);
    return operator ? { ...operator } : null;
  }

  const { rows } = await pool.query(
    `SELECT id, email, password_hash, role, failed_login_attempts, lockout_until
     FROM operators
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );

  return mapOperatorFromDb(rows[0]);
}

async function createOrUpdateOperator({ email, passwordHash, role = 'operator', id = crypto.randomUUID() }) {
  const normalizedEmail = normalizeEmail(email);

  if (storageMode() === 'memory') {
    const existingId = memoryState.operatorIdByEmail.get(normalizedEmail);
    const operatorId = existingId || id;

    const current = existingId ? memoryState.operatorsById.get(existingId) : null;
    const next = {
      id: operatorId,
      email: normalizedEmail,
      passwordHash,
      role,
      failedLoginAttempts: current ? current.failedLoginAttempts : 0,
      lockoutUntil: current ? current.lockoutUntil : null
    };

    memoryState.operatorsById.set(operatorId, next);
    memoryState.operatorIdByEmail.set(normalizedEmail, operatorId);
    return { ...next };
  }

  const { rows } = await pool.query(
    `INSERT INTO operators (id, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       updated_at = NOW()
     RETURNING id, email, password_hash, role, failed_login_attempts, lockout_until`,
    [id, normalizedEmail, passwordHash, role]
  );

  return mapOperatorFromDb(rows[0]);
}

async function setOperatorLoginState(operatorId, { failedLoginAttempts, lockoutUntil }) {
  if (storageMode() === 'memory') {
    const current = memoryState.operatorsById.get(operatorId);
    if (!current) {
      return null;
    }

    const next = {
      ...current,
      failedLoginAttempts,
      lockoutUntil
    };

    memoryState.operatorsById.set(operatorId, next);
    return { ...next };
  }

  const lockoutTimestamp = lockoutUntil ? new Date(lockoutUntil).toISOString() : null;

  const { rows } = await pool.query(
    `UPDATE operators
     SET failed_login_attempts = $2,
         lockout_until = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, password_hash, role, failed_login_attempts, lockout_until`,
    [operatorId, failedLoginAttempts, lockoutTimestamp]
  );

  return mapOperatorFromDb(rows[0]);
}

async function saveRefreshSession({ jti, operatorId, expiresAt }) {
  if (storageMode() === 'memory') {
    memoryState.refreshSessionsByJti.set(jti, {
      jti,
      operatorId,
      expiresAt: Number(expiresAt)
    });
    return;
  }

  await pool.query(
    `INSERT INTO refresh_sessions (jti, operator_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (jti) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [jti, operatorId, new Date(Number(expiresAt)).toISOString()]
  );
}

async function getRefreshSession(jti) {
  if (storageMode() === 'memory') {
    const session = memoryState.refreshSessionsByJti.get(jti);
    return session ? { ...session } : null;
  }

  const { rows } = await pool.query(
    `SELECT jti, operator_id, expires_at
     FROM refresh_sessions
     WHERE jti = $1
     LIMIT 1`,
    [jti]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    jti: rows[0].jti,
    operatorId: rows[0].operator_id,
    expiresAt: new Date(rows[0].expires_at).getTime()
  };
}

async function deleteRefreshSession(jti) {
  if (storageMode() === 'memory') {
    memoryState.refreshSessionsByJti.delete(jti);
    return;
  }

  await pool.query('DELETE FROM refresh_sessions WHERE jti = $1', [jti]);
}

function resetAuthStoreForTests() {
  memoryState.operatorsById.clear();
  memoryState.operatorIdByEmail.clear();
  memoryState.refreshSessionsByJti.clear();
}

module.exports = {
  getOperatorByEmail,
  createOrUpdateOperator,
  setOperatorLoginState,
  saveRefreshSession,
  getRefreshSession,
  deleteRefreshSession,
  resetAuthStoreForTests
};
