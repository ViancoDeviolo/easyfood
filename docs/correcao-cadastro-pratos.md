# Parte 1 — Análise da correção do cadastro de pratos

Repositório de referência: [FelipeDiasR/easy-food](https://github.com/FelipeDiasR/easy-food), commit `70e459e` ("fix at creat menu"), sobre o commit `e9bc82c`, que criou o módulo `dishes`.

## Arquivos alterados pelo professor

| Arquivo | O que mudou |
|---|---|
| `prisma/schema.prisma` | `Restaurant` ganhou `ownerId` e a relação `owner`; `User` ganhou `restaurants` |
| `prisma/migrations/20261029223849_add_restaurant_owner/migration.sql` | Coluna `ownerId` (NOT NULL) e chave estrangeira para `User` |
| `src/modules/dishes/dish.service.js` | Nova validação (`validateDish`), `parseId`, `ensureOwnership`, `getDishWithRestaurant`; `createDish` deixou de exigir `imageUrl` |
| `src/modules/dishes/dish.controller.js` | Passa `req.user.id` (vindo do token) para criar, alterar e excluir |
| `src/modules/restaurant/restaurant.service.js` | Grava `ownerId: user.id` ao criar o restaurante |
| `src/modules/restaurant/restaurant.controller.js` | Só formatação |

## O que causava o erro

1. **O cadastro exigia a imagem antes de ela existir.** O `createDish` original recusava o prato sem `imageUrl` (`Campos obrigatórios: name, category, price, imageUrl, description`), mas o fluxo correto é cadastrar o prato e **depois** enviar a foto. Na prática, `POST /restaurants/:restaurantId/dishes` voltava **400** sempre que o prato vinha sem imagem.
2. **Qualquer usuário logado podia mexer no cardápio de qualquer restaurante.** `Restaurant` não tinha dono, então não havia como saber quem podia cadastrar, alterar ou excluir pratos.
3. **Validação frágil.** Os ids eram convertidos com `Number()` e testados com `!id`, e o preço não era validado como número. Um preço como `"abc"` só falhava dentro do banco, gerando um 500 em vez de um 400.

## Como a correção foi implementada

- O prato é criado com `imageUrl: ""` (o campo é obrigatório no schema do professor), e a foto é enviada depois.
- `validateDish` confere nome, categoria, descrição e preço (número finito e não negativo) e devolve **400** com mensagem clara.
- `parseId` aceita apenas inteiros positivos.
- O restaurante passou a ter `ownerId`, gravado a partir do usuário do token. `ensureOwnership` devolve **403** quando o usuário não é o dono.
- O controller passa `req.user.id` para o service. O service decide as regras e não conhece `req`/`res`.

## Como isso aparece no nosso EasyFood (Oracle)

Por termos trocado PostgreSQL + Prisma por **Oracle + `oracledb`** ([ADR-002](../adrs/ADR-002-persistencia-com-oracle.md), [ADR-003](../adrs/ADR-003-driver-oracledb-e-repository.md)), **não aplicamos os arquivos do Prisma** (`schema.prisma` e a migration do professor). Mas cada ideia da correção já estava no projeto:

| Correção do professor | No nosso projeto |
|---|---|
| `ownerId` no restaurante (migration Prisma) | `owner_id NOT NULL` com FK desde a migration `002_create_restaurants.sql` |
| `ensureOwnership` (403) | `restaurantService.getOwnedRestaurant()`, usado pelo cardápio, pedidos e fotos |
| `imageUrl: ""` para não exigir a foto | `image_url` é **opcional** (`NULL`), na migration `006`; a foto vai por `POST /dishes/:dishId/image` |
| `validateDish` | `menu.schemas.js` + `validate()`: nome, preço > 0, categoria e descrição opcionais |
| `parseId` | `parseId()` em `src/shared/http/validation.js` |
| `req.user.id` passado ao service | Mesmo padrão em todos os controllers |

Diferenças intencionais:
- `imageUrl` é `NULL` em vez de `""`. "Sem foto" fica explícito e não confunde com uma URL vazia.
- Categoria é opcional, porque um restaurante pequeno pode não separar o cardápio. No professor ela é obrigatória.
- A migration do professor adiciona `ownerId NOT NULL` sem valor padrão, o que falha se a tabela já tiver restaurantes (o próprio Prisma avisa). No nosso caso o dono existe desde a criação da tabela.

## Teste do endpoint pedido

```http
POST /restaurants/1/dishes
Authorization: Bearer <token do dono>
Content-Type: application/json

{ "name": "Pizza Portuguesa", "category": "Pizzas", "description": "8 fatias", "price": 57.9 }
```

Resposta: **201 Created**, com o prato gravado no Oracle e ligado ao restaurante 1 (`restaurantId: 1`, `imageUrl: null`). Coberto pelo teste automatizado *"cadastra prato em POST /restaurants/:restaurantId/dishes sem exigir imagem (201)"*.

A rota `/restaurants/:restaurantId/dishes` é o mesmo recurso de `/restaurants/:restaurantId/menu`. As duas funcionam, para manter compatibilidade com o nome usado em sala.
