# Acknowledgements de seguridad

Página de reconocimiento a quienes reportaron vulnerabilidades válidas a Madriguera Shop siguiendo el proceso descrito en [SECURITY.md](../SECURITY.md).

## Hall of fame

_Todavía no hay reportes públicos._

Si reportaste algo y querés aparecer acá (o preferís quedar anónimo), indicálo cuando envíes el advisory.

## Cómo aparecés en esta lista

1. Reportá la vulnerabilidad por el canal indicado en [SECURITY.md](../SECURITY.md).
2. Nosotros coordinamos disclosure responsable contigo.
3. Cuando el fix está deployado, agregamos tu nombre/handle acá (en orden cronológico de reporte) con:
   - Fecha del reporte.
   - Resumen one-liner del issue (sin detalles que faciliten un re-attack si la mitigación regresa).
   - Crédito como quieras: nombre real, handle, anónimo, etc.

## Categorías que reconocemos

- **Críticas**: ejecución remota, escalación de privilegios, leak masivo de datos de usuarios o pagos.
- **Altas**: bypass de auth, IDOR, SSRF, XSS persistente, escape de tenant.
- **Medias**: XSS reflejado, CSRF en endpoints sensibles, exposición de PII puntual.
- **Bajas**: configuraciones inseguras detectables sin explotación práctica.

Reportes que ya conocemos (en backlog público) o que no afectan a la app (ataques fuera de scope listado en SECURITY.md) no entran al hall of fame, pero igual agradecemos el reporte.
