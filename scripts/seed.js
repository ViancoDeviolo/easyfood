// Popula o Oracle com dados de demonstração.
// Uso: npm run db:seed   (rode depois do npm run db:migrate)

const { env, validateEnv } = require("../src/config/env");
const { createRepositories } = require("../src/database/repositories");
const { createServices } = require("../src/app");
const { seed } = require("../src/database/seed");

async function run() {
  validateEnv();
  const repositories = createRepositories(env.dbClient);
  await repositories.connect();

  try {
    const services = createServices({ repositories, jwt: env.jwt });
    await seed({ services, repositories });
  } finally {
    await repositories.close();
  }
}

run().catch((error) => {
  console.error("Falha ao popular o banco:", error.message);
  process.exitCode = 1;
});
