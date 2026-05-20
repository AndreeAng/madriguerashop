"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DashboardCopy } from "./copy";

/**
 * Context para que client components dentro de `/dashboard/*` accedan al
 * copy resuelto por la vertical de la tienda actual.
 *
 * Por qué un Context y no props en cada componente:
 *   - `LiveOrderBadge`, `DashboardHeader`, `Pagination`, y otros widgets
 *     viven en 14+ pages distintas. Pasar `vertical` por prop en todas
 *     duplica boilerplate y olvidos rompen la consistencia (un widget
 *     muestra "Pedidos" otro "Solicitudes" en la misma tienda).
 *   - El layout server-side ya resuelve el copy una vez por request;
 *     el provider lo propaga al árbol client.
 *
 * Por qué un default seguro en lugar de throw:
 *   - Permite usar el hook desde lugares fuera del dashboard layout
 *     (ej. tests, Storybook) sin crash. Cae al copy genérico ("pedido"/
 *     "pedidos") que es lo que esperarían sin tienda específica.
 */

const DEFAULT_COPY: DashboardCopy = {
  productsLabel: "Productos",
  productSingular: "producto",
  ordersLabel: "Pedidos",
  orderSingular: "pedido",
};

const DashboardCopyContext = createContext<DashboardCopy>(DEFAULT_COPY);

export function DashboardCopyProvider({
  copy,
  children,
}: {
  copy: DashboardCopy;
  children: ReactNode;
}) {
  return (
    <DashboardCopyContext.Provider value={copy}>
      {children}
    </DashboardCopyContext.Provider>
  );
}

export function useDashboardCopy(): DashboardCopy {
  return useContext(DashboardCopyContext);
}
