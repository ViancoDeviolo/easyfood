// Regras de negócio de pedidos.
// O preço de cada item SEMPRE vem do banco, nunca do cliente.

const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError
} = require("../../shared/errors/app-error");
const { ORDER_STATUS, canTransition, allowedTransitions } = require("./order-status");

// Dinheiro é calculado em centavos (inteiros) para evitar erros de ponto flutuante
const toCents = (value) => Math.round(value * 100);
const fromCents = (cents) => cents / 100;

function mergeDuplicatedItems(items) {
  const quantities = new Map();
  for (const { menuItemId, quantity } of items) {
    quantities.set(menuItemId, (quantities.get(menuItemId) || 0) + quantity);
  }
  return [...quantities.entries()].map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
}

function createOrderService({ orders, menuItems, restaurantService }) {
  async function place(customerId, { restaurantId, deliveryAddress, notes, items }) {
    const restaurant = await restaurantService.getById(restaurantId);
    const requested = mergeDuplicatedItems(items);

    const tooMany = requested.find((item) => item.quantity > 99);
    if (tooMany) throw new ValidationError("Quantidade máxima por item é 99");

    const found = await menuItems.findByIds(requested.map((item) => item.menuItemId));
    const byId = new Map(found.map((item) => [item.id, item]));

    const orderItems = requested.map(({ menuItemId, quantity }) => {
      const menuItem = byId.get(menuItemId);
      if (!menuItem || menuItem.restaurantId !== restaurant.id) {
        throw new ValidationError(`Item ${menuItemId} não pertence ao cardápio deste restaurante`);
      }
      if (!menuItem.available) {
        throw new ConflictError(`O item "${menuItem.name}" está indisponível no momento`);
      }
      return { menuItemId, name: menuItem.name, quantity, unitPrice: menuItem.price };
    });

    const subtotalCents = orderItems.reduce(
      (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
      0
    );
    const deliveryFeeCents = toCents(restaurant.deliveryFee);

    return orders.create({
      customerId,
      restaurantId: restaurant.id,
      status: ORDER_STATUS.PENDENTE,
      deliveryAddress,
      notes,
      subtotal: fromCents(subtotalCents),
      deliveryFee: fromCents(deliveryFeeCents),
      total: fromCents(subtotalCents + deliveryFeeCents),
      items: orderItems
    });
  }

  async function listMine(customerId) {
    return orders.findByCustomer(customerId);
  }

  async function listForRestaurant(restaurantId, userId, { status } = {}) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    return orders.findByRestaurant(restaurantId, { status });
  }

  /** Papéis do usuário em relação ao pedido: cliente, dono do restaurante ou ambos. */
  async function rolesFor(order, userId) {
    const roles = [];
    if (order.customerId === userId) roles.push("customer");
    const restaurant = await restaurantService.getById(order.restaurantId);
    if (restaurant.ownerId === userId) roles.push("restaurant");
    return roles;
  }

  async function getAccessibleOrder(orderId, userId) {
    const order = await orders.findById(orderId);
    if (!order) throw new NotFoundError("Pedido não encontrado");

    const roles = await rolesFor(order, userId);
    if (roles.length === 0) throw new ForbiddenError("Você não tem acesso a este pedido");

    return { order, roles };
  }

  async function getById(orderId, userId) {
    const { order, roles } = await getAccessibleOrder(orderId, userId);
    return { ...order, nextStatuses: allowedTransitions(order.status, roles) };
  }

  async function changeStatus(orderId, userId, newStatus) {
    const { order, roles } = await getAccessibleOrder(orderId, userId);

    if (!canTransition(order.status, newStatus, roles)) {
      throw new ConflictError(`Não é possível mudar o pedido de ${order.status} para ${newStatus}`);
    }

    const updated = await orders.updateStatus(orderId, order.status, newStatus);
    if (!updated) {
      throw new ConflictError("O pedido foi alterado por outra operação. Atualize e tente novamente.");
    }

    return getById(orderId, userId);
  }

  return { place, listMine, listForRestaurant, getById, changeStatus };
}

module.exports = { createOrderService };
