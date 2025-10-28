// src/services/extractionService.js

const XLSX = require('xlsx');

// Mapeamento de colunas longas (das planilhas) para nomes curtos (do DB)
const COLUMN_MAP = {
    // --- Planilha ZEUS ---
    'Data/Hora': 'data_hora',
    'PRESSAO DE SUCCAO': 'pressao_succao',
    'PRESSAO DE RECALQUE': 'pressao_recal',
    'Total': 'total',
    'Vazao Media': 'vazao_media',
    'Evento': 'evento',
    // Adicionando variações em minúsculo para robustez
    'pressao de succao': 'pressao_succao',
    'vazao media': 'vazao_media',
    'total': 'total',

    // --- Planilha ELIPSE ---
    'datahora': 'data_hora',
    'nome_estacao': 'nome_estacao',
    'nome_variavel': 'nome_variavel',
    'var_local': 'var_local',
    'Valor': 'valor',
    'Unidade': 'unidade',
};

/**
 * Normaliza o nome de uma coluna mapeando para um nome padronizado.
 * @param {string} colName - Nome da coluna lida da planilha.
 * @returns {string} Nome da coluna padronizado (ou o original se não mapeado).
 */
function normalizeHeader(colName) {
   // 1. Converte para string e remove espaços em branco das extremidades (resolvendo o erro .trim)
    const rawCleanedName = String(colName || '').trim();

    if (rawCleanedName.length === 0) {
        return '';
    }

    // 2. Normalização: Converte para minúsculo e substitui MÚLTIPLOS espaços por UM ÚNICO espaço.
    // Isso garante consistência, por exemplo, 'Vazao  Media' -> 'vazao media'
    const normalizedKey = rawCleanedName
        .toLowerCase()
        .replace(/\s+/g, ' '); // Substitui um ou mais espaços por um único espaço

    // 3. Tenta buscar no mapa usando a chave padronizada (em minúsculo, com espaços consistentes)
    // O mapeamento em minúsculo ('vazao media') deve ser o suficiente agora.
    if (COLUMN_MAP[normalizedKey]) {
        return COLUMN_MAP[normalizedKey]; // DEVE ser 'vazao_media'
    }

    // 4. Fallback: Se não encontrar, retorna o nome limpo sem caracteres especiais (seu fallback anterior)
    // A chave do seu mapa 'data_hora' precisa de um tratamento diferente para o 'Data/Hora', então vamos
    // ajustar a lógica de fallback.
    
    // Para tratar 'Data/Hora', vamos tentar remover tudo que não seja letra, número ou underscore,
    // garantindo que ele não retorne 'datahora' e sim 'data_hora' (que é o que está no mapa).
    
    // Se a busca principal falhar, o nome original 'Data/Hora' viraria 'data/hora' e não seria encontrado no mapa.
    // Vamos corrigir a busca para ser mais flexível com o mapa.

    // A MUDANÇA ESSENCIAL é na busca pelo mapa:

    // Tente com a busca apenas em minúsculo:
    const searchKey = rawCleanedName.toLowerCase(); 

    // Busca exata (sua lógica original, mas usando o nome LIMPO)
    if (COLUMN_MAP[searchKey]) { // Ex: 'vazao media' -> 'vazao_media'
        return COLUMN_MAP[searchKey];
    }
    if (COLUMN_MAP[rawCleanedName]) { // Ex: 'Vazao Media' -> 'vazao_media'
        return COLUMN_MAP[rawCleanedName];
    }
    
    // Fallback: Remove caracteres especiais e tenta buscar
    const fallbackKey = normalizedKey.replace(/[^a-z0-9]/g, ''); // Remove todos os símbolos, incluindo '/' e ' '
    if (COLUMN_MAP[fallbackKey]) { // Isto é para chaves como 'datahora' se você tivesse no mapa
        return COLUMN_MAP[fallbackKey];
    }


    // Seu fallback original: (mantido apenas para garantir que retorna uma string limpa)
    return searchKey.replace(/[^a-z0-9_]/g, '');
}


/**
 * Lê um arquivo de planilha (xlsx, xls, csv com ';'), extrai os dados e normaliza os cabeçalhos.
 * @param {string} filePath - O caminho completo do arquivo.
 * @returns {Array<Object>} Array de objetos JSON com cabeçalhos normalizados.
 * @throws {Error} Se o arquivo estiver vazio ou se colunas essenciais estiverem faltando.
 */
function extractDataFromSpreadsheet(filePath) {
    let workbook;
    
    // Opções de leitura: Define o delimitador para CSV como ponto e vírgula
    const readOptions = { 
        delimiter: ';', 
        raw: false, // Mantém a formatação de números e datas como texto
        type: 'file' // Tenta adivinhar o tipo de arquivo
    };

    try {
        // Tenta ler o arquivo, usando a opção de delimitador (importante para CSV)
        workbook = XLSX.readFile(filePath, readOptions);
    } catch (error) {
        throw new Error(`422|Falha ao ler o arquivo. Verifique o formato e permissões: ${error.message}`);
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // header: 1 ainda instrui a usar a próxima linha (Linha 2) como cabeçalho
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 1 });

    // 1. Validação de Vazio (RB04)
    if (!rawData || rawData.length <= 1) { 
        throw new Error('422|Planilha vazia: O arquivo não contém linhas de dados.');
    }

    // A primeira linha é o cabeçalho
    const rawHeaders = rawData[0];
    const normalizedHeaders = rawHeaders.map(normalizeHeader);
    
    // Filtra cabeçalhos vazios que podem surgir de colunas extras vazias no CSV
    const finalNormalizedHeaders = normalizedHeaders.filter(header => header && header.length > 0);

    // 2. Validação das Colunas Essenciais (RB04) - Validação Condicional
    let requiredColumnsDB = [];

    // Checa se o arquivo parece ser o ZEUS (tem 'pressao_succao' ou 'vazao_media')
    if (finalNormalizedHeaders.includes('pressao_succao') || finalNormalizedHeaders.includes('vazao_media')) {
        // Requisitos para a Planilha ZEUS
        requiredColumnsDB = [
            'data_hora',
            'pressao_succao',
            'vazao_media',
            'total',
            'pressao_recal',
        ];
    } else if (finalNormalizedHeaders.includes('nome_estacao') && finalNormalizedHeaders.includes('valor')) {
        // Requisitos para a Planilha ELIPSE
        requiredColumnsDB = [
            'data_hora',
            'nome_estacao',
            'valor',
        ];
    } else {
        // Caso não reconheça o formato de nenhuma das duas planilhas
        throw new Error('422|Formato inesperado: Planilha com cabeçalhos não reconhecidos. Colunas encontradas: ' + finalNormalizedHeaders.join(', '));
    }

    // Checa se as colunas obrigatórias estão presentes
    const missingColumns = requiredColumnsDB.filter(col => !finalNormalizedHeaders.includes(col));

    if (missingColumns.length > 0) {
        throw new Error(`422|Formato inesperado: Colunas essenciais faltando (verifique mapeamento): ${missingColumns.join(', ')}`);
    }

    // 3. Converte para o formato final JSON, usando a função customizada para mapear cabeçalhos
    const finalData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        header: normalizedHeaders, // Usa os cabeçalhos normalizados (incluindo nulos/vazios, mas o .filter acima garante a validação)
        range: 1 // Ignora a primeira linha (o cabeçalho original)
    });

    // Filtra objetos com colunas vazias
    const cleanedFinalData = finalData.filter(row => Object.keys(row).length > 0);

    return cleanedFinalData;
}

module.exports = {
    extractDataFromSpreadsheet,
};