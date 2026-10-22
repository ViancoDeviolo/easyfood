// Regras da foto de perfil do restaurante.
// A API só recebe e guarda o original; quem otimiza é a função serverless "optimize-image",
// disparada pelo evento do storage. Por isso o upload responde PROCESSANDO na hora.

const { randomUUID } = require("node:crypto");
const {
  NotFoundError,
  ValidationError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError
} = require("../../shared/errors/app-error");
const { IMAGE_STATUS } = require("./restaurant-image.constants");
const { detectImageExtension, originalKey, optimizedKey } = require("./restaurant-image.files");

function createRestaurantImageService({ restaurants, restaurantService, storage, imageFiles, maxBytes }) {
  async function upload(restaurantId, userId, buffer) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ValidationError("Envie o arquivo da imagem no corpo da requisição");
    }
    if (buffer.length > maxBytes) {
      throw new PayloadTooLargeError(`A imagem deve ter no máximo ${Math.round(maxBytes / 1024 / 1024)} MB`);
    }

    const ext = detectImageExtension(buffer);
    if (!ext) throw new UnsupportedMediaTypeError("Envie uma imagem JPEG, PNG ou WebP");

    const previous = await restaurants.findImage(restaurantId);
    const imageId = randomUUID();

    // O banco é atualizado ANTES de gravar o arquivo: quando a função terminar,
    // o registro com esse imageId já existe para receber o status PRONTA.
    await restaurants.setImage(restaurantId, { imageId, imageStatus: IMAGE_STATUS.PROCESSANDO });

    try {
      await storage.put(originalKey(imageId, ext), buffer); // dispara a função (evento object.created)
    } catch (error) {
      await restaurants.setImage(restaurantId, previous); // desfaz: mantém a foto anterior
      throw error;
    }

    await imageFiles.discard(previous?.imageId); // a foto antiga não é mais usada

    return { imageStatus: IMAGE_STATUS.PROCESSANDO };
  }

  async function getStatus(restaurantId) {
    await restaurantService.getById(restaurantId);
    const { imageStatus } = await restaurants.findImage(restaurantId);
    return { imageStatus };
  }

  async function getOptimized(restaurantId) {
    await restaurantService.getById(restaurantId);
    const image = await restaurants.findImage(restaurantId);

    if (image.imageStatus !== IMAGE_STATUS.PRONTA) {
      throw new NotFoundError(
        image.imageStatus === IMAGE_STATUS.PROCESSANDO
          ? "A imagem ainda está sendo processada"
          : "Este restaurante não tem imagem"
      );
    }

    const buffer = await storage.get(optimizedKey(image.imageId));
    if (!buffer) throw new NotFoundError("Arquivo da imagem não encontrado");
    return buffer;
  }

  async function remove(restaurantId, userId) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    const previous = await restaurants.findImage(restaurantId);
    await restaurants.setImage(restaurantId, { imageId: null, imageStatus: IMAGE_STATUS.NENHUMA });
    await imageFiles.discard(previous.imageId);
  }

  // ---- Callbacks da função serverless -------------------------------------

  async function handleProcessed(result) {
    const stillCurrent = await restaurants.updateImageStatus(result.imageId, IMAGE_STATUS.PRONTA);
    // A foto foi substituída ou removida enquanto era processada: descarta o resultado
    if (!stillCurrent) await imageFiles.discard(result.imageId);
  }

  async function handleFailed(event) {
    const imageId = event.key.split("/")[1].split(".")[0];
    await restaurants.updateImageStatus(imageId, IMAGE_STATUS.ERRO);
  }

  return { upload, getStatus, getOptimized, remove, handleProcessed, handleFailed };
}

module.exports = { createRestaurantImageService };
