// Validação simples e declarativa do corpo das requisições.
// Cada módulo descreve suas regras em um objeto (schema) e o controller chama validate().

const { ValidationError } = require("../errors/app-error");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkField(field, rule, raw) {
  let value = raw;

  if (rule.type === "string") {
    if (typeof value !== "string") return { error: `${field} deve ser um texto` };
    value = value.trim();
    if (rule.required && value.length === 0) return { error: `${field} é obrigatório` };
    if (rule.minLength && value.length < rule.minLength) {
      return { error: `${field} deve ter pelo menos ${rule.minLength} caracteres` };
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return { error: `${field} deve ter no máximo ${rule.maxLength} caracteres` };
    }
    if (rule.format === "email") {
      if (!EMAIL_REGEX.test(value)) return { error: `${field} deve ser um e-mail válido` };
      value = value.toLowerCase();
    }
  }

  if (rule.type === "number" || rule.type === "integer") {
    if (typeof value === "string" && value.trim() !== "") value = Number(value);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { error: `${field} deve ser um número` };
    }
    if (rule.type === "integer" && !Number.isInteger(value)) {
      return { error: `${field} deve ser um número inteiro` };
    }
    if (rule.min !== undefined && value < rule.min) return { error: `${field} deve ser no mínimo ${rule.min}` };
    if (rule.max !== undefined && value > rule.max) return { error: `${field} deve ser no máximo ${rule.max}` };
    if (rule.decimals !== undefined) {
      // toPrecision corrige ruído de ponto flutuante (ex.: 4.55 * 10 = 45.4999...)
      const factor = 10 ** rule.decimals;
      value = Math.round(Number((value * factor).toPrecision(12))) / factor;
    }
  }

  if (rule.type === "boolean" && typeof value !== "boolean") {
    return { error: `${field} deve ser true ou false` };
  }

  if (rule.enum && !rule.enum.includes(value)) {
    return { error: `${field} deve ser um dos valores: ${rule.enum.join(", ")}` };
  }

  return { value };
}

/**
 * Valida `input` de acordo com `schema`.
 * @param {object} input corpo da requisição
 * @param {object} schema regras por campo
 * @param {{ partial?: boolean }} options partial=true ignora campos obrigatórios ausentes (PATCH)
 * @returns {object} somente os campos conhecidos, já normalizados
 */
function validate(input, schema, { partial = false } = {}) {
  const data = {};
  const errors = [];
  const source = input && typeof input === "object" ? input : {};

  for (const [field, rule] of Object.entries(schema)) {
    const raw = source[field];
    const missing = raw === undefined || raw === null || raw === "";

    if (missing) {
      if (rule.required && !partial) errors.push(`${field} é obrigatório`);
      else if (!partial && rule.default !== undefined) data[field] = rule.default;
      continue;
    }

    const result = checkField(field, rule, raw);
    if (result.error) errors.push(result.error);
    else data[field] = result.value;
  }

  if (errors.length > 0) {
    throw new ValidationError("Dados inválidos", errors);
  }

  if (partial && Object.keys(data).length === 0) {
    throw new ValidationError("Nenhum campo válido informado para atualização");
  }

  return data;
}

function parseId(value, name = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError(`${name} inválido`);
  }
  return id;
}

module.exports = { validate, parseId };
