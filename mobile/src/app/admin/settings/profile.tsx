import { PRIMARY_ACTIVITIES, PRIMARY_ACTIVITY_LABELS, primaryActivityModule, readPrimaryActivity, type PrimaryActivity } from '../../../../../src/lib/organization/primary-activity';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import {
  ChipSelector,
  Notice,
  SaveBar,
  Section,
  StateView,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import {
  fetchBusinessProfileDetails,
  saveBusinessProfile,
  settingsErrorMessage,
} from '@/lib/settings-admin';
import { useSettings } from '@/lib/settings-context';
import {
  APPOINTMENT_MODE_OPTIONS,
  ATTENTION_MODE_OPTIONS,
  BUSINESS_VERTICALS,
  MODEL_HINTS,
  MODEL_LABELS,
  MODULE_LABELS,
  OPERATING_MODELS,
  ORGANIZATION_MODULES,
  SERVICE_SPECIALTIES,
  SERVICE_SPECIALTY_LABELS,
  VERTICAL_LABELS,
  defaultOperatingModelFor,
  getSuggestedModules,
  isServiceVertical,
  moduleDependencyProblems,
  moduleHint,
  modulesForVerticalChange,
  type BusinessProfileDetails,
  type BusinessVertical,
  type OperatingModel,
  type OrganizationModule,
  type ServiceAppointmentMode,
  type ServiceAttentionMode,
  type ServiceSpecialty,
} from '@/lib/settings-model';

type Draft = {
  primaryActivity: PrimaryActivity;
  businessVertical: BusinessVertical;
  operatingModel: OperatingModel;
  enabledModules: OrganizationModule[];
  serviceSpecialties: ServiceSpecialty[];
  attentionMode: ServiceAttentionMode;
  appointmentMode: ServiceAppointmentMode;
};

type AutoChangeBanner = {
  label: string;
  added: OrganizationModule[];
  removed: OrganizationModule[];
  previous: OrganizationModule[];
};

const toDraft = (profile: BusinessProfileDetails): Draft => ({
  primaryActivity: readPrimaryActivity(profile.primaryActivity),
  businessVertical: profile.businessVertical,
  operatingModel: profile.operatingModel,
  enabledModules: profile.enabledModules ?? profile.effectiveModules,
  serviceSpecialties: [...profile.serviceSpecialties],
  attentionMode: profile.attentionMode,
  appointmentMode: profile.appointmentMode,
});

const sameSorted = (a: readonly string[], b: readonly string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export default function BusinessProfileScreen() {
  const scope = useSyncExternalStore(subscribePrivateCacheContext, getPrivateCacheContext);
  return (
    <SettingsGate title="Perfil del negocio">
      {() => <ProfileEditor key={scope.epoch} />}
    </SettingsGate>
  );
}

function ProfileEditor() {
  const colors = usePalette();
  const { data: panel, reload: reloadPanel } = usePanel();
  const { refreshSetupStatus } = useSettings();
  const [saved, setSaved] = useState<BusinessProfileDetails | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoChange, setAutoChange] = useState<AutoChangeBanner | null>(null);
  const dirtyRef = useRef(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (pullRefresh = false) => {
    const seq = ++requestSeq.current;
    const scope = getPrivateCacheContext();
    if (pullRefresh) setRefreshing(true);
    try {
      const next = await fetchBusinessProfileDetails();
      if (seq !== requestSeq.current || scope.epoch !== getPrivateCacheContext().epoch) return;
      setSaved(next);
      if (!dirtyRef.current || pullRefresh) {
        setDraft(toDraft(next));
        setAutoChange(null);
      }
      setError(null);
    } catch (cause) {
      if (seq === requestSeq.current && scope.epoch === getPrivateCacheContext().epoch) {
        setError(settingsErrorMessage(cause, 'No pudimos cargar el perfil del negocio.'));
      }
    } finally {
      if (seq === requestSeq.current) setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
      return () => {
        requestSeq.current++;
      };
    }, [load]),
  );

  const entitledSet = useMemo(
    () => new Set<string>(saved?.entitledModules ?? []),
    [saved?.entitledModules],
  );

  const dirty = useMemo(() => {
    if (!saved || !draft) return false;
    const base = toDraft(saved);
    if (draft.businessVertical !== base.businessVertical) return true;
    if (draft.primaryActivity !== readPrimaryActivity(base.primaryActivity)) return true;
    if (draft.operatingModel !== base.operatingModel) return true;
    if (!sameSorted(draft.enabledModules, base.enabledModules)) return true;
    if ((isServiceVertical(draft.businessVertical)||draft.enabledModules.includes('services'))) {
      if (!sameSorted(draft.serviceSpecialties, base.serviceSpecialties)) return true;
      if (draft.attentionMode !== base.attentionMode) return true;
      if (draft.appointmentMode !== base.appointmentMode) return true;
    }
    return false;
  }, [saved, draft]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const activeVertical = draft?.businessVertical ?? saved?.businessVertical ?? 'general';
  const activeModel = draft?.operatingModel ?? saved?.operatingModel ?? 'retail';
  const activeEnabled = useMemo(
    () => (draft?.enabledModules ?? []).filter((m) => entitledSet.has(m)),
    [draft?.enabledModules, entitledSet],
  );
  const dependencyProblems = useMemo(
    () => moduleDependencyProblems(activeEnabled),
    [activeEnabled],
  );
  const suggestedModules = useMemo(
    () => getSuggestedModules(activeVertical, activeModel),
    [activeVertical, activeModel],
  );

  const applyRecommendationFor = (
    nextVertical: BusinessVertical,
    nextModel: OperatingModel,
    currentEnabled: OrganizationModule[],
  ) => {
    const recommended = modulesForVerticalChange(
      currentEnabled,
      getSuggestedModules(nextVertical, nextModel),
      entitledSet,
    );
    const added = recommended.filter((m) => !currentEnabled.includes(m));
    const removed = currentEnabled.filter((m) => !recommended.includes(m));
    if (added.length === 0 && removed.length === 0) {
      setAutoChange(null);
      return currentEnabled;
    }
    setAutoChange({
      label: VERTICAL_LABELS[nextVertical] ?? nextVertical,
      added,
      removed,
      previous: currentEnabled,
    });
    return recommended;
  };

  const changeVertical = (nextVertical: BusinessVertical) => {
    if (!draft) return;
    let nextModel = draft.operatingModel;
    if (isServiceVertical(nextVertical) && nextModel !== 'service' && nextModel !== 'mixed') {
      nextModel = 'service';
    } else if (!isServiceVertical(nextVertical) && nextModel === 'service') {
      nextModel = defaultOperatingModelFor(nextVertical);
    }
    const nextModules = applyRecommendationFor(nextVertical, nextModel, draft.enabledModules);
    setDraft({
      ...draft,
      businessVertical: nextVertical,
      operatingModel: nextModel,
      enabledModules: nextModules,
    });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const changeModel = (nextModel: OperatingModel) => {
    if (!draft) return;
    const nextModules = applyRecommendationFor(draft.businessVertical, nextModel, draft.enabledModules);
    setDraft({
      ...draft,
      operatingModel: nextModel,
      enabledModules: nextModules,
    });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const undoAutoChange = () => {
    if (!autoChange || !draft) return;
    setDraft({ ...draft, enabledModules: autoChange.previous });
    setAutoChange(null);
  };

  const toggleModule = (mod: OrganizationModule, enabled: boolean) => {
    if (!draft || !entitledSet.has(mod)) return;
    const next = enabled
      ? Array.from(new Set([...draft.enabledModules, mod]))
      : draft.enabledModules.filter((item) => item !== mod);
    setDraft({ ...draft, enabledModules: next });
    setAutoChange(null);
  };

  const toggleSpecialty = (item: ServiceSpecialty) => {
    if (!draft) return;
    const exists = draft.serviceSpecialties.includes(item);
    const next = exists
      ? draft.serviceSpecialties.filter((entry) => entry !== item)
      : [...draft.serviceSpecialties, item];
    setDraft({ ...draft, serviceSpecialties: next });
  };

  const applyRecommended = () => {
    if (!draft) return;
    const recommendedIncluded = suggestedModules.filter((m) => entitledSet.has(m));
    const modulesToDisable = activeEnabled.filter((m) => !recommendedIncluded.includes(m));
    const commit = () => {
      setDraft({ ...draft, enabledModules: recommendedIncluded });
      setAutoChange(null);
      void Haptics.selectionAsync().catch(() => undefined);
    };
    if (modulesToDisable.length > 0) {
      Alert.alert(
        '¿Aplicar herramientas recomendadas?',
        `Se van a ocultar ${modulesToDisable.length} ${modulesToDisable.length === 1 ? 'herramienta' : 'herramientas'} en tu menú. Los datos cargados no se borran.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Aplicar', onPress: commit },
        ],
      );
      return;
    }
    commit();
  };

  const enableAllEntitled = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      enabledModules: ORGANIZATION_MODULES.filter((m) => entitledSet.has(m)),
    });
    setAutoChange(null);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const discard = useCallback(() => {
    if (!saved) return;
    setDraft(toDraft(saved));
    setAutoChange(null);
    void Haptics.selectionAsync().catch(() => undefined);
  }, [saved]);

  const save = useCallback(async () => {
    if (!draft || !saved) return false;
    if (dependencyProblems.length > 0) {
      Alert.alert('Revisá las herramientas elegidas', dependencyProblems.join('\n'));
      return false;
    }
    const scope = getPrivateCacheContext();
    setSaving(true);
    try {
      const updated = await saveBusinessProfile({
        businessVertical: draft.businessVertical,
        operatingModel: draft.operatingModel,
        primaryActivity: draft.primaryActivity,
        enabledModules: activeEnabled,
        ...((isServiceVertical(draft.businessVertical)||draft.enabledModules.includes('services'))
          ? {
              serviceSpecialties: draft.serviceSpecialties,
              attentionMode: draft.attentionMode,
              appointmentMode: draft.appointmentMode,
            }
          : {}),
      });
      if (scope.epoch !== getPrivateCacheContext().epoch) return false;
      setSaved(updated);
      setDraft(toDraft(updated));
      setAutoChange(null);
      reloadPanel();
      void refreshSetupStatus();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      return true;
    } catch (cause) {
      Alert.alert(
        'No pudimos guardar',
        settingsErrorMessage(cause, 'No pudimos actualizar el perfil del negocio. Intentá nuevamente.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, saved, dependencyProblems, activeEnabled, reloadPanel, refreshSetupStatus]);

  useUnsavedChangesGuard(dirty, save, saving);

  if (!saved || !draft) {
    return (
      <WebsiteScreen title="Perfil del negocio">
        {error ? (
          <StateView
            icon="alert-circle-outline"
            title="No pudimos cargar el perfil"
            text={error}
            action="Reintentar"
            onAction={() => void load(false)}
          />
        ) : (
          <StateView loading title="Cargando el perfil…" />
        )}
      </WebsiteScreen>
    );
  }

  const entitledModules = ORGANIZATION_MODULES.filter((m) => entitledSet.has(m));
  const lockedModules = ORGANIZATION_MODULES.filter((m) => !entitledSet.has(m));
  const planName = panel?.organization.plan ? panel.organization.plan.toUpperCase() : null;

  return (
    <WebsiteScreen
      title="Perfil del negocio"
      subtitle="Rubro, forma de trabajo y herramientas"
      saving={saving}
      refreshing={!dirty ? refreshing : undefined}
      onRefresh={!dirty ? () => void load(true) : undefined}
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={discard}
        />
      }
    >
      <SettingsOfflineNotice />
      {error ? (
        <Notice tone="danger" text={error} actionLabel="Reintentar" onAction={() => void load(false)} />
      ) : null}

      <Section
        title="Estado actual"
        icon="briefcase-outline"
        right={planName ? <StatusPill label={`Plan ${planName}`} tone="primary" /> : undefined}
      >
        <View style={styles.summaryRow}>
          <SummaryBox
            label="Rubro guardado"
            value={VERTICAL_LABELS[saved.businessVertical] ?? saved.businessVertical}
            colors={colors}
          />
          <SummaryBox
            label="Forma de trabajo"
            value={MODEL_LABELS[saved.operatingModel] ?? saved.operatingModel}
            colors={colors}
          />
        </View>
        {dirty ? (
          <Notice
            tone="warning"
            text="Tenés cambios pendientes. Apagar una herramienta solo la oculta del menú; sus datos no se borran."
          />
        ) : null}
      </Section>

      <Section
        title="Rubro principal"
        icon="storefront-outline"
        hint="Define las herramientas recomendadas y adapta el catálogo."
      >
        <ChipSelector
          options={BUSINESS_VERTICALS.map((value) => ({
            value,
            label: VERTICAL_LABELS[value] ?? value,
          }))}
          selected={draft.businessVertical}
          onSelect={changeVertical}
        />
      </Section>

      <Section
        title="Forma de trabajo"
        icon="layers-outline"
        hint={MODEL_HINTS[draft.operatingModel]}
      >
        <ChipSelector
          options={OPERATING_MODELS.map((value) => ({
            value,
            label: MODEL_LABELS[value] ?? value,
            badge: defaultOperatingModelFor(draft.businessVertical) === value ? 'Recomendado' : undefined,
          }))}
          selected={draft.operatingModel}
          onSelect={changeModel}
        />
      </Section>

      <Section title="Actividad principal" icon="navigate-outline" hint="Ordena los accesos de web y app sin cambiar tus permisos.">
        <ChipSelector options={PRIMARY_ACTIVITIES.filter(value=>!primaryActivityModule(value)||activeEnabled.includes(primaryActivityModule(value)!)).map(value=>({value,label:PRIMARY_ACTIVITY_LABELS[value]}))} selected={draft.primaryActivity} onSelect={primaryActivity=>setDraft({...draft,primaryActivity})} />
      </Section>
      {(isServiceVertical(draft.businessVertical)||draft.enabledModules.includes('services')) ? (
        <Section
          title="Especialidades y atención"
          icon="calendar-outline"
          hint="Mostrá qué servicios ofrecés y cómo atendés turnos."
        >
          <Text style={[styles.subLabel, { color: colors.text }]}>Especialidades</Text>
          <View style={styles.chipsWrap}>
            {SERVICE_SPECIALTIES.map((item) => {
              const selected = draft.serviceSpecialties.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleSpecialty(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={[
                    websiteStyles.chip,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accentSoft : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      websiteStyles.chipText,
                      { color: selected ? colors.accent : colors.text },
                    ]}
                  >
                    {SERVICE_SPECIALTY_LABELS[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.subLabel, { color: colors.text }]}>Dónde atendés</Text>
          <ChipSelector
            options={ATTENTION_MODE_OPTIONS}
            selected={draft.attentionMode}
            onSelect={(attentionMode) => setDraft({ ...draft, attentionMode })}
          />
          <Text style={[styles.subLabel, { color: colors.text }]}>Cómo recibís clientes</Text>
          <ChipSelector
            options={APPOINTMENT_MODE_OPTIONS}
            selected={draft.appointmentMode}
            onSelect={(appointmentMode) => setDraft({ ...draft, appointmentMode })}
          />
        </Section>
      ) : null}

      {autoChange ? (
        <Notice
          tone="info"
          text={`Actualizamos las herramientas recomendadas para ${autoChange.label}. Podés ajustarlas abajo antes de guardar.`}
          actionLabel="Deshacer cambio automático"
          onAction={undoAutoChange}
        />
      ) : null}

      <Section
        title="Herramientas del menú"
        icon="apps-outline"
        hint="Activá o desactivá las incluidas en tu plan."
        right={
          <StatusPill
            label={`${activeEnabled.length} activas`}
            tone="success"
          />
        }
      >
        <View style={styles.quickRow}>
          <Pressable
            onPress={applyRecommended}
            accessibilityRole="button"
            style={[styles.quickBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
            <Text style={[styles.quickBtnText, { color: colors.accent }]}>Usar recomendadas</Text>
          </Pressable>
          <Pressable
            onPress={enableAllEntitled}
            accessibilityRole="button"
            style={[styles.quickBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            <Ionicons name="checkmark-done-outline" size={14} color={colors.text} />
            <Text style={[styles.quickBtnText, { color: colors.text }]}>Todo lo incluido</Text>
          </Pressable>
        </View>

        {dependencyProblems.length > 0 ? (
          <Notice tone="warning" text={dependencyProblems.join(' ')} />
        ) : null}

        {entitledModules.map((mod) => {
          const checked = activeEnabled.includes(mod);
          const recommended = suggestedModules.includes(mod);
          return (
            <ToggleRow
              key={mod}
              label={MODULE_LABELS[mod] ?? mod}
              hint={moduleHint(mod) ?? undefined}
              badge={recommended ? 'Recomendado' : undefined}
              value={checked}
              onValueChange={(value) => toggleModule(mod, value)}
            />
          );
        })}
      </Section>

      {lockedModules.length > 0 ? (
        <Section
          title="En planes superiores"
          icon="lock-closed-outline"
          hint="Estas herramientas requieren otro plan."
        >
          <View style={styles.chipsWrap}>
            {lockedModules.map((mod) => (
              <View
                key={mod}
                style={[styles.lockedChip, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Ionicons name="lock-closed-outline" size={12} color={colors.muted} />
                <Text style={[styles.lockedText, { color: colors.muted }]}>
                  {MODULE_LABELS[mod] ?? mod}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => router.push('/admin/subscriptions' as never)}
            accessibilityRole="button"
            style={[websiteStyles.secondaryButton, { borderColor: colors.border }]}
          >
            <Ionicons name="card-outline" size={17} color={colors.accent} />
            <Text style={[websiteStyles.secondaryText, { color: colors.accent }]}>
              Ver detalles de tu suscripción
            </Text>
          </Pressable>
        </Section>
      ) : null}
    </WebsiteScreen>
  );
}

function SummaryBox({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof usePalette>;
}) {
  return (
    <View
      style={[
        styles.summaryBox,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={2} style={[styles.summaryValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryBox: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryValue: { fontSize: 13, fontWeight: '800' },
  subLabel: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  quickBtnText: { fontSize: 12, fontWeight: '700' },
  lockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    opacity: 0.78,
  },
  lockedText: { fontSize: 12, fontWeight: '600' },
});
