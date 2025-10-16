// src/controllers/uploadController.js

const path = require('path');
const fs = require('fs/promises'); // Para deletar arquivos temporários
const { extractDataFromSpreadsheet } = require('../services/extractionService');
const { insertZeusData, insertElipseData } = require('../repositories/dataRepository');
const multer = require('multer'); 

// --- Configuração do Multer (RB01) ---
const uploadDir = path.join(__dirname, '..', '..', 'uploads_temp'); // Volta duas pastas para a raiz

// Garante que a pasta temporária exista
fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        // Nomes únicos: timestamp + nome original (RB01)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadMiddleware = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Validação do formato (RB01)
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            // Resposta de Erro (Formato Inválido) - RB01
            cb(new Error('400|Formato de arquivo inválido. Apenas .xlsx, .xls, .csv são permitidos.'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } 
}).fields([
    { name: 'planilha1', maxCount: 1 },
    { name: 'planilha2', maxCount: 1 }
]);

// --- Função Principal do Controller (RB01 + RB02) ---

async function handleFileUploadAndProcessing(req, res) {
    if (!req.files || !req.files.planilha1 || !req.files.planilha2) {
        return res.status(400).json({ error: 'É necessário enviar os dois arquivos: planilha1 e planilha2.', code: 400 });
    }

    const file1 = req.files.planilha1[0];
    const file2 = req.files.planilha2[0];
    let filePaths = [file1.path, file2.path];
    
    try {
        // 1. EXTRAÇÃO E VALIDAÇÃO (RB02 + RB04)
        // O extractDataFromSpreadsheet vai validar o formato de cada um
        const dataPlanilha1 = extractDataFromSpreadsheet(file1.path);
        const dataPlanilha2 = extractDataFromSpreadsheet(file2.path);
        
        // 2. PERSISTÊNCIA NO DB (Lógica adaptada do RB02)
        // Aqui é onde você decide qual dado vai para qual tabela. 
        // Vamos usar uma heurística simples baseada nos campos obrigatórios para decidir:

        const isZeus1 = dataPlanilha1.some(row => 'pressao_succao' in row);
        const isZeus2 = dataPlanilha2.some(row => 'pressao_succao' in row);
        
        // Simplesmente inserindo ambos (ajuste esta lógica para ser mais robusta)
        if (isZeus1) {
            await insertZeusData(dataPlanilha1);
        } else {
            await insertElipseData(dataPlanilha1);
        }

        if (isZeus2) {
            await insertZeusData(dataPlanilha2);
        } else {
            await insertElipseData(dataPlanilha2);
        }
        
        // 3. Resposta de Sucesso (RB01)
        return res.status(200).json({
            message: 'Arquivos processados e dados inseridos no banco de dados com sucesso.',
            processados: {
                planilha1: isZeus1 ? 'Zeus' : 'Elipse',
                planilha2: isZeus2 ? 'Zeus' : 'Elipse',
            },
        });

    } catch (processError) {
        // Trata erros de extração/validação (422) ou DB (500)
        const [statusCode, message] = processError.message.split('|');
        return res.status(parseInt(statusCode) || 500).json({ 
            error: message || 'Erro no processamento dos arquivos.', 
            details: processError.message, 
            code: parseInt(statusCode) || 500 
        });
    } finally {
        // Limpeza (RB01)
        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath); // Deleta o arquivo temporário
            } catch (e) {
                console.error(`Falha ao deletar arquivo temporário: ${filePath}`, e.message);
            }
        }
    }
}


module.exports = {
    uploadMiddleware,
    handleFileUploadAndProcessing,
};