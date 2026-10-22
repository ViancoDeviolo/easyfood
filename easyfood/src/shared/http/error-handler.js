// Middlewares finais da aplicação: rota inexistente e tratamento centralizado de erros.
// No Express 5, erros lançados em funções async chegam aqui automaticamente.

const { AppError } = require("../errors/app-error");

function notFoundHandler(req, res) {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // Corpo maior que o limite configurado (ex.: foto acima de 15 MB)
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Arquivo maior que o permitido" });
  }

  // JSON malformado no corpo da requisição
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido no corpo da requisição" });
  }

  console.error("[erro não tratado]", err);
  return res.status(500).json({ error: "Erro interno do servidor" });
}

module.exports = { notFoundHandler, errorHandler };
