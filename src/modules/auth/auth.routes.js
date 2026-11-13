// Rotas do módulo auth.
//   POST /auth/register  -> cadastro (público)
//   POST /auth/login     -> login, devolve JWT (público)
//   GET  /auth/me        -> dados do usuário logado (protegido)
//   POST   /auth/me/image -> envia/troca a foto de perfil (protegido, multipart campo "image")
//   DELETE /auth/me/image -> remove a foto de perfil (protegido)

const express = require("express");

function createAuthRoutes({ controller, authenticate, uploadImage }) {
  const router = express.Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", authenticate, controller.me);
  // authenticate antes do upload: sem token, o arquivo nem é lido
  router.post("/me/image", authenticate, uploadImage, controller.uploadImage);
  router.delete("/me/image", authenticate, controller.removeImage);

  return router;
}

module.exports = { createAuthRoutes };
