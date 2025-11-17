const express = require('express');
const router = express.Router();

// 네이버 OAuth 2.0 인증 요청
router.get('/naver', (req, res) => {
  const clientId = process.env.NAVER_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.NAVER_REDIRECT_URI);
  const state = Math.random().toString(36).substring(2, 15); // CSRF 방지용
  const authorizeUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
  res.redirect(authorizeUrl);
});

module.exports = router;

const { getNaverToken, getNaverUserInfo } = require('../utils/naverOAuth');
const { sign: signJWT } = require('../utils/jwt');
const { findUserByUserId, createUser } = require('../services/userService');

// 네이버 OAuth 콜백 처리
router.get('/naver/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) {
    return res.status(400).send(`Error: ${error_description || error}`);
  }
  try {
    // 1. 네이버 토큰 발급
    const tokenData = await getNaverToken({ code, state });
    if (!tokenData.access_token) {
      return res.status(400).send('네이버 토큰 발급 실패');
    }
    // 2. 네이버 사용자 정보 조회
    const userInfo = await getNaverUserInfo(tokenData.access_token);
    // 3. 사용자 정보 확인 및 DB 저장/조회
    const profile = userInfo.response;
    let user = await findUserByUserId(profile.id);
    if (!user) {
      // 신규 유저면 DB에 저장
      await createUser({
        userid: profile.id,
        email: profile.email,
        name: profile.name,
        nickname: profile.nickname
      });
      user = await findUserByUserId(profile.id);
    }
    // JWT 발급
    const payload = {
      id: user.id, // PK
      userid: user.userid, // 네이버 고유값
      email: user.email,
      name: user.name,
      nickname: user.nickname
    };
    const jwtToken = signJWT(payload);
    res.json({ jwtToken, user });
  } catch (err) {
    res.status(500).send('네이버 인증 처리 중 오류 발생: ' + err.message);
  }
});
