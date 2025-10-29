const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const multer = require('multer');

// Importa o arquivo de Rotas
const dataRoutes = require('./routes/dataRoutes'); 

const PORT = process.env.PORT || 3000;
// [INÍCIO SEGURANÇA DE CORS]

// Lista de domínios que podem aceder a esta API
const whitelist = [
  // URLs para desenvolvimento local 
  'http://localhost:3001', 
  'http://localhost:5173', 
  
  // URL DE PRODUÇÃO 
  'https://dmae-frontend.onrender.com', 
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite pedidos da whitelist OU pedidos sem 'origin' (ex: Postman)
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Se a origem não estiver na lista, rejeita o pedido
      callback(new Error('Acesso não permitido pelo CORS'));
    }
  }
};

// Usa o middleware CORS com as opções restritas
app.use(cors(corsOptions));
app.use(express.json());


// ------------------------------------------------------------------
// CARREGAMENTO DE ROTAS: Use um prefixo /api para todas as rotas
// ------------------------------------------------------------------
app.use('/api', dataRoutes); 

// ------------------------------------------------------------------
// CONFIGURAÇÃO DE TRATAMENTO DE ERRO (Recomendado)
// O Multer ou erros do DB
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Tratamento de erro específico do Multer para retornar 400
    if (err instanceof multer.MulterError || (err.message && err.message.startsWith('400|'))) {
        const [statusCode, message] = err.message.includes('|') ? err.message.split('|') : [400, 'Erro de upload de arquivo.'];
        return res.status(parseInt(statusCode) || 400).json({ 
            error: message,
            code: parseInt(statusCode) || 400
        });
    }

    return res.status(500).json({
        error: 'Algo deu errado no servidor.',
        details: err.message
    });
});
// ------------------------------------------------------------------

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});