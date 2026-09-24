// Regras de validação das requisições do módulo auth.

const registerSchema = {
  name: { type: "string", required: true, minLength: 2, maxLength: 150 },
  email: { type: "string", required: true, format: "email", maxLength: 150 },
  password: { type: "string", required: true, minLength: 6, maxLength: 72 }
};

const loginSchema = {
  email: { type: "string", required: true, format: "email" },
  password: { type: "string", required: true }
};

module.exports = { registerSchema, loginSchema };
