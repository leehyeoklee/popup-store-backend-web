const { verify } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  const token = authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const payload = verify(token);
    req.user = payload;
  } catch (e) {
    // 토큰 오류시 무시
    req.user = null;
  }
  next();
}

module.exports = authMiddleware;
