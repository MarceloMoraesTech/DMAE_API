const path = require('path');
const fs = require('fs/promises');
const { extractDataFromSpreadsheet } = require('../services/extractionService');
const { insertZeusData, insertElipseData } = require('../repositories/dataRepository');
const multer = require('multer'); 

// --- Configuração do Multer ---
const uploadDir = path.join(__dirname, '..', '..', 'uploads_temp');

// Garante que a pasta temporária exista
fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadMiddleware = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('400|Formato de arquivo inválido. Apenas .xlsx, .xls, .csv são permitidos.'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } 
}).fields([
    // MUDANÇA 1: Usamos os nomes de campo do frontend
    { name: 'zeusFile', maxCount: 1 },
    { name: 'elipseFile', maxCount: 1 }
]);

// --- Função Principal do Controller ---

async function handleFileUploadAndProcessing(req, res) {
    
    // MUDANÇA 2: Pegamos os arquivos pelos nomes de campo
    const zeusFile = req.files.zeusFile ? req.files.zeusFile[0] : null;
    const elipseFile = req.files.elipseFile ? req.files.elipseFile[0] : null;
    
    if (!zeusFile && !elipseFile) {
        return res.status(400).json({ 
            error: 'É necessário enviar pelo menos um arquivo (ZEUS ou ELIPSE).', 
            code: 400 
        });
    }

    let filePaths = [];
    let uploadStatus = { zeus: 'N/A', elipse: 'N/A' };
    
    // Coleta caminhos para limpeza
    if (zeusFile) filePaths.push(zeusFile.path);
    if (elipseFile) filePaths.push(elipseFile.path);
    
    try {
        let zeusRowsCount = 0;
        let elipseRowsCount = 0;

        // EXTRAÇÃO E INSERÇÃO DO ARQUIVO ZEUS
        if (zeusFile) {
            console.log(`Processando arquivo Zeus: ${zeusFile.originalname}`);
            const zeusData = await extractDataFromSpreadsheet(zeusFile.path);
            
            if (zeusData && zeusData.length > 0) {
                // MUDANÇA 3: Inserção direta no Zeus
                await insertZeusData(zeusData); 
                zeusRowsCount = zeusData.length;
                uploadStatus.zeus = `Sucesso (${zeusRowsCount} linhas)`;
            } else {
                uploadStatus.zeus = `Falha (Nenhuma linha válida)`;
                throw new Error('422|Arquivo ZEUS processado mas não contém dados válidos.');
            }
        }
        
        // EXTRAÇÃO E INSERÇÃO DO ARQUIVO ELIPSE
        if (elipseFile) {
            console.log(`Processando arquivo Elipse: ${elipseFile.originalname}`);
            const elipseData = await extractDataFromSpreadsheet(elipseFile.path);
            
console.log('Total de linhas do Elipse para inserção:', elipseData.length); // Verifique se isso é > 0

await dataRepository.insertElipseData(elipseData);

            if (elipseData && elipseData.length > 0) {
                // MUDANÇA 4: Inserção direta no Elipse
                await insertElipseData(elipseData); 
                elipseRowsCount = elipseData.length;
                uploadStatus.elipse = `Sucesso (${elipseRowsCount} linhas)`;
            } else {
                 uploadStatus.elipse = `Falha (Nenhuma linha válida)`;
                 throw new Error('422|Arquivo ELIPSE processado mas não contém dados válidos.');
            }
        }
        
        // Resposta de Sucesso
        return res.status(200).json({
            message: 'Arquivos processados e dados inseridos no banco de dados com sucesso.',
            processados: {
                zeus: uploadStatus.zeus,
                elipse: uploadStatus.elipse,
            },
        });

    } catch (processError) {
        // ... (Tratamento de erro permanece o mesmo)
        const errorMessage = processError.message;
        const [statusCode, message] = errorMessage.includes('|') ? errorMessage.split('|') : [500, 'Erro interno no processamento de dados.'];
        
        return res.status(parseInt(statusCode) || 500).json({ 
            error: message || 'Erro no processamento dos arquivos.', 
            details: errorMessage, 
            code: parseInt(statusCode) || 500 
        });
    } finally {
        // Limpeza dos arquivos temporários
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