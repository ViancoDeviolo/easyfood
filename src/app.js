// Monta a aplicação Express.
// É aqui que as peças são conectadas (composition root):
//   repositories -> services -> controllers -> routes
// Trocar Oracle por memória (ou por outro banco) não exige mudar services nem controllers.

const path = require("node:path");
const express = require("express");
const cors = require("cors");

const { createAuthService } = require("./modules/auth/auth.service");
const { createAuthController } = require("./modules/auth/auth.controller");
const { createAuthMiddleware } = require("./modules/auth/auth.middleware");
const { createAuthRoutes } = require("./modules/auth/auth.routes");

const { createRestaurantService } = require("./modules/restaurants/restaurant.service");
const { createRestaurantController } = require("./modules/restaurants/restaurant.controller");
const { createRestaurantRoutes } = require("./modules/restaurants/restaurant.routes");

const { createMenuService } = require("./modules/menu/menu.service");
const { createMenuController } = require("./modules/menu/menu.controller");
const { createMenuRoutes } = require("./modules/menu/menu.routes");

const { createOrderService } = require("./modules/orders/order.service");
const { createOrderController } = require("./modules/orders/order.controller");
const { createOrderRoutes, createRestaurantOrderRoutes } = require("./modules/orders/order.routes");

const { notFoundHandler, errorHandler } = require("./shared/http/error-handler");

function createServices({ repositories, jwt }) {
  const authService = createAuthService({
    users: repositories.users,
    jwtSecret: jwt.secret,
    jwtExpiresIn: jwt.expiresIn
  });
  const restaurantService = createRestaurantService({
    restaurants: repositories.restaurants,
    orders: repositories.orders
  });
  const menuService = createMenuService({
    menuItems: repositories.menuItems,
    orders: repositories.orders,
    restaurantService
  });
  const orderService = createOrderService({
    orders: repositories.orders,
    menuItems: repositories.menuItems,
    restaurantService
  });

  return { authService, restaurantService, menuService, orderService };
}

function createApp({ repositories, jwt }) {
  const services = createServices({ repositories, jwt });
  const authenticate = createAuthMiddleware(services.authService);

  const app = express();

  app.use(cors({ exposedHeaders: ["X-Total-Count", "X-Page", "X-Page-Size", "Location"] }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/health", async (req, res) => {
    try {
      await repositories.ping();
      res.json({ status: "ok", database: repositories.client });
    } catch {
      res.status(503).json({ status: "degraded", database: repositories.client });
    }
  });

  const orderController = createOrderController(services.orderService);

  app.use(
    "/auth",
    createAuthRoutes({ controller: createAuthController(services.authService), authenticate })
  );
  app.use(
    "/restaurants/:restaurantId/menu",
    createMenuRoutes({ controller: createMenuController(services.menuService), authenticate })
  );
  app.use(
    "/restaurants/:restaurantId/orders",
    createRestaurantOrderRoutes({ controller: orderController, authenticate })
  );
  app.use(
    "/restaurants",
    createRestaurantRoutes({
      controller: createRestaurantController(services.restaurantService),
      authenticate
    })
  );
  app.use("/orders", createOrderRoutes({ controller: orderController, authenticate }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  // Services expostos para scripts (ex.: seed) reutilizarem as mesmas regras de negócio
  app.locals.services = services;

  return app;
}

module.exports = { createApp, createServices };
