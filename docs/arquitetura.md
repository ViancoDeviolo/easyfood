# Arquitetura da EasyFood

Documentação no modelo **C4** (Context → Container → Component → Code), mais o modelo de dados e o fluxo principal.
Os diagramas usam Mermaid e são renderizados automaticamente pelo GitHub.

## Nível 1 — Contexto

Quem usa o sistema e com o que ele conversa.

```mermaid
flowchart LR
    cliente["👤 Cliente<br/>pede comida"]
    dono["👤 Dono de restaurante<br/>gerencia cardápio e pedidos"]
    easyfood["EasyFood<br/>[Sistema]<br/>Plataforma de delivery"]

    cliente -- "busca restaurantes,<br/>faz e acompanha pedidos" --> easyfood
    dono -- "cadastra restaurante e cardápio,<br/>avança status dos pedidos" --> easyfood
```

## Nível 2 — Containers

Quais aplicações e armazenamentos formam o sistema.

```mermaid
flowchart LR
    user["👤 Usuário<br/>(cliente ou dono)"]

    subgraph EasyFood
        web["Interface Web<br/>[HTML, CSS, JavaScript]<br/>public/"]
        api["API EasyFood<br/>[Node.js, Express]<br/>REST + JWT"]
        db[("Oracle Database<br/>[26ai Free / Autonomous DB]<br/>usuários, restaurantes,<br/>cardápio, pedidos")]
    end

    user -- "HTTPS" --> web
    web -- "JSON / HTTP<br/>Authorization: Bearer" --> api
    api -- "SQL via oracledb<br/>(pool de conexões, TCP 1521)" --> db
```

A interface é servida pela própria API (`express.static`), então em produção existe um único processo Node.js.

## Nível 3 — Componentes da API

Como a API está organizada por dentro: um **monólito modular**, com os mesmos papéis em cada módulo.

```mermaid
flowchart TB
    req(["Requisição HTTP"]) --> app

    subgraph API["API EasyFood (src/)"]
        app["app.js<br/>composition root:<br/>monta dependências, middlewares e rotas"]
        mw["auth.middleware<br/>valida JWT"]

        subgraph modules["modules/"]
            direction LR
            auth["auth<br/>routes · controller · service"]
            rest["restaurants<br/>routes · controller · service"]
            menu["menu<br/>routes · controller · service"]
            orders["orders<br/>routes · controller · service<br/>+ máquina de estados"]
        end

        factory["database/repositories.js<br/>Factory: escolhe Oracle ou memória"]
        repos["*.repository.oracle.js<br/>SQL + mapeamento"]
        oracle["database/oracle.js<br/>pool, transações,<br/>tradução de erros ORA-"]
        errors["shared/<br/>validação + error handler"]
    end

    app --> mw
    app --> modules
    menu -. "getOwnedRestaurant()" .-> rest
    orders -. "getById()" .-> rest
    modules --> factory --> repos --> oracle --> db[("Oracle Database")]
    modules -.-> errors
```

Responsabilidades:

| Camada | Arquivo | Faz | Não faz |
|---|---|---|---|
| Server | `server.js` | Valida config, conecta no banco, liga o HTTP, encerra com segurança | Regras, rotas |
| App | `src/app.js` | Cria e conecta as peças, registra middlewares e rotas | Acessar banco |
| Routes | `*.routes.js` | Mapeia método + caminho → controller, aplica `authenticate` | Validar, regras |
| Controller | `*.controller.js` | Lê `req`, valida com o schema, chama o service, escolhe o status HTTP | SQL, regras de negócio |
| Service | `*.service.js` | Regras de negócio e autorização (dono, cliente, transições de status) | Conhecer `req`/`res` ou SQL |
| Repository | `*.repository.*.js` | Persistência (SQL Oracle ou array em memória) | Regras de negócio |
| Database | `src/database/oracle.js` | Pool de conexões, transações, tradução de erros do Oracle | Conhecer entidades |

## Nível 4 — Código (exemplo: fazer um pedido)

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente (browser)
    participant R as order.routes
    participant M as auth.middleware
    participant Ct as order.controller
    participant S as order.service
    participant RS as restaurant.service
    participant Rp as order.repository.oracle
    participant DB as Oracle

    C->>R: POST /orders + Bearer token
    R->>M: authenticate
    M-->>R: req.user = { id }
    R->>Ct: place(req, res)
    Ct->>Ct: validatePlaceOrder(body)
    Ct->>S: place(customerId, dados)
    S->>RS: getById(restaurantId)
    S->>S: busca itens no cardápio,<br/>confere restaurante e disponibilidade,<br/>calcula total com preços do banco
    S->>Rp: create(pedido)
    Rp->>DB: INSERT INTO orders ... RETURNING id
    Rp->>DB: executeMany INSERT INTO order_items
    Rp->>DB: COMMIT (ou ROLLBACK se algo falhar)
    Rp-->>S: pedido completo
    S-->>Ct: pedido
    Ct-->>C: 201 Created + Location: /orders/{id}
