// Middleware que protege rotas: exige "Authorization: Bearer <token>".
// Se o token for válido, a identidade do usuário fica disponível em req.user.

const { UnauthorizedError } = require("../../shared/errors/app-error");

function createAuthMiddleware(authService) {
  return function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedError("Token não fornecido");
    }

    req.user = authService.verifyToken(token);
    next();
  };
}

module.exports = { createAuthMiddleware };
