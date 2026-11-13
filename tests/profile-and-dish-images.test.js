// Testes da Parte 5 da atividade: cadastro de pratos, foto de perfil e foto de prato,
// todos usando o mesmo serviço compartilhado de imagens (Multer + Sharp).
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { buildTestApp, createUser, createRestaurant } = require("./helpers");

async function makeImage({ width = 1600, height = 1200, format = "jpeg" } = {}) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 2654435761) % 256;
  return sharp(pixels, { raw: { width, height, channels: 3 } })[format]({ quality: 95 }).toBuffer();
}

const attachImage = (req, buffer, contentType = "image/jpeg", filename = "foto.jpg") =>
  req.attach("image", buffer, { filename, contentType });

describe("Parte 5 — cadastro de pratos e imagens de perfil e pratos", () => {
  let api;
  let storageDir;
  let owner;
  let other;
  let restaurant;

  beforeEach(async () => {
    ({ api, storageDir } = buildTestApp());
    owner = await createUser(api, "Dono");
    other = await createUser(api, "Outro");
    restaurant = await createRestaurant(api, owner);
  });

  const filesIn = (folder) => {
    const dir = path.join(storageDir, folder);
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  };

  async function createDish(overrides = {}) {
    const { body } = await api
      .post(`/restaurants/${restaurant.id}/dishes`)
      .set(owner.auth)
      .send({ name: "Pizza Calabresa", category: "Pizzas", description: "8 fatias", price: 52.9, ...overrides })
      .expect(201);
    return body;
  }

  // ---- Cadastro de pratos (Parte 1) --------------------------------------

  it("cadastra prato em POST /restaurants/:restaurantId/dishes sem exigir imagem (201)", async () => {
    const dish = await createDish();
    assert.equal(dish.restaurantId, restaurant.id);
    assert.equal(dish.category, "Pizzas");
    assert.equal(dish.imageUrl, null);

    const listed = await api.get(`/restaurants/${restaurant.id}/dishes`).expect(200);
    assert.equal(listed.body.length, 1);
    await api.get(`/dishes/${dish.id}`).expect(200);
  });

  it("só o dono do restaurante cadastra pratos nele (403)", async () => {
    await api
      .post(`/restaurants/${restaurant.id}/dishes`)
      .set(other.auth)
      .send({ name: "Invasão", price: 1 })
      .expect(403);
  });

  // ---- Foto de perfil do usuário (Parte 2) -------------------------------

  it("envia foto para o perfil autenticado e devolve o caminho otimizado", async () => {
    const res = await attachImage(api.post("/auth/me/image").set(owner.auth), await makeImage()).expect(200);
    assert.match(res.body.imageUrl, /^\/images\/users\/[0-9a-f-]{36}\.webp$/);
    assert.equal(res.body.id, owner.user.id);

    const me = await api.get("/auth/me").set(owner.auth).expect(200);
    assert.equal(me.body.imageUrl, res.body.imageUrl);

    const image = await api.get(res.body.imageUrl).expect(200);
    assert.equal(image.headers["content-type"], "image/webp");
    assert.equal((await sharp(image.body).metadata()).width, 800);
  });

  it("a foto vai para o usuário do token, nunca para um id enviado na requisição", async () => {
    const req = api.post("/auth/me/image").set(other.auth).field("userId", String(owner.user.id));
    await attachImage(req, await makeImage({ width: 400, height: 400 })).expect(200);

    const ownerMe = await api.get("/auth/me").set(owner.auth);
    const otherMe = await api.get("/auth/me").set(other.auth);
    assert.equal(ownerMe.body.imageUrl, null);
    assert.ok(otherMe.body.imageUrl);
  });

  it("login também devolve a foto do usuário", async () => {
    await attachImage(api.post("/auth/me/image").set(owner.auth), await makeImage()).expect(200);
    const login = await api.post("/auth/login").send({ email: owner.user.email, password: "senha123" }).expect(200);
    assert.ok(login.body.user.imageUrl);
  });

  it("trocar a foto apaga a anterior; remover volta para null", async () => {
    await attachImage(api.post("/auth/me/image").set(owner.auth), await makeImage()).expect(200);
    await attachImage(api.post("/auth/me/image").set(owner.auth), await makeImage({ format: "png" }), "image/png", "a.png").expect(200);
    assert.equal(filesIn("users").length, 1);

    await api.delete("/auth/me/image").set(owner.auth).expect(204);
    assert.equal(filesIn("users").length, 0);
    assert.equal((await api.get("/auth/me").set(owner.auth)).body.imageUrl, null);
  });

  // ---- Foto do prato (Parte 3) -------------------------------------------

  it("envia foto para um prato e o cardápio passa a devolver a imagem", async () => {
    const dish = await createDish();
    const res = await attachImage(api.post(`/dishes/${dish.id}/image`).set(owner.auth), await makeImage()).expect(200);
    assert.match(res.body.imageUrl, /^\/images\/dishes\/[0-9a-f-]{36}\.webp$/);

    const menu = await api.get(`/restaurants/${restaurant.id}/dishes`).expect(200);
    assert.equal(menu.body[0].imageUrl, res.body.imageUrl);

    const image = await api.get(res.body.imageUrl).expect(200);
    assert.equal(image.headers["content-type"], "image/webp");
  });

  it("só o dono do restaurante troca a foto do prato (403)", async () => {
    const dish = await createDish();
    await attachImage(api.post(`/dishes/${dish.id}/image`).set(other.auth), await makeImage()).expect(403);
  });

  it("excluir o prato ou o restaurante apaga as fotos dos pratos", async () => {
    const first = await createDish({ name: "Prato 1" });
    const second = await createDish({ name: "Prato 2" });
    await attachImage(api.post(`/dishes/${first.id}/image`).set(owner.auth), await makeImage()).expect(200);
    await attachImage(api.post(`/dishes/${second.id}/image`).set(owner.auth), await makeImage()).expect(200);
    assert.equal(filesIn("dishes").length, 2);

    await api.delete(`/restaurants/${restaurant.id}/dishes/${first.id}`).set(owner.auth).expect(204);
    assert.equal(filesIn("dishes").length, 1);

    await api.delete(`/restaurants/${restaurant.id}`).set(owner.auth).expect(204);
    assert.equal(filesIn("dishes").length, 0);
  });

  // ---- Erros esperados (tabela da Parte 5) --------------------------------

  it("enviar imagem sem JWT -> 401 (perfil e prato)", async () => {
    const dish = await createDish();
    const image = await makeImage({ width: 300, height: 300 });
    await attachImage(api.post("/auth/me/image"), image).expect(401);
    await attachImage(api.post(`/dishes/${dish.id}/image`), image).expect(401);
  });

  it("enviar arquivo inválido -> 415; arquivo corrompido -> 422; sem arquivo -> 400", async () => {
    // Content-Type de imagem, mas o conteúdo não é imagem (conferido pelos bytes)
    await attachImage(api.post("/auth/me/image").set(owner.auth), Buffer.from("<script>alert(1)</script>"), "image/png", "x.png").expect(415);
    // Tipo declarado não permitido
    await attachImage(api.post("/auth/me/image").set(owner.auth), Buffer.from("%PDF-1.4"), "application/pdf", "x.pdf").expect(415);
    // Cabeçalho JPEG válido com conteúdo corrompido: o Sharp não consegue processar
    const corrupted = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
    await attachImage(api.post("/auth/me/image").set(owner.auth), corrupted).expect(422);
    // Nenhum arquivo enviado
    await api.post("/auth/me/image").set(owner.auth).expect(400);

    assert.equal(filesIn("users").length, 0, "nada é gravado quando a imagem é recusada");
    assert.equal((await api.get("/auth/me").set(owner.auth)).body.imageUrl, null);
  });

  it("enviar imagem acima do limite -> 413", async () => {
    const { api: smallApi } = buildTestApp({ imageMaxBytes: 50 * 1024 });
    const user = await createUser(smallApi, "Usuário");
    await attachImage(smallApi.post("/auth/me/image").set(user.auth), await makeImage()).expect(413);
  });

  it("enviar imagem para prato inexistente -> 404", async () => {
    await attachImage(api.post("/dishes/999999/image").set(owner.auth), await makeImage({ width: 300, height: 300 })).expect(404);
  });

  it("caminho de imagem inexistente ou malicioso -> 404", async () => {
    await api.get("/images/users/00000000-0000-0000-0000-000000000000.webp").expect(404);
    await api.get("/images/originals/qualquer.jpg").expect(404);
    await api.get("/images/users/..%2F..%2F.env").expect(404);
  });
});
