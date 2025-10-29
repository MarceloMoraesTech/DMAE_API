// src/repositories/dataRepository.js

const { query } = require('../config/db');

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
async function insertElipseData(data) {
    if (data.length === 0) return;
    
    // Colunas esperadas do Elipse (ajuste se necessário)
    const columns = ['data_hora', 'nome_estacao', 'nome_variavel', 'var_local', 'valor', 'unidade'];

    const values = [];
    const placeholders = data.map((row, rowIndex) => {
        const rowValues = columns.map((col, colIndex) => {
            let valueToInsert = row[col];

            // --- CORREÇÃO ELIPSE: Aplica conversão para o campo 'valor' ---
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
        ON CONFLICT (data_hora) DO NOTHING;
    `; 

    await query(sql, values);
}

module.exports = {
    insertZeusData,
    insertElipseData,
};