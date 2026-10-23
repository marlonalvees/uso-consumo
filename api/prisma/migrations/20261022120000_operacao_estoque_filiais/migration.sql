-- ============================================================================
-- 1. Pedido: cancelamento, observações, datas de cada etapa e recebimento
--    com divergência (item a item).
-- ============================================================================

ALTER TYPE "uso_consumo"."order_status" ADD VALUE 'CANCELADO';

CREATE TYPE "uso_consumo"."receipt_issue" AS ENUM ('FALTOU', 'AVARIADO');

ALTER TABLE "uso_consumo"."order" ADD COLUMN     "admin_notes" TEXT,
ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "receipt_notes" TEXT,
ADD COLUMN     "receipt_photo_path" TEXT,
ADD COLUMN     "sent_at" TIMESTAMP(3),
ADD COLUMN     "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "uso_consumo"."order_item" ADD COLUMN     "adjust_reason" TEXT,
ADD COLUMN     "pending_resolved_at" TIMESTAMP(3),
ADD COLUMN     "receipt_issue" "uso_consumo"."receipt_issue",
ADD COLUMN     "received_quantity" INTEGER,
ADD COLUMN     "unit_cost" DOUBLE PRECISION;

ALTER TABLE "uso_consumo"."order_extra_item" ADD COLUMN     "adjust_reason" TEXT,
ADD COLUMN     "receipt_issue" "uso_consumo"."receipt_issue",
ADD COLUMN     "received_quantity" INTEGER;

ALTER TABLE "uso_consumo"."order" ADD CONSTRAINT "order_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "order_branch_id_status_idx" ON "uso_consumo"."order"("branch_id", "status");
CREATE INDEX "order_updated_at_idx" ON "uso_consumo"."order"("updated_at");

-- Pedidos antigos: a data de envio vem da baixa de estoque (primeira saída do
-- pedido); sem baixa (só itens extras), fica a última atualização.
UPDATE "uso_consumo"."order" o
SET "sent_at" = sm."first_out"
FROM (
  SELECT "order_id", MIN("created_at") AS "first_out"
  FROM "uso_consumo"."stock_movement"
  WHERE "type" = 'SAIDA' AND "order_id" IS NOT NULL
  GROUP BY "order_id"
) sm
WHERE sm."order_id" = o."id" AND o."status" IN ('ENVIADO', 'ENTREGUE');

UPDATE "uso_consumo"."order"
SET "sent_at" = "updated_at"
WHERE "sent_at" IS NULL AND "status" IN ('ENVIADO', 'ENTREGUE');

UPDATE "uso_consumo"."order" SET "status_changed_at" = COALESCE("delivered_at", "sent_at", "updated_at");

-- Custo dos pedidos já enviados = preço atual do produto (não há histórico melhor).
UPDATE "uso_consumo"."order_item" oi
SET "unit_cost" = i."price"
FROM "uso_consumo"."item" i, "uso_consumo"."order" o
WHERE oi."item_id" = i."id" AND oi."order_id" = o."id" AND o."status" IN ('ENVIADO', 'ENTREGUE');

-- Pedidos já entregues foram confirmados por inteiro.
UPDATE "uso_consumo"."order_item" oi
SET "received_quantity" = oi."quantity"
FROM "uso_consumo"."order" o
WHERE oi."order_id" = o."id" AND o."status" = 'ENTREGUE';

UPDATE "uso_consumo"."order_extra_item" oe
SET "received_quantity" = oe."quantity"
FROM "uso_consumo"."order" o
WHERE oe."order_id" = o."id" AND o."status" = 'ENTREGUE';

-- ============================================================================
-- 2. Histórico do pedido (quem fez o quê e quando).
-- ============================================================================

CREATE TYPE "uso_consumo"."order_event_type" AS ENUM ('CRIADO', 'EDITADO', 'STATUS', 'ITENS_AJUSTADOS', 'CANCELADO', 'RECEBIDO');

CREATE TABLE "uso_consumo"."order_event" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "type" "uso_consumo"."order_event_type" NOT NULL,
    "from_status" "uso_consumo"."order_status",
    "to_status" "uso_consumo"."order_status",
    "user_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_event_order_id_created_at_idx" ON "uso_consumo"."order_event"("order_id", "created_at");

