# Parte 6 — Pense como arquiteto

**Por que faz sentido reutilizar o mesmo serviço de imagens?**
Validar o formato, limitar o tamanho, redimensionar, converter para WebP e gravar no storage são passos iguais para a foto do usuário e para a do prato. Com um único `image.service.js`, a regra existe uma vez só. Uma correção de segurança, a troca do storage local por OCI Object Storage ou uma mudança no tamanho (800 px) valem para todos os módulos de uma vez, sem duplicar código. A própria otimização (`optimizeImage`) é a mesma usada pela função serverless da foto do restaurante.

**Qual é a responsabilidade do Controller e qual é a do Service?**
O **controller** traduz HTTP: lê `req.params`, `req.user.id` e `req.file`, chama o service e escolhe o status da resposta (200, 201, 204). O **service** decide as regras: o prato existe (404)? O usuário é o dono do restaurante (403)? Se o banco falhar, apaga o arquivo novo. Depois de trocar a foto, apaga a antiga. O service não conhece `req` nem `res`, por isso pode ser testado e reutilizado fora do Express.

**Por que não devemos implementar o processamento diretamente nas rotas?**
A rota só deve dizer "este caminho, com estes middlewares, vai para este controller". Colocar o Sharp ali misturaria HTTP, regra de negócio e infraestrutura no mesmo lugar. O código ficaria duplicado entre `/auth/me/image` e `/dishes/:dishId/image`, e não daria para testar o processamento sem subir um servidor.

**Como o middleware de autenticação protege a alteração da imagem de perfil?**
O `authenticate` roda **antes** do upload: sem um JWT válido a requisição para com **401**, e o arquivo nem é lido. Quando o token é válido, ele coloca o usuário em `req.user`. O service usa só `req.user.id` para decidir de quem é a foto, nunca um id vindo da URL ou do corpo. Assim, ninguém troca a foto de outra pessoa. Um teste automatizado confirma isso enviando um `userId` de outro usuário no formulário.

**O que deve acontecer se o processamento de uma imagem falhar?**
A operação falha **sem efeitos colaterais**, e o usuário recebe um erro claro:
- **415:** não é JPEG, PNG nem WebP. O formato é conferido pelos bytes do arquivo, não pelo nome.
- **413:** acima de 15 MB.
- **422:** a imagem está corrompida e o Sharp não conseguiu processar.

Nada é gravado e a foto anterior continua valendo. Se o arquivo novo foi salvo mas o banco falhou, o arquivo é apagado para não ficar órfão. Quando a foto é a ação secundária, como no cadastro de prato ou restaurante com foto, o cadastro principal é mantido e a interface avisa que a foto não foi enviada.

**Nossa arquitetura atual permite adicionar novas funcionalidades sem modificar toda a aplicação?**
Sim. Esta atividade é o exemplo:
- O upload de imagem de prato e de perfil entrou como peças novas (`shared/images/`, rotas `/dishes` e `/auth/me/image`, migration `006`).
- Os módulos de pedidos, restaurantes e autenticação continuaram com as mesmas regras.
- Os 58 testes que já existiam continuaram passando; os da foto do restaurante só trocaram o formato de envio para multipart (Multer). Com os novos, são 73.

O que mudou em código existente foi pontual: o `app.js` conecta as peças novas, e os repositories ganharam as colunas de imagem. A camada de repositories também permite trocar o storage ou o banco sem tocar nos services.
