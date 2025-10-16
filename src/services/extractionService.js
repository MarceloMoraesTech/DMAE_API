// src/services/extractionService.js

const XLSX = require('xlsx');

const COLUMN_MAP = {
    'Data/Hora': 'data_hora', 'PRESSAO DE SUCCAO': 'pressao_succao',
    'PRESSAO DE RECALQUE': 'pressao_recal', 'Total': 'total',
    'Vazao Media': 'vazao_media', 'Evento': 'evento',
    'pressao de succao': 'pressao_succao', 'vazao media': 'vazao_media',
    'total': 'total', 'datahora': 'data_hora', 'nome_estacao': 'nome_estacao',
    'nome_variavel': 'nome_variavel', 'var_local': 'var_local',
    'Valor': 'valor', 'Unidade': 'unidade',
};

function normalizeHeader(colName) {
    const cleanedName = colName ? colName.trim() : '';
    if (COLUMN_MAP[cleanedName]) return COLUMN_MAP[cleanedName];
    const lowerCaseName = cleanedName.toLowerCase();
    if (COLUMN_MAP[lowerCaseName]) return COLUMN_MAP[lowerCaseName];
    return lowerCaseName.replace(/[^a-z0-9_]/g, '');
}

function extractDataFromSpreadsheet(filePath) {
    const workbook = XLSX.readFile(filePath, { delimiter: ';', raw: false, type: 'file' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!rawData || rawData.length <= 1) {
        throw new Error('422|Planilha vazia: O arquivo não contém linhas de dados.');
    }

    const rawHeaders = rawData[0];
    const normalizedHeaders = rawHeaders.map(normalizeHeader);
    const finalNormalizedHeaders = normalizedHeaders.filter(header => header && header.length > 0);

    let requiredColumnsDB = [];
    if (finalNormalizedHeaders.includes('pressao_succao') || finalNormalizedHeaders.includes('vazao_media')) {
        requiredColumnsDB = ['data_hora', 'pressao_succao', 'vazao_media', 'total', 'pressao_recal'];
    } else if (finalNormalizedHeaders.includes('nome_estacao') && finalNormalizedHeaders.includes('valor')) {
        requiredColumnsDB = ['data_hora', 'nome_estacao', 'valor'];
    } else {
        throw new Error('422|Formato inesperado: Cabeçalhos não reconhecidos. Encontrados: ' + finalNormalizedHeaders.join(', '));
    }

    const missingColumns = requiredColumnsDB.filter(col => !finalNormalizedHeaders.includes(col));
    if (missingColumns.length > 0) {
        throw new Error(`422|Formato inesperado: Colunas essenciais faltando: ${missingColumns.join(', ')}`);
    }

    const finalData = XLSX.utils.sheet_to_json(worksheet, { raw: false, header: normalizedHeaders, range: 1 });
    return finalData.filter(row => Object.keys(row).length > 0);
}

module.exports = { extractDataFromSpreadsheet };