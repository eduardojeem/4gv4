import { BillingCard } from '@/components/subscription/billing-card';
import { usePanel } from '@/lib/panel';
import { navigationColor } from '@/lib/bottom-nav-model';
import { buildSubscriptionExpiryNotice, subscriptionPeriodEnd } from '../../../../src/lib/saas/subscription-expiry-notice';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SubscriptionTransferCard } from '@/components/subscription/transfer-card';
import { fetchSubscription } from '@/lib/admin';
import { formatGs, openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import {
  billingMissingFields,
  isFreePlan,
  moduleLabel,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  redemptionText,
  subscriptionStatus,
  visibleQuotas,
  type StatusTone,
  type SubscriptionDetails,
  type SubscriptionPayment,
} from '@/lib/subscription-model';

/**
 * En el celular la suscripción se consulta y no se compra: Google Play (y la
 * App Store) piden su propio cobro para suscripciones digitales y no permiten
 * mandar a pagar afuera. Pagar, cambiar de plan y transferir quedan en la web;
 * acá se ven el plan, los cupos, los pagos y los datos de facturación.
 */
const PURCHASES_IN_APP = Platform.OS === 'web';

const TONES: Record<StatusTone, { color: string; background: string }> = {
  success: { color: palette.success, background: 'rgba(22,163,74,0.12)' },
  info: { color: palette.primary, background: 'rgba(37,99,235,0.12)' },
  danger: { color: palette.danger, background: 'rgba(220,38,38,0.12)' },
  warning: { color: '#D97706', background: 'rgba(217,119,6,0.12)' },
  neutral: { color: '#64748B', background: 'rgba(100,116,139,0.12)' },
};

const PAID = new Set(['paid', 'approved']);

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Asuncion' });
}

