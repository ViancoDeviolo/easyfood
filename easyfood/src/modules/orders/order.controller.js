// Controller de pedidos.

const { validate, parseId } = require("../../shared/http/validation");
const { validatePlaceOrder, statusSchema, listQuerySchema } = require("./order.schemas");

function createOrderController(orderService) {
  async function place(req, res) {
    const data = validatePlaceOrder(req.body);
    const order = await orderService.place(req.user.id, data);
    res.status(201).location(`/orders/${order.id}`).json(order);
  }

  async function listMine(req, res) {
    res.json(await orderService.listMine(req.user.id));
  }

  async function getById(req, res) {
    res.json(await orderService.getById(parseId(req.params.id), req.user.id));
  }

  async function changeStatus(req, res) {
    const { status } = validate(req.body, statusSchema);
    res.json(await orderService.changeStatus(parseId(req.params.id), req.user.id, status));
  }

  async function listForRestaurant(req, res) {
    const query = validate(req.query, listQuerySchema);
    const restaurantId = parseId(req.params.restaurantId, "restaurantId");
    res.json(await orderService.listForRestaurant(restaurantId, req.user.id, query));
  }

  return { place, listMine, getById, changeStatus, listForRestaurant };
}

module.exports = { createOrderController };
