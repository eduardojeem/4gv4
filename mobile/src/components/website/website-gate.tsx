import type { ReactNode } from 'react';

import { useWebsite } from '@/lib/website-context';
import type { WebsiteSettings } from '@/lib/website-model';
import { Notice, StateView, WebsiteScreen } from './website-ui';

/**
 * Carga, permisos, error y conexión de cualquier pantalla del sitio web. Solo
 * renderiza el contenido cuando hay configuración del servidor para editar.
 */
export function WebsiteGate({ title, children }: { title: string; children: (settings: WebsiteSettings) => ReactNode }) {
  const { settings, loading, error, offline, forbidden, canEdit, reload } = useWebsite();

  if (!canEdit || forbidden) {
    return (
      <WebsiteScreen title={title}>
        <StateView icon="lock-closed-outline" title="Sin permiso para editar el sitio" text="Solo el dueño o un administrador del comercio pueden cambiar la tienda online. Pedíselo al dueño." />
      </WebsiteScreen>
    );
  }
  if (loading && !settings) {
    return (
      <WebsiteScreen title={title}>
        <StateView loading title="Cargando tu sitio web…" />
      </WebsiteScreen>
    );
  }
  if (!settings) {
    return (
      <WebsiteScreen title={title}>
        <StateView icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} title={offline ? 'Sin conexión' : 'No pudimos cargar el sitio'} text={error ?? undefined} action="Reintentar" onAction={() => void reload()} />
      </WebsiteScreen>
    );
  }
  return <>{children(settings)}</>;
}

/** Aviso dentro del contenido cuando la última carga falló por conexión. */
export function OfflineNotice() {
  const { offline } = useWebsite();
  return offline ? <Notice tone="danger" text="Sin conexión. Ves lo último cargado; no se va a guardar nada hasta que vuelva internet." /> : null;
}
