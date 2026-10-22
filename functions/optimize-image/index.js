// Handler da função serverless "optimize-image".
//
// Disparada por um EVENTO: "um arquivo novo foi gravado em originals/".
// Fluxo (igual ao da Aula 8): Evento -> Trigger -> Execução
//   1. lê a imagem original no storage
//   2. redimensiona e comprime (optimizeImage)
//   3. grava a versão otimizada em optimized/<id>.webp
//
// O handler recebe o storage por parâmetro (injeção de dependência). Em produção,
// esse storage seria o Object Storage do provedor; localmente, é uma pasta em disco.
// A função não acessa o banco nem a API: só devolve o resultado para quem a disparou.

const path = require("node:path");
const { optimizeImage } = require("./optimize-image");

async function handler(event, { storage }) {
  const { key } = event; // ex.: "originals/3f2a...c9.jpg"
  const imageId = path.basename(key, path.extname(key));

  const original = await storage.get(key);
  if (!original) throw new Error(`Arquivo original não encontrado: ${key}`);

  const optimized = await optimizeImage(original);
  const optimizedKey = `optimized/${imageId}.webp`;
  await storage.put(optimizedKey, optimized.buffer);

  return {
    imageId,
    originalKey: key,
    optimizedKey,
    originalBytes: original.length,
    optimizedBytes: optimized.bytes,
    width: optimized.width,
    height: optimized.height
  };
}

module.exports = { handler };
