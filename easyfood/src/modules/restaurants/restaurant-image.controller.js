// Controller da foto do restaurante.
// O upload usa o corpo "cru" da requisição (Content-Type image/jpeg, image/png ou image/webp),
// sem multipart: menos dependências e um arquivo por requisição.

const { parseId } = require("../../shared/http/validation");

function createRestaurantImageController(imageService) {
  async function upload(req, res) {
    const result = await imageService.upload(parseId(req.params.id), req.user.id, req.body);
    // 202 Accepted: recebido, mas o processamento termina depois (assíncrono)
    res.status(202).json(result);
  }

  async function status(req, res) {
    res.json(await imageService.getStatus(parseId(req.params.id)));
  }

  async function show(req, res) {
    const buffer = await imageService.getOptimized(parseId(req.params.id));
    res.set("Content-Type", "image/webp");
    res.set("X-Content-Type-Options", "nosniff");
    // A URL muda a cada nova foto (?v=), então o arquivo pode ficar em cache por bastante tempo
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  }

  async function remove(req, res) {
    await imageService.remove(parseId(req.params.id), req.user.id);
    res.status(204).end();
  }

  return { upload, status, show, remove };
}

module.exports = { createRestaurantImageController };
