require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const authRouter = require('./routes/auth');
const popupsRouter = require('./routes/popups');
const authMiddleware = require('./middleware/auth');

const app = express();
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

app.use(authMiddleware);
app.use('/auth', authRouter);
app.use('/api/popups', popupsRouter);

app.get('/', (req, res) => {
  res.send('Popup Store Backend is running!');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});