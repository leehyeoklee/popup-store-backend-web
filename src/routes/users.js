const express = require('express');
const router = express.Router();

const db = require('../config/db');
const { toPopupItem } = require('../utils/popupItem');

// 내 즐겨찾기 목록 API
router.get('/me/favorites', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [favRows] = await db.promise().query(
      'SELECT popup_id FROM favorites WHERE user_id = ?', [userId]
    );
    if (favRows.length === 0) {
      return res.json({ items: [] });
    }
    const popupIds = favRows.map(row => row.popup_id);
    const placeholders = popupIds.map(() => '?').join(',');
    const [popupRows] = await db.promise().query(
      `SELECT * FROM popup_stores WHERE id IN (${placeholders}) ORDER BY updated_at DESC`, popupIds
    );

    const items = await Promise.all(popupRows.map(row => toPopupItem(row, userId)));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 현재 로그인 유저 정보 반환 API
router.get('/me', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [rows] = await db.promise().query('SELECT id, nickname, profile_image FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    // profileImage로 key 변환
    const user = {
      id: String(rows[0].id),
      nickname: rows[0].nickname,
      profileImage: rows[0].profile_image || undefined
    };
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
