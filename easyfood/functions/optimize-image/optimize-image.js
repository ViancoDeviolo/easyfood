// Lógica pura da função: recebe a imagem original e devolve a versão otimizada.
// Não conhece HTTP, banco ou storage — só transforma bytes. Isso a torna fácil de testar
// e de executar em qualquer provedor (OCI Functions, AWS Lambda, Azure Functions...).

const sharp = require("sharp");

const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;
// Proteção contra "decompression bomb": recusa imagens com mais de ~40 megapixels
const MAX_INPUT_PIXELS = 40_000_000;

async function optimizeImage(inputBuffer) {
  const { data, info } = await sharp(inputBuffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error"
  })
    .rotate() // respeita a orientação EXIF de fotos de celular antes de descartar os metadados
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height, bytes: info.size };
}

module.exports = { optimizeImage, MAX_WIDTH, WEBP_QUALITY };
