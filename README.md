# EasyFood 🍕

Plataforma de delivery de comida, uma réplica simplificada do iFood. Projeto da disciplina **Software Architecture & Design Patterns** (UniFECAF, 2026).

Clientes encontram restaurantes, montam a sacola e acompanham o pedido. Donos de restaurante gerenciam cardápio e avançam o status dos pedidos recebidos.

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express)
![Oracle](https://img.shields.io/badge/Oracle_AI_Database-26ai-F80000?logo=oracle&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens)
![Tests](https://img.shields.io/badge/testes-42_passando-brightgreen)

## Stack

| Camada | Tecnologia |
|---|---|
| API | Node.js 22 + Express 5 |
| Banco de dados | **Oracle AI Database 26ai Free** (Docker) ou **Oracle Autonomous Database** (OCI) |
| Acesso a dados | `oracledb` (driver oficial, modo Thin) + padrão Repository + migrations SQL |
| Autenticação | JWT (`jsonwebtoken`) + senhas com hash `bcryptjs` |
| Interface | HTML, CSS e JavaScript puro (servidos pela própria API) |
| Testes | `node:test` + `supertest` |
| Infra | Docker Compose + GitHub Actions |

## Como rodar

### Opção 1: demonstração rápida, sem banco (1 minuto)

```bash
npm install
npm run start:memory
```

Abra **http://localhost:3000**. Os dados ficam em memória e somem ao reiniciar (veja a [ADR-001](adrs/ADR-001-armazenamento-em-memoria.md)).

### Opção 2: com Oracle (modo padrão)

```bash
npm install
cp .env.example .env              # Windows: copy .env.example .env
docker compose up -d oracle       # aguarde "healthy" em: docker compose ps
npm run db:setup                  # cria as tabelas e os dados de exemplo
npm start
```

### Opção 3: tudo em containers

```bash
docker compose up --build
```

Sobe o Oracle, aplica as migrations, popula o banco e inicia a API em http://localhost:3000.

Detalhes, SQL Developer, consultas úteis e Oracle na nuvem: **[docs/oracle.md](docs/oracle.md)**.

### Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Cliente | `cliente@easyfood.com` | `easyfood123` |
| Dono dos restaurantes | `dono@easyfood.com` | `easyfood123` |

## Funcionalidades

- Cadastro, login e rota `/auth/me` com JWT; senha guardada como hash.
- Restaurantes: listagem pública com busca, filtro por categoria e paginação; CRUD protegido, em que só o dono altera o restaurante.
- Cardápio por restaurante, com disponibilidade de cada item.
- Pedidos: preço e total calculados no servidor, pedido e itens gravados numa única transação no Oracle, ciclo de vida `PENDENTE → CONFIRMADO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE` (ou `CANCELADO`).
- Interface web com área do cliente e painel do dono do restaurante.
- `/health` indica se o banco está disponível; a API responde `503` quando o Oracle está fora.

Referência completa dos endpoints: **[docs/api.md](docs/api.md)** · requisições prontas: [docs/easyfood.http](docs/easyfood.http)

## Arquitetura

Monólito modular em camadas: cada domínio (`auth`, `restaurants`, `menu`, `orders`) tem as mesmas camadas.

```
Requisição → routes → controller → service → repository → Oracle Database
             caminho   HTTP         regras     SQL
```

```
easyfood/
├── adrs/                      # decisões arquiteturais (ADR-001 a ADR-006)
├── database/
│   ├── migrations/            # schema Oracle versionado (001_ ... 004_)
│   └── setup/                 # criação manual do usuário (sem Docker)
├── docs/                      # C4, modelo de dados, API, guia do Oracle
├── public/                    # interface web
├── scripts/                   # migrate.js e seed.js
├── src/
│   ├── config/env.js          # única leitura de variáveis de ambiente
│   ├── database/
│   │   ├── oracle.js          # pool, transações, tradução de erros ORA-
│   │   ├── repositories.js    # factory: Oracle ou memória
│   │   └── seed.js            # dados de demonstração
│   ├── modules/
│   │   ├── auth/              # routes · controller · service · middleware · schemas · repositories
│   │   ├── restaurants/
│   │   ├── menu/
│   │   └── orders/            # + order-status.js (máquina de estados)
│   ├── shared/                # erros de aplicação, validação, error handler
│   └── app.js                 # composition root
├── tests/                     # 42 testes automatizados
├── .github/workflows/ci.yml   # testes + integração real com Oracle
├── docker-compose.yml
├── Dockerfile
└── server.js
```

Diagramas C4, modelo entidade-relacionamento, fluxo do pedido e padrões de projeto usados: **[docs/arquitetura.md](docs/arquitetura.md)**.

## Decisões arquiteturais

| ADR | Decisão |
|---|---|
| [001](adrs/ADR-001-armazenamento-em-memoria.md) | Armazenamento em memória no protótipo (substituída) |
| [002](adrs/ADR-002-persistencia-com-oracle.md) | Persistência com Oracle Database |
| [003](adrs/ADR-003-driver-oracledb-e-repository.md) | Driver `oracledb` + padrão Repository no lugar do Prisma |
| [004](adrs/ADR-004-monolito-modular-em-camadas.md) | Monólito modular em camadas |
| [005](adrs/ADR-005-autenticacao-jwt.md) | Autenticação com JWT |
| [006](adrs/ADR-006-comunicacao-sincrona.md) | Sem arquitetura orientada a eventos por enquanto |

## Testes

```bash
npm test
```

Os testes sobem a API com os repositories em memória e cobrem autenticação, permissões de dono, validações, cálculo do pedido, ciclo de status e tradução de erros do Oracle.
No GitHub Actions, um segundo job sobe um **Oracle real** em container, roda as migrations duas vezes (para provar que são idempotentes), o seed e um teste de fumaça da API.

## Evolução do projeto

| Etapa | O que mudou |
|---|---|
| Missão 1 | API com `GET /restaurants` e array em memória |
| Missão 2 | `POST /restaurants`, teste de reinicialização, ADR-001 |
| Missão 3 | Persistência em banco relacional, agora **Oracle** (ADR-002, ADR-003) |
| Missão 4 | Arquitetura em camadas e módulos (ADR-004) |
| Atividade 5 | Autenticação JWT e rotas protegidas (ADR-005) |
| Aula 6 | Avaliação de event-driven, decisão de não adotar agora (ADR-006) |
| Evolução | Cardápio, pedidos com transação, interface web, Docker e CI |

---

Desenvolvido por **Lucas** · [github.com/ViancoDeviolo](https://github.com/ViancoDeviolo)
