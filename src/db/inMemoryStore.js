const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const state = {
  operatorsById: new Map(),
  operatorIdByEmail: new Map(),
  refreshSessionsByJti: new Map()
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function createOperator({ email, password, role = 'operator', id = crypto.randomUUID() }) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await bcrypt.hash(password, 10);

  const operator = {
    id,
    email: normalizedEmail,
    passwordHash,
    role,
    failedLoginAttempts: 0,
    lockoutUntil: null
  };

  state.operatorsById.set(id, operator);
  state.operatorIdByEmail.set(normalizedEmail, id);

  return { ...operator };
}

function getOperatorByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const operatorId = state.operatorIdByEmail.get(normalizedEmail);
  if (!operatorId) {
    return null;
  }

  const operator = state.operatorsById.get(operatorId);
  return operator ? { ...operator } : null;
}

function updateOperator(operatorId, patch) {
  const current = state.operatorsById.get(operatorId);
  if (!current) {
    return null;
  }

  const next = { ...current, ...patch };
  state.operatorsById.set(operatorId, next);
  return { ...next };
}

function saveRefreshSession({ jti, operatorId, expiresAt }) {
  state.refreshSessionsByJti.set(jti, { jti, operatorId, expiresAt: Number(expiresAt) });
}

function getRefreshSession(jti) {
  const session = state.refreshSessionsByJti.get(jti);
  return session ? { ...session } : null;
}

function deleteRefreshSession(jti) {
  state.refreshSessionsByJti.delete(jti);
}

function clearOperators() {
  state.operatorsById.clear();
  state.operatorIdByEmail.clear();
}

function operatorsFilePath() {
  return process.env.OPERATORS_FILE
    ? path.resolve(process.cwd(), process.env.OPERATORS_FILE)
    : path.resolve(__dirname, '../../data/operators.json');
}

function loadOperatorsFromFile() {
  const filePath = operatorsFilePath();
  clearOperators();

  if (!fs.existsSync(filePath)) {
    return { filePath, count: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`Operator seed file must be an array: ${filePath}`);
  }

  let loadedCount = 0;
  for (const item of parsed) {
    if (!item || !item.email || !item.passwordHash) {
      continue;
    }

    const id = item.id || crypto.randomUUID();
    const email = normalizeEmail(item.email);
    const operator = {
      id,
      email,
      passwordHash: item.passwordHash,
      role: item.role || 'operator',
      failedLoginAttempts: 0,
      lockoutUntil: null
    };

    state.operatorsById.set(id, operator);
    state.operatorIdByEmail.set(email, id);
    loadedCount += 1;
  }

  return { filePath, count: loadedCount };
}

function resetAuthStore() {
  clearOperators();
  state.refreshSessionsByJti.clear();
}

module.exports = {
  createOperator,
  getOperatorByEmail,
  updateOperator,
  saveRefreshSession,
  getRefreshSession,
  deleteRefreshSession,
  loadOperatorsFromFile,
  operatorsFilePath,
  resetAuthStore
};
