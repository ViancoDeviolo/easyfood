// Regras de negócio do cardápio.
// Qualquer pessoa pode consultar; só o dono do restaurante pode alterar.

const { NotFoundError, ConflictError } = require("../../shared/errors/app-error");

function createMenuService({ menuItems, orders, restaurantService }) {
  async function list(restaurantId) {
    await restaurantService.getById(restaurantId); // 404 se o restaurante não existir
    return menuItems.findByRestaurant(restaurantId);
  }

  async function getItemOfRestaurant(restaurantId, itemId) {
    const item = await menuItems.findById(itemId);
    if (!item || item.restaurantId !== restaurantId) {
      throw new NotFoundError("Item do cardápio não encontrado");
    }
    return item;
  }

  async function create(restaurantId, userId, data) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    return menuItems.create({ ...data, restaurantId });
  }

  async function update(restaurantId, itemId, userId, data) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    await getItemOfRestaurant(restaurantId, itemId);
    return menuItems.update(itemId, data);
  }

  async function remove(restaurantId, itemId, userId) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    await getItemOfRestaurant(restaurantId, itemId);
    if (await orders.existsForMenuItem(itemId)) {
      throw new ConflictError("Item já foi pedido e não pode ser removido; marque-o como indisponível");
    }
    await menuItems.remove(itemId);
  }

  return { list, create, update, remove };
}

module.exports = { createMenuService };
