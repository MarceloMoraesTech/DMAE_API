// src/repositories/dataRepository.js

const { query } = require('../config/db');

// Define o tamanho do lote para a inserção. 
// Um tamanho de 1000 linhas é seguro para evitar o limite de parâmetros do driver (32767).
const BATCH_SIZEE = 500; 

// Colunas fixas para Zeus e Elipse
const ZEUS_COLUMNS = ['data_hora', 'pressao_succao', 'pressao_recal', 'total', 'vazao_media', 'evento', 'nome_estacao'];
const ELIPSE_COLUMNS = ['data_hora', 'nome_estacao', 'nome_variavel', 'variavel_local', 'valor', 'unidade'];


/**
 * Executa a inserção dos dados em lotes para evitar o limite de parâmetros do PostgreSQL.
 * @param {Array<Object>} data - Dados processados da planilha.
 * @param {Array<string>} columns - Nomes das colunas da tabela.
 * @param {string} tableName - Nome da tabela ('zeus' ou 'elipse').
 * @param {string} conflictClause - Cláusula ON CONFLICT (ex: 'ON CONFLICT (data_hora) DO NOTHING').
 */
async function batchInsert(data, columns, tableName, conflictClause) {
    if (data.length === 0) return;

    const numColumns = columns.length;

    // Itera sobre o array de dados em lotes (chunks)
    for (let i = 0; i < data.length; i += BATCH_SIZEE) {
        const batch = data.slice(i, i + BATCH_SIZEE);
        if (batch.length === 0) continue;

        const values = [];
        const placeholders = [];
        let paramIndex = 1; // Contador para os placeholders: $1, $2, $3, ...

        for (const row of batch) {
            const rowValues = columns.map(col => {
                let valueToInsert = row[col];

                // Lógica de conversão numérica (Para as colunas que vieram como string do CSV)
                if (['pressao_succao', 'pressao_recal', 'total', 'vazao_media', 'valor'].includes(col)) {
                    if (valueToInsert === null || valueToInsert === undefined || valueToInsert === '') {
                        return null; // Mantém nulo para valores vazios
                    }
                    // Garante que o valor seja Number (ou null se for NaN) para envio ao DB
                    return parseFloat(valueToInsert) || null;
                }
                
                // Força a inserção do 'nome_estacao' (BORDINI 400), conforme sua lógica anterior
                if (col === 'nome_estacao' && tableName === 'zeus') {
                    return 'BORDINI 400';
                }

                return valueToInsert;
            });

            values.push(...rowValues); // Adiciona todos os valores do lote
            
            // Constrói os placeholders para a linha atual (ex: ($1, $2, $3))
            const rowPlaceholders = `(${Array.from({ length: numColumns }, 
                (_, j) => `$${paramIndex + j}`).join(', ')})`;
            
            placeholders.push(rowPlaceholders);
            paramIndex += numColumns;
        }

        // Constrói a consulta SQL final para o lote
        const sql = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES ${placeholders.join(', ')}
            ${conflictClause};
        `; 

        try {
            await query(sql, values);
            // console.log(`Lote ${i/BATCH_SIZE + 1} de ${batch.length} linhas inserido em ${tableName}.`);
        } catch (error) {
            console.error(`Erro ao inserir lote em ${tableName}:`, error.message);
            // Re-lança o erro para ser capturado no uploadController
            throw new Error(`500|Falha na inserção em ${tableName} (Lote ${i/BATCH_SIZEE + 1}). Detalhes: ${error.message}`);
        }
    }
}


/**
 * Insere um conjunto de dados do Zeus no banco de dados, usando inserção em lote.
 * É a função que estava falhando com 35264 parâmetros.
 * @param {Array<Object>} data - Array de objetos com os dados normalizados do Zeus.
 */
async function insertZeusData(data) {
    const conflictClause = 'ON CONFLICT (data_hora) DO NOTHING';
    await batchInsert(data, ZEUS_COLUMNS, 'zeus', conflictClause);
}

/**
 * Insere um conjunto de dados do Elipse no banco de dados, usando inserção em lote.
 * @param {Array<Object>} data - Array de objetos com os dados normalizados do Elipse.
 */
async function insertElipseData(data) {
    const conflictClause = 'ON CONFLICT (data_hora, nome_variavel, variavel_local) DO NOTHING';
    await batchInsert(data, ELIPSE_COLUMNS, 'elipse', conflictClause);
}

module.exports = {
    insertZeusData,
    insertElipseData,
};



/**
 * Insere um conjunto de dados do Zeus no banco de dados.
 * @param {Array<Object>} data - Array de objetos com os dados normalizados do Zeus.
 */
async function insertZeusData(data) {
    if (data.length === 0) return;

    // Colunas esperadas do Zeus (ajuste se necessário)
    const columns = ['data_hora', 'pressao_succao', 'pressao_recal', 'total', 'vazao_media', 'evento','nome_estacao'];
    
    // Constrói os placeholders e os valores para inserção em massa
    const values = [];
    const placeholders = data.map((row, rowIndex) => {
        const rowValues = columns.map((col, colIndex) => {
            let valueToInsert = row[col];
            
            // --- INÍCIO DA CORREÇÃO DE CONVERSÃO NUMÉRICA ---
            // Força a conversão para Number/Float para colunas numéricas
            if (['pressao_succao', 'pressao_recal', 'total', 'vazao_media'].includes(col)) {
                // Se o valor estiver vazio ou for null, mantenha null
                if (valueToInsert === null || valueToInsert === undefined || valueToInsert === '') {
                    valueToInsert = null;
                } else {
                    // Tenta converter para float. Se for uma string limpa (ex: "6660527618"), 
                    // parseFloat funciona. Isso garante que o driver receba um tipo Number.
                    // Usamos || null para tratar casos onde o valor pode ser NaN
                    valueToInsert = parseFloat(valueToInsert) || null;
                }
            }
            // --- FIM DA CORREÇÃO DE CONVERSÃO NUMÉRICA ---
            if (col === 'nome_estacao') {
                // Força a inserção de 'BORDINI 400' em todas as linhas
                valueToInsert = 'BORDINI 400'; 
            }

            values.push(valueToInsert); // Coleta o valor (agora Number para os campos numéricos)
            return `$${(rowIndex * columns.length) + colIndex + 1}`;
        }).join(', ');
        return `(${rowValues})`;
    }).join(', ');

    const sql = `
        INSERT INTO zeus (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (data_hora) DO NOTHING;
    `; // Exemplo: Evita duplicidade se data_hora for UNIQUE
    
    await query(sql, values);
}

/**
 * Insere um conjunto de dados do Elipse no banco de dados.
 * @param {Array<Object>} data - Array de objetos com os dados normalizados do Elipse.
 */

const BATCH_SIZE = 500;

async function insertElipseData(data) {
   if (data.length === 0) return;
    
    // Divide os dados em lotes
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        if (batch.length === 0) continue;

        // O restante do código de construção da query vai aqui, usando 'batch' em vez de 'data'

        const columns = ['data_hora', 'nome_estacao', 'nome_variavel', 'variavel_local', 'valor', 'unidade']; 

        const values = [];
        const placeholders = batch.map((row, rowIndex) => { // Use 'batch'
            const rowValues = columns.map((col, colIndex) => {
                let valueToInsert = row[col];

                // ... (Sua correção de float para 'valor' e outras colunas) ...
                if (col === 'valor') {
                    if (valueToInsert === null || valueToInsert === undefined || valueToInsert === '') {
                        valueToInsert = null;
                    } else {
                        valueToInsert = parseFloat(valueToInsert) || null;
                    }
                }
                
                values.push(valueToInsert);
                return `$${(rowIndex * columns.length) + colIndex + 1}`;
            }).join(', ');
            return `(${rowValues})`;
        }).join(', ');

        const sql = `
            INSERT INTO elipse (${columns.join(', ')})
            VALUES ${placeholders}
            ON CONFLICT (data_hora, nome_variavel, variavel_local) DO NOTHING;
        `; 

        try {
            await query(sql, values);
        } catch (error) {
            console.error(`Erro ao inserir lote ${i}:`, error.message);
            throw error; // Re-lança o erro para que a transação falhe
        }
    }
}

module.exports = {
    insertZeusData,
    insertElipseData,
};