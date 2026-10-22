// Repository de itens do cardápio — implementação em memória.

const { ConflictError } = require("../../shared/errors/app-error");

function createMemoryMenuItemRepository() {
  const items = [];
  let nextId = 1;

  function ensureUniqueName(restaurantId, name, ignoreId) {
    const duplicated = items.some(
      (item) => item.restaurantId === restaurantId && item.name === name && item.id !== ignoreId
    );
    if (duplicated) throw new ConflictError("Já existe um item com esse nome no cardápio");
  }

  async function findByRestaurant(restaurantId) {
    return items
      .filter((item) => item.restaurantId === restaurantId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ ...item }));
  }

  async function findById(id) {
    const item = items.find((menuItem) => menuItem.id === id);
    return item ? { ...item } : null;
  }

  async function findByIds(ids) {
    return items.filter((item) => ids.includes(item.id)).map((item) => ({ ...item }));
  }

  async function create(data) {
    ensureUniqueName(data.restaurantId, data.name);
    const now = new Date();
    const item = {
      id: nextId++,
      restaurantId: data.restaurantId,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      available: data.available,
      createdAt: now,
      updatedAt: now
    };
    items.push(item);
    return { ...item };
  }

  async function update(id, fields) {
    const item = items.find((menuItem) => menuItem.id === id);
    if (!item) return null;
    if (fields.name !== undefined) ensureUniqueName(item.restaurantId, fields.name, id);
    for (const field of ["name", "description", "price", "available"]) {
      if (fields[field] !== undefined) item[field] = fields[field];
    }
    item.updatedAt = new Date();
    return { ...item };
  }

  async function remove(id) {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    return true;
  }

  /** Simula o ON DELETE CASCADE do Oracle. */
  async function removeByRestaurant(restaurantId) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].restaurantId === restaurantId) items.splice(i, 1);
    }
  }

  return { findByRestaurant, findById, findByIds, create, update, remove, removeByRestaurant };
}

module.exports = { createMemoryMenuItemRepository };
