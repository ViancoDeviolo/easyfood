# ADR-006 — Não adotar arquitetura orientada a eventos neste momento

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 24/09/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

Na Aula 6 surgiram necessidades como: quando um restaurante é cadastrado, enviar e-mail de boas-vindas, registrar atividade e notificar o time comercial.
O mesmo vale para pedidos (avisar o restaurante, atualizar analytics).
Uma opção é publicar eventos (`restaurant.created`, `order.placed`) em um broker (RabbitMQ, Kafka, SQS) e deixar consumidores reagirem.

## Alternativas consideradas

1. **Comunicação direta e síncrona** entre módulos (service chama service)
2. Eventos em memória (EventEmitter do Node) dentro do monólito
3. Broker de mensagens externo (RabbitMQ, Kafka, SQS)

## Decisão

Manter **comunicação direta e síncrona** entre os módulos. Hoje nenhuma ação depende de processamento posterior.

## Justificativa

- Poucos componentes e fluxo simples: o ganho de desacoplamento ainda é pequeno.
- Um broker traria infraestrutura adicional, consistência eventual, tratamento de falhas e observabilidade mais complexa.
- O único efeito colateral crítico (gravar pedido + itens) já é resolvido por **transação no Oracle**.

## Consequências

**Positivas**
- Fluxo fácil de entender e depurar; erro aparece na hora para quem chamou.
- Nenhuma infraestrutura extra.

**Negativas / trade-offs**
- Se no futuro o cadastro de restaurante precisar notificar vários sistemas, o service vai acumular responsabilidades.
- Chamadas lentas (ex.: e-mail) atrasariam a resposta da API se fossem adicionadas de forma síncrona.

## Critérios de revisão

Reavaliar quando surgirem consumidores reais de eventos (e-mail, notificações, analytics), quando uma ação não precisar terminar antes de responder ao usuário, ou quando módulos forem extraídos para serviços separados.
