// Rotas de pedidos. Todas exigem autenticação.
//   POST  /orders                          -> fazer pedido
//   GET   /orders                          -> meus pedidos (cliente)
//   GET   /orders/:id                      -> detalhe (cliente ou dono do restaurante)
//   PATCH /orders/:id/status               -> mudar status (conforme o ciclo de vida)
//   GET   /restaurants/:restaurantId/orders -> pedidos recebidos (somente o dono)

const express = require("express");

function createOrderRoutes({ controller, authenticate }) {
  const router = express.Router();

  router.use(authenticate);
  router.post("/", controller.place);
  router.get("/", controller.listMine);
  router.get("/:id", controller.getById);
  router.patch("/:id/status", controller.changeStatus);

  return router;
}

function createRestaurantOrderRoutes({ controller, authenticate }) {
  const router = express.Router({ mergeParams: true });
  router.get("/", authenticate, controller.listForRestaurant);
  return router;
}

module.exports = { createOrderRoutes, createRestaurantOrderRoutes };
