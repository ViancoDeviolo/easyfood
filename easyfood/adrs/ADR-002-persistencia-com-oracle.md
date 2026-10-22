# ADR-002 — Persistir os dados no Oracle Database

| Campo | Valor |
|---|---|
| **Status** | Aceita (substitui a [ADR-001](ADR-001-armazenamento-em-memoria.md)) |
| **Data** | 24/09/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

O teste de reinicialização mostrou que o armazenamento em memória perde todos os restaurantes cadastrados.
Além disso, o domínio cresceu: agora existem **usuários, restaurantes, cardápio e pedidos**, com relacionamentos entre si e operações que precisam ser atômicas (um pedido e seus itens são gravados juntos ou não são gravados).

Precisamos de um banco que ofereça durabilidade, integridade referencial e transações.

## Alternativas consideradas

| # | Opção | Observação |
|---|---|---|
| 1 | **Oracle Database** (26ai Free local / Autonomous Database na OCI) | Relacional, ACID, muito usado em bancos e seguradoras |
| 2 | PostgreSQL | Relacional, open source, opção usada em aula |
| 3 | MySQL | Relacional, popular em aplicações web |
| 4 | MongoDB | Documentos, schema flexível |
| 5 | SQLite | Embarcado, sem servidor |

## Decisão

Usar o **Oracle Database** como banco de dados da EasyFood:
- **Desenvolvimento:** Oracle AI Database 26ai Free em Docker (`docker-compose.yml`).
- **Nuvem (opcional):** Oracle Autonomous Database no plano *Always Free* da OCI, conectado via wallet.

## Justificativa

- **Transações ACID:** criar um pedido grava `ORDERS` e `ORDER_ITEMS` na mesma transação, com `COMMIT`/`ROLLBACK` explícitos.
- **Integridade no próprio banco:** chaves estrangeiras, `UNIQUE` e `CHECK` (status válido, preço positivo, `total = subtotal + taxa`) garantem consistência mesmo se a aplicação tiver um bug.
- **Recursos maduros:** colunas `IDENTITY`, índices baseados em função (`UPPER(category)`), paginação com `OFFSET ... FETCH`, `RETURNING ... INTO`.
- **Relevância de mercado:** Oracle é o banco predominante em instituições financeiras e seguradoras, que é o setor em que o time atua e quer atuar.
- **Sem custo:** tanto o Oracle Database Free quanto o Autonomous Database Always Free são gratuitos.
- **Liberdade da disciplina:** a escolha do banco é livre; usar Oracle é uma oportunidade de aprender um SGBD diferente do visto em aula.

## Consequências

**Positivas**
- Dados persistem entre reinicializações e deploys (teste de reinicialização passa).
- Regras críticas protegidas por constraints, não só por código.
- Várias instâncias da API podem usar o mesmo banco.
- Caminho claro para a nuvem com o Autonomous Database.

**Negativas / trade-offs**
- **O Prisma não suporta Oracle.** Foi preciso trocar a forma de acesso a dados (ver [ADR-003](ADR-003-driver-oracledb-e-repository.md)).
- A imagem Docker do Oracle é maior que a do PostgreSQL e demora mais para subir na primeira vez.
- Menos material de Oracle + Node.js do que de PostgreSQL + Node.js.
- Dependência de infraestrutura externa: se o banco cair, a API responde `503` e `/health` informa `degraded`.

## Critérios de revisão

Reavaliar se:
1. O custo de licenciamento passar a existir (ex.: sair dos planos gratuitos).
2. O time não conseguir manter o ambiente Oracle nas máquinas de desenvolvimento.
3. Surgir necessidade predominante de dados não relacionais.
