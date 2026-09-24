// Regras de validação das requisições de pedidos.

const { ValidationError } = require("../../shared/errors/app-error");
const { validate } = require("../../shared/http/validation");
const { ORDER_STATUS } = require("./order-status");

const placeOrderSchema = {
  restaurantId: { type: "integer", required: true, min: 1 },
  deliveryAddress: { type: "string", required: true, minLength: 5, maxLength: 300 },
  notes: { type: "string", maxLength: 300 }
};

const orderItemSchema = {
  menuItemId: { type: "integer", required: true, min: 1 },
  quantity: { type: "integer", required: true, min: 1, max: 99 }
};

const statusSchema = {
  status: { type: "string", required: true, enum: Object.values(ORDER_STATUS) }
};

const listQuerySchema = {
  status: { type: "string", enum: Object.values(ORDER_STATUS) }
};

function validatePlaceOrder(body) {
  const data = validate(body, placeOrderSchema);

  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Dados inválidos", ["items deve ser uma lista com pelo menos 1 item"]);
  }
  if (items.length > 50) {
    throw new ValidationError("Dados inválidos", ["um pedido pode ter no máximo 50 itens"]);
  }

  data.items = items.map((item, index) => {
    try {
      return validate(item, orderItemSchema);
    } catch (error) {
      throw new ValidationError("Dados inválidos", error.details.map((d) => `items[${index}].${d}`));
    }
  });

  return data;
}

module.exports = { validatePlaceOrder, statusSchema, listQuerySchema };
