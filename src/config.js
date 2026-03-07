function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  accessTtl: process.env.JWT_ACCESS_TTL || '15m',
  refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  loginMaxAttempts: parseNumber(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginLockoutMinutes: parseNumber(process.env.LOGIN_LOCKOUT_MINUTES, 15)
};

module.exports = { config };
