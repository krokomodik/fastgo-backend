const { Pool } = require('pg');

// Если задана переменная DATABASE_URL (Render), используем её
// Иначе собираем подключение из отдельных переменных (локальная разработка)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Обязательно для Supabase
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'fastgo'
    });

module.exports = pool;