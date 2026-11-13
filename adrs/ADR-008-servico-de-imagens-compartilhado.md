# ADR-008 — Serviço de imagens compartilhado para perfil e pratos

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 12/11/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

Duas funcionalidades novas precisam de imagens: a **foto de perfil do usuário** (`POST /auth/me/image`) e a **foto de cada prato** (`POST /dishes/:dishId/image`). A [ADR-007](ADR-007-processamento-de-imagens-serverless.md) já processa a foto do restaurante com uma função serverless assíncrona.

A atividade pede: Multer para receber o arquivo, Sharp para otimizar, caminho da imagem gravado no banco e **a mesma lógica reutilizada** pelos módulos.

## Alternativas consideradas

1. Processar dentro de cada módulo (`auth` e `menu` com seu próprio Sharp)
2. **Um serviço compartilhado (`src/shared/images/`)**, chamado de forma síncrona pelos services dos módulos
3. Usar a mesma função serverless assíncrona da ADR-007 também para perfil e pratos

## Decisão

Adotar a **opção 2**:

- `upload.middleware.js`: Multer com `memoryStorage`, limite de 15 MB, um arquivo no campo `image` e filtro de tipo declarado. Os erros do Multer viram 400, 413 ou 415. O mesmo middleware atende perfil, prato **e** restaurante.
- `image.service.js`: confere o formato pelos bytes (415), otimiza com `optimizeImage` (a **mesma função** usada pela serverless: 800 px, WebP q80), grava em `users/` ou `dishes/` com nome UUID e devolve o caminho público `/images/<pasta>/<uuid>.webp`. Se o Sharp falhar, responde 422 e não grava nada.
- `image.routes.js`: `GET /images/:pasta/:arquivo` entrega a imagem com cache longo, porque o nome muda a cada envio.
- O banco guarda o **caminho** (`USERS.IMAGE_URL`, `MENU_ITEMS.IMAGE_URL`, migration `006`).
- Os services de `auth` e `menu` recebem o `imageService` por injeção de dependência (`app.js`) e só cuidam das regras: quem pode trocar, apagar a foto antiga, desfazer se o banco falhar.

## Por que síncrono aqui e assíncrono no restaurante

Foto de perfil e de prato são **pequenas e pontuais**: o usuário espera ver o resultado na hora, e processar uma imagem de poucos MB leva milissegundos. A resposta síncrona (200 com o caminho pronto) é mais simples para a interface e para os testes. A foto do restaurante continua assíncrona porque foi o tema da Aula 8. Como a **lógica de otimização é a mesma**, mover perfil e pratos para a função serverless no futuro é só uma troca de quem chama `optimizeImage`.

## Consequências

**Positivas**
- Uma única implementação de validação e otimização no projeto inteiro (DRY), sem lógica duplicada entre módulos.
- Módulos desacoplados do Sharp e do storage: dependem só de `saveOptimized` e `remove`.
- Segurança por padrão: formato conferido pelos bytes, limite de tamanho e de pixels, nome gerado pelo servidor (sem path traversal), metadados EXIF descartados, dono da foto sempre vindo do JWT.

**Negativas / trade-offs**
- Processamento síncrono ocupa a API durante o Sharp. Com muitos uploads simultâneos, perfil e pratos devem migrar para a função serverless.
- O arquivo inteiro fica em memória durante o upload (até 15 MB por requisição). Aceitável neste volume; em escala, o envio iria direto para o Object Storage com URL pré-assinada.
- Dois estilos convivem (síncrono e assíncrono). Isso é documentado aqui e na ADR-007.

## Critérios de revisão

Reavaliar se o volume de uploads crescer a ponto de afetar a latência da API, ou quando o storage local for trocado por Object Storage.
