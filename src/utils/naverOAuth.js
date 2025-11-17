const axios = require('axios');

async function getNaverToken({ code, state }) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  const redirectUri = process.env.NAVER_REDIRECT_URI;
  const url = 'https://nid.naver.com/oauth2.0/token';

  const params = {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
    redirect_uri: redirectUri
  };

  const response = await axios.get(url, { params });
  return response.data;
}

async function getNaverUserInfo(accessToken) {
  const url = 'https://openapi.naver.com/v1/nid/me';
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return response.data;
}

module.exports = { getNaverToken, getNaverUserInfo };
