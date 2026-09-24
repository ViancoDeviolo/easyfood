// Erros de aplicação com status HTTP associado.
// Services e repositories lançam estes erros; o error handler converte em resposta HTTP.
// Assim nenhuma camada abaixo do controller precisa conhecer req/res.

class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = "Dados inválidos", details) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Acesso negado") {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Recurso não encontrado") {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflito com o estado atual do recurso") {
    super(message, 409);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = "Serviço temporariamente indisponível") {
    super(message, 503);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError
};
