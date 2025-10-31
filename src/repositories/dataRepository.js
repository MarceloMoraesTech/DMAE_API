// src/repositories/dataRepository.js

const { query } = require('../config/db');

// Define o tamanho do lote para a inserção. 
// O BATCH_SIZE de 1000 é seguro para ambas as tabelas e evita o limite de 32767 parâmetros.
const BATCH_SIZE = 1000; 

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
    for (let i = 0; i < data.length; i += BATCH_SIZE) { // Usando BATCH_SIZE
        const batch = data.slice(i, i + BATCH_SIZE); // Usando BATCH_SIZE
        if (batch.length === 0) continue;

        const values = [];
        const placeholders = [];
        let paramIndex = 1; // Contador para os placeholders: $1, $2, $3, ...

        for (const row of batch) {
            const rowValues = columns.map(col => {
                let valueToInsert = row[col];

                // Lógica de conversão numérica 
                if (['pressao_succao', 'pressao_recal', 'total', 'vazao_media', 'valor'].includes(col)) {
                    if (valueToInsert === null || valueToInsert === undefined || valueToInsert === '') {
                        return null; 
                    }
                    // Garante que o valor seja Number (ou null se for NaN)
                    return parseFloat(valueToInsert) || null;
                }
                
                // Força a inserção do 'nome_estacao' (BORDINI 400) para a tabela 'zeus'
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
        } catch (error) {
            console.error(`Erro ao inserir lote em ${tableName}:`, error.message);
            // Re-lança o erro para ser capturado no uploadController
            throw new Error(`500|Falha na inserção em ${tableName} (Lote ${i/BATCH_SIZE + 1}). Detalhes: ${error.message}`);
        }
    }
}


/**
 * Insere um conjunto de dados do Zeus no banco de dados, usando inserção em lote.
 */
async function insertZeusData(data) {
    const conflictClause = 'ON CONFLICT (data_hora) DO NOTHING';
    await batchInsert(data, ZEUS_COLUMNS, 'zeus', conflictClause);
}

/**
 * Insere um conjunto de dados do Elipse no banco de dados, usando inserção em lote.
 */
async function insertElipseData(data) {
    const conflictClause = 'ON CONFLICT (data_hora, nome_variavel, variavel_local) DO NOTHING';
    await batchInsert(data, ELIPSE_COLUMNS, 'elipse', conflictClause);
}

module.exports = {
    insertZeusData,
    insertElipseData,
};