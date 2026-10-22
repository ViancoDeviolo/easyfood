const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const { buildTestApp, createUser, createRestaurant } = require("./helpers");
const { optimizeImage } = require("../functions/optimize-image/optimize-image");

/** Gera uma imagem real (com ruído, para não comprimir demais) no formato pedido. */
async function makeImage({ width = 2400, height = 1600, format = "jpeg" } = {}) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 2654435761) % 256;
  return sharp(pixels, { raw: { width, height, channels: 3 } })[format]({ quality: 95 }).toBuffer();
}

describe("Função serverless optimize-image", () => {
  it("redimensiona para 800 px de largura, converte para WebP e reduz o tamanho", async () => {
    const original = await makeImage();
    const result = await optimizeImage(original);
    const meta = await sharp(result.buffer).metadata();

    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 533); // mantém a proporção 3:2
    assert.ok(result.bytes < original.length / 3, "a imagem otimizada deve ser bem menor");
  });

  it("não aumenta imagens menores que 800 px", async () => {
    const result = await optimizeImage(await makeImage({ width: 300, height: 200, format: "png" }));
    assert.equal(result.width, 300);
  });

  it("recusa arquivo que não é imagem", async () => {
    await assert.rejects(optimizeImage(Buffer.from("isto não é uma imagem")));
  });
});

describe("Foto do restaurante (upload + processamento assíncrono)", () => {
  let api;
  let app;
  let storageDir;
  let owner;
  let other;
  let restaurant;

  beforeEach(async () => {
    ({ api, app, storageDir } = buildTestApp());
    owner = await createUser(api, "Dono");
    other = await createUser(api, "Outro");
    restaurant = await createRestaurant(api, owner);
  });

  const upload = (user, buffer, type = "image/jpeg") =>
    api.put(`/restaurants/${restaurant.id}/image`).set(user.auth).set("Content-Type", type).send(buffer);

  const waitForFunction = () => app.locals.functionRuntime.drain();
  const filesIn = (folder) => {
    const dir = path.join(storageDir, folder);
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  };

  it("novo restaurante começa sem foto", async () => {
    assert.equal(restaurant.imageStatus, "NENHUMA");
    assert.equal(restaurant.imageUrl, null);
  });

  it("responde 202 PROCESSANDO e a função deixa a imagem PRONTA depois", async () => {
    const res = await upload(owner, await makeImage()).expect(202);
    assert.equal(res.body.imageStatus, "PROCESSANDO");

    await waitForFunction();

    const status = await api.get(`/restaurants/${restaurant.id}/image/status`).expect(200);
    assert.equal(status.body.imageStatus, "PRONTA");

    const { body } = await api.get(`/restaurants/${restaurant.id}`).expect(200);
    assert.match(body.imageUrl, new RegExp(`^/restaurants/${restaurant.id}/image\\?v=[0-9a-f-]{36}$`));
    assert.equal(body.imageId, undefined, "o identificador interno não é exposto");

    const image = await api.get(body.imageUrl).expect(200);
    assert.equal(image.headers["content-type"], "image/webp");
    assert.equal((await sharp(image.body).metadata()).width, 800);
  });

  it("guarda original e otimizada no storage (como na arquitetura da aula)", async () => {
    await upload(owner, await makeImage({ format: "png" }), "image/png").expect(202);
    await waitForFunction();
    assert.equal(filesIn("originals").length, 1);
    assert.match(filesIn("originals")[0], /\.png$/);
    assert.equal(filesIn("optimized").length, 1);
  });

  it("enquanto processa, GET da imagem responde 404 com mensagem clara", async () => {
    await upload(owner, await makeImage()).expect(202);
    const res = await api.get(`/restaurants/${restaurant.id}/image`).expect(404);
    assert.equal(res.body.error, "A imagem ainda está sendo processada");
    await waitForFunction();
  });

  it("exige token e só o dono pode enviar ou remover a foto", async () => {
    const image = await makeImage({ width: 400, height: 300 });
    await api.put(`/restaurants/${restaurant.id}/image`).set("Content-Type", "image/jpeg").send(image).expect(401);
    await upload(other, image).expect(403);
    await api.delete(`/restaurants/${restaurant.id}/image`).set(other.auth).expect(403);
  });

  it("recusa arquivo que não é imagem, mesmo com Content-Type de imagem (415)", async () => {
    await upload(owner, Buffer.from("<script>alert(1)</script>"), "image/png").expect(415);
    assert.equal(filesIn("originals").length, 0);
  });

  it("recusa arquivo acima do limite (413)", async () => {
    const { api: smallApi } = buildTestApp({ imageMaxBytes: 50 * 1024 });
    const smallOwner = await createUser(smallApi, "Dono");
    const smallRestaurant = await createRestaurant(smallApi, smallOwner);
    await smallApi
      .put(`/restaurants/${smallRestaurant.id}/image`)
      .set(smallOwner.auth)
      .set("Content-Type", "image/jpeg")
      .send(await makeImage())
      .expect(413);
  });

  it("recusa corpo vazio (400)", async () => {
    await upload(owner, Buffer.alloc(0)).expect(400);
  });

  it("marca ERRO quando a função não consegue processar o arquivo", async () => {
    // Cabeçalho JPEG válido seguido de lixo: passa na checagem rápida, falha no sharp
    const corrupted = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
    await upload(owner, corrupted).expect(202);
    await waitForFunction();
    const status = await api.get(`/restaurants/${restaurant.id}/image/status`).expect(200);
    assert.equal(status.body.imageStatus, "ERRO");
  });

  it("nova foto substitui a anterior e apaga os arquivos antigos", async () => {
    await upload(owner, await makeImage()).expect(202);
    await waitForFunction();
    const first = (await api.get(`/restaurants/${restaurant.id}`)).body.imageUrl;

    await upload(owner, await makeImage({ width: 1200, height: 1200 })).expect(202);
    await waitForFunction();
    const second = (await api.get(`/restaurants/${restaurant.id}`)).body.imageUrl;

    assert.notEqual(first, second);
    assert.equal(filesIn("originals").length, 1);
    assert.equal(filesIn("optimized").length, 1);
  });

  it("remover a foto volta para NENHUMA e apaga os arquivos", async () => {
    await upload(owner, await makeImage()).expect(202);
    await waitForFunction();
    await api.delete(`/restaurants/${restaurant.id}/image`).set(owner.auth).expect(204);

    const { body } = await api.get(`/restaurants/${restaurant.id}`);
    assert.equal(body.imageStatus, "NENHUMA");
    assert.equal(filesIn("originals").length + filesIn("optimized").length, 0);
  });

  it("remover o restaurante apaga também a foto", async () => {
    await upload(owner, await makeImage()).expect(202);
    await waitForFunction();
    await api.delete(`/restaurants/${restaurant.id}`).set(owner.auth).expect(204);
    assert.equal(filesIn("originals").length + filesIn("optimized").length, 0);
  });
});

describe("Storage local", () => {
  it("recusa chaves fora do padrão (proteção contra path traversal)", async () => {
    const { storage } = buildTestApp();
    await assert.rejects(storage.put("../../.env", Buffer.from("x")), /Chave de storage inválida/);
    await assert.rejects(storage.get("originals/../../package.json"), /Chave de storage inválida/);
  });
});
