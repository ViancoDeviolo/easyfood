# ADR-003 — Acessar o Oracle com `oracledb` e o padrão Repository

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 24/09/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

Até a Missão 4 o acesso a dados era feito pelo Prisma, chamado diretamente dentro dos services.
Com a decisão de usar Oracle (ADR-002) surgiu um problema: **o Prisma não tem suporte a Oracle Database**.
Também percebemos que os services dependiam de uma ferramenta específica de banco, o que dificultava testar as regras de negócio sem um banco rodando.

## Alternativas consideradas

1. **`oracledb` (driver oficial da Oracle para Node.js) + SQL escrito à mão + padrão Repository**
2. ORM com suporte a Oracle (TypeORM, Sequelize)
3. Query builder (Knex) com cliente `oracledb`
4. Continuar com PostgreSQL só para poder manter o Prisma

## Decisão

- Usar o **driver `oracledb`** em modo *Thin* (JavaScript puro, sem instalar Oracle Instant Client).
- Isolar todo o SQL em **repositories**, um por entidade (`*.repository.oracle.js`).
- Manter uma segunda implementação com o **mesmo contrato** em memória (`*.repository.memory.js`).
- Escolher a implementação em um único lugar, uma **factory** (`src/database/repositories.js`), a partir da variável `DB_CLIENT`.
- Versionar o schema com **migrations SQL** (`database/migrations/*.sql`) aplicadas por `npm run db:migrate`, registradas na tabela `SCHEMA_MIGRATIONS`.

## Justificativa

- É a biblioteca oficial e mantida pela própria Oracle; dá acesso completo a recursos do banco (pool de conexões, `executeMany`, `RETURNING INTO`, transações explícitas).
- SQL escrito à mão deixa claro o que acontece no banco — importante para aprender Oracle de verdade.
- O padrão Repository desacopla regra de negócio de persistência: services pedem "salve este pedido", sem saber se é Oracle ou memória.
- A implementação em memória permite **42 testes automatizados** rodarem em segundos, sem banco, inclusive no GitHub Actions.
- Os scripts de migration usam a convenção do SQL*Plus (comando terminado por `/`) e também rodam no SQL Developer ou SQLcl.

## Consequências

**Positivas**
- Services e controllers não mudam se o banco mudar; só surge um novo repository.
- Testes rápidos e confiáveis.
- Erros do Oracle (`ORA-00001`, `ORA-02292`, falha de conexão...) são traduzidos em um só lugar (`src/database/oracle.js`) para respostas HTTP claras (`409`, `503`...).

**Negativas / trade-offs**
- Mais código do que com um ORM: mapeamento de linhas (`ROW.NAME` → `name`) é manual.
- Duas implementações por entidade precisam ser mantidas iguais. A implementação em memória precisa imitar comportamentos do banco (ex.: `ON DELETE CASCADE`, unicidade).
- Sem geração automática de migrations: o SQL de cada mudança é escrito à mão.
- DDL no Oracle faz commit implícito: se uma migration falhar no meio, a limpeza é manual.

## Critérios de revisão

Reavaliar se o número de entidades crescer a ponto de o mapeamento manual virar gargalo (considerar TypeORM/Knex), ou se o Prisma passar a suportar Oracle.
