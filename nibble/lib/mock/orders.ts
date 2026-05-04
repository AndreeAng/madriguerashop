export type OrderStatus =
  | "PENDING_PAYMENT"
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "IN_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type MockOrder = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  itemsSummary: string;
  paymentMethod: "QR_STATIC" | "CASH_ON_DELIVERY";
  zone?: string;
};

export const orders: MockOrder[] = [
  {
    id: "ord_001",
    number: 1247,
    customerName: "Carla Mendoza",
    customerPhone: "+59171234567",
    total: 145,
    status: "NEW",
    createdAt: "hace 2 min",
    itemsSummary: "1× Combo Familiar + 1× Limonada Jengibre",
    paymentMethod: "QR_STATIC",
    zone: "Cala Cala",
  },
  {
    id: "ord_002",
    number: 1246,
    customerName: "José Linares",
    customerPhone: "+59172345678",
    total: 78,
    status: "CONFIRMED",
    createdAt: "hace 8 min",
    itemsSummary: "1× Wings Clásicos BBQ + 1× Cheese Fries",
    paymentMethod: "CASH_ON_DELIVERY",
    zone: "Tupuraya",
  },
  {
    id: "ord_003",
    number: 1245,
    customerName: "Ana Vargas",
    customerPhone: "+59173456789",
    total: 96,
    status: "PREPARING",
    createdAt: "hace 18 min",
    itemsSummary: "2× Buffalo Hot + 2× Limonada Jengibre",
    paymentMethod: "QR_STATIC",
    zone: "Queru Queru",
  },
  {
    id: "ord_004",
    number: 1244,
    customerName: "Daniel Pacheco",
    customerPhone: "+59174567890",
    total: 175,
    status: "IN_DELIVERY",
    createdAt: "hace 32 min",
    itemsSummary: "1× Combo Familiar + 1× Nuggets x12",
    paymentMethod: "QR_STATIC",
    zone: "Sarco",
  },
  {
    id: "ord_005",
    number: 1243,
    customerName: "Luciana Rocha",
    customerPhone: "+59175678901",
    total: 64,
    status: "DELIVERED",
    createdAt: "hace 1h",
    itemsSummary: "1× Wings Honey Mustard + 1× Cheese Fries",
    paymentMethod: "CASH_ON_DELIVERY",
    zone: "El Prado",
  },
  {
    id: "ord_006",
    number: 1242,
    customerName: "Mateo Quispe",
    customerPhone: "+59176789012",
    total: 110,
    status: "PENDING_PAYMENT",
    createdAt: "hace 1h",
    itemsSummary: "2× Wings Clásicos + 1× Nuggets x12",
    paymentMethod: "QR_STATIC",
    zone: "América Oeste",
  },
];

export function getOrder(id: string): MockOrder | undefined {
  return orders.find((o) => o.id === id);
}
