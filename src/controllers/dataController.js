const { query } = require('../config/db'); // Importa a função de consulta do DB

async function getOverallData(req, res) {
    try {
        
        // 1. Busca dados do Zeus (limite de 5000 linhas para não sobrecarregar)
        const zeusResult = await query('SELECT * FROM zeus ORDER BY data_hora DESC LIMIT 5000');
        
        const elipseSql = `
    WITH latest_elipse AS (
        SELECT data_hora, nome_estacao FROM elipse 
        GROUP BY data_hora, nome_estacao 
        HAVING COUNT(DISTINCT nome_variavel) >= 6 
        ORDER BY data_hora DESC 
    )
    SELECT 
        t1.data_hora,
        t1.nome_estacao,
        -- PIVOTAGEM: Transforma linhas em colunas, usando nomes REAIS da API/tabela
        
        -- Status
        MAX(CASE WHEN t1.nome_variavel = 'ModoControle' THEN t1.valor ELSE NULL END) AS modo_controle,
        MAX(CASE WHEN t1.nome_variavel = 'FalhaComunicacao' THEN t1.valor ELSE NULL END) AS falha_comunicacao,

        -- Pressão
        MAX(CASE WHEN t1.nome_variavel = 'PressaoSucção' THEN t1.valor ELSE NULL END) AS pressao_succao,
        MAX(CASE WHEN t1.nome_variavel = 'PressaoRecalque' THEN t1.valor ELSE NULL END) AS pressao_recalque,
        
        -- Nível
        -- Assumindo que 'RSV inferior 01' é o nome da variável de nível inferior
        MAX(CASE WHEN t1.nome_variavel = 'Nível' AND t1.variavel_local_desc = 'RSV inferior 01' THEN t1.valor 
                 WHEN t1.nome_variavel = 'RSV inferior 01' THEN t1.valor -- Tentativa de cobrir inconsistências
                 ELSE NULL END) AS nivel_rsv_inferior,

        -- Assumindo que 'Reservatório' é o nome da variável de nível superior
        MAX(CASE WHEN t1.nome_variavel = 'Nível' AND t1.variavel_local_desc = 'Reservatório' THEN t1.valor 
                 WHEN t1.nome_variavel = 'NivelRSVSuperior' THEN t1.valor -- Tentativa de cobrir inconsistências
                 ELSE NULL END) AS nivel_rsv_superior_valor,
        
        -- Nomes das Variáveis (Útil para o frontend saber o nome do nível superior)
        MAX(CASE WHEN t1.nome_variavel = 'Nível' AND t1.variavel_local_desc = 'Reservatório' THEN t1.variavel_local_desc ELSE NULL END) AS nivel_rsv_superior_nome,


        -- Correntes (Usando 'variavel_local_desc' para diferenciar as bombas)
        MAX(CASE WHEN t1.nome_variavel = 'Corrente' AND t1.variavel_local_desc = 'GMB 01' THEN t1.valor ELSE NULL END) AS corrente_gmb1,
        MAX(CASE WHEN t1.nome_variavel = 'Corrente' AND t1.variavel_local_desc = 'GMB 02' THEN t1.valor ELSE NULL END) AS corrente_gmb2,
        MAX(CASE WHEN t1.nome_variavel = 'Corrente' AND t1.variavel_local_desc = 'GMB 03' THEN t1.valor ELSE NULL END) AS corrente_gmb3
        
    FROM 
        elipse t1
    INNER JOIN latest_elipse t2 ON t1.data_hora = t2.data_hora AND t1.nome_estacao = t2.nome_estacao -- Adicionado nome_estacao ao JOIN
    GROUP BY 
        t1.data_hora, t1.nome_estacao
    ORDER BY 
        t1.data_hora DESC;
`;

        const elipseResult = await query(elipseSql);

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


async function getChartData(req, res) {
    try {
        // Recebe os parâmetros de data (o frontend já envia estes)
        const { start, end } = req.query;
        // Exemplo: Buscar apenas os campos essenciais para o gráfico de comparação
        const sql = `
            SELECT 
                DISTINCT ON (data_hora)
                data_hora,
                pressao_succao,
                pressao_recal,
                vazao_media 
            FROM 
                zeus
            WHERE
                data_hora >= $1 AND data_hora <= $2
            ORDER BY 
                data_hora ASC  
            LIMIT 
                2000;
        `;

        // Passa os parâmetros de data para a função query
        const result = await query(sql, [start, end]);

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

// --- CONSTANTES DE REGRA DE NEGÓCIO ---
// Regra de Faturamento: superior a 85% do intervalo de tempo de medição
const MIN_PERCENTUAL_FATURAMENTO = 0.85; 
// Meta Teórica para um mês completo de 31 dias (14880 pacotes/linhas)
const META_TEORICA_MAX = 14880; 


async function getFaturamentoStatus(req, res) {
    // mes_ano deve ser 'YYYY-MM', ex: '2025-08'
    const { mes_ano } = req.query; 

    if (!mes_ano || !/^\d{4}-\d{2}$/.test(mes_ano)) {
        return res.status(400).json({ error: 'Parâmetro mes_ano é obrigatório e deve estar no formato YYYY-MM (ex: 2025-08).' });
    }

    try {
        // 1. Determina o início e o fim do mês (necessário para a cláusula WHERE)
        const [ano, mes] = mes_ano.split('-');
        const data_inicio = `${mes_ano}-01 00:00:00+00`;
        
        // Data de fim é o primeiro dia do próximo mês
        const mes_fim_js = new Date(parseInt(ano), parseInt(mes)); 
        const data_fim = mes_fim_js.toISOString().slice(0, 10) + ' 00:00:00+00';

        // 2. Consulta o PostgreSQL para contar as linhas VÁLIDAS por estação no período
        // Contamos apenas registros que têm uma vazão_media > 0 para garantir que o pacote de dados é válido.
        const sql = `
            SELECT 
                nome_estacao AS Estacao,
                COUNT(id_bomba) AS QtdCommEntregue
            FROM 
                zeus
            WHERE 
                data_hora >= $1 
                AND data_hora < $2
                AND vazao_media > 0  -- Assume-se que vazão > 0 implica pacote de dados válido
            GROUP BY 
                nome_estacao;
        `;
        
        const result = await query(sql, [data_inicio, data_fim]);
        const rawData = result.rows;

        // 3. Aplicação da Lógica de Faturamento
        const dataComStatus = rawData.map(item => {
            const numerador = parseInt(item.qtdcommentregue); // nome da coluna em camelCase é convertido pelo driver pg
            const denominador = META_TEORICA_MAX; // Usamos a constante de 14880 para 31 dias

            // Cálculo do Percentual
            const percentual = numerador / denominador;
            
            // Aplicação da Regra Contratual (>= 85%)
            const status = (percentual >= MIN_PERCENTUAL_FATURAMENTO) 
                ? 'FATURAR' 
                : 'NÃO FATURAR';

            // Retorna o objeto processado
            return {
                Estacao: item.estacao,
                QtdCommEntregue: numerador,
                MetaTeorica: denominador,
                PercentualComms: (percentual * 100).toFixed(2) + '%', 
                StatusFaturamento: status
            };
        });

        return res.status(200).json(dataComStatus);

    } catch (error) {
        console.error(`Erro ao processar status de faturamento para ${mes_ano}:`, error);
        return res.status(500).json({ 
            error: 'Falha ao calcular faturamento a partir da tabela ZEUS.', 
            details: error.message 
        });
    }
}

module.exports = {
    getOverallData,
    getChartData,
    getFaturamentoStatus,
};