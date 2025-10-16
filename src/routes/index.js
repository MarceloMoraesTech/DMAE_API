const { Router } = require('express');
const uploadMiddleware = require('../middlewares/uploadMiddleware');
const uploadController = require('../controllers/uploadController');
const DataController = require('../controllers/dataController');
const routes = Router();
routes.post('/upload', uploadMiddleware.fields([{ name: 'planilha1', maxCount: 1 }, { name: 'planilha2', maxCount: 1 }]), uploadController.handleFileUploadAndProcessing);
routes.get('/data/all', DataController.getOverallData);
module.exports = routes;