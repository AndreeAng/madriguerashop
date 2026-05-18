-- AlterTable
-- Pedido programado: el cliente eligió día/hora futura para entrega o
-- recojo. Nullable para que pedidos existentes mantengan "lo antes posible".
ALTER TABLE "Order" ADD COLUMN "scheduledFor" TIMESTAMP(3);
