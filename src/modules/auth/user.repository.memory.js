// Repository de usuários — implementação em memória.
// Mesmo contrato da versão Oracle; usada nos testes e no modo DB_CLIENT=memory.

const { ConflictError } = require("../../shared/errors/app-error");

function createMemoryUserRepository() {
  const users = [];
  let nextId = 1;

  // Devolve cópias, como um banco de verdade: quem recebe não altera o "registro" por engano
  const copy = (user) => (user ? { ...user } : null);

  async function findById(id) {
    return copy(users.find((user) => user.id === id));
  }

  async function findByEmail(email) {
    return copy(users.find((user) => user.email === email));
  }

  async function create({ name, email, passwordHash }) {
    if (users.some((user) => user.email === email)) {
      throw new ConflictError("E-mail já cadastrado");
    }
    const user = { id: nextId++, name, email, passwordHash, imageUrl: null, createdAt: new Date() };
    users.push(user);
    return copy(user);
  }

  async function updateImageUrl(id, imageUrl) {
    const user = users.find((item) => item.id === id);
    if (user) user.imageUrl = imageUrl;
    return copy(user);
  }

  return { findById, findByEmail, create, updateImageUrl };
}

module.exports = { createMemoryUserRepository };
