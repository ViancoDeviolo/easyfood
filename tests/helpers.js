// Utilitários de teste: sobe a aplicação com os repositories em memória.
const request = require("supertest");
const { createApp } = require("../src/app");
const { createRepositories } = require("../src/database/repositories");

const JWT = { secret: "segredo-de-teste-com-mais-de-16-caracteres", expiresIn: "1h" };

function buildTestApp() {
  const repositories = createRepositories("memory");
  const app = createApp({ repositories, jwt: JWT });
  return { app, repositories, api: request(app) };
}

let counter = 0;

/** Cadastra e loga um usuário novo; devolve { token, user, auth } */
async function createUser(api, name = "Usuário") {
  counter += 1;
  const credentials = { name, email: `user${counter}@teste.com`, password: "senha123" };
  await api.post("/auth/register").send(credentials).expect(201);
  const { body } = await api
    .post("/auth/login")
    .send({ email: credentials.email, password: credentials.password })
    .expect(200);
  return { token: body.token, user: body.user, auth: { Authorization: `Bearer ${body.token}` } };
}

async function createRestaurant(api, owner, overrides = {}) {
  const { body } = await api
    .post("/restaurants")
    .set(owner.auth)
    .send({ name: "Restaurante Teste", category: "Pizza", deliveryFee: 5, ...overrides })
    .expect(201);
  return body;
}

async function createMenuItem(api, owner, restaurantId, overrides = {}) {
  const { body } = await api
    .post(`/restaurants/${restaurantId}/menu`)
    .set(owner.auth)
    .send({ name: `Item ${Math.random().toString(36).slice(2, 8)}`, price: 10, ...overrides })
    .expect(201);
  return body;
}

module.exports = { buildTestApp, createUser, createRestaurant, createMenuItem, JWT };
