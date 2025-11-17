// MySQL User 모델
class User {
  constructor({ id, email, name, nickname, profileImage }) {
    this.id = id; // 네이버 고유 id
    this.email = email;
    this.name = name;
    this.nickname = nickname;
    this.profileImage = profileImage;
  }
}

module.exports = User;
