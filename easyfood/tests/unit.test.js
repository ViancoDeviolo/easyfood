// Testes de unidade de peças que não dependem de HTTP.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { canTransition, allowedTransitions } = require("../src/modules/orders/order-status");
const { translateOracleError } = require("../src/database/oracle");
const { splitStatements } = require("../scripts/migrate");
const { validate } = require("../src/shared/http/validation");

describe("Máquina de estados do pedido", () => {
  it("permite apenas as transições previstas para cada papel", () => {
    assert.equal(canTransition("PENDENTE", "CONFIRMADO", ["restaurant"]), true);
    assert.equal(canTransition("PENDENTE", "CONFIRMADO", ["customer"]), false);
    assert.equal(canTransition("PENDENTE", "CANCELADO", ["customer"]), true);
    assert.equal(canTransition("EM_PREPARO", "CANCELADO", ["restaurant"]), false);
    assert.equal(canTransition("ENTREGUE", "PENDENTE", ["restaurant", "customer"]), false);
    assert.deepEqual(allowedTransitions("PENDENTE", ["customer", "restaurant"]), ["CANCELADO", "CONFIRMADO"]);
  });
});

describe("Tradução de erros do Oracle", () => {
  it("ORA-00001 na constraint de e-mail vira 409 com mensagem amigável", () => {
    const error = translateOracleError({
      errorNum: 1,
      message: "ORA-00001: unique constraint (EASYFOOD.UK_USERS_EMAIL) violated on table EASYFOOD.USERS"
    });
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, "E-mail já cadastrado");
  });

  it("ORA-02292 genérico vira 409 e ORA-02290 vira 400", () => {
    assert.equal(translateOracleError({ errorNum: 2292, message: "ORA-02292: integrity constraint (X.FK_Y) violated" }).statusCode, 409);
    assert.equal(translateOracleError({ errorNum: 2290, message: "ORA-02290: check constraint violated" }).statusCode, 400);
  });

  it("falhas de conexão viram 503", () => {
    assert.equal(translateOracleError({ code: "NJS-503", message: "connection refused" }).statusCode, 503);
    assert.equal(translateOracleError({ errorNum: 12514, message: "ORA-12514" }).statusCode, 503);
  });

  it("erros desconhecidos passam adiante sem alteração", () => {
    const original = new Error("outro erro");
    assert.equal(translateOracleError(original), original);
  });
});

describe("Leitor de migrations", () => {
  it("separa comandos por '/' e remove comentários de linha", () => {
    const sql = "-- comentário\nCREATE TABLE a (id NUMBER)\n/\n\nCREATE INDEX ix ON a (id)\n/\n";
    assert.deepEqual(splitStatements(sql), ["CREATE TABLE a (id NUMBER)", "CREATE INDEX ix ON a (id)"]);
  });
});

describe("Validação", () => {
  it("arredonda casas decimais sem erro de ponto flutuante", () => {
    const schema = { value: { type: "number", decimals: 1 } };
    assert.equal(validate({ value: 4.55 }, schema).value, 4.6);
    assert.equal(validate({ value: 1.25 }, schema).value, 1.3);
  });
});
