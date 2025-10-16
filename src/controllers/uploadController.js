const fs = require('fs/promises');
const { extractDataFromSpreadsheet } = require('../services/extractionService');
const { insertZeusData, insertElipseData } = require('../repositories/dataRepository');
class UploadController {
  async handleFileUploadAndProcessing(req, res, next) {
    if (!req.files || !req.files.planilha1 || !req.files.planilha2) {
      return res.status(400).json({ error: 'É necessário enviar os dois arquivos: planilha1 e planilha2.' });
    }
    const filePaths = [req.files.planilha1[0].path, req.files.planilha2[0].path];
    try {
      const data1 = extractDataFromSpreadsheet(filePaths[0]);
      const data2 = extractDataFromSpreadsheet(filePaths[1]);
      const isZeus1 = data1.some(r => 'pressao_succao' in r);
      await (isZeus1 ? insertZeusData(data1) : insertElipseData(data1));
      await (isZeus1 ? insertElipseData(data2) : insertZeusData(data2));
      return res.status(200).json({ message: 'Arquivos processados e inseridos com sucesso.' });
    } catch (error) {
      next(error); // Passa o erro para o middleware de tratamento
    } finally {
      filePaths.forEach(p => fs.unlink(p).catch(e => console.error(`Falha ao deletar ${p}`, e)));
    }
  }
}
module.exports = new UploadController();