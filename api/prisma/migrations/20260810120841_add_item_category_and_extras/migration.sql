-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('PAPELARIA', 'LIMPEZA');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "category" "ItemCategory" NOT NULL DEFAULT 'LIMPEZA';

-- CreateTable
CREATE TABLE "OrderExtraItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderExtraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- AddForeignKey
ALTER TABLE "OrderExtraItem" ADD CONSTRAINT "OrderExtraItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

