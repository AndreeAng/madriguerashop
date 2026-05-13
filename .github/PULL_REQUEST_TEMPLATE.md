<!--
Gracias por contribuir a Madriguera Shop. Completá las secciones que apliquen
y borrá las que no. El objetivo de este template es que un reviewer pueda
entender qué cambia, por qué, y cómo verificarlo — sin tener que adivinar.
-->

## Qué cambia

<!-- 1-3 líneas. ¿Qué hace esto? Si arregla un bug, mencionar el comportamiento
viejo y el nuevo. Si agrega una feature, mencionar a quién impacta. -->

## Por qué

<!-- Contexto. Link a issue/discusión si existe. Si es un bug, qué causa lo
disparó (incidente, queja de cliente, hallazgo de auditoría, etc.). -->

## Test plan

<!-- Cómo probaste que esto funciona. Pasos concretos para que el reviewer
reproduzca. Adjuntá screenshots/videos si tocás UI. -->

- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run test` pasa
- [ ] (Si tocás UI) probé en mobile + desktop
- [ ] (Si tocás schema) generé migration y la corrí contra DB local
- [ ] (Si tocás auth/billing/siat) probé el happy path E2E

## Áreas de riesgo

<!-- ¿Qué podría romper? ¿Hay un rollback obvio? ¿Necesita feature flag? -->

## Migrations

<!-- Si tocás `prisma/schema.prisma`: -->

- [ ] No aplica (solo código)
- [ ] Migration agregada: `prisma/migrations/<timestamp>_<name>/migration.sql`
- [ ] Migration es idempotente (puede aplicarse y desaplicarse sin pérdida)
- [ ] Backfill necesario: documentado en el SQL

## Env vars / secrets

<!-- Si agregás env vars nuevas: -->

- [ ] No aplica
- [ ] Documentadas en `.env.example`
- [ ] Setear en hosts (Vercel/VPS) ANTES de mergear

## Breaking changes

<!-- Cualquier cambio que rompa un contrato existente (API, schema, env, UX): -->

- [ ] No
- [ ] Sí — documentado en CHANGELOG o release notes

---

🤖 _Si este PR fue generado/asistido por una herramienta IA, mencionarlo acá._
