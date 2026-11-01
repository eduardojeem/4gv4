import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SubscriptionTransferCard } from '@/components/subscription/transfer-card';
import { fetchSubscription, type SubscriptionDetails } from '@/lib/admin';
import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type StatusInfo = { label: string; color: string; background: string };

/** Mismos estados que muestra la web, con color propio para claro y oscuro. */
function statusInfo(status: string): StatusInfo {
  if (status === 'active') return { label: 'Activo', color: palette.success, background: 'rgba(22,163,74,0.12)' };
  if (status === 'trial' || status === 'trialing') return { label: 'Prueba gratis', color: palette.primary, background: 'rgba(37,99,235,0.12)' };
  if (['past_due', 'unpaid', 'suspended', 'expired'].includes(status)) {
    return { label: 'Pago pendiente', color: palette.danger, background: 'rgba(220,38,38,0.12)' };
  }
  if (status === 'cancelled' || status === 'canceled') return { label: 'Cancelada', color: '#64748B', background: 'rgba(100,116,139,0.12)' };
  return { label: 'Pago pendiente', color: '#D97706', background: 'rgba(217,119,6,0.12)' };
}

/** Lo mismo que exige la web para pagar con tarjeta o QR. */
function billingMissingFields(profile: SubscriptionDetails['billingProfile']): string[] {
  const missing: string[] = [];
  if (!profile?.business_name?.trim()) missing.push('Razón social');
  if (!profile?.ruc?.replace(/[^\d]/g, '')) missing.push('RUC o CI');
  if (!profile?.billing_email?.trim()) missing.push('Correo de facturación');
  if (!profile?.phone?.trim()) missing.push('Teléfono');
  if (!profile?.fiscal_address?.trim()) missing.push('Dirección fiscal');
  return missing;
}

