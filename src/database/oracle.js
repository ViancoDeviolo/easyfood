// Camada de acesso ao Oracle Database.
// Responsabilidade: criar/fechar o pool de conexões, executar SQL e traduzir erros ORA-/NJS-
// em erros de aplicação. Nenhum outro arquivo importa "oracledb" além deste e dos repositories.

const oracledb = require("oracledb");
const { env } = require("../config/env");
const {
  ConflictError,
  NotFoundError,
  ValidationError,
  ServiceUnavailableError
} = require("../shared/errors/app-error");

// Linhas retornadas como objetos { COLUNA: valor } em vez de arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// CLOBs pequenos (descrições) chegam direto como string
oracledb.fetchAsString = [oracledb.CLOB];

let pool = null;

async function initPool() {
  if (pool) return pool;

  const config = {
    user: env.oracle.user,
    password: env.oracle.password,
    connectString: env.oracle.connectString,
    poolMin: env.oracle.poolMin,
    poolMax: env.oracle.poolMax,
    poolIncrement: 1,
    poolAlias: "easyfood"
  };

  // Oracle Autonomous Database (OCI): conexão mTLS com wallet
  if (env.oracle.walletDir) {
    config.configDir = env.oracle.walletDir;
    config.walletLocation = env.oracle.walletDir;
    config.walletPassword = env.oracle.walletPassword;
  }

  pool = await oracledb.createPool(config);
  return pool;
}

async function closePool() {
  if (!pool) return;
  await pool.close(10); // aguarda até 10s para conexões em uso terminarem
  pool = null;
}

function getPool() {
  if (!pool) throw new ServiceUnavailableError("Pool do Oracle não inicializado");
  return pool;
}

/** Executa `work(connection)` com uma conexão do pool e sempre a devolve. */
async function withConnection(work) {
  let connection;
  try {
    connection = await getPool().getConnection();
    return await work(connection);
  } catch (error) {
    throw translateOracleError(error);
  } finally {
    if (connection) await connection.close();
  }
}

/** Igual a withConnection, mas faz COMMIT no sucesso e ROLLBACK em qualquer erro. */
async function withTransaction(work) {
  return withConnection(async (connection) => {
    try {
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}

/** Atalho para um único comando SQL com autoCommit. */
async function execute(sql, binds = {}, options = {}) {
  return withConnection((connection) =>
    connection.execute(sql, binds, { autoCommit: true, ...options })
  );
}

async function ping() {
  await withConnection((connection) => connection.ping());
}

// ---------------------------------------------------------------------------
// Tradução de erros do Oracle para erros de aplicação
// ---------------------------------------------------------------------------

// Mensagens amigáveis por nome de constraint (definidas nas migrations)
const CONSTRAINT_ERRORS = {
  UK_USERS_EMAIL: () => new ConflictError("E-mail já cadastrado"),
  UK_MENU_ITEMS_REST_NAME: () => new ConflictError("Já existe um item com esse nome no cardápio"),
  FK_ORDERS_RESTAURANT: () => new ConflictError("Restaurante possui pedidos e não pode ser removido"),
  FK_ORDER_ITEMS_MENU_ITEM: () =>
    new ConflictError("Item já foi pedido e não pode ser removido; marque-o como indisponível"),
  FK_RESTAURANTS_OWNER: () => new NotFoundError("Usuário responsável não encontrado")
};

const CONNECTION_ERROR_NUMS = new Set([1017, 3113, 3114, 12170, 12514, 12528, 12541]);

function extractConstraintName(message = "") {
  // Ex.: "ORA-00001: unique constraint (EASYFOOD.UK_USERS_EMAIL) violated"
  const match = message.match(/\(([A-Z0-9_$#]+\.)?([A-Z0-9_$#]+)\)/i);
  return match ? match[2].toUpperCase() : null;
}

function translateOracleError(error) {
  // Já é um erro de aplicação (lançado por nós dentro de uma transação)
  if (error && error.statusCode) return error;

  const errorNum = error?.errorNum;
  const code = error?.code || "";

  if (errorNum === 1 || errorNum === 2291 || errorNum === 2292) {
    const constraint = extractConstraintName(error.message);
    if (constraint && CONSTRAINT_ERRORS[constraint]) return CONSTRAINT_ERRORS[constraint]();
    if (errorNum === 1) return new ConflictError("Registro duplicado");
    if (errorNum === 2291) return new NotFoundError("Registro relacionado não encontrado");
    return new ConflictError("Registro possui dependências e não pode ser removido");
  }

  if (errorNum === 2290 || errorNum === 1400 || errorNum === 12899) {
    // CHECK constraint, NOT NULL, valor maior que a coluna
    return new ValidationError("Dados rejeitados pelas regras do banco", [error.message]);
  }

  if (CONNECTION_ERROR_NUMS.has(errorNum) || code.startsWith("NJS-5") || code === "NJS-040") {
    console.error("[oracle] banco indisponível:", error.message);
    return new ServiceUnavailableError("Banco de dados indisponível no momento");
  }

  return error;
}

module.exports = {
  oracledb,
  initPool,
  closePool,
  withConnection,
  withTransaction,
  execute,
  ping,
  translateOracleError
};
