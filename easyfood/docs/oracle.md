# Guia do Oracle Database na EasyFood

Este guia cobre: subir o Oracle localmente, aplicar o schema, inspecionar os dados e (opcionalmente) apontar a API para o Oracle na nuvem.

## 1. Subir o Oracle com Docker (recomendado)

Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e aberto.

```bash
docker compose up -d oracle
docker compose ps            # aguarde a coluna STATUS mostrar "healthy"
```

A imagem `gvenzl/oracle-free:23-slim-faststart` traz o **Oracle AI Database 26ai Free** (versão 23.26, sucessora do 23ai) e já cria o usuário da aplicação:

| Item | Valor |
|---|---|
| Host / porta | `localhost:1521` |
| Serviço (PDB) | `FREEPDB1` |
| Usuário da aplicação | `easyfood` / `EasyFood_2026` |
| Usuário administrador | `system` / `EasyFoodAdmin_2026` |

> A primeira subida baixa a imagem (algumas centenas de MB) e inicializa o banco. As seguintes levam poucos segundos.
> Os dados ficam no volume `oracle-data` e sobrevivem a `docker compose down`. Para apagar tudo: `docker compose down -v`.

## 2. Criar as tabelas e os dados de exemplo

```bash
npm run db:migrate    # aplica database/migrations/*.sql que ainda não rodaram
npm run db:seed       # cria usuários e restaurantes de demonstração (só se ainda não existirem)
# ou os dois juntos:
npm run db:setup
```

O `db:migrate` guarda o que já foi aplicado na tabela `SCHEMA_MIGRATIONS`, então pode ser executado quantas vezes quiser.

**Como criar uma nova migration:** crie `database/migrations/005_descricao.sql`, escreva um comando por bloco, termine cada bloco com uma linha contendo apenas `/` e rode `npm run db:migrate`. Nunca edite uma migration que já foi aplicada; crie outra.

## 3. Inspecionar o banco

**Pelo terminal (SQL*Plus dentro do container):**

```bash
docker exec -it easyfood-oracle sqlplus easyfood/EasyFood_2026@FREEPDB1
```

**Por interface gráfica:** use o [SQL Developer](https://www.oracle.com/database/sqldeveloper/) ou a extensão *Oracle SQL Developer for VS Code*, com os dados da tabela acima (tipo de conexão *Basic*, *Service name* = `FREEPDB1`).

Consultas úteis para a apresentação:

```sql
-- Tabelas e constraints criadas pelas migrations
SELECT table_name FROM user_tables ORDER BY table_name;

SELECT table_name, constraint_name, constraint_type
  FROM user_constraints
 WHERE constraint_name NOT LIKE 'SYS%'
 ORDER BY table_name, constraint_type;

-- Faturamento por restaurante (pedidos não cancelados)
SELECT r.name                   AS restaurante,
       COUNT(o.id)              AS pedidos,
       NVL(SUM(o.total), 0)     AS faturamento
  FROM restaurants r
  LEFT JOIN orders o
    ON o.restaurant_id = r.id
   AND o.status <> 'CANCELADO'
 GROUP BY r.name
 ORDER BY faturamento DESC;

-- Itens mais pedidos
SELECT oi.item_name, SUM(oi.quantity) AS quantidade
  FROM order_items oi
 GROUP BY oi.item_name
 ORDER BY quantidade DESC
 FETCH FIRST 5 ROWS ONLY;

-- Prova de que a senha é guardada como hash
SELECT email, SUBSTR(password_hash, 1, 20) || '...' AS hash FROM users;
```

**Teste da integridade feita pelo banco** (deve falhar com `ORA-02290`):

```sql
UPDATE orders SET status = 'VOANDO' WHERE id = 1;
```

## 4. Como a aplicação usa o Oracle

| Recurso Oracle | Onde aparece |
|---|---|
| Driver oficial `oracledb` (modo *Thin*, sem Instant Client) | `src/database/oracle.js` |
| Pool de conexões | `initPool()` / `closePool()` |
| Transação com `COMMIT` / `ROLLBACK` | `withTransaction()`, usado ao criar pedidos |
| `RETURNING id INTO :id` | inserts de todos os repositories |
| `executeMany` (insert em lote) | itens do pedido |
| Bind variables (`:nome`) em todas as consultas | proteção contra SQL injection |
| Colunas `IDENTITY` | chaves primárias |
| `OFFSET ... FETCH NEXT ... ROWS ONLY` | paginação de restaurantes |
| Índice baseado em função `UPPER(category)` | filtro por categoria sem diferenciar maiúsculas |
| Constraints `CHECK`, `UNIQUE`, `FOREIGN KEY`, `ON DELETE CASCADE` | migrations |
| Tradução de `ORA-00001`, `ORA-02291/02292`, `ORA-02290`, erros de conexão | `translateOracleError()` |

## 5. (Opcional) Oracle Autonomous Database na nuvem (OCI Always Free)

1. Crie uma conta em [cloud.oracle.com](https://cloud.oracle.com) (o plano *Always Free* não gera cobrança).
2. Crie um **Autonomous Database** (tipo *Transaction Processing*), marcando *Always Free*. Anote a senha do `ADMIN`.
3. Em **Database connection**, baixe a **wallet** (zip) e descompacte em uma pasta fora do projeto, por exemplo `C:/oracle/wallet_easyfood`.
4. Conectado como `ADMIN` (pelo *Database Actions → SQL* no próprio console), crie o usuário da aplicação:
   ```sql
   CREATE USER easyfood IDENTIFIED BY "UmaSenhaForte_2026" QUOTA UNLIMITED ON data;
   GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE TO easyfood;
   ```
5. No `.env`:
   ```env
   ORACLE_USER=easyfood
   ORACLE_PASSWORD=UmaSenhaForte_2026
   ORACLE_CONNECT_STRING=nomedobanco_high        # alias do arquivo tnsnames.ora da wallet
   ORACLE_WALLET_DIR=C:/oracle/wallet_easyfood
   ORACLE_WALLET_PASSWORD=senha-definida-ao-baixar-a-wallet
   ```
6. `npm run db:setup` e `npm start`. O `/health` deve responder `{"status":"ok","database":"oracle"}`.

> A wallet é uma credencial: está no `.gitignore` e **nunca** deve ir para o GitHub.

## 6. Problemas comuns

| Erro | Causa provável | O que fazer |
|---|---|---|
| `NJS-503` / `ECONNREFUSED` | Container não está rodando | `docker compose up -d oracle` e aguarde `healthy` |
| `ORA-12514` | Banco ainda iniciando ou serviço errado | Espere o `healthy`; confira `FREEPDB1` na connect string |
| `ORA-01017` | Usuário/senha errados | Confira `.env`; se mudou a senha depois de criar o volume, rode `docker compose down -v` |
| `ORA-00955` ao migrar | Migration falhou no meio e deixou objetos criados | Remova os objetos criados por ela (ou `docker compose down -v`) e rode de novo |
| API responde `503` | Banco caiu durante a execução | Suba o banco novamente; a API volta sozinha (o pool reconecta) |
