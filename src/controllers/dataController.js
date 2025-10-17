const { query } = require('../config/db'); // Importa a função de consulta do DB

/**
 * @swagger
 * /api/data/all:
 *   get:
 *     summary: Obtém todos os dados das tabelas Zeus e Elipse do banco de dados.
 *     tags:
 *       - Dados
 *     description: Retorna um objeto JSON com arrays de dados separados por planilha.
 *     responses:
 *       '200':
 *         description: Dados retornados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 planilha_zeus:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       data_hora:
 *                         type: string
 *                         format: date-time
 *                       pressao_succao:
 *                         type: number
 *                       vazao_media:
 *                         type: number
 *                 planilha_elipse:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       data_hora:
 *                         type: string
 *                         format: date-time
 *                       nome_estacao:
 *                         type: string
 *                       valor:
 *                         type: number
 *       '500':
 *         description: Erro interno do servidor.
 */

async function getOverallData(req, res) {
    try {
        
        // 1. Busca dados do Zeus (limite de 5000 linhas para não sobrecarregar)
        const zeusResult = await query('SELECT * FROM zeus ORDER BY data_hora DESC LIMIT 5000');
        
        // 2. Busca dados do Elipse (limite de 5000 linhas)
        const elipseResult = await query('SELECT * FROM elipse ORDER BY data_hora DESC LIMIT 5000');

        // 3. Formata a resposta (único objeto JSON com dados separados)
        const responseData = {
            planilha_zeus: zeusResult.rows,
            planilha_elipse: elipseResult.rows,
        };

        return res.status(200).json(responseData);

    } catch (error) {
        console.error('Erro ao buscar todos os dados do DB:', error);
        return res.status(500).json({ error: 'Falha ao buscar dados no banco de dados.', details: error.message });
    }
}

/**
 * @swagger
 * /api/data/charts:
 *   get:
 *     summary: Obtém dados essenciais e otimizados para a plotagem de gráficos.
 *     tags:
 *       - Dados
 *     description: Retorna um subconjunto de colunas do Zeus, ideal para gráficos de tempo.
 *     responses:
 *       '200':
 *         description: Dados otimizados para gráficos retornados com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 chart_data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       data_hora:
 *                         type: string
 *                         format: date-time
 *                       pressao_succao:
 *                         type: number
 *                       pressao_recal:
 *                         type: number
 *                       vazao_media:
 *                         type: number
 *                 source:
 *                   type: string
 *       '500':
 *         description: Erro interno do servidor.
 */

async function getChartData(req, res) {
    try {
        // Exemplo: Buscar apenas os campos essenciais para o gráfico de comparação
        const sql = `
            SELECT 
                data_hora,
                pressao_succao,
                pressao_recal,
                vazao_media 
            FROM 
                zeus
            ORDER BY 
                data_hora
            LIMIT 
                2000;
        `;
        
        const result = await query(sql);

        // Retorna os dados em formato JSON, prontos para o frontend plotar
        return res.status(200).json({
            chart_data: result.rows,
            source: "zeus"
        });

    } catch (error) {
        console.error('Erro ao buscar dados para gráficos:', error);
        return res.status(500).json({ error: 'Falha ao gerar dados para gráficos.', details: error.message });
    }
}

module.exports = {
    getOverallData,
    getChartData,
};