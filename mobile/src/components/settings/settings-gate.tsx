import type { ReactNode } from 'react';

import { Notice, StateView, WebsiteScreen } from '@/components/website/website-ui';
import { useSettings } from '@/lib/settings-context';
import type { OrgSettings } from '@/lib/settings-model';

/**
 * Carga, permisos, error y conexión de cualquier pantalla de configuración. Solo
 * renderiza el contenido cuando hay configuración del servidor para editar.
 */
export function SettingsGate({ title, children }: { title: string; children: (settings: OrgSettings) => ReactNode }) {
  const { settings, loading, error, offline, forbidden, canEdit, reload } = useSettings();

  if (!canEdit || forbidden) {
    return (
      <WebsiteScreen title={title}>
        <StateView icon="lock-closed-outline" title="Sin permiso para cambiar la configuración" text={error && forbidden ? error : 'Solo el dueño o un administrador del comercio pueden cambiarla. Pedíselo al dueño.'} />
      </WebsiteScreen>
    );
  }
  if (loading && !settings) {
    return (
      <WebsiteScreen title={title}>
        <StateView loading title="Cargando la configuración…" />
      </WebsiteScreen>
    );
  }
  if (!settings) {
    return (
      <WebsiteScreen title={title}>
        <StateView icon={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} title={offline ? 'Sin conexión' : 'No pudimos cargar la configuración'} text={error ?? undefined} action="Reintentar" onAction={() => void reload()} />
      </WebsiteScreen>
    );
  }
  return <>{children(settings)}</>;
}

/** Aviso dentro del contenido cuando la última carga falló por conexión. */
export function SettingsOfflineNotice() {
  const { offline } = useSettings();
  return offline ? <Notice tone="danger" text="Sin conexión. Ves lo último cargado; no se va a guardar nada hasta que vuelva internet." /> : null;
}
