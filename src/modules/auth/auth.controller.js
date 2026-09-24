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

  return { register, login, me };
}

module.exports = { createAuthController };
