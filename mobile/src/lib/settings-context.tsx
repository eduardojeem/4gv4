import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError } from './api';
import { usePanel } from './panel';
import { setMobileRegionalFormatConfig } from './regional-format';
import { fetchOrgSettings, fetchSetupStatus, settingsErrorMessage } from './settings-admin';
import type { OrgSettings, SettingsSetupStatus } from './settings-model';

type SettingsState = {
  /** Lo último que confirmó el servidor (la base para detectar cambios). */
  settings: OrgSettings | null;
  setupStatus: SettingsSetupStatus | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** La última carga falló por falta de conexión (se muestra lo anterior). */
  offline: boolean;
  forbidden: boolean;
  /** Solo dueño o administrador del comercio (el servidor lo exige igual). */
  canEdit: boolean;
  organizationName: string | null;
  reload: () => Promise<void>;
  refreshSetupStatus: () => Promise<void>;
  /** Reemplaza lo guardado con lo que devolvió el servidor. */
  applySaved: (settings: OrgSettings) => void;
};

/** Lo cargado, siempre atado al comercio para el que se pidió. */
type Loaded = {
  organizationId: string;
  settings: OrgSettings | null;
  setupStatus: SettingsSetupStatus | null;
  error: string | null;
  offline: boolean;
  forbidden: boolean;
};

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, reload: reloadPanel } = usePanel();
  const organizationId = data?.organization.id ?? null;
  const organizationName = data?.organization.name ?? null;
  const role = data?.organization.role ?? null;
  const canEdit = Boolean(data?.user.isSuperAdmin || role === 'owner' || role === 'admin');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (forOrganization: string) => {
    const seq = ++requestSeq.current;
    try {
      const [settings, setupStatus] = await Promise.all([
        fetchOrgSettings(),
        fetchSetupStatus().catch(() => null),
      ]);
      if (seq !== requestSeq.current) return;
      setLoaded({
        organizationId: forOrganization,
        settings,
        setupStatus,
        error: null,
        offline: false,
        forbidden: false,
      });
    } catch (cause) {
      if (seq !== requestSeq.current) return;
      const status = cause instanceof ApiError ? cause.status : -1;
      // Si falla, se conserva lo último cargado de ESTE comercio.
      setLoaded((current) => ({
        organizationId: forOrganization,
        settings: current?.organizationId === forOrganization ? current.settings : null,
        setupStatus: current?.organizationId === forOrganization ? current.setupStatus : null,
        error: settingsErrorMessage(cause, 'No pudimos cargar la configuración. Intentá nuevamente.'),
        offline: status === 0,
        forbidden: status === 403,
      }));
    } finally {
      if (seq === requestSeq.current) setRefreshing(false);
    }
  }, []);

  // Otro comercio: lo cargado no sirve ni se muestra; se pide de nuevo.
  const current = loaded && loaded.organizationId === organizationId ? loaded : null;
  useEffect(() => {
    if (!current?.settings) return;
    setMobileRegionalFormatConfig({
      locale: current.settings.locale,
      countryCode: current.settings.countryCode,
      language: current.settings.language,
    });
  }, [current?.settings]);

  useEffect(() => {
    if (organizationId && canEdit && !current) void load(organizationId);
  }, [organizationId, canEdit, current, load]);

  const reload = useCallback(async () => {
    if (!organizationId) return;
    setRefreshing(true);
    await load(organizationId);
  }, [organizationId, load]);

  const refreshSetupStatus = useCallback(async () => {
    if (!organizationId) return;
    const status = await fetchSetupStatus().catch(() => null);
    if (!status) return;
    setLoaded((value) =>
      value && value.organizationId === organizationId ? { ...value, setupStatus: status } : value,
    );
  }, [organizationId]);

  const applySaved = useCallback((settings: OrgSettings) => {
    // Si mientras se guardaba se cambió de comercio, no se mezcla con el otro.
    setLoaded((value) =>
      value && value.organizationId === organizationId
        ? { ...value, settings, error: null, offline: false }
        : value,
    );
    if (organizationName && settings.companyName.trim() && settings.companyName.trim() !== organizationName.trim()) {
      reloadPanel();
    }
    void refreshSetupStatus();
  }, [organizationId, organizationName, reloadPanel, refreshSetupStatus]);

  const value = useMemo<SettingsState>(() => ({
    settings: current?.settings ?? null,
    setupStatus: current?.setupStatus ?? null,
    loading: Boolean(organizationId && canEdit && !current),
    refreshing,
    error: current?.error ?? null,
    offline: current?.offline ?? false,
    forbidden: current?.forbidden ?? false,
    canEdit,
    organizationName,
    reload,
    refreshSetupStatus,
    applySaved,
  }), [current, organizationId, canEdit, refreshing, organizationName, reload, refreshSetupStatus, applySaved]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings fuera de SettingsProvider');
  return value;
}
