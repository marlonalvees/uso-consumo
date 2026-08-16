-- Cria o schema de negócio da aplicação, isolado do schema "public" do hub.
CREATE SCHEMA IF NOT EXISTS "uso_consumo";

-- CreateEnum
CREATE TYPE "uso_consumo"."order_status" AS ENUM ('PENDENTE', 'EM_SEPARACAO', 'AGUARDANDO_ENVIO', 'ENVIADO', 'ENTREGUE');

-- CreateEnum
CREATE TYPE "uso_consumo"."item_category" AS ENUM ('PAPELARIA', 'LIMPEZA');

-- CreateTable
CREATE TABLE "uso_consumo"."item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "category" "uso_consumo"."item_category" NOT NULL DEFAULT 'LIMPEZA',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uso_consumo"."order" (
    "id" TEXT NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "user_hub_id" INTEGER NOT NULL,
    "status" "uso_consumo"."order_status" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uso_consumo"."order_item" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uso_consumo"."order_extra_item" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_extra_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_name_key" ON "uso_consumo"."item"("name");

-- AddForeignKey (referência somente-leitura à tabela do hub em public.branchs)
ALTER TABLE "uso_consumo"."order" ADD CONSTRAINT "order_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branchs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (referência somente-leitura à tabela do hub em public.users — quem solicitou o pedido)
ALTER TABLE "uso_consumo"."order" ADD CONSTRAINT "order_user_hub_id_fkey" FOREIGN KEY ("user_hub_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_consumo"."order_item" ADD CONSTRAINT "order_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "uso_consumo"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_consumo"."order_item" ADD CONSTRAINT "order_item_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "uso_consumo"."item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_consumo"."order_extra_item" ADD CONSTRAINT "order_extra_item_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "uso_consumo"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
