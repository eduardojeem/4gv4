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

import { fetchSubscription, type SubscriptionDetails } from '@/lib/admin';
import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

export default function SubscriptionsAdminScreen() {
  const colors = usePalette();
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchSubscription()
      .then((res) => {
        if (!active) return;
        setData(res);
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
  const status = data?.subscription?.status || 'active';
  const isActive = status === 'active';
  const isTrial = status === 'trial';

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
            {/* Tarjeta Plan Actual */}
            <View style={[styles.heroCard, { backgroundColor: '#1E1B4B' }]}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroSub}>Tu plan vigente</Text>
                  <Text style={styles.heroTitle}>{planName}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isActive ? 'rgba(22,163,74,0.2)' : 'rgba(217,119,6,0.2)',
                      borderColor: isActive ? '#16A34A' : '#D97706',
                    },
                  ]}>
                  <Text style={[styles.statusText, { color: isActive ? '#4ADE80' : '#FBBF24' }]}>
                    {isActive ? 'Activo' : isTrial ? 'Prueba gratis' : 'Pago pendiente'}
                  </Text>
                </View>
              </View>

              {data.subscription?.current_period_ends_at && (
                <Text style={styles.renewalText}>
                  Próxima renovación:{' '}
                  {new Date(data.subscription.current_period_ends_at).toLocaleDateString('es-PY', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              )}

              <Pressable
                onPress={() => void openWeb('/admin/subscriptions')}
                style={styles.changePlanBtn}>
                <Ionicons name="sparkles" size={16} color="#1E1B4B" />
                <Text style={styles.changePlanText}>Gestionar plan en la web</Text>
              </Pressable>
            </View>

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
    padding: 18,
    gap: 12,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  renewalText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  changePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  changePlanText: { color: '#1E1B4B', fontSize: 13, fontWeight: '800' },
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
