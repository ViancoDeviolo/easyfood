// Repository de restaurantes — implementação em memória.

function createMemoryRestaurantRepository() {
  const restaurants = [];
  let nextId = 1;

  function matches(restaurant, { search, category, ownerId }) {
    if (search && !restaurant.name.toUpperCase().includes(search.toUpperCase())) return false;
    if (category && restaurant.category.toUpperCase() !== category.toUpperCase()) return false;
    if (ownerId && restaurant.ownerId !== ownerId) return false;
    return true;
  }

  async function findAll({ search, category, ownerId, offset = 0, limit = 50 } = {}) {
    const filtered = restaurants
      .filter((restaurant) => matches(restaurant, { search, category, ownerId }))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
    return { items: filtered.slice(offset, offset + limit).map(clone), total: filtered.length };
  }

  async function findCategories() {
    return [...new Set(restaurants.map((restaurant) => restaurant.category))].sort();
  }

  async function findById(id) {
    const restaurant = restaurants.find((item) => item.id === id);
    return restaurant ? clone(restaurant) : null;
  }

  async function create(data) {
    const now = new Date();
    const restaurant = {
      id: nextId++,
      ownerId: data.ownerId,
      name: data.name,
      category: data.category,
      description: data.description ?? null,
      rating: data.rating,
      deliveryFee: data.deliveryFee,
      createdAt: now,
      updatedAt: now
    };
    restaurants.push(restaurant);
    return clone(restaurant);
  }

  async function update(id, fields) {
    const restaurant = restaurants.find((item) => item.id === id);
    if (!restaurant) return null;
    const allowed = ["name", "category", "description", "rating", "deliveryFee"];
    for (const field of allowed) {
      if (fields[field] !== undefined) restaurant[field] = fields[field];
    }
    restaurant.updatedAt = new Date();
    return clone(restaurant);
  }

  async function remove(id) {
    const index = restaurants.findIndex((item) => item.id === id);
    if (index === -1) return false;
    restaurants.splice(index, 1);
    return true;
  }

  return { findAll, findCategories, findById, create, update, remove };
}

function clone(restaurant) {
  return { ...restaurant };
}

module.exports = { createMemoryRestaurantRepository };
