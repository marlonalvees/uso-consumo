-- ============================================================================
-- 1. Simplifica o pipeline de status do pedido de 5 para 4 estágios:
--    PENDENTE -> RECEBIDO, EM_SEPARACAO -> EM_ANDAMENTO (absorve AGUARDANDO_ENVIO)
-- ============================================================================

-- Remapeia pedidos que estavam em AGUARDANDO_ENVIO para EM_SEPARACAO antes de
-- remover esse valor do enum (nenhum dado é perdido, só o rótulo do estágio).
UPDATE "uso_consumo"."order" SET "status" = 'EM_SEPARACAO' WHERE "status" = 'AGUARDANDO_ENVIO';

ALTER TYPE "uso_consumo"."order_status" RENAME VALUE 'PENDENTE' TO 'RECEBIDO';
ALTER TYPE "uso_consumo"."order_status" RENAME VALUE 'EM_SEPARACAO' TO 'EM_ANDAMENTO';

-- Postgres não tem "DROP VALUE" pra enum — recria o tipo sem AGUARDANDO_ENVIO.
CREATE TYPE "uso_consumo"."order_status_new" AS ENUM ('RECEBIDO', 'EM_ANDAMENTO', 'ENVIADO', 'ENTREGUE');
ALTER TABLE "uso_consumo"."order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "uso_consumo"."order" ALTER COLUMN "status" TYPE "uso_consumo"."order_status_new"
  USING ("status"::text::"uso_consumo"."order_status_new");
ALTER TABLE "uso_consumo"."order" ALTER COLUMN "status" SET DEFAULT 'RECEBIDO';
DROP TYPE "uso_consumo"."order_status";
ALTER TYPE "uso_consumo"."order_status_new" RENAME TO "order_status";

-- ============================================================================
-- 2. Rastreia quantidade pedida (original) x quantidade que será enviada,
--    já que nem sempre o estoque cobre a quantidade pedida.
-- ============================================================================

ALTER TABLE "uso_consumo"."order_item" ADD COLUMN "requested_quantity" INTEGER;
UPDATE "uso_consumo"."order_item" SET "requested_quantity" = "quantity";
ALTER TABLE "uso_consumo"."order_item" ALTER COLUMN "requested_quantity" SET NOT NULL;

ALTER TABLE "uso_consumo"."order_extra_item" ADD COLUMN "requested_quantity" INTEGER;
UPDATE "uso_consumo"."order_extra_item" SET "requested_quantity" = "quantity";
ALTER TABLE "uso_consumo"."order_extra_item" ALTER COLUMN "requested_quantity" SET NOT NULL;

-- ============================================================================
-- 3. Categoria de produto vira cadastro (tabela) em vez de enum fixo.
-- ============================================================================

ALTER TABLE "uso_consumo"."item" ADD COLUMN "category_id" TEXT;

CREATE TABLE "uso_consumo"."item_category_tmp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "item_category_tmp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "item_category_tmp_name_key" ON "uso_consumo"."item_category_tmp"("name");

INSERT INTO "uso_consumo"."item_category_tmp" ("id", "name") VALUES
  ('papelaria', 'Papelaria'),
  ('limpeza', 'Limpeza');

UPDATE "uso_consumo"."item" SET "category_id" = 'papelaria' WHERE "category" = 'PAPELARIA';
UPDATE "uso_consumo"."item" SET "category_id" = 'limpeza' WHERE "category" = 'LIMPEZA';

ALTER TABLE "uso_consumo"."item" ALTER COLUMN "category_id" SET NOT NULL;
ALTER TABLE "uso_consumo"."item" DROP COLUMN "category";
DROP TYPE "uso_consumo"."item_category";

ALTER TABLE "uso_consumo"."item_category_tmp" RENAME TO "item_category";
ALTER TABLE "uso_consumo"."item_category" RENAME CONSTRAINT "item_category_tmp_pkey" TO "item_category_pkey";
ALTER INDEX "uso_consumo"."item_category_tmp_name_key" RENAME TO "item_category_name_key";

ALTER TABLE "uso_consumo"."item" ADD CONSTRAINT "item_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "uso_consumo"."item_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 4. Fornecedores.
-- ============================================================================

CREATE TABLE "uso_consumo"."supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_name_key" ON "uso_consumo"."supplier"("name");

-- ============================================================================
-- 5. Estoque: fornecedor padrão + níveis de estoque no produto.
-- ============================================================================

ALTER TABLE "uso_consumo"."item" ADD COLUMN "supplier_id" TEXT;
ALTER TABLE "uso_consumo"."item" ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "uso_consumo"."item" ADD COLUMN "min_stock" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "uso_consumo"."item" ADD COLUMN "target_stock" INTEGER;

ALTER TABLE "uso_consumo"."item" ADD CONSTRAINT "item_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "uso_consumo"."supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 6. Compras (entrada de estoque).
-- ============================================================================

CREATE TABLE "uso_consumo"."purchase" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uso_consumo"."purchase_item" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DOUBLE PRECISION,

    CONSTRAINT "purchase_item_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "uso_consumo"."purchase" ADD CONSTRAINT "purchase_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "uso_consumo"."supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "uso_consumo"."purchase_item" ADD CONSTRAINT "purchase_item_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "uso_consumo"."purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "uso_consumo"."purchase_item" ADD CONSTRAINT "purchase_item_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "uso_consumo"."item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 7. Movimentação de estoque (entrada por compra, saída ao marcar pedido como
--    Enviado) — histórico auditável por trás do stock_quantity em "item".
-- ============================================================================

CREATE TYPE "uso_consumo"."stock_movement_type" AS ENUM ('ENTRADA', 'SAIDA');

CREATE TABLE "uso_consumo"."stock_movement" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "type" "uso_consumo"."stock_movement_type" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "purchase_id" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "uso_consumo"."stock_movement" ADD CONSTRAINT "stock_movement_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "uso_consumo"."item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "uso_consumo"."stock_movement" ADD CONSTRAINT "stock_movement_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "uso_consumo"."purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "uso_consumo"."stock_movement" ADD CONSTRAINT "stock_movement_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "uso_consumo"."order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
