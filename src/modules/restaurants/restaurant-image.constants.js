// Constantes e helpers da foto do restaurante, compartilhados pelos repositories e services.

const IMAGE_STATUS = Object.freeze({
  NENHUMA: "NENHUMA",
  PROCESSANDO: "PROCESSANDO",
  PRONTA: "PRONTA",
  ERRO: "ERRO"
});

/**
 * URL pública da imagem otimizada, ou null se ainda não houver uma pronta.
 * O parâmetro ?v= muda a cada nova foto, então o navegador nunca mostra uma versão antiga do cache.
 */
function restaurantImageUrl(restaurantId, imageId, imageStatus) {
  if (imageStatus !== IMAGE_STATUS.PRONTA || !imageId) return null;
  return `/restaurants/${restaurantId}/image?v=${imageId}`;
}

module.exports = { IMAGE_STATUS, restaurantImageUrl };
