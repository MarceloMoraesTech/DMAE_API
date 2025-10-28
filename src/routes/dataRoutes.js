const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController'); 
const dataController = require('../controllers/dataController'); 

// Rota de Upload
router.post('/upload', 
    uploadController.uploadMiddleware, 
    uploadController.handleFileUploadAndProcessing
);

// Rotas de Leitura
router.get('/data/all', dataController.getOverallData);
router.get('/data/charts', dataController.getChartData);
router.get('/data/faturamento-status', dataController.getFaturamentoStatus);

module.exports = router;