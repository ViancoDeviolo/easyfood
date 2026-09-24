// Centraliza a leitura das variáveis de ambiente.
// Nenhum outro arquivo deve acessar process.env diretamente.
require("dotenv").config({ quiet: true });

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 3000),

  // "oracle" (padrão) ou "memory" (testes / demonstração sem banco).
  // A flag --memory (npm run start:memory) funciona igual no Windows, macOS e Linux.
  dbClient: process.argv.includes("--memory")
    ? "memory"
    : (process.env.DB_CLIENT || "oracle").toLowerCase(),

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  },

  oracle: {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING || "localhost:1521/FREEPDB1",
    // Opcional: usados apenas para o Oracle Autonomous Database (OCI) com wallet
    walletDir: process.env.ORACLE_WALLET_DIR || undefined,
    walletPassword: process.env.ORACLE_WALLET_PASSWORD || undefined,
    poolMin: toInt(process.env.ORACLE_POOL_MIN, 1),
    poolMax: toInt(process.env.ORACLE_POOL_MAX, 10)
  }
};

function validateEnv() {
  const problems = [];

  // No modo demonstração (memória) aceitamos rodar sem .env: gera uma chave temporária
  if (env.dbClient === "memory" && !env.jwt.secret) {
    env.jwt.secret = require("node:crypto").randomBytes(32).toString("hex");
    console.warn("JWT_SECRET não definido: usando chave temporária (apenas no modo memória).");
  }

  if (!env.jwt.secret || env.jwt.secret.length < 16) {
    problems.push("JWT_SECRET precisa estar definido e ter pelo menos 16 caracteres");
  }

  if (!["oracle", "memory"].includes(env.dbClient)) {
    problems.push(`DB_CLIENT inválido: "${env.dbClient}" (use "oracle" ou "memory")`);
  }

  if (env.dbClient === "oracle") {
    if (!env.oracle.user) problems.push("ORACLE_USER não definido");
    if (!env.oracle.password) problems.push("ORACLE_PASSWORD não definido");
  }

  if (problems.length > 0) {
    throw new Error(`Configuração inválida:\n - ${problems.join("\n - ")}`);
  }
}

module.exports = { env, validateEnv };
