# Função `optimize-image`

Função serverless (FaaS) que gera a versão otimizada da foto de um restaurante.

| | |
|---|---|
| **Gatilho** | evento `object.created` no prefixo `originals/` do storage |
| **Entrada** | imagem JPEG, PNG ou WebP (até 15 MB) |
| **Saída** | `optimized/<id>.webp`, largura máxima de 800 px, qualidade 80 |
| **Dependências** | apenas `sharp` |

- `optimize-image.js`: transformação pura (bytes → bytes), sem efeitos colaterais.
- `index.js`: handler; lê do storage, otimiza e grava o resultado.

**Execução local:** a API usa `src/shared/functions/local-function-runtime.js`, que escuta o evento do storage e chama o handler de forma assíncrona, como faria o provedor de nuvem.

**Em produção:** o mesmo `handler` pode ser publicado no OCI Functions ou AWS Lambda, ligado ao evento de criação de objeto do bucket (OCI Object Storage / S3). Ver [ADR-007](../../adrs/ADR-007-processamento-de-imagens-serverless.md).
