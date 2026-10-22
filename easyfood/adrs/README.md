# Registro de Decisões Arquiteturais (ADRs)

Cada arquivo registra **uma** decisão importante da EasyFood: o contexto, as alternativas, o que foi decidido, por quê e quais consequências isso trouxe.
Um ADR não é apagado quando a decisão muda. Ele recebe o status *Substituída* e aponta para o ADR que o substituiu.

| ADR | Decisão | Status |
|-----|---------|--------|
| [001](ADR-001-armazenamento-em-memoria.md) | Armazenar restaurantes em memória no protótipo | Substituída pela 002 |
| [002](ADR-002-persistencia-com-oracle.md) | Persistir os dados no Oracle Database | Aceita |
| [003](ADR-003-driver-oracledb-e-repository.md) | Acessar o Oracle com `oracledb` e o padrão Repository (sem Prisma) | Aceita |
| [004](ADR-004-monolito-modular-em-camadas.md) | Organizar a aplicação como monólito modular em camadas | Aceita |
| [005](ADR-005-autenticacao-jwt.md) | Autenticar usuários com JWT próprio | Aceita |
| [006](ADR-006-comunicacao-sincrona.md) | Não adotar arquitetura orientada a eventos neste momento | Aceita (atualizada pela 007) |
| [007](ADR-007-processamento-de-imagens-serverless.md) | Processar as fotos dos restaurantes com uma função serverless | Aceita |

Modelo usado em todos: **Contexto → Alternativas → Decisão → Justificativa → Consequências (positivas e negativas) → Critérios de revisão**.
