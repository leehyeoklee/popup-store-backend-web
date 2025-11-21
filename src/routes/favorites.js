const express = require('express');
const router = express.Router();

const db = require('../config/db');
const { toPopupItem } = require('./popups');

// 즐겨찾기 추가
router.post('/', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { popupId } = req.body;
    if (!userId || !popupId) {
      return res.status(400).json({ error: 'Missing user or popupId' });
    }
    await db.promise().query(
      'INSERT IGNORE INTO favorites (user_id, popup_id) VALUES (?, ?)', [userId, popupId]
    );
    const [rows] = await db.promise().query(
      'SELECT favorite_count FROM popup_stores WHERE id = ?', [popupId]
    );
    res.json({ ok: true, favoriteCount: rows[0]?.favorite_count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 즐겨찾기 삭제
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const popupId = req.params.id;
    if (!userId || !popupId) {
      return res.status(400).json({ error: 'Missing user or popupId' });
    }
    await db.promise().query(
      'DELETE FROM favorites WHERE user_id = ? AND popup_id = ?', [userId, popupId]
    );
    const [rows] = await db.promise().query(
      'SELECT favorite_count FROM popup_stores WHERE id = ?', [popupId]
    );
    res.json({ ok: true, favoriteCount: rows[0]?.favorite_count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
