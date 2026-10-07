# Reconciliación de ramas (2026-10-07)

Base revisada: `d86d6e09`.

Las seis ramas se incorporan al historial preservando el árbol vigente de main.
No hay una actualización funcional pendiente que justifique restaurar sus
implementaciones históricas. La estrategia `ours` registra esa resolución sin
volver a aplicar parches ya incorporados ni degradar dependencias.

| Rama | Evidencia y resolución |
| --- | --- |
| feature/organization-business-profile | `git cherry main` identifica 35f6929e como parche ya incorporado; main incluye además barberías, finanzas y recomendaciones por vertical. |
| feature/pos-product-credit | Los siete commits aparecen como equivalentes en `git cherry main`; se conserva el checkout y la elegibilidad actuales. |
| security/private-tenant-isolation | Siete commits son equivalentes; la migración final tiene el mismo blob f97a80188af6e4923bbdbbcfea55b06fb94d002a en migrations_legacy. Se conserva su ubicación para no reaplicarla. |
| audit/public-sections | Los scripts actuales reciben el correo por argumento, el debug inicia vacío y el SQL legacy usa placeholder. Los archivos temporales ya no están versionados. No se restaura middleware.ts junto a src/proxy.ts ni un script antiguo que modifica privilegios. |
| download-changes | Solo agrega un pnpm-lock.yaml antiguo. El proyecto declara npm@11.7.0 y CI usa npm ci; se conserva package-lock.json como lockfile del proyecto. |
| vercel/react-server-components-cve-vu-dz72if | Actualizaba Next 15.5.4 a 15.5.9; main ya usa Next 16.3.x. No se degrada la versión ni el lockfile. |

Los worktrees activos mantienen sus checkouts y cambios locales. Las referencias
remotas se actualizan por fast-forward después de estas integraciones, sin force
push ni eliminación de commits.

## Bloqueo de publicación

El despliegue de producción dpl_7dqMXa9JksYt4MZeRNb5RA2o8MTS está CANCELED y
expone errorLink a la documentación de Verified Commits. El commit d86d6e09
no tiene firma. La conexión de Vercel y la CLI tampoco tienen acceso de escritura
al equipo; GitHub no tiene secretos de despliegue configurados.

La solución que conserva la protección es generar un commit firmado y verificado
en GitHub, por ejemplo mediante un PR integrado desde su interfaz, y confirmar que
Vercel publica ese nuevo SHA. No se modificó la política de seguridad de Vercel.
