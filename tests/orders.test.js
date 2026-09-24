const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildTestApp, createUser, createRestaurant, createMenuItem } = require("./helpers");

describe("Orders (pedidos)", () => {
  let api;
  let owner;
  let customer;
  let stranger;
  let restaurant;
  let pizza;
  let soda;

  beforeEach(async () => {
    ({ api } = buildTestApp());
    owner = await createUser(api, "Dono");
    customer = await createUser(api, "Cliente");
    stranger = await createUser(api, "Estranho");
    restaurant = await createRestaurant(api, owner, { deliveryFee: 6.9 });
    pizza = await createMenuItem(api, owner, restaurant.id, { name: "Pizza", price: 54.9 });
    soda = await createMenuItem(api, owner, restaurant.id, { name: "Refri", price: 6.5 });
  });

  function placeOrder(user, items, extra = {}) {
    return api
      .post("/orders")
      .set(user.auth)
      .send({ restaurantId: restaurant.id, deliveryAddress: "Rua das Flores, 123", items, ...extra });
  }

  it("calcula o total com os preços do banco, ignorando preço enviado pelo cliente", async () => {
    const res = await placeOrder(customer, [
      { menuItemId: pizza.id, quantity: 2, unitPrice: 0.01 },
      { menuItemId: soda.id, quantity: 3 }
    ]).expect(201);

    assert.equal(res.body.status, "PENDENTE");
    assert.equal(res.body.subtotal, 129.3); // 2 x 54.90 + 3 x 6.50
    assert.equal(res.body.deliveryFee, 6.9);
    assert.equal(res.body.total, 136.2);
    assert.equal(res.body.restaurantName, restaurant.name);
    assert.equal(res.body.items.length, 2);
  });

  it("junta itens repetidos em uma única linha", async () => {
    const res = await placeOrder(customer, [
      { menuItemId: pizza.id, quantity: 1 },
      { menuItemId: pizza.id, quantity: 2 }
    ]).expect(201);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].quantity, 3);
  });

  it("exige autenticação, itens e endereço", async () => {
    await api.post("/orders").send({}).expect(401);
    const res = await api.post("/orders").set(customer.auth).send({ restaurantId: restaurant.id }).expect(400);
    assert.ok(res.body.details.some((d) => d.includes("deliveryAddress")));
    await placeOrder(customer, []).expect(400);
    await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 0 }]).expect(400);
  });

  it("recusa item de outro restaurante e item indisponível", async () => {
    const other = await createRestaurant(api, owner, { name: "Outro" });
    const foreign = await createMenuItem(api, owner, other.id);
    await placeOrder(customer, [{ menuItemId: foreign.id, quantity: 1 }]).expect(400);

    await api
      .patch(`/restaurants/${restaurant.id}/menu/${soda.id}`)
      .set(owner.auth)
      .send({ available: false });
    await placeOrder(customer, [{ menuItemId: soda.id, quantity: 1 }]).expect(409);
  });

  it("devolve 404 para restaurante inexistente", async () => {
    await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }], { restaurantId: 999 }).expect(404);
  });

  it("cliente vê os próprios pedidos e o dono vê os recebidos", async () => {
    await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }]).expect(201);

    const mine = await api.get("/orders").set(customer.auth).expect(200);
    assert.equal(mine.body.length, 1);

    const received = await api.get(`/restaurants/${restaurant.id}/orders`).set(owner.auth).expect(200);
    assert.equal(received.body.length, 1);

    await api.get(`/restaurants/${restaurant.id}/orders`).set(customer.auth).expect(403);
    const none = await api.get("/orders").set(stranger.auth).expect(200);
    assert.equal(none.body.length, 0);
  });

  it("somente cliente e dono acessam o detalhe do pedido", async () => {
    const { body: order } = await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }]);

    const asCustomer = await api.get(`/orders/${order.id}`).set(customer.auth).expect(200);
    assert.deepEqual(asCustomer.body.nextStatuses, ["CANCELADO"]);

    const asOwner = await api.get(`/orders/${order.id}`).set(owner.auth).expect(200);
    assert.deepEqual(asOwner.body.nextStatuses, ["CONFIRMADO", "CANCELADO"]);

    await api.get(`/orders/${order.id}`).set(stranger.auth).expect(403);
    await api.get("/orders/999").set(customer.auth).expect(404);
  });

  it("percorre o ciclo de vida completo do pedido", async () => {
    const { body: order } = await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }]);

    for (const status of ["CONFIRMADO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE"]) {
      const res = await api
        .patch(`/orders/${order.id}/status`)
        .set(owner.auth)
        .send({ status })
        .expect(200);
      assert.equal(res.body.status, status);
    }

    // Pedido entregue não muda mais
    await api.patch(`/orders/${order.id}/status`).set(owner.auth).send({ status: "CANCELADO" }).expect(409);
  });

  it("cliente só pode cancelar enquanto o pedido está pendente", async () => {
    const { body: first } = await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }]);
    await api.patch(`/orders/${first.id}/status`).set(customer.auth).send({ status: "CONFIRMADO" }).expect(409);
    const cancelled = await api
      .patch(`/orders/${first.id}/status`)
      .set(customer.auth)
      .send({ status: "CANCELADO" })
      .expect(200);
    assert.equal(cancelled.body.status, "CANCELADO");

    const { body: second } = await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }]);
    await api.patch(`/orders/${second.id}/status`).set(owner.auth).send({ status: "CONFIRMADO" }).expect(200);
    await api.patch(`/orders/${second.id}/status`).set(customer.auth).send({ status: "CANCELADO" }).expect(409);
  });

  it("filtra pedidos recebidos por status e valida status desconhecido", async () => {
    const { body: order } = await placeOrder(customer, [{ menuItemId: pizza.id, quantity: 1 }]);
    await placeOrder(customer, [{ menuItemId: soda.id, quantity: 1 }]);
    await api.patch(`/orders/${order.id}/status`).set(owner.auth).send({ status: "CONFIRMADO" });

    const confirmed = await api
      .get(`/restaurants/${restaurant.id}/orders?status=CONFIRMADO`)
      .set(owner.auth)
      .expect(200);
    assert.equal(confirmed.body.length, 1);

    await api.patch(`/orders/${order.id}/status`).set(owner.auth).send({ status: "VOANDO" }).expect(400);
  });
});
