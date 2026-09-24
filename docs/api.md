# Referência da API

Base: `http://localhost:3000` · Corpo e respostas em JSON · Rotas marcadas com 🔒 exigem `Authorization: Bearer <token>`.

Erros seguem sempre o formato `{ "error": "mensagem", "details": ["..."] }` (`details` só aparece em erros de validação).

## Auth

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| POST | `/auth/register` | Cadastro `{ name, email, password }` | `201` usuário sem senha |
| POST | `/auth/login` | Login `{ email, password }` | `200 { token, user }` |
| GET 🔒 | `/auth/me` | Dados do usuário logado | `200` |

## Restaurantes

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/restaurants` | Lista. Filtros: `?search=`, `?category=`, `?page=`, `?limit=` (máx. 100). Total no header `X-Total-Count` | `200 [ ... ]` |
| GET | `/restaurants/categories` | Categorias existentes | `200 [ "Pizza", ... ]` |
| GET 🔒 | `/restaurants/mine` | Restaurantes do usuário logado | `200` |
| GET | `/restaurants/:id` | Detalhe | `200` |
| POST 🔒 | `/restaurants` | Cadastro `{ name, category, description?, rating?, deliveryFee? }` — o usuário logado vira o dono | `201` + `Location` |
| PATCH 🔒 | `/restaurants/:id` | Alteração parcial (somente o dono) | `200` |
| DELETE 🔒 | `/restaurants/:id` | Remoção (somente o dono; bloqueada se já houver pedidos) | `204` |

## Cardápio

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/restaurants/:id/menu` | Itens do cardápio | `200` |
| POST 🔒 | `/restaurants/:id/menu` | Novo item `{ name, price, description?, available? }` (somente o dono) | `201` |
| PATCH 🔒 | `/restaurants/:id/menu/:itemId` | Alteração parcial, ex. `{ "available": false }` | `200` |
| DELETE 🔒 | `/restaurants/:id/menu/:itemId` | Remoção (bloqueada se o item já foi pedido) | `204` |

## Pedidos

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| POST 🔒 | `/orders` | `{ restaurantId, deliveryAddress, notes?, items: [{ menuItemId, quantity }] }` — preços e total calculados no servidor | `201` |
| GET 🔒 | `/orders` | Pedidos do cliente logado | `200` |
| GET 🔒 | `/orders/:id` | Detalhe (cliente ou dono), com `nextStatuses` permitidos | `200` |
| PATCH 🔒 | `/orders/:id/status` | `{ "status": "CONFIRMADO" }` — segue o ciclo de vida | `200` |
| GET 🔒 | `/restaurants/:id/orders` | Pedidos recebidos (somente o dono). Filtro `?status=` | `200` |

## Infra

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | `200 { status: "ok", database: "oracle" }` ou `503` se o banco estiver fora |

## Códigos de status

| Código | Quando |
|---|---|
| 400 | Dados inválidos ou JSON malformado |
| 401 | Sem token, token inválido/expirado, credenciais erradas |
| 403 | Autenticado, mas sem permissão (não é o dono / não é o cliente) |
| 404 | Recurso ou rota inexistente |
| 409 | Conflito: e-mail duplicado, item indisponível, transição de status inválida, remoção bloqueada |
| 503 | Banco de dados indisponível |

Exemplos prontos para executar: [`easyfood.http`](easyfood.http) (extensão *REST Client* do VS Code).
