// Operações de arquivo da foto do restaurante no storage.
// Separado do service para poder ser usado também na remoção do restaurante.

const IMAGE_TYPES = [
  // A extensão vem dos primeiros bytes do arquivo ("magic numbers"), nunca do nome
  // nem do Content-Type enviado pelo cliente, que podem ser falsificados.
  { ext: "jpg", matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    matches: (b) =>
      b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  {
    ext: "webp",
    matches: (b) =>
      b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
  }
];

function detectImageExtension(buffer) {
  const type = IMAGE_TYPES.find((candidate) => candidate.matches(buffer));
  return type ? type.ext : null;
}

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
