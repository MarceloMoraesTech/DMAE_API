// 1. Carregar Variáveis de Ambiente
// O 'dotenv' lê o arquivo .env e injeta as variáveis no process.env
require('dotenv').config();

// 2. Importa a classe Pool do pacote 'pg'
const { Pool } = require('pg');

const config = {
    // Se você usa as variáveis separadas:
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    
    // OU se você usa DATABASE_URL:
    // connectionString: process.env.DATABASE_URL, 
    
    // ---------------------------------
    // ESTA É A PARTE ESSENCIAL PARA O RENDER:
    ssl: {
      rejectUnauthorized: false 
    }
    // ---------------------------------
};

const pool = new Pool(config);

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