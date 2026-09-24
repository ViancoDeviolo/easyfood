const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildTestApp, createUser, createRestaurant, createMenuItem } = require("./helpers");

describe("Restaurants", () => {
  let api;
  let owner;
  let other;

  beforeEach(async () => {
    ({ api } = buildTestApp());
    owner = await createUser(api, "Dono");
    other = await createUser(api, "Outro");
  });

  it("GET /restaurants é público e devolve uma lista", async () => {
    const res = await api.get("/restaurants").expect(200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.headers["x-total-count"], "0");
  });

  it("POST /restaurants exige autenticação", async () => {
    await api.post("/restaurants").send({ name: "Sem token", category: "Pizza" }).expect(401);
  });

  it("cadastra restaurante com o usuário logado como dono", async () => {
    const res = await api
      .post("/restaurants")
      .set(owner.auth)
      .send({ name: "Cantina", category: "Italiana", rating: 4.55, deliveryFee: 7.999 })
      .expect(201);

    assert.equal(res.body.ownerId, owner.user.id);
    assert.equal(res.body.rating, 4.6); // arredondado para NUMBER(2,1)
    assert.equal(res.body.deliveryFee, 8); // arredondado para NUMBER(8,2)
    assert.equal(res.headers.location, `/restaurants/${res.body.id}`);
  });

  it("valida nome, categoria e faixa da avaliação", async () => {
    const res = await api
      .post("/restaurants")
      .set(owner.auth)
      .send({ name: "A", rating: 7 })
      .expect(400);
    assert.equal(res.body.details.length, 3);
  });

  it("filtra por busca e categoria e pagina o resultado", async () => {
    await createRestaurant(api, owner, { name: "Pizza do Zé", category: "Pizza", rating: 4 });
    await createRestaurant(api, owner, { name: "Pizza Nobre", category: "Pizza", rating: 5 });
    await createRestaurant(api, owner, { name: "Sushi Bar", category: "Japonesa" });

    const byCategory = await api.get("/restaurants?category=pizza").expect(200);
    assert.deepEqual(byCategory.body.map((r) => r.name), ["Pizza Nobre", "Pizza do Zé"]);

    const bySearch = await api.get("/restaurants?search=sushi").expect(200);
    assert.equal(bySearch.body.length, 1);

    const page2 = await api.get("/restaurants?limit=2&page=2").expect(200);
    assert.equal(page2.body.length, 1);
    assert.equal(page2.headers["x-total-count"], "3");

    const categories = await api.get("/restaurants/categories").expect(200);
    assert.deepEqual(categories.body, ["Japonesa", "Pizza"]);
  });

  it("GET /restaurants/:id devolve 404 para inexistente e 400 para id inválido", async () => {
    await api.get("/restaurants/999").expect(404);
    await api.get("/restaurants/abc").expect(400);
  });

  it("somente o dono altera ou remove o restaurante", async () => {
    const restaurant = await createRestaurant(api, owner);

    await api.patch(`/restaurants/${restaurant.id}`).set(other.auth).send({ name: "Hack" }).expect(403);
    await api.delete(`/restaurants/${restaurant.id}`).set(other.auth).expect(403);

    const updated = await api
      .patch(`/restaurants/${restaurant.id}`)
      .set(owner.auth)
      .send({ name: "Novo Nome" })
      .expect(200);
    assert.equal(updated.body.name, "Novo Nome");
    assert.equal(updated.body.category, restaurant.category);

    await api.delete(`/restaurants/${restaurant.id}`).set(owner.auth).expect(204);
    await api.get(`/restaurants/${restaurant.id}`).expect(404);
  });

  it("GET /restaurants/mine lista apenas os restaurantes do usuário", async () => {
    await createRestaurant(api, owner, { name: "Meu" });
    await createRestaurant(api, other, { name: "Do outro" });
    const res = await api.get("/restaurants/mine").set(owner.auth).expect(200);
    assert.deepEqual(res.body.map((r) => r.name), ["Meu"]);
  });

  it("não remove restaurante que já recebeu pedidos", async () => {
    const restaurant = await createRestaurant(api, owner);
    const item = await createMenuItem(api, owner, restaurant.id);
    await api
      .post("/orders")
      .set(other.auth)
      .send({
        restaurantId: restaurant.id,
        deliveryAddress: "Rua A, 10",
        items: [{ menuItemId: item.id, quantity: 1 }]
      })
      .expect(201);

    await api.delete(`/restaurants/${restaurant.id}`).set(owner.auth).expect(409);
  });

  it("remover restaurante sem pedidos remove também o cardápio", async () => {
    const { api: localApi, repositories } = buildTestApp();
    const localOwner = await createUser(localApi, "Dono");
    const restaurant = await createRestaurant(localApi, localOwner);
    await createMenuItem(localApi, localOwner, restaurant.id);

    await localApi.delete(`/restaurants/${restaurant.id}`).set(localOwner.auth).expect(204);
    assert.deepEqual(await repositories.menuItems.findByRestaurant(restaurant.id), []);
  });
});