export default function SubscriptionsAdminScreen() {
  const colors = usePalette();
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Momento de la última carga: los días que faltan se cuentan desde ahí, no en cada render.
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchSubscription()
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoadedAt(Date.now());
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar la suscripción.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const planName = data?.plan?.name || data?.subscription?.plan || 'Plan Activo';
  const status = statusInfo(data?.subscription?.status || 'active');
  const periodEnd = data?.subscription?.current_period_ends_at || data?.subscription?.trial_ends_at || null;
  const daysLeft = periodEnd && loadedAt ? Math.ceil((new Date(periodEnd).getTime() - loadedAt) / 86_400_000) : null;
  const cancelScheduled = data?.subscription?.cancel_at_period_end === true;
  const missingBilling = billingMissingFields(data?.billingProfile ?? null);

  const limits = data?.plan?.limits || {};
  const usage = data?.usage || { branches: 0, users: 0, products: 0, registers: 0 };

  const renderQuotaBar = (label: string, current: number, max: number | null | undefined, icon: keyof typeof Ionicons.glyphMap) => {
    const isUnlimited = max === null || max === undefined || max < 0;
    const ratio = isUnlimited ? 0.3 : Math.min(1, current / Math.max(1, max));
    const percent = Math.round(ratio * 100);
    const isNearLimit = !isUnlimited && ratio >= 0.85;

    return (
      <View style={[styles.quotaBox, { borderColor: colors.border }]}>
        <View style={styles.quotaHead}>
          <View style={styles.quotaTitleRow}>
            <Ionicons name={icon} size={16} color={palette.primary} />
            <Text style={[styles.quotaLabel, { color: colors.text }]}>{label}</Text>
          </View>
          <Text style={[styles.quotaValues, { color: isNearLimit ? '#DC2626' : colors.text }]}>
            {current} {isUnlimited ? '/ Ilimitado' : `/ ${max}`}
          </Text>
        </View>
        <View style={[styles.trackBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.fillBar,
              {
                width: isUnlimited ? '100%' : `${percent}%`,
                backgroundColor: isNearLimit ? '#DC2626' : palette.primary,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Suscripción</Text>
        <Text style={[styles.topSub, { color: colors.muted }]}>Plan comercial, cuotas de uso y facturación</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {!data ? (
          error ? (
            <View style={styles.centerBox}>
              <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          )
        ) : (
          <>
            {/* Tarjeta Plan Actual: sigue el tema claro u oscuro del teléfono */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: palette.primary }]}>
              <View style={styles.heroTop}>
                <View style={styles.flexShrink}>
                  <Text style={[styles.heroSub, { color: colors.muted }]}>Tu plan vigente</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>{planName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: status.background, borderColor: status.color }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>

              {periodEnd && (
                <Text style={[styles.renewalText, { color: colors.muted }]}>
                  {cancelScheduled ? 'Pasa a Gratuito el ' : 'Próxima renovación: '}
                  {new Date(periodEnd).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              )}
            </View>

            {/* Avisos: renovación cercana o datos de facturación incompletos */}
            {daysLeft !== null && daysLeft <= 7 && !cancelScheduled && (
              <View style={[styles.notice, { borderColor: daysLeft < 0 ? palette.danger : '#D97706' }]}>
                <Ionicons name="alert-circle" size={18} color={daysLeft < 0 ? palette.danger : '#D97706'} />
                <Text style={[styles.small, styles.flexShrink, { color: colors.text }]}>
                  {daysLeft < 0
                    ? `Tu plan venció hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'}. Pagá para conservarlo.`
                    : daysLeft === 0
                      ? 'Tu plan se renueva hoy.'
                      : `Tu plan se renueva en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}.`}
                </Text>
              </View>
            )}

            {/* Pagar: tarjeta o QR en la web, transferencia acá mismo */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: palette.success }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="wallet-outline" size={18} color={palette.success} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Pagar la suscripción</Text>
              </View>
              {missingBilling.length > 0 && (
                <Text style={[styles.small, { color: '#B45309' }]}>
                  Para pagar con tarjeta o QR completá tus datos de facturación (falta: {missingBilling.join(', ')}).
                </Text>
              )}
              <Pressable
                onPress={() => void openWeb('/admin/subscriptions#pay')}
                style={[styles.primaryBtn, { backgroundColor: palette.success }]}>
                <Ionicons name="card-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>Pagar con tarjeta o QR</Text>
              </Pressable>
              <Pressable
                onPress={() => void openWeb('/admin/subscriptions/change-plan')}
                style={[styles.outlineBtn, styles.centered, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Cambiar de plan</Text>
              </Pressable>
            </View>

            <SubscriptionTransferCard onChanged={reload} />

            {/* Cuotas de Uso del Plan */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Consumo y Límites del Plan</Text>

              {renderQuotaBar('Sucursales', usage.branches, limits.branches, 'business-outline')}
              {renderQuotaBar('Miembros de equipo', usage.users, limits.users, 'people-outline')}
              {renderQuotaBar('Productos en catálogo', usage.products, limits.products, 'cube-outline')}
              {renderQuotaBar('Cajas registradoras', usage.registers, limits.registers, 'cash-outline')}
            </View>

            {/* Módulos Habilitados */}
            {data.plan?.modules && data.plan.modules.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Módulos Incluidos</Text>
                <View style={styles.moduleGrid}>
                  {data.plan.modules.map((m) => (
                    <View key={m} style={[styles.moduleChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={[styles.moduleText, { color: colors.text }]}>
                        {m.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Perfil de Facturación */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="receipt-outline" size={18} color={palette.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Datos de Facturación</Text>
              </View>

              {data.billingProfile?.business_name ? (
                <View style={styles.profileData}>
                  <View style={styles.fieldRow}>
                    <Text style={[styles.small, { color: colors.muted }]}>Razón Social:</Text>
                    <Text style={[styles.bold, { color: colors.text }]}>{data.billingProfile.business_name}</Text>
                  </View>
                  {data.billingProfile.ruc && (
                    <View style={styles.fieldRow}>
                      <Text style={[styles.small, { color: colors.muted }]}>RUC / CI:</Text>
                      <Text style={[styles.bold, { color: colors.text }]}>{data.billingProfile.ruc}</Text>
                    </View>
                  )}
                  {data.billingProfile.billing_email && (
                    <View style={styles.fieldRow}>
                      <Text style={[styles.small, { color: colors.muted }]}>Email:</Text>
                      <Text style={[styles.bold, { color: colors.text }]}>{data.billingProfile.billing_email}</Text>
                    </View>
                  )}
                  {data.billingProfile.fiscal_address && (
                    <View style={styles.fieldRow}>
                      <Text style={[styles.small, { color: colors.muted }]}>Dirección Fiscal:</Text>
                      <Text style={[styles.bold, { color: colors.text }]}>{data.billingProfile.fiscal_address}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyBilling}>
                  <Text style={[styles.small, { color: colors.muted }]}>
                    No hay datos fiscales guardados. Podés completarlos desde la web.
                  </Text>
                  <Pressable
                    onPress={() => void openWeb('/admin/subscriptions/billing')}
                    style={[styles.outlineBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.bold, { color: palette.primary }]}>Completar datos fiscales ›</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  topSub: { fontSize: 12, marginTop: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  loading: { paddingVertical: 40 },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  bold: { fontSize: 13, fontWeight: '800' },
  small: { fontSize: 12 },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    gap: 10,
  },
  flexShrink: { flexShrink: 1 },
  centered: { alignItems: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroSub: { fontSize: 12, fontWeight: '600' },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  renewalText: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotaBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  quotaHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quotaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotaLabel: { fontSize: 13, fontWeight: '700' },
  quotaValues: { fontSize: 13, fontWeight: '800' },
  trackBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 4 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  moduleText: { fontSize: 11, fontWeight: '700' },
  profileData: { gap: 8 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyBilling: { gap: 8, alignItems: 'flex-start' },
});
