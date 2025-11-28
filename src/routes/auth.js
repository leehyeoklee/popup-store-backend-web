const express = require('express');
const session = require('express-session');
const router = express.Router();
const { getNaverToken, getNaverUserInfo } = require('../utils/naverOAuth');
const { findUserByUserId, createUser, saveRefreshToken } = require('../services/userService');

// 네이버 OAuth 2.0 인증 요청
router.get('/naver', (req, res) => {
  const clientId = process.env.NAVER_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.NAVER_REDIRECT_URI);
  const state = process.env.NAVER_STATE;
  const authorizeUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
  res.redirect(authorizeUrl);
});

module.exports = router;

// 네이버 OAuth 콜백 처리
router.get('/naver/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) {
    return res.status(400).send(`Error: ${error_description || error}`);
  }
  // state 검증: .env의 NAVER_STATE와 비교
  if (process.env.NAVER_STATE && process.env.NAVER_STATE !== state) {
    return res.status(400).send('state 값 불일치: CSRF 의심');
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
        profile_image: profile.profile_image,
        name: profile.name,
        nickname: profile.nickname
      });
      user = await findUserByUserId(profile.id);
    }
    // 세션에 사용자 id만 저장
      req.session.user = { id: user.id };
      req.session.naverAccessToken = tokenData.access_token;

    // 로그인 성공 시 홈 화면으로 리다이렉트
    res.redirect('/');
  } catch (err) {
    res.status(500).send('네이버 인증 처리 중 오류 발생: ' + err.message);
  }
});

// 로그아웃 엔드포인트
router.post('/logout', (req, res) => {
  const accessToken = req.session.naverAccessToken;
  if (accessToken) {
    const axios = require('axios');
    axios.get('https://nid.naver.com/oauth2.0/token', {
      params: {
        grant_type: 'delete',
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        access_token: accessToken,
        service_provider: 'NAVER'
      }
    }).catch((err) => {
      console.error('네이버 토큰 삭제 실패:', err.message);
    });
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});
