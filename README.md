# Popup Store Backend

## Setup

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Configure `.env` with your MySQL credentials.
3. Start server:
   ```powershell
   node src/server.js
   ```

## Stack
- Express.js
- MySQL

## MySQL User Table 예시
```sql
CREATE TABLE users (
   id VARCHAR(50) PRIMARY KEY,
   email VARCHAR(100),
   name VARCHAR(50),
   nickname VARCHAR(50),
   profileImage VARCHAR(255),
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
