// Ponto de entrada: valida a configuração, conecta ao banco e liga o servidor HTTP.

const { env, validateEnv } = require("./src/config/env");
const { createRepositories } = require("./src/database/repositories");
const { createApp } = require("./src/app");
const { seed } = require("./src/database/seed");

async function start() {
  validateEnv();

  const repositories = createRepositories(env.dbClient);
  await repositories.connect();

  const app = createApp({ repositories, jwt: env.jwt });

  // No modo memória o banco nasce vazio a cada execução; carregamos a demonstração automaticamente.
  if (repositories.client === "memory") {
    await seed({ services: app.locals.services, repositories });
  }

  const server = app.listen(env.port, () => {
    console.log(`EasyFood rodando na porta ${env.port} (banco: ${repositories.client})`);
  });

  // Encerramento limpo: para de aceitar requisições e fecha o pool do Oracle
  const shutdown = (signal) => {
    console.log(`${signal} recebido, encerrando...`);
    server.close(async () => {
      await repositories.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  console.error("Não foi possível iniciar a EasyFood:", error.message);
  process.exit(1);
});
