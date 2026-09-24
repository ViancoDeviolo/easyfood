// Repository de restaurantes — implementação Oracle.

const { oracledb, withConnection } = require("../../database/oracle");

const COLUMNS = `id, owner_id, name, category, description, rating, delivery_fee, created_at, updated_at`;

// Campos que podem ser atualizados -> coluna correspondente (whitelist contra SQL injection)
const UPDATABLE_COLUMNS = {
  name: "name",
  category: "category",
  description: "description",
  rating: "rating",
  deliveryFee: "delivery_fee"
};

function toRestaurant(row) {
  if (!row) return null;
  return {
    id: row.ID,
    ownerId: row.OWNER_ID,
    name: row.NAME,
    category: row.CATEGORY,
    description: row.DESCRIPTION,
    rating: row.RATING,
    deliveryFee: row.DELIVERY_FEE,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT
  };
}

function buildFilters({ search, category, ownerId }) {
  const conditions = [];
  const binds = {};

  if (search) {
    conditions.push(`UPPER(name) LIKE '%' || UPPER(:search) || '%'`);
    binds.search = search;
  }
  if (category) {
    conditions.push(`UPPER(category) = UPPER(:category)`);
    binds.category = category;
  }
  if (ownerId) {
    conditions.push(`owner_id = :ownerId`);
    binds.ownerId = ownerId;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, binds };
}

function createOracleRestaurantRepository() {
  async function findAll({ search, category, ownerId, offset = 0, limit = 50 } = {}) {
    const { where, binds } = buildFilters({ search, category, ownerId });

    return withConnection(async (connection) => {
      // Uma conexão executa um comando por vez, então as consultas rodam em sequência
      const rows = await connection.execute(
        `SELECT ${COLUMNS}
           FROM restaurants
           ${where}
          ORDER BY rating DESC, name
         OFFSET :rowOffset ROWS FETCH NEXT :rowLimit ROWS ONLY`,
        { ...binds, rowOffset: offset, rowLimit: limit }
      );
      const count = await connection.execute(
        `SELECT COUNT(*) AS total FROM restaurants ${where}`,
        binds
      );

      return { items: rows.rows.map(toRestaurant), total: count.rows[0].TOTAL };
    });
  }

  async function findCategories() {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT DISTINCT category FROM restaurants ORDER BY category`
      );
      return result.rows.map((row) => row.CATEGORY);
    });
  }

  async function findById(id) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT ${COLUMNS} FROM restaurants WHERE id = :id`,
        { id }
      );
      return toRestaurant(result.rows[0]);
    });
  }

  async function create({ ownerId, name, category, description, rating, deliveryFee }) {
    const id = await withConnection(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO restaurants (owner_id, name, category, description, rating, delivery_fee)
         VALUES (:ownerId, :name, :category, :description, :rating, :deliveryFee)
         RETURNING id INTO :id`,
        {
          ownerId,
          name,
          category,
          description: description ?? null,
          rating,
          deliveryFee,
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
      binds[field] = value;
    }

    if (assignments.length > 0) {
      await withConnection((connection) =>
        connection.execute(
          `UPDATE restaurants
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
        `DELETE FROM restaurants WHERE id = :id`,
        { id },
        { autoCommit: true }
      );
      return result.rowsAffected > 0;
    });
  }

  return { findAll, findCategories, findById, create, update, remove };
}

module.exports = { createOracleRestaurantRepository };
