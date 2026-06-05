// run-migration.js
const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config();

const sql = fs.readFileSync('./migrations.sql', 'utf8');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});
client.connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log('Миграции успешно выполнены');
    return client.end();
  })
  .catch(err => {
    console.error('Ошибка миграции:', err);
    return client.end();
  });