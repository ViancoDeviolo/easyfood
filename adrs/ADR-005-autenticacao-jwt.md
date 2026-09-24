# ADR-005 — Autenticação com JWT próprio

| Campo | Valor |
|---|---|
| **Status** | Aceita |
| **Data** | 24/09/2026 |
| **Responsável** | Lucas (EasyFood) |

## Contexto

Qualquer pessoa conseguia cadastrar restaurantes. Com pedidos e cardápio, passamos a precisar saber **quem** faz cada ação:
só o dono altera o próprio restaurante e cardápio; só o cliente e o dono do restaurante veem um pedido.

## Alternativas consideradas

1. **JWT emitido pela própria API** (`jsonwebtoken` + senha com `bcryptjs`)
2. AWS Cognito (provedor de identidade gerenciado)
3. Login com Google (OAuth 2.0 / OpenID Connect)
4. Sessão em servidor com cookie

## Decisão

Emitir **JWT próprio** no módulo `auth`:
- `POST /auth/register` guarda a senha como hash bcrypt (nunca em texto puro, nunca devolvida na resposta).
- `POST /auth/login` confere a senha e devolve um token assinado (HS256) com `sub` = id do usuário e validade configurável (`JWT_EXPIRES_IN`, padrão 1 dia).
- O middleware `authenticate` valida `Authorization: Bearer <token>` e disponibiliza `req.user`.
- Regras de autorização (dono do restaurante, cliente do pedido) ficam nos **services**.

## Justificativa

- Sem dependência externa nem custo; funciona igual em desenvolvimento, testes e produção.
- Stateless: a API não guarda sessão, o que combina com múltiplas instâncias.
- Cognito e Google resolvem bem identidade em escala, mas adicionam configuração de nuvem e um provedor externo sem necessidade no momento.

## Consequências

**Positivas**
- Controle total do fluxo; fácil de testar.
- Login com e-mail inexistente e com senha errada respondem igual (`401 Credenciais inválidas`) e levam o mesmo tempo, sem revelar quais e-mails existem.

**Negativas / trade-offs**
- Somos responsáveis pela segurança: guardar bem o `JWT_SECRET`, usar HTTPS em produção.
- Não há revogação de token antes de expirar (logout apenas descarta o token no cliente).
- Não há recuperação de senha, MFA ou login social.

## Critérios de revisão

Reavaliar (considerar Cognito ou login social) se surgirem requisitos de MFA, recuperação de senha, login social ou revogação imediata de sessões.
