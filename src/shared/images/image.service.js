// Serviço compartilhado de imagens.
// Concentra TODA a responsabilidade de validar, otimizar e armazenar imagens, para qualquer
// módulo (perfil do usuário, pratos...). Os módulos só dizem "guarde esta imagem em tal pasta"
// e recebem de volta o caminho público.
//
// A otimização reaproveita a mesma função pura usada pela função serverless (optimize-image):
// uma única implementação de "redimensionar para 800 px + WebP q80" em todo o projeto.

const { randomUUID } = require("node:crypto");
const { optimizeImage } = require("../../../functions/optimize-image/optimize-image");
const { detectImageExtension } = require("./image-format");
const {
  ValidationError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  UnprocessableEntityError
} = require("../errors/app-error");

const PUBLIC_PREFIX = "/images";
const FOLDERS = ["users", "dishes"];
const FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

function createImageService({ storage, maxBytes, log = console }) {
  function assertFolder(folder) {
    if (!FOLDERS.includes(folder)) throw new Error(`Pasta de imagens desconhecida: ${folder}`);
  }

  /** Confere tamanho e formato real. Lança 400, 413 ou 415. */
  function validate(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidationError("Arquivo de imagem vazio");
    }
    if (buffer.length > maxBytes) {
      throw new PayloadTooLargeError(`A imagem deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)} MB`);
    }
    if (!detectImageExtension(buffer)) {
      throw new UnsupportedMediaTypeError("Envie uma imagem JPEG, PNG ou WebP");
    }
  }

  /**
   * Valida, otimiza e grava a imagem. Devolve o caminho público (ex.: /images/users/<uuid>.webp).
   * Se o processamento falhar, nada é gravado e a imagem anterior continua valendo.
   */
  async function saveOptimized(folder, buffer) {
    assertFolder(folder);
    validate(buffer);

    let optimized;
    try {
      optimized = await optimizeImage(buffer);
    } catch {
      // Cabeçalho de imagem válido, mas conteúdo corrompido (ou grande demais em pixels)
      throw new UnprocessableEntityError("Não foi possível processar a imagem. Envie outro arquivo.");
    }

    const fileName = `${randomUUID()}.webp`;
    await storage.put(`${folder}/${fileName}`, optimized.buffer);

    return {
      url: `${PUBLIC_PREFIX}/${folder}/${fileName}`,
      width: optimized.width,
      height: optimized.height,
      bytes: optimized.bytes
    };
  }

  /** Converte um caminho público de volta para a chave do storage (ou null se não for nosso). */
  function keyFromUrl(url) {
    if (typeof url !== "string") return null;
    const match = url.match(/^\/images\/(users|dishes)\/([^/]+)$/);
    if (!match || !FILE_PATTERN.test(match[2])) return null;
    return `${match[1]}/${match[2]}`;
  }

  /** Remove uma imagem pelo caminho público. Falhas são registradas, não propagadas. */
  async function remove(url) {
    const key = keyFromUrl(url);
    if (!key) return;
    try {
      await storage.remove(key);
    } catch (error) {
      log.error(`[images] falha ao remover ${key}: ${error.message}`);
    }
  }

  /** Lê uma imagem para servir ao navegador. Devolve null se o caminho for inválido ou não existir. */
  async function read(folder, fileName) {
    if (!FOLDERS.includes(folder) || !FILE_PATTERN.test(fileName)) return null;
    return storage.get(`${folder}/${fileName}`);
  }

  return { validate, saveOptimized, remove, read };
}

module.exports = { createImageService, PUBLIC_PREFIX };
