// Controller de restaurantes: recebe req, valida, chama o service e devolve res.

const { validate, parseId } = require("../../shared/http/validation");
const { restaurantSchema, listQuerySchema } = require("./restaurant.schemas");

function createRestaurantController(restaurantService) {
  async function list(req, res) {
    const query = validate(req.query, listQuerySchema);
    const result = await restaurantService.list(query);

    // O corpo continua sendo uma lista (compatível com a primeira versão da API);
    // os dados de paginação vão nos headers.
    res.set("X-Total-Count", String(result.total));
    res.set("X-Page", String(result.page));
    res.set("X-Page-Size", String(result.limit));
    res.json(result.items);
  }

  async function categories(req, res) {
    res.json(await restaurantService.listCategories());
  }

  async function mine(req, res) {
    res.json(await restaurantService.listByOwner(req.user.id));
  }

  async function getById(req, res) {
    res.json(await restaurantService.getById(parseId(req.params.id)));
  }

  async function create(req, res) {
    const data = validate(req.body, restaurantSchema);
    const restaurant = await restaurantService.create(req.user.id, data);
    res.status(201).location(`/restaurants/${restaurant.id}`).json(restaurant);
  }

  async function update(req, res) {
    const data = validate(req.body, restaurantSchema, { partial: true });
    res.json(await restaurantService.update(parseId(req.params.id), req.user.id, data));
  }

  async function remove(req, res) {
    await restaurantService.remove(parseId(req.params.id), req.user.id);
    res.status(204).end();
  }

  return { list, categories, mine, getById, create, update, remove };
}

module.exports = { createRestaurantController };
