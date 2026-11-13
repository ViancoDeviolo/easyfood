// Regras de negócio do cardápio.
// Qualquer pessoa pode consultar; só o dono do restaurante pode alterar.

const { NotFoundError, ConflictError } = require("../../shared/errors/app-error");

// imageService é o serviço compartilhado de imagens (o mesmo usado pela foto de perfil)
function createMenuService({ menuItems, orders, restaurantService, imageService }) {
  async function list(restaurantId) {
    await restaurantService.getById(restaurantId); // 404 se o restaurante não existir
    return menuItems.findByRestaurant(restaurantId);
  }

  async function getItemOfRestaurant(restaurantId, itemId) {
    const item = await menuItems.findById(itemId);
    if (!item || item.restaurantId !== restaurantId) {
      throw new NotFoundError("Item do cardápio não encontrado");
    }
    return item;
  }

  async function create(restaurantId, userId, data) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    return menuItems.create({ ...data, restaurantId });
  }

  async function update(restaurantId, itemId, userId, data) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    await getItemOfRestaurant(restaurantId, itemId);
    return menuItems.update(itemId, data);
  }

  async function remove(restaurantId, itemId, userId) {
    await restaurantService.getOwnedRestaurant(restaurantId, userId);
    await getItemOfRestaurant(restaurantId, itemId);
    if (await orders.existsForMenuItem(itemId)) {
      throw new ConflictError("Item já foi pedido e não pode ser removido; marque-o como indisponível");
    }
    const item = await menuItems.findById(itemId);
    await menuItems.remove(itemId);
    await imageService?.remove(item?.imageUrl);
  }

  // ---- Prato acessado direto pelo id (/dishes/:dishId) --------------------

  async function getById(itemId) {
    const item = await menuItems.findById(itemId);
    if (!item) throw new NotFoundError("Prato não encontrado");
    return item;
  }

  /** Prato existe (404) e pertence a um restaurante do usuário (403). */
  async function getOwnedItem(itemId, userId) {
    const item = await getById(itemId);
    await restaurantService.getOwnedRestaurant(item.restaurantId, userId);
    return item;
  }

  async function updateImage(itemId, userId, imageBuffer) {
    const item = await getOwnedItem(itemId, userId);

    // Se o processamento falhar, o image.service lança o erro e nada muda no prato
    const previousUrl = item.imageUrl;
    const { url } = await imageService.saveOptimized("dishes", imageBuffer);
    try {
      const updated = await menuItems.update(itemId, { imageUrl: url });
      await imageService.remove(previousUrl);
      return updated;
    } catch (error) {
      await imageService.remove(url);
      throw error;
    }
  }

  async function removeImage(itemId, userId) {
    const item = await getOwnedItem(itemId, userId);
    await menuItems.update(itemId, { imageUrl: null });
    await imageService.remove(item.imageUrl);
  }

  /** Caminhos das fotos dos pratos de um restaurante (usado ao excluir o restaurante). */
  async function listImageUrls(restaurantId) {
    const items = await menuItems.findByRestaurant(restaurantId);
    return items.map((item) => item.imageUrl).filter(Boolean);
  }

  return { list, create, update, remove, getById, updateImage, removeImage, listImageUrls };
}

module.exports = { createMenuService };
