const path = require('path');
const sessionMiddleware = require('./config/session');
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const authRouter = require('./routes/auth');
const popupsRouter = require('./routes/popups');
const usersRouter = require('./routes/users');
const favoritesRouter = require('./routes/favorites');
const reportRouter = require('./routes/reports');
const requireLogin = require('./middleware/requireLogin');

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL database');
});

app.use(sessionMiddleware);
app.use('/auth', authRouter); 
app.use('/api/popups', popupsRouter);
app.use('/api/reports', reportRouter);
app.use('/api/users', requireLogin, usersRouter);
app.use('/api/favorites', requireLogin, favoritesRouter);


// 정적 파일 서빙
app.use(express.static(path.join(__dirname, '../dist')));
// SPA 라우팅 지원: API가 아닌 GET 요청은 모두 index.html 반환
app.use((req, res, next) => {
  if (
    req.method === 'GET' &&
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/auth')
  ) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    next();
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});