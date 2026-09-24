// Regras de validação das requisições do módulo restaurants.

const restaurantSchema = {
  name: { type: "string", required: true, minLength: 2, maxLength: 150 },
  category: { type: "string", required: true, minLength: 2, maxLength: 100 },
  description: { type: "string", maxLength: 500 },
  rating: { type: "number", min: 0, max: 5, decimals: 1, default: 0 },
  deliveryFee: { type: "number", min: 0, max: 999999.99, decimals: 2, default: 0 }
};

const listQuerySchema = {
  search: { type: "string", maxLength: 150 },
  category: { type: "string", maxLength: 100 },
  page: { type: "integer", min: 1, default: 1 },
  limit: { type: "integer", min: 1, max: 100, default: 20 }
};

module.exports = { restaurantSchema, listQuerySchema };
