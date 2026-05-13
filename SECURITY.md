# Política de seguridad

## Cómo reportar una vulnerabilidad

Si encontrás una vulnerabilidad de seguridad en Madriguera Shop:

**NO abras un issue público.**

En su lugar:

1. **Preferida:** Usá el [security advisory privado de GitHub](https://github.com/AndreeAng/tienda/security/advisories/new).
2. **Alternativa:** Envía un mail a `security@madrigueras.shop` con:
   - Descripción del problema.
   - Pasos para reproducir.
   - Impacto estimado (qué se podría hacer si un atacante lo explota).
   - Tu nombre / handle para reconocimiento, si querés.

Nos comprometemos a:

- Acusar recibo en **72 horas hábiles**.
- Dar un diagnóstico inicial en **5 días hábiles**.
- Coordinar disclosure responsable contigo antes de hacer público el fix.

## Scope

Está dentro del alcance:

- Cualquier endpoint público de `madrigueras.shop` (storefront, dashboard, admin, API).
- El código de `nibble/` en este repo.
- Las dependencias listadas en `nibble/package.json`.

**Fuera del alcance:**

- Servicios externos (Vercel, Brevo, etc.) — reportar directamente a ellos.
- Ataques que requieren acceso físico al dispositivo del usuario.
- Reportes sin reproducción (escaneos automáticos de vulnerability scanners sin contexto).
- Issues de tooling de desarrollo (dev server, build).

## Reconocimiento

Mantenemos una página de [Acknowledgements](docs/security-thanks.md) con los reportes válidos que recibimos. Si preferís permanecer anónimo, decílo en el reporte.
