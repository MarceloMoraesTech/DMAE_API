// src/repositories/dataRepository.js

const { query } = require('../config/db');

async function insertZeusData(data) {
    if (!data || data.length === 0) return;
    const columns = ['data_hora', 'pressao_succao', 'pressao_recal', 'total', 'vazao_media', 'evento'];
    const values = [];
    const placeholders = data.map((row, rowIndex) => {
        const rowValues = columns.map((col, colIndex) => {
            values.push(row[col] || null);
            return `$${(rowIndex * columns.length) + colIndex + 1}`;
        }).join(', ');
        return `(${rowValues})`;
    }).join(', ');

    const sql = `INSERT INTO zeus (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT (data_hora) DO NOTHING;`;
    await query(sql, values);
}

async function insertElipseData(data) {
    if (!data || data.length === 0) return;
    const columns = ['data_hora', 'nome_estacao', 'nome_variavel', 'var_local', 'valor', 'unidade'];
    const values = [];
    const placeholders = data.map((row, rowIndex) => {
        const rowValues = columns.map((col, colIndex) => {
            values.push(row[col] || null);
            return `$${(rowIndex * columns.length) + colIndex + 1}`;
        }).join(', ');
        return `(${rowValues})`;
    }).join(', ');

    const sql = `INSERT INTO elipse (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT (data_hora) DO NOTHING;`;
    await query(sql, values);
}

module.exports = {
    insertZeusData,
    insertElipseData,
};