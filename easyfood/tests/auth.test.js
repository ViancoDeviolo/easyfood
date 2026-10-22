const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildTestApp, createUser } = require("./helpers");

describe("Auth", () => {
  let api;
  let repositories;

  beforeEach(() => {
    ({ api, repositories } = buildTestApp());
  });

  it("cadastra usuário sem devolver a senha e guarda apenas o hash", async () => {
    const res = await api
      .post("/auth/register")
      .send({ name: "Aluno", email: "Aluno@EasyFood.com", password: "123456" })
      .expect(201);

    assert.equal(res.body.email, "aluno@easyfood.com");
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.passwordHash, undefined);

    const stored = await repositories.users.findByEmail("aluno@easyfood.com");
    assert.notEqual(stored.passwordHash, "123456");
    assert.match(stored.passwordHash, /^\$2[aby]\$/);
  });

  it("recusa e-mail duplicado com 409", async () => {
    const user = { name: "Aluno", email: "dup@easyfood.com", password: "123456" };
    await api.post("/auth/register").send(user).expect(201);
    const res = await api.post("/auth/register").send(user).expect(409);
    assert.equal(res.body.error, "E-mail já cadastrado");
  });

  it("valida os campos do cadastro", async () => {
    const res = await api
      .post("/auth/register")
      .send({ name: "", email: "invalido", password: "1" })
      .expect(400);
    assert.ok(res.body.details.length >= 3);
  });

  it("faz login e devolve um JWT com o id do usuário", async () => {
    await api
      .post("/auth/register")
      .send({ name: "Aluno", email: "login@easyfood.com", password: "123456" });
    const res = await api
      .post("/auth/login")
      .send({ email: "login@easyfood.com", password: "123456" })
      .expect(200);

    const payload = jwt.decode(res.body.token);
    assert.equal(Number(payload.sub), res.body.user.id);
  });

  it("recusa senha errada e e-mail inexistente com a mesma mensagem", async () => {
    await api
      .post("/auth/register")
      .send({ name: "Aluno", email: "x@easyfood.com", password: "123456" });
    const wrongPassword = await api
      .post("/auth/login")
      .send({ email: "x@easyfood.com", password: "errada" })
      .expect(401);
    const unknownEmail = await api
      .post("/auth/login")
      .send({ email: "ninguem@easyfood.com", password: "123456" })
      .expect(401);
    assert.equal(wrongPassword.body.error, unknownEmail.body.error);
  });

  it("GET /auth/me exige token válido", async () => {
    await api.get("/auth/me").expect(401);
    await api.get("/auth/me").set("Authorization", "Bearer token-falso").expect(401);

    const user = await createUser(api, "Maria");
    const res = await api.get("/auth/me").set(user.auth).expect(200);
    assert.equal(res.body.name, "Maria");
  });

  it("devolve 400 para JSON malformado", async () => {
    await api
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{ isso não é json")
      .expect(400);
  });
});
