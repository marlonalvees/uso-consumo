-- ============================================================================
-- 1. Embalagem vira cadastro (tabela) em vez de texto livre em "item.unit".
--    Agrupa valores existentes ignorando maiúsculas/espaços (o texto livre
--    tinha variação de digitação, ex: "UNIDADE" e "unidade").
-- ============================================================================

ALTER TABLE "uso_consumo"."item" ADD COLUMN "packaging_id" TEXT;

CREATE TABLE "uso_consumo"."packaging" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "packaging_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "packaging_name_key" ON "uso_consumo"."packaging"("name");

INSERT INTO "uso_consumo"."packaging" ("id", "name")
SELECT gen_random_uuid()::text, INITCAP(MIN(TRIM("unit")))
FROM "uso_consumo"."item"
GROUP BY LOWER(TRIM("unit"));

-- Garante "Saco" como opção mesmo que nenhum produto use hoje.
INSERT INTO "uso_consumo"."packaging" ("id", "name")
VALUES (gen_random_uuid()::text, 'Saco')
ON CONFLICT ("name") DO NOTHING;

UPDATE "uso_consumo"."item" i
SET "packaging_id" = p."id"
FROM "uso_consumo"."packaging" p
WHERE LOWER(TRIM(i."unit")) = LOWER(p."name");

ALTER TABLE "uso_consumo"."item" ALTER COLUMN "packaging_id" SET NOT NULL;
ALTER TABLE "uso_consumo"."item" DROP COLUMN "unit";

ALTER TABLE "uso_consumo"."item" ADD CONSTRAINT "item_packaging_id_fkey"
  FOREIGN KEY ("packaging_id") REFERENCES "uso_consumo"."packaging"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 2. CNPJ do fornecedor.
-- ============================================================================

ALTER TABLE "uso_consumo"."supplier" ADD COLUMN "cnpj" TEXT;
CREATE UNIQUE INDEX "supplier_cnpj_key" ON "uso_consumo"."supplier"("cnpj");
