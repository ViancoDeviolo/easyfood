-- ============================================================================
-- Criação manual do usuário/schema EASYFOOD.
-- Só é necessário se você NÃO usar o docker-compose (a imagem Docker já cria o usuário
-- a partir de APP_USER / APP_USER_PASSWORD).
--
-- Rode conectado como SYSTEM (ou outro usuário administrador) no PDB, por exemplo:
--   sql system/SUA_SENHA@localhost:1521/FREEPDB1 @database/setup/create-user.sql
-- ============================================================================

CREATE USER easyfood IDENTIFIED BY "EasyFood_2026"
  DEFAULT TABLESPACE users
  QUOTA UNLIMITED ON users;

GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO easyfood;
