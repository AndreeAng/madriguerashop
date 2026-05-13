-- DropForeignKey (drift cleanup — uses IF EXISTS so fresh DBs without
-- this FK don't fail to migrate)
ALTER TABLE "StoreOrderCounter" DROP CONSTRAINT IF EXISTS "StoreOrderCounter_storeId_fkey";

-- DropIndex (drift cleanup)
DROP INDEX IF EXISTS "Order_couponId_idx";

-- DropIndex (drift cleanup)
DROP INDEX IF EXISTS "PageView_visitorToken_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE INDEX "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt");
