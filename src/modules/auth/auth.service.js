// Regras de autenticação: cadastro, login e validação de token.
// Não conhece HTTP (req/res) nem o banco usado — recebe o repository por parâmetro.

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { UnauthorizedError, NotFoundError, ConflictError } = require("../../shared/errors/app-error");

const SALT_ROUNDS = 10;
// Hash usado quando o e-mail não existe, para o login levar o mesmo tempo nos dois casos
// e não revelar quais e-mails estão cadastrados.
const DUMMY_HASH = bcrypt.hashSync("easyfood-dummy-password", SALT_ROUNDS);

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl ?? null,
    createdAt: user.createdAt
  };
}

// imageService (compartilhado) é opcional: scripts como o seed não precisam dele
function createAuthService({ users, jwtSecret, jwtExpiresIn, imageService }) {
  async function register({ name, email, password }) {
    const existing = await users.findByEmail(email);
    if (existing) throw new ConflictError("E-mail já cadastrado");

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await users.create({ name, email, passwordHash });
    return toPublicUser(user);
  }

  async function login({ email, password }) {
    const user = await users.findByEmail(email);
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      throw new UnauthorizedError("Credenciais inválidas");
    }

    const token = jwt.sign({ email: user.email, name: user.name }, jwtSecret, {
      subject: String(user.id),
      expiresIn: jwtExpiresIn
    });

    return { token, user: toPublicUser(user) };
  }

  /** Valida o token e devolve a identidade contida nele. */
  function verifyToken(token) {
    try {
      const payload = jwt.verify(token, jwtSecret);
      return { id: Number(payload.sub), email: payload.email, name: payload.name };
    } catch {
      throw new UnauthorizedError("Token inválido ou expirado");
    }
  }

  async function getProfile(userId) {
    const user = await users.findById(userId);
    if (!user) throw new NotFoundError("Usuário não encontrado");
    return toPublicUser(user);
  }

  /**
   * Troca a foto de perfil do usuário AUTENTICADO.
   * O userId vem do token (req.user.id), nunca do corpo ou da URL: ninguém altera a foto de outra pessoa.
   */
  async function updateProfileImage(userId, imageBuffer) {
    const user = await users.findById(userId);
    if (!user) throw new NotFoundError("Usuário não encontrado");

    const previousUrl = user.imageUrl; // guardado antes de atualizar o registro
    const { url } = await imageService.saveOptimized("users", imageBuffer);
    try {
      const updated = await users.updateImageUrl(userId, url);
      await imageService.remove(previousUrl); // a foto antiga não é mais usada
      return toPublicUser(updated);
    } catch (error) {
      await imageService.remove(url); // banco falhou: não deixa arquivo órfão
      throw error;
    }
  }

  async function removeProfileImage(userId) {
    const user = await users.findById(userId);
    if (!user) throw new NotFoundError("Usuário não encontrado");
    const previousUrl = user.imageUrl;
    await users.updateImageUrl(userId, null);
    await imageService.remove(previousUrl);
  }

  return { register, login, verifyToken, getProfile, updateProfileImage, removeProfileImage };
}

module.exports = { createAuthService };
