// Entrega as imagens otimizadas (perfil e pratos) para o navegador.
//   GET /images/users/<uuid>.webp
//   GET /images/dishes/<uuid>.webp
// O nome do arquivo é um UUID novo a cada envio, então a resposta pode ficar em cache por muito tempo.

const express = require("express");
const { NotFoundError } = require("../errors/app-error");

function createImageRoutes({ imageService }) {
  const router = express.Router();

  router.get("/:folder/:fileName", async (req, res) => {
    const buffer = await imageService.read(req.params.folder, req.params.fileName);
    if (!buffer) throw new NotFoundError("Imagem não encontrada");

    res.set("Content-Type", "image/webp");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  });

  return router;
}

module.exports = { createImageRoutes };
