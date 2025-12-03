const express = require('express');
const router = express.Router();

const db = require('../config/db');

const { toPopupItem } = require('../utils/popupItem');

// 한글 카테고리 → 영어 카테고리 변환 함수
function toEnglishCategory(kor) {
  const map = {
    '패션': 'fashion',
    '뷰티': 'beauty',
    '식품/디저트': 'food',
    '캐릭터/굿즈': 'character',
    '전시/아트': 'exhibition',
    '엔터테인먼트': 'entertainment',
    '라이프스타일/리빙': 'lifestyle',
    '테마파크/체험': 'theme_park',
    '애니메이션/만화': 'animation',
    'IT/테크': 'tech',
    '문화/출판': 'culture',
    '스포츠/피트니스': 'sports',
    '기타': 'etc'
  };
  return map[kor] || kor;
}


// 메인 화면용 팝업스토어 API
router.get('/home', async (req, res) => {
  try {
    const userId = req.session.user?.id || null;
    
    // month 파라미터가 있으면 monthly만 조회
    if (req.query.month) {
      const [year, month] = req.query.month.split('-');
      const firstDay = `${year}-${month.padStart(2, '0')}-01`;
      const [monthRows] = await db.promise().query(
        `SELECT * FROM popup_stores WHERE start_date <= LAST_DAY(?) AND end_date >= ? ORDER BY start_date DESC`,
        [firstDay, firstDay]
      );
      const monthly = await Promise.all(monthRows.map(row => toPopupItem(row, userId)));
      return res.json({ monthly });
    }
    
    // month 파라미터가 없으면 3개 모두 조회 (병렬 처리)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;
    
    const [latestRows, popularRows, monthRows] = await Promise.all([
      db.promise().query('SELECT * FROM popup_stores ORDER BY updated_at DESC LIMIT 10'),
      db.promise().query('SELECT * FROM popup_stores ORDER BY favorite_count DESC, weekly_view_count DESC LIMIT 10'),
      db.promise().query(
        `SELECT * FROM popup_stores WHERE start_date <= LAST_DAY(?) AND end_date >= ? ORDER BY start_date DESC`,
        [firstDay, firstDay]
      )
    ]);
    
    const [latest, popular, monthly] = await Promise.all([
      Promise.all(latestRows[0].map(row => toPopupItem(row, userId))),
      Promise.all(popularRows[0].map(row => toPopupItem(row, userId))),
      Promise.all(monthRows[0].map(row => toPopupItem(row, userId)))
    ]);
    
    res.json({ latest, popular, monthly });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 검색/필터 API
router.get('/', async (req, res) => {
  try {
    // 쿼리 파라미터 추출
    const {
      region,
      category,
      date,
      keyword,
      sort = 'LATEST',
      page = 1,
      pageSize = 20
    } = req.query;

    // SQL 조건 동적 생성
    let where = [];
    let params = [];
    if (region) {
      where.push('popup_stores.id IN (SELECT id FROM popup_stores WHERE address LIKE ? OR EXISTS (SELECT 1 FROM (SELECT id, CONCAT(SUBSTRING_INDEX(address, " ", 2)) AS region_label FROM popup_stores) AS rl WHERE rl.region_label LIKE ? AND rl.id = popup_stores.id))');
      params.push(`%${region}%`, `%${region}%`);
    }
    if (category) {
      const dbCategory = toEnglishCategory(category);
      where.push('popup_stores.id IN (SELECT pc.popup_id FROM popup_categories pc JOIN categories c ON pc.category_id = c.id WHERE c.name = ?)');
      params.push(dbCategory);
    }
    if (date) {
      where.push('popup_stores.start_date <= ? AND popup_stores.end_date >= ?');
      params.push(date, date);
    }
    if (keyword) {
      where.push('(popup_stores.name LIKE ? OR popup_stores.description LIKE ? OR popup_stores.address LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // 정렬
    let orderBy = 'ORDER BY popup_stores.updated_at DESC';
    if (sort === 'POPULAR') orderBy = 'ORDER BY popup_stores.favorite_count DESC, popup_stores.weekly_view_count DESC';
    if (sort === 'ENDING_SOON') orderBy = 'ORDER BY popup_stores.end_date ASC';

    // 페이징
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    // total count
    const [countRows] = await db.promise().query(
      `SELECT COUNT(*) as total FROM popup_stores ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // 데이터 조회
    const [rows] = await db.promise().query(
      `SELECT * FROM popup_stores ${whereClause} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    const userId = req.session.user?.id || null;
    const items = await Promise.all(rows.map(row => toPopupItem(row, userId)));
    res.json({ items, page: parseInt(page), pageSize: parseInt(pageSize), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 팝업 상세 조회 API
router.get('/:id', async (req, res) => {
  try {
    const popupId = req.params.id;
    // 조회수 증가
    await db.promise().query('UPDATE popup_stores SET weekly_view_count = weekly_view_count + 1 WHERE id = ?', [popupId]);
    const [rows] = await db.promise().query('SELECT * FROM popup_stores WHERE id = ?', [popupId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Popup not found' });
    }
    const userId = req.session.user?.id || null;
    const item = await toPopupItem(rows[0], userId);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 가까운 팝업 API (주변 지역 기준)
router.get('/:id/nearby', async (req, res) => {
  try {
    const popupId = req.params.id;
    // 기준 팝업의 주소 추출
    const [rows] = await db.promise().query('SELECT address FROM popup_stores WHERE id = ?', [popupId]);
    if (rows.length === 0 || !rows[0].address) {
      return res.json({ items: [] }); // 기준 팝업 없거나 주소 없으면 빈 배열
    }
    // region_label: 주소 앞 2단어
    const parts = rows[0].address.split(' ');
    const regionLabel = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
    // 같은 region_label, 자기 자신 제외, 최신순 12개
    const [nearbyRows] = await db.promise().query(
      `SELECT * FROM popup_stores WHERE id != ? AND (address LIKE ? OR CONCAT(SUBSTRING_INDEX(address, ' ', 2)) = ?) ORDER BY updated_at DESC LIMIT 12`,
      [popupId, `%${regionLabel}%`, regionLabel]
    );
    const userId = req.session.user?.id || null;
    const items = await Promise.all(nearbyRows.map(row => toPopupItem(row, userId)));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 비슷한 팝업 API
router.get('/:id/similar', async (req, res) => {
  try {
    const popupId = req.params.id;
    // 기준 팝업의 카테고리 추출
    const [catRows] = await db.promise().query(
      'SELECT c.name FROM categories c JOIN popup_categories pc ON c.id = pc.category_id WHERE pc.popup_id = ?', [popupId]
    );
    if (catRows.length === 0) {
      return res.json({ items: [] }); // 카테고리 없으면 비슷한 팝업 없음
    }
    // 모든 카테고리 기준으로 비슷한 팝업 추천
    const categories = catRows.map(row => row.name);
    // IN 조건으로 여러 카테고리, 현재 팝업 제외, 최대 12개
    const placeholders = categories.map(() => '?').join(',');
    const query = `SELECT ps.* FROM popup_stores ps
      JOIN popup_categories pc ON ps.id = pc.popup_id
      JOIN categories c ON pc.category_id = c.id
      WHERE c.name IN (${placeholders}) AND ps.id != ?
      GROUP BY ps.id
      ORDER BY ps.updated_at DESC
      LIMIT 12`;
    const [rows] = await db.promise().query(query, [...categories, popupId]);
    const userId = req.session.user?.id || null;
    const items = await Promise.all(rows.map(row => toPopupItem(row, userId)));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
