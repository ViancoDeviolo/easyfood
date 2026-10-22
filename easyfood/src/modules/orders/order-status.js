// Ciclo de vida do pedido (máquina de estados).
// Cada status sabe para quais status pode ir e quem pode fazer a transição.
//
//   PENDENTE -> CONFIRMADO -> EM_PREPARO -> SAIU_PARA_ENTREGA -> ENTREGUE
//       \            \
//        +------------+--> CANCELADO

const ORDER_STATUS = Object.freeze({
  PENDENTE: "PENDENTE",
  CONFIRMADO: "CONFIRMADO",
  EM_PREPARO: "EM_PREPARO",
  SAIU_PARA_ENTREGA: "SAIU_PARA_ENTREGA",
  ENTREGUE: "ENTREGUE",
  CANCELADO: "CANCELADO"
});

// status atual -> { papel: [próximos status permitidos] }
const TRANSITIONS = Object.freeze({
  PENDENTE: { restaurant: ["CONFIRMADO", "CANCELADO"], customer: ["CANCELADO"] },
  CONFIRMADO: { restaurant: ["EM_PREPARO", "CANCELADO"], customer: [] },
  EM_PREPARO: { restaurant: ["SAIU_PARA_ENTREGA"], customer: [] },
  SAIU_PARA_ENTREGA: { restaurant: ["ENTREGUE"], customer: [] },
  ENTREGUE: { restaurant: [], customer: [] },
  CANCELADO: { restaurant: [], customer: [] }
});

/**
 * @param {string} current status atual
 * @param {string} next status desejado
 * @param {string[]} roles papéis do usuário no pedido ("customer" e/ou "restaurant")
 */
function canTransition(current, next, roles) {
  const rules = TRANSITIONS[current];
  if (!rules) return false;
  return roles.some((role) => (rules[role] || []).includes(next));
}

function allowedTransitions(current, roles) {
  const rules = TRANSITIONS[current] || {};
  return [...new Set(roles.flatMap((role) => rules[role] || []))];
}

module.exports = { ORDER_STATUS, canTransition, allowedTransitions };
