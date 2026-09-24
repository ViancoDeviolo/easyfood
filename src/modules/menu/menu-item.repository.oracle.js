// Repository de itens do cardápio — implementação Oracle.

const { oracledb, withConnection } = require("../../database/oracle");

const COLUMNS = `id, restaurant_id, name, description, price, available, created_at, updated_at`;

const UPDATABLE_COLUMNS = {
  name: "name",
  description: "description",
  price: "price",
  available: "available"
};

function toMenuItem(row) {
  if (!row) return null;
  return {
    id: row.ID,
    restaurantId: row.RESTAURANT_ID,
    name: row.NAME,
    description: row.DESCRIPTION,
    price: row.PRICE,
    available: row.AVAILABLE === 1, // NUMBER(1) no banco -> boolean na aplicação
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

function toColumnValue(field, value) {
  return field === "available" ? (value ? 1 : 0) : value;
}

function createOracleMenuItemRepository() {
  async function findByRestaurant(restaurantId) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT ${COLUMNS}
           FROM menu_items
          WHERE restaurant_id = :restaurantId
          ORDER BY name`,
        { restaurantId }
      );
      return result.rows.map(toMenuItem);
    });
  }

  async function findById(id) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT ${COLUMNS} FROM menu_items WHERE id = :id`,
        { id }
      );
      return toMenuItem(result.rows[0]);
    });
  }

  async function findByIds(ids) {
    if (ids.length === 0) return [];

    // Gera :id0, :id1, ... para usar bind variables também no IN (...)
    const binds = {};
    const placeholders = ids.map((id, index) => {
      binds[`id${index}`] = id;
      return `:id${index}`;
    });

    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT ${COLUMNS} FROM menu_items WHERE id IN (${placeholders.join(", ")})`,
        binds
      );
      return result.rows.map(toMenuItem);
    });
  }

  async function create({ restaurantId, name, description, price, available }) {
    const id = await withConnection(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO menu_items (restaurant_id, name, description, price, available)
         VALUES (:restaurantId, :name, :description, :price, :available)
         RETURNING id INTO :id`,
        {
          restaurantId,
          name,
          description: description ?? null,
          price,
          available: toColumnValue("available", available),
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );
      return result.outBinds.id[0];
    });
    return findById(id);
  }

  async function update(id, fields) {
    const assignments = [];
    const binds = { id };

    for (const [field, value] of Object.entries(fields)) {
      const column = UPDATABLE_COLUMNS[field];
      if (!column) continue;
      assignments.push(`${column} = :${field}`);
      binds[field] = toColumnValue(field, value);
    }

    if (assignments.length > 0) {
      await withConnection((connection) =>
        connection.execute(
          `UPDATE menu_items
              SET ${assignments.join(", ")}, updated_at = SYSTIMESTAMP
            WHERE id = :id`,
          binds,
          { autoCommit: true }
        )
      );
    }
    return findById(id);
  }

  async function remove(id) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `DELETE FROM menu_items WHERE id = :id`,
        { id },
        { autoCommit: true }
      );
      return result.rowsAffected > 0;
    });
  }

  return { findByRestaurant, findById, findByIds, create, update, remove };
}

module.exports = { createOracleMenuItemRepository };
