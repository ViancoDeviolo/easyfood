// Controller de autenticação: traduz HTTP <-> service.

const { validate } = require("../../shared/http/validation");
const { registerSchema, loginSchema } = require("./auth.schemas");

function createAuthController(authService) {
  async function register(req, res) {
    const data = validate(req.body, registerSchema);
    const user = await authService.register(data);
    res.status(201).json(user);
  }

  async function login(req, res) {
    const data = validate(req.body, loginSchema);
    const result = await authService.login(data);
    res.json(result);
  }

  async function me(req, res) {
    const user = await authService.getProfile(req.user.id);
    res.json(user);
  }

  async function uploadImage(req, res) {
    // req.file vem do middleware do Multer; o dono da foto é sempre quem está no token
    const user = await authService.updateProfileImage(req.user.id, req.file.buffer);
    res.json(user);
  }

  async function removeImage(req, res) {
    await authService.removeProfileImage(req.user.id);
    res.status(204).end();
  }

  return { register, login, me, uploadImage, removeImage };
}

module.exports = { createAuthController };
