// Repository de pedidos — implementação Oracle.
// A criação do pedido grava ORDERS e ORDER_ITEMS na mesma transação:
// ou tudo é salvo, ou nada é salvo.

const { oracledb, withConnection, withTransaction } = require("../../database/oracle");

const ORDER_COLUMNS = `
  o.id, o.customer_id, o.restaurant_id, r.name AS restaurant_name, o.status,
  o.delivery_address, o.notes, o.subtotal, o.delivery_fee, o.total, o.created_at, o.updated_at`;

function toOrder(row, items = []) {
  return {
    id: row.ID,
    customerId: row.CUSTOMER_ID,
    restaurantId: row.RESTAURANT_ID,
    restaurantName: row.RESTAURANT_NAME,
    status: row.STATUS,
    deliveryAddress: row.DELIVERY_ADDRESS,
    notes: row.NOTES,
    subtotal: row.SUBTOTAL,
    deliveryFee: row.DELIVERY_FEE,
    total: row.TOTAL,
    items,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

function toOrderItem(row) {
  return {
    id: row.ID,
    menuItemId: row.MENU_ITEM_ID,
    name: row.ITEM_NAME,
    quantity: row.QUANTITY,
    unitPrice: row.UNIT_PRICE
  };
}

/** Busca os itens de vários pedidos de uma vez e agrupa por pedido. */
async function loadItems(connection, orderIds) {
  const grouped = new Map(orderIds.map((id) => [id, []]));
  if (orderIds.length === 0) return grouped;

  const binds = {};
  const placeholders = orderIds.map((id, index) => {
    binds[`o${index}`] = id;
    return `:o${index}`;
  });

  const result = await connection.execute(
    `SELECT id, order_id, menu_item_id, item_name, quantity, unit_price
       FROM order_items
      WHERE order_id IN (${placeholders.join(", ")})
      ORDER BY id`,
    binds
  );

  for (const row of result.rows) {
    grouped.get(row.ORDER_ID).push(toOrderItem(row));
  }
  return grouped;
}

async function queryOrders(connection, where, binds) {
  const result = await connection.execute(
    `SELECT ${ORDER_COLUMNS}
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
      ${where}
      ORDER BY o.created_at DESC, o.id DESC`,
    binds
  );
  const items = await loadItems(connection, result.rows.map((row) => row.ID));
  return result.rows.map((row) => toOrder(row, items.get(row.ID)));
}

function createOracleOrderRepository() {
  async function findById(id) {
    return withConnection(async (connection) => {
      const orders = await queryOrders(connection, `WHERE o.id = :id`, { id });
      return orders[0] ?? null;
    });
  }

  async function findByCustomer(customerId) {
    return withConnection((connection) =>
      queryOrders(connection, `WHERE o.customer_id = :customerId`, { customerId })
    );
  }

  async function findByRestaurant(restaurantId, { status } = {}) {
    const binds = { restaurantId };
    let where = `WHERE o.restaurant_id = :restaurantId`;
    if (status) {
      where += ` AND o.status = :status`;
      binds.status = status;
    }
    return withConnection((connection) => queryOrders(connection, where, binds));
  }

  async function create(order) {
    const id = await withTransaction(async (connection) => {
      const inserted = await connection.execute(
        `INSERT INTO orders
           (customer_id, restaurant_id, status, delivery_address, notes, subtotal, delivery_fee, total)
         VALUES
           (:customerId, :restaurantId, :status, :deliveryAddress, :notes, :subtotal, :deliveryFee, :total)
         RETURNING id INTO :id`,
        {
          customerId: order.customerId,
          restaurantId: order.restaurantId,
          status: order.status,
          deliveryAddress: order.deliveryAddress,
          notes: order.notes ?? null,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          total: order.total,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }
      );
      const orderId = inserted.outBinds.id[0];

      // executeMany: insere todos os itens em uma única ida ao banco
      await connection.executeMany(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price)
         VALUES (:orderId, :menuItemId, :itemName, :quantity, :unitPrice)`,
        order.items.map((item) => ({
          orderId,
          menuItemId: item.menuItemId,
          itemName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })),
        {
          bindDefs: {
            orderId: { type: oracledb.NUMBER },
            menuItemId: { type: oracledb.NUMBER },
            itemName: { type: oracledb.STRING, maxSize: 150 },
            quantity: { type: oracledb.NUMBER },
            unitPrice: { type: oracledb.NUMBER }
          }
        }
      );

      return orderId;
    });

    return findById(id);
  }

  /**
   * Atualiza o status somente se o pedido ainda estiver no status esperado.
   * Evita que duas requisições simultâneas façam transições conflitantes.
   */
  async function updateStatus(id, fromStatus, toStatus) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `UPDATE orders
            SET status = :toStatus, updated_at = SYSTIMESTAMP
          WHERE id = :id AND status = :fromStatus`,
        { id, fromStatus, toStatus },
        { autoCommit: true }
      );
      return result.rowsAffected > 0;
    });
  }

  async function existsForRestaurant(restaurantId) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT 1 AS found FROM orders WHERE restaurant_id = :restaurantId FETCH FIRST 1 ROWS ONLY`,
        { restaurantId }
      );
      return result.rows.length > 0;
    });
  }

  async function existsForMenuItem(menuItemId) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT 1 AS found FROM order_items WHERE menu_item_id = :menuItemId FETCH FIRST 1 ROWS ONLY`,
        { menuItemId }
      );
      return result.rows.length > 0;
    });
  }

  return {
    findById,
    findByCustomer,
    findByRestaurant,
    create,
    updateStatus,
    existsForRestaurant,
    existsForMenuItem
  };
}

module.exports = { createOracleOrderRepository };
