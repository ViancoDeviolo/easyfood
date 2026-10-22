// Rotas do cardápio, montadas em /restaurants/:restaurantId/menu
//   GET    /                -> itens do cardápio (público)
//   POST   /                -> novo item (somente o dono)
//   PATCH  /:itemId         -> alteração parcial (somente o dono)
//   DELETE /:itemId         -> remoção (somente o dono, item nunca pedido)

const express = require("express");

function createMenuRoutes({ controller, authenticate }) {
  // mergeParams: permite ler :restaurantId definido na rota "pai"
  const router = express.Router({ mergeParams: true });

  router.get("/", controller.list);
  router.post("/", authenticate, controller.create);
  router.patch("/:itemId", authenticate, controller.update);
  router.delete("/:itemId", authenticate, controller.remove);

  return router;
}

module.exports = { createMenuRoutes };
