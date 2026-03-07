const bcrypt = require('bcryptjs');
const { AppError } = require('../errors');
const { config } = require('../config');
const {
  getOperatorByEmail,
  updateOperator,
  saveRefreshSession,
  getRefreshSession,
  deleteRefreshSession
} = require('../db/inMemoryStore');
const { issueAccessToken, issueRefreshToken, verifyRefreshToken } = require('./tokenService');

function buildAuthResponse(operator) {
  const accessToken = issueAccessToken({
    operatorId: operator.id,
    email: operator.email,
    role: operator.role
  });

  const { token: refreshToken, jti } = issueRefreshToken({
    operatorId: operator.id,
    email: operator.email,
    role: operator.role
  });

  saveRefreshSession({
    jti,
    operatorId: operator.id,
    expiresAt: Date.now() + 1000
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.accessTtl
  };
}

function isLocked(operator) {
  return Boolean(operator.lockoutUntil && Date.now() < operator.lockoutUntil);
}

function lockoutRetrySeconds(operator) {
  return Math.ceil((operator.lockoutUntil - Date.now()) / 1000);
}

async function login({ email, password }) {
  const operator = getOperatorByEmail(email);

  if (!operator) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (isLocked(operator)) {
    throw new AppError(423, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
  }

  const passwordMatches = await bcrypt.compare(password, operator.passwordHash);

  if (!passwordMatches) {
    const failedLoginAttempts = operator.failedLoginAttempts + 1;
    let lockoutUntil = null;

    if (failedLoginAttempts >= config.loginMaxAttempts) {
      lockoutUntil = Date.now() + config.loginLockoutMinutes * 60 * 1000;
    }

    const updated = updateOperator(operator.id, {
      failedLoginAttempts,
      lockoutUntil
    });

    if (updated && isLocked(updated)) {
      throw new AppError(423, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
    }

    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  updateOperator(operator.id, {
    failedLoginAttempts: 0,
    lockoutUntil: null
  });

  return buildAuthResponse(operator);
}

async function refresh({ refreshToken }) {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (payload.tokenType !== 'refresh' || !payload.jti) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const session = getRefreshSession(payload.jti);
  if (!session || session.operatorId !== payload.sub) {
    throw new AppError(401, 'Refresh token is no longer valid', 'INVALID_REFRESH_TOKEN');
  }

  deleteRefreshSession(payload.jti);

  const operator = getOperatorByEmail(payload.email);
  if (!operator) {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  return buildAuthResponse(operator);
}

module.exports = {
  login,
  refresh,
  lockoutRetrySeconds
};
