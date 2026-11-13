// Repository de usuários — implementação Oracle.

const { oracledb, withConnection } = require("../../database/oracle");

const COLUMNS = `id, name, email, password_hash, image_url, created_at`;

function toUser(row) {
  if (!row) return null;
  return {
    id: row.ID,
    name: row.NAME,
    email: row.EMAIL,
    passwordHash: row.PASSWORD_HASH,
    imageUrl: row.IMAGE_URL,
    createdAt: row.CREATED_AT
  };
}

function createOracleUserRepository() {
  async function findById(id) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT ${COLUMNS} FROM users WHERE id = :id`,
        { id }
      );
      return toUser(result.rows[0]);
    });
  }

  async function findByEmail(email) {
    return withConnection(async (connection) => {
      const result = await connection.execute(
        `SELECT ${COLUMNS} FROM users WHERE email = :email`,
        { email }
      );
      return toUser(result.rows[0]);
    });
  }

  async function create({ name, email, passwordHash }) {
    const id = await withConnection(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO users (name, email, password_hash)
         VALUES (:name, :email, :passwordHash)
         RETURNING id INTO :id`,
        {
          name,
          email,
          passwordHash,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );
      return result.outBinds.id[0];
    });
    return findById(id);
  }

  /** Grava (ou limpa, com null) o caminho da foto de perfil. */
  async function updateImageUrl(id, imageUrl) {
    await withConnection((connection) =>
      connection.execute(
        `UPDATE users SET image_url = :imageUrl WHERE id = :id`,
        { id, imageUrl },
        { autoCommit: true }
      )
    );
    return findById(id);
  }

  return { findById, findByEmail, create, updateImageUrl };
}

module.exports = { createOracleUserRepository };
