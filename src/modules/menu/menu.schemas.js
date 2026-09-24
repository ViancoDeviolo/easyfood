// Regras de validação das requisições do cardápio.

const menuItemSchema = {
  name: { type: "string", required: true, minLength: 2, maxLength: 150 },
  description: { type: "string", maxLength: 500 },
  price: { type: "number", required: true, min: 0.01, max: 99999999.99, decimals: 2 },
  available: { type: "boolean", default: true }
};

module.exports = { menuItemSchema };
