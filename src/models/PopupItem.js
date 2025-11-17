// PopupItem 모델 정의
class PopupItem {
  constructor({
    id,
    name,
    address,
    lat,
    lon,
    startDate,
    endDate,
    description = '',
    webSiteLink = '',
    weeklyViewCount = 0,
    favoriteCount = 0,
    images = [],
    updated = '',
    category = '',
    regionLabel = '',
    isFavorited = false
  }) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.lat = lat;
    this.lon = lon;
    this.startDate = startDate;
    this.endDate = endDate;
    this.description = description;
    this.webSiteLink = webSiteLink;
    this.weeklyViewCount = weeklyViewCount;
    this.favoriteCount = favoriteCount;
    this.images = images;
    this.updated = updated;
    this.category = category;
    this.regionLabel = regionLabel;
    this.isFavorited = isFavorited;
  }
}

module.exports = PopupItem;
