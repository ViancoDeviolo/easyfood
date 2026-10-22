// Executor de migrations para o Oracle.
// Lê database/migrations/*.sql em ordem, aplica apenas as que ainda não rodaram
// e registra cada uma na tabela SCHEMA_MIGRATIONS.
//
// Uso: npm run db:migrate

const fs = require("node:fs");
const path = require("node:path");
const { env, validateEnv } = require("../src/config/env");
const { initPool, closePool, withConnection } = require("../src/database/oracle");

const MIGRATIONS_DIR = path.join(__dirname, "..", "database", "migrations");

/** Divide o arquivo em comandos: cada comando termina em uma linha contendo apenas "/". */
function splitStatements(sqlText) {
  return sqlText
    .split(/^\s*\/\s*$/m)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !line.trim().startsWith("--")) // remove comentários de linha inteira
        .join("\n")
        .trim()
    )
    .filter((statement) => statement.length > 0);
}

async function ensureMigrationsTable(connection) {
  const result = await connection.execute(
    `SELECT COUNT(*) AS total FROM user_tables WHERE table_name = 'SCHEMA_MIGRATIONS'`
  );
  if (result.rows[0].TOTAL > 0) return;

  await connection.execute(`
    CREATE TABLE schema_migrations (
      version     VARCHAR2(200 CHAR) NOT NULL,
      applied_at  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
      CONSTRAINT pk_schema_migrations PRIMARY KEY (version)
    )`);
  console.log("Tabela SCHEMA_MIGRATIONS criada");
}

async function appliedVersions(connection) {
  const result = await connection.execute(`SELECT version FROM schema_migrations`);
  return new Set(result.rows.map((row) => row.VERSION));
}

async function run() {
  if (env.dbClient !== "oracle") {
    console.log(`DB_CLIENT=${env.dbClient}: migrations só se aplicam ao Oracle. Nada a fazer.`);
    return;
  }

  validateEnv();
  await initPool();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await withConnection(async (connection) => {
    await ensureMigrationsTable(connection);
    const applied = await appliedVersions(connection);
    let count = 0;

    for (const file of files) {
      if (applied.has(file)) continue;

      console.log(`Aplicando ${file}...`);
      const statements = splitStatements(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));

      // Obs.: no Oracle, cada DDL faz commit implícito. Se um comando falhar no meio,
      // corrija o script e remova manualmente os objetos já criados antes de rodar de novo.
      for (const statement of statements) {
        await connection.execute(statement);
      }

      await connection.execute(
        `INSERT INTO schema_migrations (version) VALUES (:version)`,
        { version: file },
        { autoCommit: true }
      );
      count += 1;
    }

    console.log(count === 0 ? "Banco já está atualizado." : `${count} migration(s) aplicada(s).`);
  });
}

if (require.main === module) {
  run()
    .catch((error) => {
      console.error("Falha ao aplicar migrations:", error.message);
      process.exitCode = 1;
    })
    .finally(closePool);
}

module.exports = { splitStatements };
