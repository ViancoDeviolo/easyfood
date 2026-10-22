// Rotas do módulo auth.
//   POST /auth/register  -> cadastro (público)
//   POST /auth/login     -> login, devolve JWT (público)
//   GET  /auth/me        -> dados do usuário logado (protegido)

const express = require("express");

function createAuthRoutes({ controller, authenticate }) {
  const router = express.Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", authenticate, controller.me);

  return router;
}

module.exports = { createAuthRoutes };
