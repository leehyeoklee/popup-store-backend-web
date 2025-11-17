const express = require('express');
const router = express.Router();

const db = require('../db');

// PopupItem 변환 함수 (공통)
async function toPopupItem(row, userId = null) {
  const [imgRows] = await db.promise().query('SELECT image_url FROM popup_images WHERE popup_id = ?', [row.id]);
  const [catRows] = await db.promise().query(
    'SELECT c.name FROM categories c JOIN popup_categories pc ON c.id = pc.category_id WHERE pc.popup_id = ?', [row.id]
  );
  let isFavorited = false;
  if (userId) {
    const [favRows] = await db.promise().query('SELECT 1 FROM favorites WHERE user_id = ? AND popup_id = ?', [userId, row.id]);
    isFavorited = favRows.length > 0;
  }
  let regionLabel = null;
  if (row.address) {
    const parts = row.address.split(' ');
    regionLabel = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
  }
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.mapy,
    lon: row.mapx,
    startDate: row.start_date,
    endDate: row.end_date,
    description: row.description,
    webSiteLink: row.site_link,
    weeklyViewCount: row.weekly_view_count,
    favoriteCount: row.favorite_count,
    images: imgRows.map(img => img.image_url),
    updated: row.updated_at,
    category: catRows.map(cat => cat.name).join(','),
    regionLabel,
    isFavorited
  };
}

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
    // 최신 팝업
    const [latestRows] = await db.promise().query(
      'SELECT * FROM popup_stores ORDER BY updated_at DESC LIMIT 10'
    );
    // 인기 팝업
    const [popularRows] = await db.promise().query(
      'SELECT * FROM popup_stores ORDER BY favorite_count DESC, weekly_view_count DESC LIMIT 10'
    );
    // month 쿼리 파라미터가 있으면 해당 달, 없으면 이번 달
    let monthRows;
    if (req.query.month) {
      const [year, month] = req.query.month.split('-');
      const firstDay = `${year}-${month.padStart(2, '0')}-01`;
      [monthRows] = await db.promise().query(
        `SELECT * FROM popup_stores WHERE start_date <= LAST_DAY(?) AND end_date >= ? ORDER BY start_date DESC`,
        [firstDay, firstDay]
      );
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const firstDay = `${year}-${month}-01`;
      [monthRows] = await db.promise().query(
        `SELECT * FROM popup_stores WHERE start_date <= LAST_DAY(?) AND end_date >= ? ORDER BY start_date DESC`,
        [firstDay, firstDay]
      );
    }
    // DB 결과를 PopupItem 객체로 변환
    // ...existing code...
    // 로그인 유저 PK id 추출 (즐겨찾기 여부에 사용)
    const userId = req.user?.id || null;
    // 비동기 변환 처리
    const latest = await Promise.all(latestRows.map(row => toPopupItem(row, userId)));
    const popular = await Promise.all(popularRows.map(row => toPopupItem(row, userId)));
    const monthly = await Promise.all(monthRows.map(row => toPopupItem(row, userId)));
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

    // PopupItem 변환 함수 재사용
    // ...existing code...
    const userId = req.user?.id || null;
    const items = await Promise.all(rows.map(row => toPopupItem(row, userId)));
    res.json({ items, page: parseInt(page), pageSize: parseInt(pageSize), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
