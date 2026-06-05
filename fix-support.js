const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

async function fix() {
  try {
    await client.connect();
    await client.query(`
      INSERT INTO orders (id, client_id, pickup_address, delivery_address, description, price, status)
      VALUES (0, 1, 'support', 'support', 'Чат поддержки', 0, 'support')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Заказ id=0 успешно добавлен (или уже существовал)');
  } catch (err) {
    console.error('Ошибка при добавлении заказа id=0:', err.message);
  } finally {
    await client.end();
  }
}

fix();