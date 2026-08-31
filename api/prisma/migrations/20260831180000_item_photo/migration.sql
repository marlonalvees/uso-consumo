-- Caminho relativo da foto do produto (ex: "produtos/<uuid>.jpg"), servido
-- estaticamente em /api/uploads/<photo_path>. Arquivo físico fica fora do
-- schema.prisma, em api/src/uploads (com volume dedicado no Docker).
ALTER TABLE "uso_consumo"."item" ADD COLUMN "photo_path" TEXT;
