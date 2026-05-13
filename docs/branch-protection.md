# Branch protection — configuración recomendada

> Esto se configura en GitHub UI (no es archivo de código). El propósito de
> este documento es que cualquier owner del repo pueda re-aplicar la config
> exacta si se rompe o si se crea un repo nuevo.

## Reglas para `main`

**Path:** `Settings → Branches → Branch protection rules → Add rule`
**Branch name pattern:** `main`

Activar:

### Require a pull request before merging

- ✅ **Require approvals:** 1 (o más si hay equipo)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require review from Code Owners** (usa `.github/CODEOWNERS`)
- ✅ **Require approval of the most recent reviewable push**

### Require status checks to pass before merging

- ✅ **Require branches to be up to date before merging**
- **Status checks que deben pasar** (buscar con el nombre exacto):
  - `CI Success` ← el job agregado que valida todos los demás
  - `Dependency Review`
  - `Analyze (javascript-typescript)` ← CodeQL

### Require conversation resolution before merging

- ✅ Sí — un review con comentarios abiertos no debería poder mergearse hasta resolverlos.

### Require signed commits

- ⚠ Opcional pero recomendado. Bloquea spoofing de identidad.

### Require linear history

- ✅ Sí. Fuerza rebase/squash, sin merge commits. Histórico más limpio.

### Require deployments to succeed before merging

- ❌ No aplica acá. Deployamos después del merge, no antes.

### Block force pushes

- ✅ Sí. Forzar push sobre main es destructivo.

### Restrict who can push to matching branches

- ✅ Solo administradores del repo. Force push y bypass de status checks no
  deben estar disponibles para colaboradores normales.

### Allow specified actors to bypass

- Solo el owner del repo. Idealmente nadie — los hotfixes igual deberían pasar por PR.

---

## Reglas adicionales en `Settings → General`

- **Default branch:** `main`
- **Allow merge commits:** ❌
- **Allow squash merging:** ✅ (default)
- **Allow rebase merging:** ✅
- **Automatically delete head branches:** ✅ (limpia branches tras merge)

---

## Auto-merge para Dependabot

`Settings → General → Pull Requests → Allow auto-merge` ✅

Después en cada PR de Dependabot:

```yaml
# .github/auto-merge.yml (opcional, si querés que los patch + minor de devDeps
# se auto-mergeen tras CI verde).
```

No lo tenemos activo todavía — preferimos review manual por ahora.

---

## Smoke test del setup

Después de configurar, abrí un PR de prueba con un cambio trivial:

```bash
git checkout -b test/branch-protection
echo "# test" >> docs/test.md
git add docs/test.md
git commit -m "chore: test branch protection"
git push origin test/branch-protection
gh pr create --fill
```

Deberías ver:

- ✓ CI corriendo (7 jobs).
- ✓ Botón "Merge" deshabilitado hasta que pase CI.
- ✓ Required review checkbox visible.
- ✓ Si tocaste `auth.ts` o `prisma/schema.prisma`, owner del path auto-requested.
