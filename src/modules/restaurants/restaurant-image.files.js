// Operações de arquivo da foto do restaurante no storage.
// Separado do service para poder ser usado também na remoção do restaurante.

const { IMAGE_TYPES, detectImageExtension } = require("../../shared/images/image-format");

const originalKey = (imageId, ext) => `originals/${imageId}.${ext}`;
const optimizedKey = (imageId) => `optimized/${imageId}.webp`;

function createRestaurantImageFiles({ storage, log = console }) {
  /** Remove original e otimizada de uma foto. Falhas são registradas, não propagadas. */
  async function discard(imageId) {
    if (!imageId) return;
    const keys = [...IMAGE_TYPES.map(({ ext }) => originalKey(imageId, ext)), optimizedKey(imageId)];
    const results = await Promise.allSettled(keys.map((key) => storage.remove(key)));
    for (const result of results) {
      if (result.status === "rejected") log.error(`[storage] falha ao remover arquivo: ${result.reason.message}`);
    }
  }

  return { discard };
}

module.exports = { createRestaurantImageFiles, detectImageExtension, originalKey, optimizedKey };
