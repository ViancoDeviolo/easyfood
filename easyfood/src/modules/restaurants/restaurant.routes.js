// Rotas do módulo restaurants.
//   GET    /restaurants             -> lista (público, filtros ?search=&category=&page=&limit=)
//   GET    /restaurants/categories  -> categorias existentes (público)
//   GET    /restaurants/mine        -> restaurantes do usuário logado
//   GET    /restaurants/:id         -> detalhe (público)
//   POST   /restaurants             -> cadastro (protegido)
//   PATCH  /restaurants/:id         -> alteração parcial (somente o dono)
//   DELETE /restaurants/:id         -> remoção (somente o dono, sem pedidos)
//   PUT    /restaurants/:id/image   -> envia a foto (somente o dono) -> 202, processada pela função
//   GET    /restaurants/:id/image   -> foto otimizada (WebP, público)
//   GET    /restaurants/:id/image/status -> NENHUMA | PROCESSANDO | PRONTA | ERRO
//   DELETE /restaurants/:id/image   -> remove a foto (somente o dono)

const express = require("express");

function createRestaurantRoutes({ controller, imageController, imageBodyParser, authenticate }) {
  const router = express.Router();

  router.get("/", controller.list);
  router.get("/categories", controller.categories);
  router.get("/mine", authenticate, controller.mine);
  router.get("/:id", controller.getById);
  router.post("/", authenticate, controller.create);
  router.patch("/:id", authenticate, controller.update);
  router.delete("/:id", authenticate, controller.remove);

  // authenticate vem antes do parser: requisição sem token é recusada sem ler os 15 MB do corpo
  router.put("/:id/image", authenticate, imageBodyParser, imageController.upload);
  router.get("/:id/image", imageController.show);
  router.get("/:id/image/status", imageController.status);
  router.delete("/:id/image", authenticate, imageController.remove);

  return router;
}

module.exports = { createRestaurantRoutes };
