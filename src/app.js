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
const { createRestaurantImageService } = require("./modules/restaurants/restaurant-image.service");
const { createRestaurantImageController } = require("./modules/restaurants/restaurant-image.controller");
const { createRestaurantImageFiles } = require("./modules/restaurants/restaurant-image.files");

const { createLocalFunctionRuntime } = require("./shared/functions/local-function-runtime");
const optimizeImageFunction = require("../functions/optimize-image");

const { createMenuService } = require("./modules/menu/menu.service");
const { createMenuController } = require("./modules/menu/menu.controller");
const { createMenuRoutes, createDishRoutes } = require("./modules/menu/menu.routes");

const { createOrderService } = require("./modules/orders/order.service");
const { createOrderController } = require("./modules/orders/order.controller");
const { createOrderRoutes, createRestaurantOrderRoutes } = require("./modules/orders/order.routes");

const { notFoundHandler, errorHandler } = require("./shared/http/error-handler");
const { createImageService } = require("./shared/images/image.service");
const { createUploadMiddleware } = require("./shared/images/upload.middleware");
const { createImageRoutes } = require("./shared/images/image.routes");

const DEFAULT_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Cria os services. `storage` é opcional (o seed não precisa dele);
 * sem storage, o módulo de fotos fica desligado.
 */
function createServices({ repositories, jwt, storage, imageMaxBytes = DEFAULT_IMAGE_MAX_BYTES }) {
  const imageFiles = storage ? createRestaurantImageFiles({ storage }) : undefined;
  // Serviço de imagens COMPARTILHADO: o mesmo objeto atende perfil do usuário e pratos
  const imageService = storage ? createImageService({ storage, maxBytes: imageMaxBytes }) : undefined;

  const authService = createAuthService({
    users: repositories.users,
    jwtSecret: jwt.secret,
    jwtExpiresIn: jwt.expiresIn,
    imageService
  });

  // O cardápio é criado depois do restaurante; a função abaixo só é chamada na exclusão,
  // quando menuService já existe.
  let menuService;
  const restaurantService = createRestaurantService({
    restaurants: repositories.restaurants,
    orders: repositories.orders,
    imageFiles,
    dishImages: imageService && {
      list: (restaurantId) => menuService.listImageUrls(restaurantId),
      discard: (urls) => Promise.all(urls.map((url) => imageService.remove(url)))
    }
  });
  const restaurantImageService = storage
    ? createRestaurantImageService({
        restaurants: repositories.restaurants,
        restaurantService,
        storage,
        imageFiles,
        maxBytes: imageMaxBytes
      })
    : undefined;
  menuService = createMenuService({
    menuItems: repositories.menuItems,
    orders: repositories.orders,
    restaurantService,
    imageService
  });
  const orderService = createOrderService({
    orders: repositories.orders,
    menuItems: repositories.menuItems,
    restaurantService
  });

  return {
    authService,
    restaurantService,
    restaurantImageService,
    menuService,
    orderService,
    imageService
  };
}

function createApp({ repositories, jwt, storage, imageMaxBytes = DEFAULT_IMAGE_MAX_BYTES }) {
  if (!storage) throw new Error("createApp precisa de um storage para as fotos dos restaurantes");

  const services = createServices({ repositories, jwt, storage, imageMaxBytes });
  const authenticate = createAuthMiddleware(services.authService);

  // Trigger local da função serverless: novo arquivo em originals/ -> optimize-image
  const functionRuntime = createLocalFunctionRuntime({
    storage,
    prefix: "originals/",
    handler: optimizeImageFunction.handler,
    onSuccess: services.restaurantImageService.handleProcessed,
    onFailure: services.restaurantImageService.handleFailed
  });

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
  const menuController = createMenuController(services.menuService);
  // Um único middleware de upload (Multer) para perfil, prato e restaurante
  const uploadImage = createUploadMiddleware({ maxBytes: imageMaxBytes });

  app.use(
    "/auth",
    createAuthRoutes({
      controller: createAuthController(services.authService),
      authenticate,
      uploadImage
    })
  );
  // Imagens otimizadas de perfil e pratos: GET /images/users/<arquivo>.webp
  app.use("/images", createImageRoutes({ imageService: services.imageService }));

  // O cardápio responde pelos dois nomes: /menu (original) e /dishes (nome usado pela turma)
  const menuRoutes = createMenuRoutes({ controller: menuController, authenticate });
  app.use("/restaurants/:restaurantId/menu", menuRoutes);
  app.use("/restaurants/:restaurantId/dishes", menuRoutes);
  app.use("/dishes", createDishRoutes({ controller: menuController, authenticate, uploadImage }));
  app.use(
    "/restaurants/:restaurantId/orders",
    createRestaurantOrderRoutes({ controller: orderController, authenticate })
  );
  app.use(
    "/restaurants",
    createRestaurantRoutes({
      controller: createRestaurantController(services.restaurantService),
      imageController: createRestaurantImageController(services.restaurantImageService),
      uploadImage,
      authenticate
    })
  );
  app.use("/orders", createOrderRoutes({ controller: orderController, authenticate }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  // Services expostos para scripts (ex.: seed) reutilizarem as mesmas regras de negócio
  app.locals.services = services;
  app.locals.functionRuntime = functionRuntime;

  return app;
}

module.exports = { createApp, createServices };
