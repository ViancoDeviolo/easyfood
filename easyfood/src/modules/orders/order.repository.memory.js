// Repository de pedidos — implementação em memória.
// Recebe o repository de restaurantes para preencher restaurantName (o JOIN da versão Oracle).

function createMemoryOrderRepository({ restaurants }) {
  const orders = [];
  let nextId = 1;
  let nextItemId = 1;

  async function withRestaurantName(order) {
    const restaurant = await restaurants.findById(order.restaurantId);
    return {
      ...order,
      restaurantName: restaurant ? restaurant.name : null,
      items: order.items.map((item) => ({ ...item }))
    };
  }

  async function list(predicate) {
    const found = orders
      .filter(predicate)
      .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);
    return Promise.all(found.map(withRestaurantName));
  }

  async function findById(id) {
    const order = orders.find((item) => item.id === id);
    return order ? withRestaurantName(order) : null;
  }

  async function findByCustomer(customerId) {
    return list((order) => order.customerId === customerId);
  }

  async function findByRestaurant(restaurantId, { status } = {}) {
    return list(
      (order) => order.restaurantId === restaurantId && (!status || order.status === status)
    );
  }

  async function create(data) {
    const now = new Date();
    const order = {
      id: nextId++,
      customerId: data.customerId,
      restaurantId: data.restaurantId,
      status: data.status,
      deliveryAddress: data.deliveryAddress,
      notes: data.notes ?? null,
      subtotal: data.subtotal,
      deliveryFee: data.deliveryFee,
      total: data.total,
      items: data.items.map((item) => ({
        id: nextItemId++,
        menuItemId: item.menuItemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })),
      createdAt: now,
      updatedAt: now
    };
    orders.push(order);
    return withRestaurantName(order);
  }

  async function updateStatus(id, fromStatus, toStatus) {
    const order = orders.find((item) => item.id === id && item.status === fromStatus);
    if (!order) return false;
    order.status = toStatus;
    order.updatedAt = new Date();
    return true;
  }

  async function existsForRestaurant(restaurantId) {
    return orders.some((order) => order.restaurantId === restaurantId);
  }

  async function existsForMenuItem(menuItemId) {
    return orders.some((order) => order.items.some((item) => item.menuItemId === menuItemId));
  }

  return {
    findById,
    findByCustomer,
    findByRestaurant,
    create,
    updateStatus,
    existsForRestaurant,
    existsForMenuItem
  };
}

module.exports = { createMemoryOrderRepository };
