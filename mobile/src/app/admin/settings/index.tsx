import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { BiometricSettingCard } from '@/components/settings/biometric-setting';
import { SettingsGate, SettingsOfflineNotice } from '@/components/settings/settings-gate';
import {
  Notice,
  ProgressBar,
  SettingsCard,
  StatusPill,
  WebsiteScreen,
} from '@/components/website/website-ui';
import { openWeb } from '@/lib/marketplace';
import { usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import {
  fetchAdminMfaPolicy,
  settingsErrorMessage,
  updateAdminMfaPolicy,
} from '@/lib/settings-admin';
import { useSettings } from '@/lib/settings-context';
import {
  buildMobileSetupItems,
  fiscalIdLabel,
  formatNumber,
  type AdminMfaPolicy,
} from '@/lib/settings-model';
import { countryLabel } from '../../../../../src/lib/regional/country-labels';

const go = (path: string) => router.push(`/admin/settings/${path}` as never);

export default function SettingsHome() {
  const scope = useSyncExternalStore(subscribePrivateCacheContext, getPrivateCacheContext);
  return <SettingsHomeContent key={scope.epoch} />;
}

function SettingsHomeContent() {
  const colors = usePalette();
  const { refreshing, reload, organizationName, setupStatus } = useSettings();
  const { data: panel } = usePanel();
  const [setupExpanded, setSetupExpanded] = useState(false);

  const [mfaPolicy, setMfaPolicy] = useState<AdminMfaPolicy | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSaving, setMfaSaving] = useState(false);
  const mfaSeq = useRef(0);

  const loadMfaPolicy = useCallback(async () => {
    const seq = ++mfaSeq.current;
    const requestScope = getPrivateCacheContext();
    try {
      const next = await fetchAdminMfaPolicy();
      if (seq !== mfaSeq.current || requestScope.epoch !== getPrivateCacheContext().epoch) return;
      setMfaPolicy(next);
      setMfaError(null);
    } catch (cause) {
      if (seq !== mfaSeq.current || requestScope.epoch !== getPrivateCacheContext().epoch) return;
      setMfaError(settingsErrorMessage(cause, 'No pudimos cargar la exigencia de 2FA.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMfaPolicy();
      return () => {
        mfaSeq.current++;
      };
    }, [loadMfaPolicy]),
  );

  const handleRefresh = useCallback(() => {
    void Promise.all([reload(), loadMfaPolicy()]);
  }, [reload, loadMfaPolicy]);

  const toggleAdminMfa = useCallback(async (nextValue: boolean) => {
    if (mfaSaving || !mfaPolicy) return;
    const requestEpoch = getPrivateCacheContext().epoch;
    const apply = async () => {
      setMfaSaving(true);
      try {
        const updated = await updateAdminMfaPolicy(nextValue);
        if (requestEpoch !== getPrivateCacheContext().epoch) return;
        setMfaPolicy(updated);
        setMfaError(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      } catch (cause) {
        if (requestEpoch !== getPrivateCacheContext().epoch) return;
        const message = settingsErrorMessage(cause, 'No pudimos guardar la exigencia de verificación en dos pasos.');
        setMfaError(message);
        Alert.alert('No pudimos cambiar esta opción', message);
      } finally {
        setMfaSaving(false);
      }
    };

    if (!nextValue) {
      Alert.alert(
        '¿Dejar de exigir 2FA a administradores?',
        'Los administradores podrán entrar solo con su contraseña si no tienen activada la verificación en dos pasos.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Dejar opcional', style: 'destructive', onPress: () => void apply() },
        ],
      );
      return;
    }
    await apply();
  }, [mfaPolicy, mfaSaving]);

  return (
    <SettingsGate title="Configuración">
      {(settings) => {
        const fiscalTag = fiscalIdLabel(settings.countryCode);
        const identity = [
          settings.companyName,
          settings.companyRuc && `${fiscalTag} ${settings.companyRuc}`,
        ]
          .filter(Boolean)
          .join(' · ');
        const countryPart = settings.countryCode ? countryLabel(settings.countryCode) : null;
        const regional = [
          countryPart,
          `${settings.currency} · IVA ${formatNumber(settings.taxRate, 2)} %`,
        ]
          .filter(Boolean)
          .join(' · ');

        const companyMissing =
          !settings.companyName.trim() ||
          !settings.companyPhone.trim() ||
          !settings.companyAddress.trim() ||
          !settings.city.trim();

        const setupItems = buildMobileSetupItems(settings, setupStatus);
        const pendingItems = setupItems.filter((item) => !item.done);
        const doneCount = setupItems.length - pendingItems.length;
        const progress = setupItems.length ? doneCount / setupItems.length : 1;
        const branchSummary = setupStatus?.branch
          ? [setupStatus.branch.name, setupStatus.branch.city].filter(Boolean).join(' · ') || 'Principal'
          : setupStatus
            ? 'Sin sucursal'
            : '…';
        const storefrontSummary = setupStatus
          ? setupStatus.storefront.public
            ? 'Publicada'
            : 'Sin publicar'
          : '…';
        const planLabel = panel?.organization.plan ? panel.organization.plan.toUpperCase() : undefined;

        return (
          <WebsiteScreen
            title="Configuración"
            subtitle={organizationName ?? undefined}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          >
            <SettingsOfflineNotice />

            {/* Tarjeta «Tu negocio» (estado general y datos pendientes) */}
            <View
              style={[
                styles.setupCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.setupTop}>
                <View style={[styles.setupIcon, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="storefront-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.setupHeadRow}>
                    <Text style={[styles.setupTitle, { color: colors.text }]}>Tu negocio</Text>
                    <StatusPill
                      label={`${doneCount} de ${setupItems.length}`}
                      tone={pendingItems.length === 0 ? 'success' : 'primary'}
                    />
                  </View>
                  <Text style={[styles.setupSub, { color: colors.muted }]}>
                    {!setupStatus
                      ? 'Revisando qué falta para completar tu negocio…'
                      : pendingItems.length === 0
                        ? 'Está todo cargado. Podés editar cualquier dato cuando quieras.'
                        : `Te ${pendingItems.length === 1 ? 'falta 1 dato' : `faltan ${pendingItems.length} datos`} para dejarlo completo.`}
                  </Text>
                </View>
              </View>

              <ProgressBar
                progress={progress}
                color={pendingItems.length === 0 ? colors.successText : colors.accent}
              />

              {setupStatus?.onboardingStatus === 'in_progress' ? (
                <Notice
                  tone="info"
                  text="Dejaste la configuración inicial a medias. Lo que cambies acá se mantiene cuando la retomes."
                  actionLabel="Continuar en la web"
                  onAction={() => void openWeb('/admin/onboarding')}
                />
              ) : null}

              <View style={styles.summaryGrid}>
                <SummaryChip
                  label="Sucursal principal"
                  value={branchSummary}
                  colors={colors}
                />
                <SummaryChip
                  label="Tienda online"
                  value={storefrontSummary}
                  colors={colors}
                />
              </View>

              {pendingItems.length > 0 ? (
                <>
                  <Pressable
                    onPress={() => setSetupExpanded((value) => !value)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: setupExpanded }}
                    style={[styles.pendingToggle, { borderTopColor: colors.border }]}
                  >
                    <Text style={[styles.pendingToggleText, { color: colors.accent }]}>
                      {setupExpanded
                        ? 'Ocultar datos pendientes'
                        : `Ver qué te falta (${pendingItems.length})`}
                    </Text>
                    <Ionicons
                      name={setupExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.accent}
                    />
                  </Pressable>

                  {setupExpanded ? (
                    <View style={styles.pendingList}>
                      {pendingItems.map((item) => (
                        <Pressable
                          key={item.key}
                          onPress={() => router.push(item.route as never)}
                          accessibilityRole="button"
                          style={[
                            styles.pendingRow,
                            { borderColor: colors.border, backgroundColor: colors.background },
                          ]}
                        >
                          <Ionicons name="ellipse-outline" size={16} color={colors.muted} />
                          <Text style={[styles.pendingText, { color: colors.text }]}>
                            {item.label}
                          </Text>
                          <Ionicons name="chevron-forward" size={15} color={colors.accent} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>

            <Text style={[styles.group, { color: colors.muted }]}>Comercio y operación</Text>
            <SettingsCard
              icon="business-outline"
              title="Datos de la empresa"
              hint={identity || 'Nombre, documento fiscal y contacto'}
              badge={companyMissing ? 'Completar' : undefined}
              badgeTone="warning"
              onPress={() => go('company')}
            />
            <SettingsCard
              icon="cash-outline"
              title="País, impuestos y moneda"
              hint={regional}
              badge={settings.needsCountryConfirmation ? 'Confirmar país' : undefined}
              badgeTone="warning"
              onPress={() => go('regional')}
            />
            <SettingsCard
              icon="swap-horizontal-outline"
              title="Tipos de cambio"
              hint="Cotización de otras monedas y redondeo de precios"
              onPress={() => go('exchange-rates')}
            />
            <SettingsCard
              icon="briefcase-outline"
              title="Perfil del negocio"
              hint="Rubro, forma de trabajo y herramientas activas"
              badge={planLabel}
              badgeTone="primary"
              onPress={() => go('profile')}
            />

            <Text style={[styles.group, { color: colors.muted }]}>Canales y estructura</Text>
            <SettingsCard
              icon="globe-outline"
              title="Sitio web"
              hint="Tienda online, logo, banners y publicación"
              onPress={() => router.push('/admin/website' as never)}
            />
            <SettingsCard
              icon="storefront-outline"
              title="Sucursales"
              hint="Locales, cajas y datos por sucursal"
              onPress={() => router.push('/admin/branches' as never)}
            />
            <SettingsCard
              icon="card-outline"
              title="Suscripción y plan"
              hint="Plan vigente, límites de uso y facturación"
              onPress={() => router.push('/admin/subscriptions' as never)}
            />

            <Text style={[styles.group, { color: colors.muted }]}>Seguridad del comercio</Text>
            <View
              style={[
                styles.policyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.policyRow}>
                <View style={[styles.setupIcon, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="key-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.setupHeadRow}>
                    <Text style={[styles.policyTitle, { color: colors.text }]}>
                      2FA para administradores
                    </Text>
                    {mfaPolicy ? (
                      <StatusPill
                        label={mfaPolicy.requireAdminMfa ? 'Exigido' : 'Opcional'}
                        tone={mfaPolicy.requireAdminMfa ? 'success' : 'neutral'}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.policyHint, { color: colors.muted }]}>
                    Exige código de app autenticadora al dueño y administradores al entrar al panel.
                  </Text>
                </View>
                {mfaSaving ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Switch
                    value={mfaPolicy?.requireAdminMfa ?? false}
                    disabled={!mfaPolicy || !mfaPolicy.canChange || mfaSaving}
                    onValueChange={(next) => void toggleAdminMfa(next)}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    accessibilityLabel="Exigir verificación en dos pasos a administradores"
                  />
                )}
              </View>

              {mfaError ? (
                <Text style={[styles.policyWarn, { color: colors.dangerText }]}>{mfaError}</Text>
              ) : mfaPolicy && !mfaPolicy.canChange ? (
                <Notice
                  tone="warning"
                  text="Para cambiar esta regla necesitás activar tu verificación en dos pasos y confirmar un código en esta sesión."
                  actionLabel="Ir a verificación en dos pasos"
                  onAction={() => router.push('/panel/two-factor' as never)}
                />
              ) : null}
            </View>

            <SettingsCard
              icon="shield-checkmark-outline"
              title="Tu verificación en dos pasos"
              hint="Activá o gestioná tu app autenticadora (vale también en la web)"
              onPress={() => router.push('/panel/two-factor' as never)}
            />
            <SettingsCard
              icon="document-lock-outline"
              title="Auditoría de seguridad"
              hint="Registro de accesos y cambios sensibles del equipo (web)"
              onPress={() => void openWeb('/admin/security')}
            />

            <Text style={[styles.group, { color: colors.muted }]}>Este teléfono</Text>
            <BiometricSettingCard />
            <SettingsCard
              icon="notifications-outline"
              title="Notificaciones del teléfono"
              hint="Alertas push por categoría y avisos dentro de la app"
              onPress={() => router.push('/panel/settings/notifications' as never)}
            />

            <Text style={[styles.foot, { color: colors.muted }]}>
              La configuración del comercio se aplica apenas guardás y es compartida con la web. La app sigue el modo claro u oscuro del teléfono.
            </Text>
          </WebsiteScreen>
        );
      }}
    </SettingsGate>
  );
}

function SummaryChip({
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
        styles.summaryChip,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.summaryLabel, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.summaryValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
  },
  foot: { fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  setupCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 11 },
  setupTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  setupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  setupTitle: { fontSize: 16, fontWeight: '800' },
  setupSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: 13, fontWeight: '800' },
  pendingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    minHeight: 36,
  },
  pendingToggleText: { fontSize: 13, fontWeight: '800' },
  pendingList: { gap: 8 },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingText: { flex: 1, fontSize: 13, fontWeight: '600' },
  policyCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  policyTitle: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  policyHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  policyWarn: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
});