ALTER TABLE "uso_consumo"."order_event" ADD CONSTRAINT "order_event_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "uso_consumo"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uso_consumo"."order_event" ADD CONSTRAINT "order_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Linha do tempo mínima dos pedidos antigos: criação, envio e entrega.
INSERT INTO "uso_consumo"."order_event" ("id", "order_id", "type", "to_status", "user_id", "created_at")
SELECT gen_random_uuid()::text, "id", 'CRIADO', 'RECEBIDO', "user_hub_id", "created_at"
FROM "uso_consumo"."order";

INSERT INTO "uso_consumo"."order_event" ("id", "order_id", "type", "from_status", "to_status", "created_at")
SELECT gen_random_uuid()::text, "id", 'STATUS', 'EM_ANDAMENTO', 'ENVIADO', "sent_at"
FROM "uso_consumo"."order"
WHERE "sent_at" IS NOT NULL;

INSERT INTO "uso_consumo"."order_event" ("id", "order_id", "type", "from_status", "to_status", "created_at")
SELECT gen_random_uuid()::text, "id", 'RECEBIDO', 'ENVIADO', 'ENTREGUE', "delivered_at"
FROM "uso_consumo"."order"
WHERE "status" = 'ENTREGUE' AND "delivered_at" IS NOT NULL;

-- ============================================================================
-- 3. Compras viram pedidos de compra (PEDIDO -> RECEBIDO), com quem fez.
--    As compras antigas já tinham dado entrada no estoque: ficam RECEBIDO.
-- ============================================================================

CREATE TYPE "uso_consumo"."purchase_status" AS ENUM ('PEDIDO', 'RECEBIDO', 'CANCELADO');

ALTER TABLE "uso_consumo"."purchase" ADD COLUMN     "created_by_id" INTEGER,
ADD COLUMN     "received_at" TIMESTAMP(3),
ADD COLUMN     "received_by_id" INTEGER,
ADD COLUMN     "status" "uso_consumo"."purchase_status" NOT NULL DEFAULT 'RECEBIDO';

ALTER TABLE "uso_consumo"."purchase_item" ADD COLUMN     "received_quantity" INTEGER;

UPDATE "uso_consumo"."purchase" SET "received_at" = "created_at";
UPDATE "uso_consumo"."purchase_item" SET "received_quantity" = "quantity";

CREATE INDEX "purchase_status_created_at_idx" ON "uso_consumo"."purchase"("status", "created_at");

ALTER TABLE "uso_consumo"."purchase" ADD CONSTRAINT "purchase_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "uso_consumo"."purchase" ADD CONSTRAINT "purchase_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 4. Estoque: quem fez cada movimentação, data da última contagem do produto
--    e prazo de entrega do fornecedor (pra sugerir o mínimo pelo consumo).
-- ============================================================================

ALTER TABLE "uso_consumo"."stock_movement" ADD COLUMN     "created_by_id" INTEGER;
ALTER TABLE "uso_consumo"."item" ADD COLUMN     "last_counted_at" TIMESTAMP(3);
ALTER TABLE "uso_consumo"."supplier" ADD COLUMN     "lead_time_days" INTEGER;

CREATE INDEX "stock_movement_item_id_created_at_idx" ON "uso_consumo"."stock_movement"("item_id", "created_at");
CREATE INDEX "stock_movement_created_at_idx" ON "uso_consumo"."stock_movement"("created_at");

ALTER TABLE "uso_consumo"."stock_movement" ADD CONSTRAINT "stock_movement_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 5. Filiais: estoque ideal por produto e cota mensal (informativa).
-- ============================================================================

CREATE TABLE "uso_consumo"."branch_item_par" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "branch_item_par_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branch_item_par_branch_id_item_id_key" ON "uso_consumo"."branch_item_par"("branch_id", "item_id");

ALTER TABLE "uso_consumo"."branch_item_par" ADD CONSTRAINT "branch_item_par_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uso_consumo"."branch_item_par" ADD CONSTRAINT "branch_item_par_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "uso_consumo"."item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "uso_consumo"."branch_budget" (
    "branch_id" INTEGER NOT NULL,
    "monthly_amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "branch_budget_pkey" PRIMARY KEY ("branch_id")
);

ALTER TABLE "uso_consumo"."branch_budget" ADD CONSTRAINT "branch_budget_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branchs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 6. Aparelhos inscritos pra receber notificações push (app instalado).
-- ============================================================================

CREATE TABLE "uso_consumo"."push_subscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "branch_ids" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "uso_consumo"."push_subscription"("endpoint");
