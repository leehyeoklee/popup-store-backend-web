// 로그인 여부 확인 미들웨어
module.exports = function requireLogin(req, res, next) {
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};