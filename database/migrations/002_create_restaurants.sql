-- ============================================================================
-- 002 - Restaurantes
-- Cada restaurante pertence a um usuário (owner), que é o único que pode alterá-lo.
-- ============================================================================

CREATE TABLE restaurants (
    id             NUMBER GENERATED ALWAYS AS IDENTITY,
    owner_id       NUMBER                                    NOT NULL,
    name           VARCHAR2(150 CHAR)                        NOT NULL,
    category       VARCHAR2(100 CHAR)                        NOT NULL,
    description    VARCHAR2(500 CHAR),
    rating         NUMBER(2,1)  DEFAULT 0                    NOT NULL,
    delivery_fee   NUMBER(8,2)  DEFAULT 0                    NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_restaurants PRIMARY KEY (id),
    CONSTRAINT fk_restaurants_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT ck_restaurants_rating CHECK (rating BETWEEN 0 AND 5),
    CONSTRAINT ck_restaurants_fee CHECK (delivery_fee >= 0)
)
/

CREATE INDEX ix_restaurants_owner ON restaurants (owner_id)
/

-- Índice baseado em função: acelera o filtro por categoria sem diferenciar maiúsculas
CREATE INDEX ix_restaurants_category ON restaurants (UPPER(category))
/
