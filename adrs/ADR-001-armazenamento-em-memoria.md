# ADR-001 — Armazenar restaurantes em memória no protótipo

| Campo | Valor |
|---|---|
| **Status** | Substituída pela [ADR-002](ADR-002-persistencia-com-oracle.md) |
| **Data** | 20/08/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

A primeira versão da API precisava apenas listar (`GET /restaurants`) e cadastrar (`POST /restaurants`) restaurantes.
O produto estava em fase de protótipo: o objetivo era validar o fluxo e demonstrar a ideia rapidamente, sem investir em infraestrutura.

## Alternativas consideradas

1. Array em memória no próprio processo Node.js
2. Arquivo JSON em disco
3. SQLite
4. Banco relacional em servidor (PostgreSQL, Oracle)
5. Banco de documentos (MongoDB, Firebase)

## Decisão

Guardar os restaurantes em um array em memória.

## Justificativa

- Zero configuração e zero custo.
- Permite testar GET e POST em minutos.
- Mantém o foco em validar o fluxo, não em infraestrutura.

## Consequências

**Positivas**
- Desenvolvimento e testes muito rápidos.
- Conceito validado sem dependências externas.

**Negativas**
- Os dados somem sempre que o servidor reinicia (comprovado no teste de reinicialização da Missão 2).
- Não funciona com mais de uma instância da aplicação.
- Sem integridade, sem relacionamentos e sem consultas elaboradas.

## Critérios de revisão

Reavaliar quando os dados precisarem sobreviver a reinicializações, quando surgirem entidades relacionadas ou antes de qualquer uso real.
**Esse critério foi atingido** e a decisão foi substituída pela ADR-002.

## Nota

A ideia do array em memória não foi descartada: ela voltou como `*.repository.memory.js` (ver [ADR-003](ADR-003-driver-oracledb-e-repository.md)), usada nos testes automatizados e no modo de demonstração.
