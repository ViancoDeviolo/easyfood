// Rotas do cardápio, montadas em /restaurants/:restaurantId/menu
// e também em /restaurants/:restaurantId/dishes (mesmo recurso, nome usado pela turma)
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

// Rotas do prato acessado direto pelo id, montadas em /dishes
//   GET    /:dishId        -> dados do prato (público)
//   POST   /:dishId/image  -> envia/troca a foto do prato (somente o dono; multipart campo "image")
//   DELETE /:dishId/image  -> remove a foto do prato (somente o dono)
function createDishRoutes({ controller, authenticate, uploadImage }) {
  const router = express.Router();

  router.get("/:dishId", controller.show);
  router.post("/:dishId/image", authenticate, uploadImage, controller.uploadImage);
  router.delete("/:dishId/image", authenticate, controller.removeImage);

  return router;
}

module.exports = { createMenuRoutes, createDishRoutes };
