const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { config } = require('../config');

function issueAccessToken({ operatorId, email, role }) {
  return jwt.sign(
    { sub: operatorId, email, role, tokenType: 'access' },
    config.accessSecret,
    { expiresIn: config.accessTtl }
  );
}

function issueRefreshToken({ operatorId, email, role }) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: operatorId, email, role, tokenType: 'refresh', jti },
    config.refreshSecret,
    { expiresIn: config.refreshTtl }
  );

  const decoded = jwt.decode(token);
  return { token, jti, expiresAt: decoded && decoded.exp ? decoded.exp * 1000 : Date.now() };
}

function verifyRefreshToken(refreshToken) {
  return jwt.verify(refreshToken, config.refreshSecret);
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken
};
