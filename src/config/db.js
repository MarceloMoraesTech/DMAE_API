// 1. Carregar Variáveis de Ambiente
// O 'dotenv' lê o arquivo .env e injeta as variáveis no process.env
require('dotenv').config();

// 2. Importa a classe Pool do pacote 'pg'
const { Pool } = require('pg');

// 3. Configuração do Pool de Conexões usando variáveis de ambiente
const pool = new Pool({
  user: process.env.DB_USER,        // Lê DB_USER do arquivo .env
  host: process.env.DB_HOST,        // Lê DB_HOST do arquivo .env
  database: process.env.DB_DATABASE, // Lê DB_DATABASE do arquivo .env
  password: process.env.DB_PASSWORD, // Lê DB_PASSWORD do arquivo .env
  port: process.env.DB_PORT,          // Lê DB_PORT do arquivo .env
});

// Exemplo: Testar a conexão
pool.connect()
  .then(client => {
    console.log('Conectado com sucesso ao PostgreSQL!');
    client.release(); // Libera o cliente de volta para o pool
  })
  .catch(err => {
    console.error('Erro ao conectar ao banco de dados:', err.stack);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};