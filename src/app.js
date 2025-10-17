// src/app.js (Com a estrutura limpa)

const express = require('express');
const app = express();
require('dotenv').config(); 

// Importa os Controllers
const uploadController = require('./controllers/uploadController'); 
const dataController = require('./controllers/dataController'); 

const PORT = process.env.PORT || 3000;

app.use(express.json());

// ------------------------------------------------------------------
// ROTAS DO BACKEND
// ------------------------------------------------------------------

const swaggerUI = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');

// 1. Configuração do Swagger/OpenAPI
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'DMAE Data API',
            version: '1.0.0',
            description: 'API para upload, processamento e disponibilização de dados ZEUS e ELIPSE.'
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor de Desenvolvimento Local',
            },
        ],
    },
    // Caminho para os arquivos onde você colocará as anotações do Swagger (jsdoc)
    apis: ['./src/controllers/*.js'], 
};

const specs = swaggerJsDoc(options);

// ... (Resto do código Express)

// 2. Endpoint de Documentação
// Acesso: http://localhost:3000/api-docs
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(specs));

// RB01: API para Upload de Arquivos (Usa o Controller com Multer, Extração e Persistência)
app.post('/api/upload', 
    // O Multer é executado primeiro (uploadController.uploadMiddleware)
    (req, res, next) => {
        uploadController.uploadMiddleware(req, res, (err) => {
            // ... (Lógica de tratamento de erro do Multer)
            next();
        });
    },
    // O Controller lida com a extração e persistência (uploadController.handleFileUploadAndProcessing)
    uploadController.handleFileUploadAndProcessing
);

// RB03 CORRIGIDO: APIs para Disponibilização de Dados do DB para Gráficos
app.get('/api/data/all', dataController.getOverallData);
app.get('/api/data/charts', dataController.getChartData);

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});