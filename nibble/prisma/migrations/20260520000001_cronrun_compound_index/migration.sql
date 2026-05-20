-- El check del lock zombie en `app/api/cron/*` filtra por
-- `(name, status, startedAt >= staleCutoff)`. Con el índice solo
-- `(name, startedAt)`, Postgres usa el índice para name+startedAt y
-- filtra `status` post-scan — fine ahora pero degrada cuando la tabla
-- crece. Cambiamos a un índice compuesto que cubre los tres campos del
-- WHERE.
--
-- DROP IF EXISTS + CREATE IF NOT EXISTS para idempotencia ante hotfixes
-- manuales.

DROP INDEX IF EXISTS "CronRun_name_startedAt_idx";

CREATE INDEX IF NOT EXISTS "CronRun_name_status_startedAt_idx"
  ON "CronRun"("name", "status", "startedAt");
