-- ============================================================================
-- 003 - Cardápio (itens de cada restaurante)
-- Ao remover um restaurante sem pedidos, seus itens são removidos junto (ON DELETE CASCADE).
-- ============================================================================

CREATE TABLE menu_items (
    id             NUMBER GENERATED ALWAYS AS IDENTITY,
    restaurant_id  NUMBER                                    NOT NULL,
    name           VARCHAR2(150 CHAR)                        NOT NULL,
    description    VARCHAR2(500 CHAR),
    price          NUMBER(10,2)                              NOT NULL,
    available      NUMBER(1)    DEFAULT 1                    NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_menu_items PRIMARY KEY (id),
    CONSTRAINT fk_menu_items_restaurant FOREIGN KEY (restaurant_id)
        REFERENCES restaurants (id) ON DELETE CASCADE,
    CONSTRAINT uk_menu_items_rest_name UNIQUE (restaurant_id, name),
    CONSTRAINT ck_menu_items_price CHECK (price > 0),
    CONSTRAINT ck_menu_items_available CHECK (available IN (0, 1))
)
/
