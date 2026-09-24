-- ============================================================================
-- 001 - Usuários da plataforma (clientes e donos de restaurante)
-- Convenção dos scripts: um comando por bloco, terminado por uma linha com "/".
-- Os arquivos rodam pelo "npm run db:migrate" e também no SQL*Plus / SQLcl / SQL Developer.
-- ============================================================================

CREATE TABLE users (
    id             NUMBER GENERATED ALWAYS AS IDENTITY,
    name           VARCHAR2(150 CHAR)                        NOT NULL,
    email          VARCHAR2(150 CHAR)                        NOT NULL,
    password_hash  VARCHAR2(255 CHAR)                        NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
)
/

COMMENT ON TABLE users IS 'Usuários da EasyFood. A senha é armazenada apenas como hash bcrypt.'
/
