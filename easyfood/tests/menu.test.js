const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildTestApp, createUser, createRestaurant, createMenuItem } = require("./helpers");

describe("Menu (cardápio)", () => {
  let api;
  let owner;
  let other;
  let restaurant;

  beforeEach(async () => {
    ({ api } = buildTestApp());
    owner = await createUser(api, "Dono");
    other = await createUser(api, "Outro");
    restaurant = await createRestaurant(api, owner);
  });

  it("dono adiciona itens e qualquer pessoa consulta o cardápio", async () => {
    const created = await api
      .post(`/restaurants/${restaurant.id}/menu`)
      .set(owner.auth)
      .send({ name: "Pizza Grande", price: 59.9, description: "8 fatias" })
      .expect(201);
    assert.equal(created.body.available, true);
    assert.equal(created.body.restaurantId, restaurant.id);

    const res = await api.get(`/restaurants/${restaurant.id}/menu`).expect(200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].price, 59.9);
  });

  it("não deixa outro usuário mexer no cardápio", async () => {
    await api
      .post(`/restaurants/${restaurant.id}/menu`)
      .set(other.auth)
      .send({ name: "Invasor", price: 1 })
      .expect(403);
  });

  it("recusa nome repetido no mesmo restaurante", async () => {
    await createMenuItem(api, owner, restaurant.id, { name: "Coxinha" });
    await api
      .post(`/restaurants/${restaurant.id}/menu`)
      .set(owner.auth)
      .send({ name: "Coxinha", price: 5 })
      .expect(409);
  });

  it("valida preço positivo", async () => {
    await api
      .post(`/restaurants/${restaurant.id}/menu`)
      .set(owner.auth)
      .send({ name: "Grátis", price: 0 })
      .expect(400);
  });

  it("atualiza disponibilidade e remove item nunca pedido", async () => {
    const item = await createMenuItem(api, owner, restaurant.id);

    const updated = await api
      .patch(`/restaurants/${restaurant.id}/menu/${item.id}`)
      .set(owner.auth)
      .send({ available: false })
      .expect(200);
    assert.equal(updated.body.available, false);

    await api.delete(`/restaurants/${restaurant.id}/menu/${item.id}`).set(owner.auth).expect(204);
    await api.delete(`/restaurants/${restaurant.id}/menu/${item.id}`).set(owner.auth).expect(404);
  });

  it("não remove item que já foi pedido", async () => {
    const item = await createMenuItem(api, owner, restaurant.id);
    await api
      .post("/orders")
      .set(other.auth)
      .send({ restaurantId: restaurant.id, deliveryAddress: "Rua B, 20", items: [{ menuItemId: item.id, quantity: 1 }] })
      .expect(201);

    await api.delete(`/restaurants/${restaurant.id}/menu/${item.id}`).set(owner.auth).expect(409);
  });

  it("devolve 404 para item de outro restaurante", async () => {
    const otherRestaurant = await createRestaurant(api, owner, { name: "Outro" });
    const item = await createMenuItem(api, owner, otherRestaurant.id);
    await api
      .patch(`/restaurants/${restaurant.id}/menu/${item.id}`)
      .set(owner.auth)
      .send({ price: 1 })
      .expect(404);
  });

  it("devolve 404 ao consultar cardápio de restaurante inexistente", async () => {
    await api.get("/restaurants/999/menu").expect(404);
  });
});
