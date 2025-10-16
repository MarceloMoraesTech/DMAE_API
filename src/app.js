const express = require('express');
const routes = require('./routes');
const app = express();
app.use(express.json());
app.use('/api', routes);
app.use((err, req, res, next) => {
    const [statusCode, message] = err.message.split('|');
    const code = parseInt(statusCode) || 500;
    res.status(code).json({ error: message || 'Erro inesperado no servidor.' });
});
module.exports = app;