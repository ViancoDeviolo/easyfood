-- ============================================================================
-- 006 - Foto de perfil do usuário e foto/categoria do prato (atividade pós-Aula 8)
-- Guardamos o CAMINHO público da imagem otimizada (ex.: /images/users/<uuid>.webp).
-- O arquivo em si fica no storage; o banco só aponta para ele.
-- ============================================================================

ALTER TABLE users ADD (
    image_url  VARCHAR2(200 CHAR)
)
/

ALTER TABLE menu_items ADD (
    image_url  VARCHAR2(200 CHAR),
    category   VARCHAR2(100 CHAR)
)
/
