const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config(); 

// Importa o arquivo de Rotas
const dataRoutes = require('./routes/dataRoutes'); 

const PORT = process.env.PORT || 3000;

// Configurações e Middlewares
app.use(cors()); 
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