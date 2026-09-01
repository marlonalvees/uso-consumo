-- Caminho relativo da foto da nota fiscal da compra (ex: "notas-fiscais/<uuid>.jpg"),
-- servido estaticamente em /api/uploads/<invoice_path>. Arquivo físico fica fora do
-- schema.prisma, em api/src/uploads (com volume dedicado no Docker).
ALTER TABLE "uso_consumo"."purchase" ADD COLUMN "invoice_path" TEXT;