```

## Modelo de dados (Oracle)

```mermaid
erDiagram
    USERS ||--o{ RESTAURANTS : "é dono de"
    USERS ||--o{ ORDERS : "faz"
    RESTAURANTS ||--o{ MENU_ITEMS : "oferece"
    RESTAURANTS ||--o{ ORDERS : "recebe"
    ORDERS ||--|{ ORDER_ITEMS : "contém"
    MENU_ITEMS ||--o{ ORDER_ITEMS : "é pedido em"

    USERS {
        NUMBER id PK "IDENTITY"
        VARCHAR2 name
        VARCHAR2 email UK
        VARCHAR2 password_hash "bcrypt"
        TIMESTAMP_TZ created_at
    }
    RESTAURANTS {
        NUMBER id PK "IDENTITY"
        NUMBER owner_id FK
        VARCHAR2 name
        VARCHAR2 category "índice UPPER(category)"
        VARCHAR2 description
        NUMBER rating "2,1 - CHECK 0..5"
        NUMBER delivery_fee "8,2 - CHECK >= 0"
    }
    MENU_ITEMS {
        NUMBER id PK "IDENTITY"
        NUMBER restaurant_id FK "ON DELETE CASCADE"
        VARCHAR2 name "UK com restaurant_id"
        NUMBER price "10,2 - CHECK > 0"
        NUMBER available "1 = sim, 0 = não"
    }
    ORDERS {
        NUMBER id PK "IDENTITY"
        NUMBER customer_id FK
        NUMBER restaurant_id FK
        VARCHAR2 status "CHECK lista de status"
        VARCHAR2 delivery_address
        NUMBER subtotal
        NUMBER delivery_fee
        NUMBER total "CHECK total = subtotal + taxa"
    }
    ORDER_ITEMS {
        NUMBER id PK "IDENTITY"
        NUMBER order_id FK "ON DELETE CASCADE"
        NUMBER menu_item_id FK
        VARCHAR2 item_name "foto do nome"
        NUMBER quantity "CHECK 1..99"
        NUMBER unit_price "foto do preço"
    }
```

`ORDER_ITEMS` guarda nome e preço do item **no momento da compra**: se o restaurante mudar o preço depois, pedidos antigos não mudam.

## Ciclo de vida do pedido

```mermaid
stateDiagram-v2
    [*] --> PENDENTE: cliente faz o pedido
    PENDENTE --> CONFIRMADO: restaurante
    PENDENTE --> CANCELADO: cliente ou restaurante
    CONFIRMADO --> EM_PREPARO: restaurante
    CONFIRMADO --> CANCELADO: restaurante
    EM_PREPARO --> SAIU_PARA_ENTREGA: restaurante
    SAIU_PARA_ENTREGA --> ENTREGUE: restaurante
    ENTREGUE --> [*]
    CANCELADO --> [*]
```

As transições ficam em `src/modules/orders/order-status.js`. A atualização no banco usa `WHERE id = :id AND status = :statusAtual`: se duas pessoas tentarem mudar o mesmo pedido ao mesmo tempo, só a primeira vence e a outra recebe `409`.

## Padrões de projeto utilizados

| Padrão | Onde | Para quê |
|---|---|---|
| **Layered Architecture** | routes → controller → service → repository | Separar responsabilidades |
| **Modular Monolith** | `src/modules/*` | Separar por domínio sem distribuir |
| **Repository** | `*.repository.oracle.js` / `*.repository.memory.js` | Isolar a persistência |
| **Factory** | `src/database/repositories.js` | Escolher a implementação por configuração |
| **Dependency Injection** (manual) | funções `create...()` + `src/app.js` | Trocar dependências sem alterar quem usa |
| **Middleware / Chain of Responsibility** | `authenticate`, `errorHandler` | Etapas encadeadas na requisição |
| **State Machine** | `order-status.js` | Controlar transições válidas do pedido |
| **Unit of Work** (via transação) | `withTransaction()` em `oracle.js` | Pedido + itens gravados atomicamente |
| **Object Pool** | pool do `oracledb` | Reaproveitar conexões com o banco |
