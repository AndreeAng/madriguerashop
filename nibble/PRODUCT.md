# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary on the storefront: the end customer of a Bolivian shop, buying from a phone. Decisions on the storefront favor this buyer first; the merchant benefits through conversion.

Secondary: the shop owner, who runs catalog, orders, delivery and billing from the dashboard.

## Product Purpose

Madriguera Shop is a multi-tenant SaaS that gives Bolivian businesses their own online store. Customers pay by bank QR or cash on delivery, orders reach the shop through WhatsApp, and the owner operates everything from one panel. Built by Nibble S.R.L., Cochabamba.

## Positioning

Online selling shaped around how Bolivian shops already work: bank QR with proof upload and WhatsApp order confirmation, instead of card checkouts.

## Operating Context

- Mobile-first purchase path: product → add to cart → checkout (delivery or pickup, ASAP or scheduled) → WhatsApp confirmation → order tracking page.
- Stores span verticals (food, hardware, services, retail), so storefront copy must follow the store's vertical through `storefrontCopy`.
- Currency is bolivianos; the interface is in Spanish.

## Capabilities and Constraints

- A shop can enable delivery, pickup or both, and QR, cash or both. The interface must reflect what the shop has enabled.
- Stores can be closed by schedule; closed stores still take scheduled orders.
- Paying by QR happens before confirming, so the amount shown must match the final total and a proof of payment is tied to that amount.

## Evidence on Hand

Seeded demo stores only (`prisma/seed.ts`). No verified response times, delivery guarantees or customer ratings exist per merchant; do not state them.

## Product Principles

1. The buyer on a phone comes first on the storefront.
2. Never lose what a customer typed, or charge an amount they did not see.
3. Only state what the shop's real configuration can back up.
4. Each store adapts to its vertical; food language is not the default.
