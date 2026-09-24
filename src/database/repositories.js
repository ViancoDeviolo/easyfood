// Factory de repositories.
// Decide, a partir da configuração, qual implementação de persistência a aplicação usa.
// Services recebem os repositories prontos e não sabem se estão falando com Oracle ou memória.

const oracle = require("./oracle");
const { createOracleUserRepository } = require("../modules/auth/user.repository.oracle");
const { createOracleRestaurantRepository } = require("../modules/restaurants/restaurant.repository.oracle");
const { createOracleMenuItemRepository } = require("../modules/menu/menu-item.repository.oracle");
const { createOracleOrderRepository } = require("../modules/orders/order.repository.oracle");
const { createMemoryUserRepository } = require("../modules/auth/user.repository.memory");
const { createMemoryRestaurantRepository } = require("../modules/restaurants/restaurant.repository.memory");
const { createMemoryMenuItemRepository } = require("../modules/menu/menu-item.repository.memory");
const { createMemoryOrderRepository } = require("../modules/orders/order.repository.memory");

function createOracleRepositories() {
  return {
    client: "oracle",
    users: createOracleUserRepository(),
    restaurants: createOracleRestaurantRepository(),
    menuItems: createOracleMenuItemRepository(),
    orders: createOracleOrderRepository(),
    connect: oracle.initPool,
    ping: oracle.ping,
    close: oracle.closePool
  };
}

function createMemoryRepositories() {
  const users = createMemoryUserRepository();
  const restaurants = createMemoryRestaurantRepository();
  const menuItems = createMemoryMenuItemRepository();
  const orders = createMemoryOrderRepository({ restaurants });

  // Reproduz o ON DELETE CASCADE de MENU_ITEMS definido na migration 003
  const removeRestaurant = restaurants.remove;
  restaurants.remove = async (id) => {
    const removed = await removeRestaurant(id);
    if (removed) await menuItems.removeByRestaurant(id);
    return removed;
  };

  return {
    client: "memory",
    users,
    restaurants,
    menuItems,
    orders,
    connect: async () => {},
    ping: async () => {},
    close: async () => {}
  };
}

function createRepositories(client) {
  if (client === "memory") return createMemoryRepositories();
  return createOracleRepositories();
}

module.exports = { createRepositories };
