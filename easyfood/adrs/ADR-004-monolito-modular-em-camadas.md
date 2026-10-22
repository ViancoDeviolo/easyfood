# ADR-004 — Monólito modular organizado em camadas

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 24/09/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

O `server.js` original concentrava tudo: Express, middlewares, rotas, validação, acesso ao banco e inicialização.
O Product Owner trouxe novas necessidades (usuários, autenticação, cardápio, pedidos), e o arquivo tenderia a crescer sem controle.
Na Aula 5 discutimos se esses domínios deveriam virar microsserviços.

## Alternativas consideradas

1. Manter tudo em `server.js`
2. **Monólito modular:** uma aplicação, um deploy, código separado por domínio e por camada
3. Microsserviços (ex.: Auth Service, Orders Service separados, comunicação por rede)

## Decisão

Adotar um **monólito modular**. Cada domínio vira um módulo em `src/modules/` (`auth`, `restaurants`, `menu`, `orders`), e cada módulo segue as mesmas camadas:

```
routes  →  controller  →  service  →  repository  →  Oracle
(caminho)  (HTTP)         (regras)    (SQL)
```

- `server.js` só liga o servidor.
- `src/app.js` é o *composition root*: cria repositories → services → controllers → rotas e injeta as dependências.
- Validação de entrada fica em `*.schemas.js`; erros de negócio são classes em `src/shared/errors`, convertidas em HTTP por um único error handler.

## Justificativa

- O time é pequeno, o produto está em evolução e não há necessidade de escalar partes do sistema de forma independente.
- Microsserviços trariam custos (rede, latência, falhas parciais, deploy múltiplo, observabilidade) sem um problema real que os justifique hoje. *Primeiro organize; depois distribua, se houver motivo.*
- Separar por domínio já prepara o terreno: se um dia `orders` precisar virar serviço, as fronteiras estão definidas.
- A injeção de dependências por funções `create...()` permite trocar Oracle por memória nos testes sem alterar nenhum service.

## Consequências

**Positivas**
- Cada arquivo tem uma responsabilidade clara; services não conhecem `req`/`res`.
- Deploy e debug simples (um processo só).
- Fácil adicionar novos módulos seguindo o mesmo padrão.

**Negativas / trade-offs**
- Mais arquivos e mais "saltos" para seguir uma requisição.
- Todos os módulos ainda compartilham o mesmo processo e o mesmo banco: uma falha grave derruba tudo.
- Escala é do sistema inteiro, não por módulo.

## Critérios de revisão

Reavaliar a extração de um módulo para serviço próprio se: equipes diferentes passarem a cuidar de módulos diferentes; um módulo exigir escala ou ciclo de deploy próprio; ou houver requisito de isolamento de falhas.
