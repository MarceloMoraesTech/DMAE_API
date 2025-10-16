const { query } = require('../config/db');
module.exports = {
  async getOverallData(req, res) {
    try {
      const zeusResult = await query('SELECT * FROM zeus LIMIT 5000');
      const elipseResult = await query('SELECT * FROM elipse LIMIT 5000');
      return res.status(200).json({ planilha_zeus: zeusResult.rows, planilha_elipse: elipseResult.rows });
    } catch (error) { return res.status(500).json({ error: 'Falha ao buscar dados.' }); }
  },
};