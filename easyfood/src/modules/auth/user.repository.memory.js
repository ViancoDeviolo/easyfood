// Repository de usuários — implementação em memória.
// Mesmo contrato da versão Oracle; usada nos testes e no modo DB_CLIENT=memory.

const { ConflictError } = require("../../shared/errors/app-error");

function createMemoryUserRepository() {
  const users = [];
  let nextId = 1;

  async function findById(id) {
    return users.find((user) => user.id === id) ?? null;
  }

  async function findByEmail(email) {
    return users.find((user) => user.email === email) ?? null;
  }

  async function create({ name, email, passwordHash }) {
    if (users.some((user) => user.email === email)) {
      throw new ConflictError("E-mail já cadastrado");
    }
    const user = { id: nextId++, name, email, passwordHash, createdAt: new Date() };
    users.push(user);
    return user;
  }

  return { findById, findByEmail, create };
}

module.exports = { createMemoryUserRepository };
