-- ============================================================================
-- 005 - Foto de perfil do restaurante (Aula 8)
-- O arquivo fica no storage; o banco guarda só o identificador e o status do processamento.
--   NENHUMA     -> restaurante sem foto
--   PROCESSANDO -> original recebido, função serverless ainda otimizando
--   PRONTA      -> versão otimizada disponível
--   ERRO        -> a função não conseguiu processar o arquivo
-- ============================================================================

ALTER TABLE restaurants ADD (
    image_id          VARCHAR2(36 CHAR),
    image_status      VARCHAR2(20 CHAR) DEFAULT 'NENHUMA' NOT NULL,
    image_updated_at  TIMESTAMP WITH TIME ZONE
)
/

ALTER TABLE restaurants ADD CONSTRAINT ck_restaurants_image_status
    CHECK (image_status IN ('NENHUMA', 'PROCESSANDO', 'PRONTA', 'ERRO'))
/

-- A função atualiza o status procurando pelo image_id
CREATE INDEX ix_restaurants_image ON restaurants (image_id)
/
