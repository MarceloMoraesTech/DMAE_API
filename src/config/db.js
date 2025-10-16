require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST,
  database: process.env.DB_DATABASE, password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
pool.connect().then(() => console.log('Conectado com sucesso ao PostgreSQL!')).catch(err => console.error('Erro de conexão com o DB:', err.stack));
module.exports = { query: (text, params) => pool.query(text, params) };