// "Provedor serverless" local.
// Faz o papel do Trigger da Aula 8: escuta o evento do storage e executa a função
// fora do ciclo da requisição HTTP (processamento assíncrono). A API responde 202 na hora
// e a imagem otimizada fica disponível depois.
//
// Em produção esta peça deixa de existir: o próprio provedor (OCI Functions, AWS Lambda)
// liga o evento do bucket à função.

function createLocalFunctionRuntime({ storage, prefix, handler, onSuccess, onFailure, log = console }) {
  const pending = new Set();

  storage.on("object.created", (event) => {
    if (!event.key.startsWith(prefix)) return;

    // setImmediate: a execução começa só depois que a requisição atual terminou
    const execution = new Promise((resolve) => setImmediate(resolve))
      .then(() => handler(event, { storage }))
      .then((result) => onSuccess(result))
      .catch((error) => {
        log.error(`[function] falha ao processar ${event.key}: ${error.message}`);
        return onFailure(event, error);
      })
      .catch((error) => log.error(`[function] falha ao registrar resultado: ${error.message}`))
      .finally(() => pending.delete(execution));

    pending.add(execution);
  });

  /** Aguarda as execuções em andamento (usado nos testes e no encerramento do servidor). */
  async function drain() {
    while (pending.size > 0) await Promise.all([...pending]);
  }

  return { drain };
}

module.exports = { createLocalFunctionRuntime };
