const db = require('../config/db');

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

module.exports = { toPopupItem };
