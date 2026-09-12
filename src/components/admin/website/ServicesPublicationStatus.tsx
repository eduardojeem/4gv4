export function ServicesPublicationStatus({ storefrontPublic, enabled, activeCount, orgSlug, servicesModuleEnabled = true }: {
  storefrontPublic: boolean; enabled: boolean; activeCount: number; orgSlug?: string | null; servicesModuleEnabled?: boolean
}) {
  const published = storefrontPublic && enabled && activeCount > 0 && servicesModuleEnabled
  return <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
    <div>
      <p className="text-sm font-medium">
        {!servicesModuleEnabled
          ? 'Módulo de servicios no activo'
          : !storefrontPublic
            ? 'Tienda sin publicar'
            : !enabled
              ? 'Sección de servicios oculta'
              : !activeCount
                ? 'Sin servicios habilitados'
                : 'Servicios publicados'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {!servicesModuleEnabled
          ? 'Los módulos de Servicios o Reparaciones no están activos en tu suscripción. La sección permanecerá oculta para tus clientes.'
          : !storefrontPublic
            ? 'Prepará el catálogo y publicá tu tienda desde Empresa y publicación.'
            : published
              ? `${activeCount} servicios visibles en tu tienda. Este estado corresponde a lo guardado.`
              : 'Habilitá la sección y al menos un servicio completo; luego guardá el catálogo.'}
      </p>
    </div>
    {published && orgSlug && <a href={`/${orgSlug}/servicios`} target="_blank" rel="noreferrer" className="rounded-md border bg-background px-3 py-2 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring">Ver servicios</a>}
  </div>
}
