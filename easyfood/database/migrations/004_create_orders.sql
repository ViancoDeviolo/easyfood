-- ============================================================================
-- 004 - Pedidos e itens do pedido
-- O pedido guarda uma "foto" do nome e do preço de cada item no momento da compra,
-- para que alterações futuras no cardápio não mudem pedidos antigos.
-- ============================================================================

CREATE TABLE orders (
    id                NUMBER GENERATED ALWAYS AS IDENTITY,
    customer_id       NUMBER                                    NOT NULL,
    restaurant_id     NUMBER                                    NOT NULL,
    status            VARCHAR2(20 CHAR) DEFAULT 'PENDENTE'      NOT NULL,
    delivery_address  VARCHAR2(300 CHAR)                        NOT NULL,
    notes             VARCHAR2(300 CHAR),
    subtotal          NUMBER(10,2)                              NOT NULL,
    delivery_fee      NUMBER(8,2)  DEFAULT 0                    NOT NULL,
    total             NUMBER(10,2)                              NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_orders PRIMARY KEY (id),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES users (id),
    CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
    CONSTRAINT ck_orders_status CHECK (
        status IN ('PENDENTE', 'CONFIRMADO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO')
    ),
    CONSTRAINT ck_orders_total CHECK (total = subtotal + delivery_fee)
)
/

CREATE INDEX ix_orders_customer ON orders (customer_id, created_at)
/

CREATE INDEX ix_orders_restaurant ON orders (restaurant_id, status)
/

CREATE TABLE order_items (
    id             NUMBER GENERATED ALWAYS AS IDENTITY,
    order_id       NUMBER                NOT NULL,
    menu_item_id   NUMBER                NOT NULL,
    item_name      VARCHAR2(150 CHAR)    NOT NULL,
    quantity       NUMBER(3)             NOT NULL,
    unit_price     NUMBER(10,2)          NOT NULL,
    CONSTRAINT pk_order_items PRIMARY KEY (id),
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items (id),
    CONSTRAINT ck_order_items_quantity CHECK (quantity BETWEEN 1 AND 99),
    CONSTRAINT ck_order_items_price CHECK (unit_price > 0)
)
/

CREATE INDEX ix_order_items_order ON order_items (order_id)
/

CREATE INDEX ix_order_items_menu_item ON order_items (menu_item_id)
/