function openReceipt(url: string) {
  void (/^https?:\/\//.test(url) ? WebBrowser.openBrowserAsync(url) : openWeb(url.startsWith('/') ? url : `/${url}`));
}

export default function SubscriptionsAdminScreen() {
  const colors = usePalette();
  const [data, setData] = useState<SubscriptionDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Momento de la última carga: los días que faltan se cuentan desde ahí, no en cada render.
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [modulesExpanded, setModulesExpanded] = useState(false);
  const [couponsExpanded, setCouponsExpanded] = useState(false);
  const [billingEditing, setBillingEditing] = useState(false);
  const { data: panel } = usePanel();
  const accent = navigationColor(panel?.organization.brandColor, panel?.organization.customBrandColor);

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

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && !billingEditing) reload(); });
    return () => listener.remove();
  }, [reload, billingEditing]);

  const free = isFreePlan(data?.plan ?? null);
  const planName = data?.plan?.name || data?.subscription?.plan || 'Gratis';
  const status = subscriptionStatus(data?.subscription?.status ?? (free && data?.plan ? 'free' : null));
  const tone = TONES[status.tone];
  const periodEnd = subscriptionPeriodEnd(data?.subscription);
  const expiry = loadedAt ? buildSubscriptionExpiryNotice(data?.subscription ?? null, loadedAt) : null;
  const cancelScheduled = data?.subscription?.cancel_at_period_end === true;
  const missingBilling = billingMissingFields(data?.billingProfile ?? null);
  const payments = data?.payments ?? [];
  const visiblePayments = showAllPayments ? payments : payments.slice(0, 5);

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Text style={[styles.topTitle, { color: colors.text }]}>Suscripción</Text>
        <Text style={[styles.topSub, { color: colors.muted }]}>Plan, cupos, pagos y facturación</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} enabled={!billingEditing} tintColor={accent} />}>
        {!data ? (
          error ? (
            <View style={styles.centerBox}>
              <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator style={styles.loading} color={accent} />
          )
        ) : (
          <>
            {error && <View accessibilityRole="alert" style={[styles.notice,{borderColor:palette.danger}]}><Text style={[styles.small,{color:colors.text,flex:1}]}>{error} Se muestran los últimos datos cargados.</Text><Pressable accessibilityRole="button" onPress={reload} style={{padding:10,minHeight:44}}><Text style={{color:colors.text,fontWeight:'700'}}>Reintentar</Text></Pressable></View>}
            {/* Plan vigente */}
            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: accent }]}>
              <View style={styles.heroTop}>
                <View style={styles.flexShrink}>
                  <Text style={[styles.heroSub, { color: colors.muted }]}>Tu plan</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>{planName}</Text>
                  <Text style={[styles.small,{color:colors.muted}]}>Actualizado: {loadedAt ? new Date(loadedAt).toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'}) : 'Sin confirmar'}</Text>
                  {!free && data.plan?.price_monthly ? (
                    <Text style={[styles.small, { color: colors.muted }]}>{formatGs(data.plan.price_monthly)} por mes</Text>
                  ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: tone.background, borderColor: tone.color }]}>
                  <Text style={[styles.statusText, { color: tone.color }]}>{status.label}</Text>
                </View>
              </View>

              {/* El plan gratis no se renueva: no tiene fecha que mostrar. */}
              {periodEnd && !free && (
                <Text style={[styles.renewalText, { color: colors.muted }]}>
                  {cancelScheduled ? 'Pasa a Gratis el ' : status.tone === 'info' ? 'La prueba termina el ' : 'Vigente hasta el '}
                  {new Date(periodEnd).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Asuncion' })}
                </Text>
              )}
            </View>

            {expiry && <View style={[styles.notice, { borderColor: expiry.tone === 'danger' ? palette.danger : '#D97706' }]}><Ionicons name="time-outline" size={20} color={colors.text}/><Text style={[styles.small,styles.flexShrink,{color:colors.text}]}>{expiry.title}. Fecha: {expiry.dateLabel}.</Text></View>}

            {PURCHASES_IN_APP ? (
              <>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: palette.success }]}>
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="wallet-outline" size={18} color={palette.success} />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Pagar la suscripción</Text>
                  </View>
                  {missingBilling.length > 0 && (data.paymentAvailability.bancard_card || data.paymentAvailability.stripe) && (
                    <Text style={[styles.small, { color: '#B45309' }]}>
                      Para pagar en línea completá tus datos de facturación (falta: {missingBilling.join(', ')}).
                    </Text>
                  )}
                  {(data.paymentAvailability.bancard_card || data.paymentAvailability.stripe || data.paymentAvailability.transfer) ? <Pressable onPress={() => void openWeb('/admin/subscriptions#pay')} style={[styles.primaryBtn, { backgroundColor: palette.success }]}>
                    <Ionicons name="card-outline" size={16} color="#fff" />
                    <Text style={styles.primaryText}>Ver medios de pago disponibles</Text>
                  </Pressable> : <Text style={[styles.small, { color: colors.muted }]}>No hay medios de pago disponibles. Contactá con soporte para renovar tu plan.</Text>}
                  <Pressable onPress={() => void openWeb('/admin/subscriptions/change-plan')} style={[styles.outlineBtn, styles.centered, { borderColor: colors.border }]}>
                    <Text style={[styles.bold, { color: colors.text }]}>Cambiar de plan</Text>
                  </Pressable>
                </View>
                <SubscriptionTransferCard onChanged={reload} allowCreate={data.paymentAvailability.transfer} />
              </>
            ) : (
              <View style={[styles.notice, { borderColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
                <Text style={[styles.small, styles.flexShrink, { color: colors.muted }]}>
                  Tu plan se administra desde tu cuenta de MiTiendaPy en la web. Acá podés ver el plan, los cupos y tus pagos.
                </Text>
              </View>
            )}

            {/* Cupos del plan */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Uso y límites del plan</Text>
              {data.repairUsage && data.plan?.modules.includes('repairs') && <Text style={[styles.small,{color:colors.muted}]}>El cupo de reparaciones se renueva el {formatDate(data.repairUsage.endsAt)} (hora de Paraguay). No se acumula; las reparaciones anteriores siguen guardadas.</Text>}
              {visibleQuotas(data).sort((a,b) => Number(b.key === (panel?.businessFocus === 'repairs' ? 'repairs' : panel?.businessFocus === 'agenda' ? 'services' : 'products')) - Number(a.key === (panel?.businessFocus === 'repairs' ? 'repairs' : panel?.businessFocus === 'agenda' ? 'services' : 'products'))).map((quota) => {
                const unlimited = quota.max === null || (typeof quota.max === 'number' && quota.max < 0);
                const known = quota.current !== null && quota.max !== undefined;
                const ratio = unlimited || !known ? 0 : Math.min(1, (quota.current ?? 0) / Math.max(1, quota.max ?? 1));
                const near = known && !unlimited && ratio >= 0.85;
                const barColor = near ? palette.danger : accent;
                return (
                  <View key={quota.key} style={styles.quotaRow} accessible accessibilityLabel={`${quota.label}: ${quota.current ?? 'sin información'} de ${unlimited ? 'ilimitado' : quota.max ?? 'sin información'}`}>
                    <View style={styles.quotaHead}>
                      <Text style={[styles.quotaLabel, { color: colors.text }]}>{quota.label}</Text>
                      <Text style={[styles.quotaValues, { color: near ? palette.danger : colors.text }]}>
                        {quota.current ?? 'Sin dato'} / {unlimited ? 'Ilimitado' : quota.max ?? 'Sin dato'}
                      </Text>
                    </View>
                    {!unlimited && known && (
                      <View style={[styles.trackBar, { backgroundColor: colors.border }]}>
                        <View style={[styles.fillBar, { width: `${Math.round(ratio * 100)}%`, backgroundColor: barColor }]} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Módulos */}
            {data.plan && data.plan.modules.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable accessibilityRole="button" accessibilityState={{expanded:modulesExpanded}} onPress={() => setModulesExpanded(value=>!value)} style={{minHeight:44,justifyContent:'center'}}><Text style={[styles.cardTitle, { color: colors.text }]}>Incluido en tu plan · {data.plan.modules.length} {modulesExpanded ? '⌃' : '⌄'}</Text></Pressable>
                {modulesExpanded && <View style={styles.moduleGrid}>
                  {data.plan.modules.map((m) => (
                    <View key={m} style={[styles.moduleChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="checkmark-circle" size={15} color={palette.success} />
                      <Text style={[styles.moduleText, { color: colors.text }]}>{moduleLabel(m)}</Text>
                    </View>
                  ))}
                </View>}
              </View>
            )}

            {/* Historial de pagos */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="time-outline" size={18} color={accent} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>Pagos</Text>
              </View>
              {payments.length >= 25 && <Text style={[styles.small,{color:colors.muted}]}>Se muestran los últimos 25 pagos.</Text>}
              {payments.length === 0 ? (
                <Text style={[styles.small, { color: colors.muted }]}>Todavía no hay pagos registrados.</Text>
              ) : (
                <>
                  {visiblePayments.map((payment, index) => (
                    <PaymentRow key={payment.id} payment={payment} colors={colors} first={index === 0} />
                  ))}
                  {payments.length > 5 && (
                    <Pressable onPress={() => setShowAllPayments((v) => !v)} style={styles.linkBtn} accessibilityRole="button">
                      <Text style={[styles.bold, { color: accent }]}>{showAllPayments ? 'Ver menos' : `Ver los ${payments.length} pagos`}</Text>
                    </Pressable>
                  )}
                </>
              )}
            </View>

            {/* Cupones */}
            {data.promoRedemptions.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeaderRow}>
                  <Ionicons name="pricetag-outline" size={18} color={accent} />
                  <Pressable accessibilityRole="button" accessibilityState={{expanded:couponsExpanded}} onPress={()=>setCouponsExpanded(value=>!value)} style={{minHeight:44,justifyContent:'center'}}><Text style={[styles.cardTitle, { color: colors.text }]}>Cupones aplicados · {data.promoRedemptions.length} {couponsExpanded?'⌃':'⌄'}</Text></Pressable>
                </View>
                {couponsExpanded && data.promoRedemptions.map((redemption) => (
                  <View key={redemption.id} style={styles.fieldRow}>
                    <Text style={[styles.small, styles.flexShrink, { color: colors.text }]}>
                      {redemptionText(redemption.benefit_snapshot, formatGs)}
                      {typeof redemption.benefit_snapshot?.code === 'string' ? ` · ${redemption.benefit_snapshot.code}` : ''}
                    </Text>
                    <Text style={[styles.small, { color: colors.muted }]}>{formatDate(redemption.redeemed_at)}</Text>
                  </View>
                ))}
              </View>
            )}

            <BillingCard
              profile={data.billingProfile}
              onEditingChange={setBillingEditing}
              onSaved={(billingProfile) => setData((prev) => (prev ? { ...prev, billingProfile } : prev))}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function PaymentRow({ payment, colors, first }: { payment: SubscriptionPayment; colors: ReturnType<typeof usePalette>; first: boolean }) {
  const paid = PAID.has(payment.status);
  const failed = ['failed', 'rejected', 'cancelled'].includes(payment.status);
  const statusColor = paid ? palette.success : failed ? palette.danger : payment.status === 'refunded' ? '#64748B' : '#D97706';
  const method = PAYMENT_METHOD_LABEL[payment.payment_method ?? ''] ?? PAYMENT_METHOD_LABEL[payment.provider ?? ''] ?? null;
  return (
    <View style={[styles.paymentRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
      <View style={styles.flexShrink}>
        <Text style={[styles.bold, { color: colors.text }]}>{formatGs(Number(payment.amount) || 0)}</Text>
        <Text style={[styles.small, { color: colors.muted }]}>
          {formatDate(payment.paid_at || payment.created_at)}{method ? ` · ${method}` : ''}
        </Text>
      </View>
      <View style={styles.paymentRight}>
        <Text style={[styles.statusText, { color: statusColor }]}>{PAYMENT_STATUS_LABEL[payment.status] ?? payment.status}</Text>
        {payment.receipt_url && paid ? (
          <Pressable onPress={() => openReceipt(payment.receipt_url as string)} hitSlop={8} accessibilityRole="link" accessibilityLabel="Ver comprobante del pago">
            <Text style={[styles.small, { color: palette.primary, fontWeight: '700' }]}>Comprobante</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  topSub: { fontSize: 12, marginTop: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  loading: { paddingVertical: 40 },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  bold: { fontSize: 13, fontWeight: '800' },
  small: { fontSize: 12, lineHeight: 17 },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  heroCard: { borderRadius: 18, borderWidth: 1.5, padding: 18, gap: 10 },
  flexShrink: { flexShrink: 1 },
  centered: { alignItems: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, backgroundColor: palette.primary },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  heroSub: { fontSize: 12, fontWeight: '600' },
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 },
  statusBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  renewalText: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quotaRow: { gap: 6 },
  quotaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quotaLabel: { fontSize: 13, fontWeight: '700' },
  quotaValues: { fontSize: 13, fontWeight: '800' },
  trackBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 4 },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  moduleText: { fontSize: 12, fontWeight: '700' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10 },
  paymentRight: { alignItems: 'flex-end', gap: 2 },
  linkBtn: { alignItems: 'center', paddingVertical: 6 },
  profileData: { gap: 8 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  fieldValue: { flexShrink: 1, textAlign: 'right' },
  form: { gap: 10 },
  formField: { gap: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  formBtn: { flex: 1, marginTop: 0, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
