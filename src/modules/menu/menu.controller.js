// Controller do cardápio.

const { validate, parseId } = require("../../shared/http/validation");
const { menuItemSchema } = require("./menu.schemas");

function createMenuController(menuService) {
  async function list(req, res) {
    res.json(await menuService.list(parseId(req.params.restaurantId, "restaurantId")));
  }

  async function create(req, res) {
    const restaurantId = parseId(req.params.restaurantId, "restaurantId");
    const data = validate(req.body, menuItemSchema);
    const item = await menuService.create(restaurantId, req.user.id, data);
    res.status(201).location(`/restaurants/${restaurantId}/menu/${item.id}`).json(item);
  }

  async function update(req, res) {
    const data = validate(req.body, menuItemSchema, { partial: true });
    const item = await menuService.update(
      parseId(req.params.restaurantId, "restaurantId"),
      parseId(req.params.itemId, "itemId"),
      req.user.id,
      data
    );
    res.json(item);
  }

  async function remove(req, res) {
    await menuService.remove(
      parseId(req.params.restaurantId, "restaurantId"),
      parseId(req.params.itemId, "itemId"),
      req.user.id
    );
    res.status(204).end();
  }

  async function show(req, res) {
    res.json(await menuService.getById(parseId(req.params.dishId, "dishId")));
  }

  async function uploadImage(req, res) {
    const dish = await menuService.updateImage(parseId(req.params.dishId, "dishId"), req.user.id, req.file.buffer);
    res.json(dish);
  }

  async function removeImage(req, res) {
    await menuService.removeImage(parseId(req.params.dishId, "dishId"), req.user.id);
    res.status(204).end();
  }

  return { list, create, update, remove, show, uploadImage, removeImage };
}

module.exports = { createMenuController };
