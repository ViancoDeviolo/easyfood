// Rotas do módulo restaurants.
//   GET    /restaurants             -> lista (público, filtros ?search=&category=&page=&limit=)
//   GET    /restaurants/categories  -> categorias existentes (público)
//   GET    /restaurants/mine        -> restaurantes do usuário logado
//   GET    /restaurants/:id         -> detalhe (público)
//   POST   /restaurants             -> cadastro (protegido)
//   PATCH  /restaurants/:id         -> alteração parcial (somente o dono)
//   DELETE /restaurants/:id         -> remoção (somente o dono, sem pedidos)

const express = require("express");

function createRestaurantRoutes({ controller, authenticate }) {
  const router = express.Router();

  router.get("/", controller.list);
  router.get("/categories", controller.categories);
  router.get("/mine", authenticate, controller.mine);
  router.get("/:id", controller.getById);
  router.post("/", authenticate, controller.create);
  router.patch("/:id", authenticate, controller.update);
  router.delete("/:id", authenticate, controller.remove);

  return router;
}

module.exports = { createRestaurantRoutes };
