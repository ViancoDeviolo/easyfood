# ADR-007 — Processar as fotos dos restaurantes com uma função serverless

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 22/10/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

Os restaurantes agora podem cadastrar uma **foto de perfil**. As fotos chegam direto do celular ou da câmera, com até **12 MB**, mas a vitrine da EasyFood precisa de imagens leves (por volta de 300 KB, 800 px de largura) para carregar rápido.

Precisamos processar a imagem (redimensionar e comprimir) antes de disponibilizá-la. Processar imagens consome muita CPU e memória, e esse trabalho **não precisa terminar antes de responder ao restaurante**.

## Alternativas consideradas

| # | Opção | Observação |
|---|---|---|
| 1 | **Processar dentro da API**, na própria requisição | Simples, mas a API fica ocupada com CPU pesada e a resposta demora |
| 2 | **Serviço de processamento separado**, sempre ligado | Isola o trabalho, mas é mais um servidor para manter funcionando o tempo todo |
| 3 | **Função serverless (FaaS)** disparada pelo evento de upload no storage | Executa só quando chega uma imagem; o provedor cuida da infraestrutura |

## Decisão

Adotar a **opção 3**, combinando estilos arquiteturais: a EasyFood **continua sendo um monólito modular** e ganha **uma função independente** só para imagens.

```
Restaurante → API (PUT /restaurants/:id/image) → Storage: originals/<id>.jpg
                    │ responde 202 PROCESSANDO           │ evento object.created
                    ▼                                    ▼
             Banco: image_status            Função optimize-image (sharp)
                                              redimensiona 800 px + WebP q80
                                                         │
                                       Storage: optimized/<id>.webp
                                                         │
                                       Banco: image_status = PRONTA
```

- A função fica em `functions/optimize-image/` e **não importa nada de `src/`**: recebe o storage por parâmetro, transforma bytes e devolve o resultado.
- **Localmente**, `src/shared/functions/local-function-runtime.js` faz o papel do provedor: escuta o evento do storage e executa a função fora da requisição.
- **Em produção**, o mesmo `handler` seria publicado no OCI Functions (ou AWS Lambda), ligado ao evento de criação de objeto do OCI Object Storage (ou S3). O runtime local deixa de existir; nada mais muda.

## Justificativa

- **Separa o trabalho pesado:** a API continua respondendo rápido aos pedidos, mesmo com vários uploads ao mesmo tempo.
- **Processamento assíncrono:** a API confirma o recebimento (`202 Accepted`) e a imagem otimizada fica disponível em seguida. O restaurante não precisa esperar.
- **Custo proporcional ao uso:** a função só executa quando chega uma imagem; não há servidor ocioso.
- **Escala gerenciada:** em picos de upload, o provedor executa várias instâncias da função em paralelo.
- **Testável sem nuvem:** a lógica (`optimizeImage`) é pura e tem testes automatizados.

## Resposta aos cenários da aula

| Cenário | Escolha |
|---|---|
| **A** — poucas imagens por dia | Processar dentro da API também seria aceitável. Mantemos a função porque o custo extra é baixo e o desenho já está pronto para crescer. |
| **B** — milhares de imagens, com picos | Função serverless é a melhor escolha: escala sozinha e não derruba a API. |
| **C** — imagem disponível imediatamente após o envio | Processamento assíncrono não serve sozinho. Seria preciso processar de forma síncrona (na API ou chamando a função por HTTP e esperando), aceitando a latência maior, ou exibir o original até a versão otimizada ficar pronta. |

## Consequências

**Positivas**
- API mais leve e responsiva; o trabalho pesado fica isolado.
- A função pode ser trocada, versionada e escalada sem mexer na API.
- Segurança: o formato é conferido pelos bytes do arquivo (não pelo nome nem pelo `Content-Type`), há limite de tamanho (15 MB) e de pixels (proteção contra *decompression bomb*), as chaves do storage são geradas pelo servidor (sem *path traversal*) e os metadados EXIF, como localização GPS, são descartados.

**Negativas / trade-offs**
- **Consistência eventual:** logo após o upload a foto ainda não está pronta (`PROCESSANDO`); a interface precisa consultar o status.
- **Cold start:** em produção, a primeira execução depois de um tempo parado é mais lenta.
- **Limites de execução e dependência do provedor:** tempo máximo, memória e a forma de ligar o evento variam entre OCI, AWS e Azure.
- **Mais peças para observar:** falhas da função aparecem como `image_status = ERRO` e no log, não na resposta da API.
- **Localmente**, o runtime roda no mesmo processo da API: se a API cair durante o processamento, a imagem pode ficar em `PROCESSANDO` (no provedor real, o evento é reentregue).

## Relação com a ADR-006

A [ADR-006](ADR-006-comunicacao-sincrona.md) continua valendo: os **módulos da API** seguem conversando de forma direta e síncrona. O evento aparece só aqui, entre o **storage e a função**, porque este é o primeiro caso real em que uma ação não precisa terminar antes de responder ao usuário — exatamente o critério de revisão previsto na ADR-006. Não há broker de mensagens: o próprio storage emite o evento.

## Critérios de revisão

Reavaliar se:
1. O requisito passar a ser o do cenário C (imagem disponível na hora).
2. O volume de imagens for tão baixo que a função não compense a complexidade.
3. O custo por execução no provedor superar o de um serviço dedicado.
