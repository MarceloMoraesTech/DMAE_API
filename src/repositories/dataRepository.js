// src/repositories/dataRepository.js

const { query } = require('../config/db');

/**
 * Insere um conjunto de dados do Zeus no banco de dados.
 * @param {Array<Object>} data - Array de objetos com os dados normalizados do Zeus.
 */
async function insertZeusData(data) {
    if (data.length === 0) return;

    // Colunas esperadas do Zeus (ajuste se necessário)
    const columns = ['data_hora', 'pressao_succao', 'pressao_recal', 'total', 'vazao_media', 'evento'];
    
    // Constrói os placeholders e os valores para inserção em massa
    const values = [];
    const placeholders = data.map((row, rowIndex) => {
        const rowValues = columns.map((col, colIndex) => {
            values.push(row[col] || null); // Coleta o valor, usando null se a coluna não existir
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
async function insertElipseData(data) {
    if (data.length === 0) return;
    
    // Colunas esperadas do Elipse (ajuste se necessário)
    const columns = ['data_hora', 'nome_estacao', 'nome_variavel', 'var_local', 'valor', 'unidade'];

    const values = [];
    const placeholders = data.map((row, rowIndex) => {
        const rowValues = columns.map((col, colIndex) => {
            values.push(row[col] || null);
            return `$${(rowIndex * columns.length) + colIndex + 1}`;
        }).join(', ');
        return `(${rowValues})`;
    }).join(', ');

    const sql = `
        INSERT INTO elipse (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (data_hora) DO NOTHING;
    `; 

    await query(sql, values);
}

module.exports = {
    insertZeusData,
    insertElipseData,
};