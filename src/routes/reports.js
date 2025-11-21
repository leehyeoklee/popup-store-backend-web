const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 팝업 제보 등록
router.post('/', async (req, res) => {
  const { name, address, description } = req.body;
  if (!name || !address || !description) {
    return res.status(400).json({ error: '필수 정보 누락' });
  }
  try {
    const [result] = await db.promise().query(
      'INSERT INTO reports (name, address, description, reported_at) VALUES (?, ?, ?, NOW())',
      [name, address, description]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 운영자: 제보 목록 조회 (key 필요)
router.get('/', async (req, res) => {
  const adminKey = req.query.key;
  if (adminKey !== process.env.REPORT_ADMIN_KEY) {
    return res.status(403).json({ error: '권한 없음' });
  }
  try {
    const [rows] = await db.promise().query(
      'SELECT id, name, address, description, reported_at AS reportedAt FROM reports ORDER BY reported_at DESC'
    );
    res.json({ reports: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
