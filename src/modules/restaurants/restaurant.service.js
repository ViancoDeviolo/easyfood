// Regras de negócio de restaurantes.
// Apenas o dono (owner) pode alterar ou remover o próprio restaurante.

const { NotFoundError, ForbiddenError, ConflictError } = require("../../shared/errors/app-error");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function createRestaurantService({ restaurants, orders }) {
  async function list({ search, category, page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
    const safePage = Math.max(page, 1);
    const { items, total } = await restaurants.findAll({
      search,
      category,
      offset: (safePage - 1) * safeLimit,
      limit: safeLimit
    });
    return { items, total, page: safePage, limit: safeLimit };
  }

  async function listCategories() {
    return restaurants.findCategories();
  }

  async function listByOwner(ownerId) {
    const { items } = await restaurants.findAll({ ownerId, limit: MAX_PAGE_SIZE });
    return items;
  }

  async function getById(id) {
    const restaurant = await restaurants.findById(id);
    if (!restaurant) throw new NotFoundError("Restaurante não encontrado");
    return restaurant;
  }

  /** Garante que o restaurante existe e pertence ao usuário. Reutilizado por menu e pedidos. */
  async function getOwnedRestaurant(id, userId) {
    const restaurant = await getById(id);
    if (restaurant.ownerId !== userId) {
      throw new ForbiddenError("Apenas o dono do restaurante pode realizar esta ação");
    }
    return restaurant;
  }

  async function create(ownerId, data) {
    return restaurants.create({ ...data, ownerId });
  }

  async function update(id, userId, data) {
    await getOwnedRestaurant(id, userId);
    return restaurants.update(id, data);
  }

  async function remove(id, userId) {
    await getOwnedRestaurant(id, userId);
    if (await orders.existsForRestaurant(id)) {
      throw new ConflictError("Restaurante possui pedidos e não pode ser removido");
    }
    await restaurants.remove(id);
  }

  return { list, listCategories, listByOwner, getById, getOwnedRestaurant, create, update, remove };
}

module.exports = { createRestaurantService };
