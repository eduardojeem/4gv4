import { usePanel } from '@/lib/panel';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CollectSheet } from '@/components/collect-sheet';
import {
  CREDIT_STATUS,
  creditCode,
  dateOnly,
  deleteCustomer,
  fetchCustomer,
  fetchCustomerCredits,
  fetchCustomerDebts,
  fetchCustomerHistory,
  fetchCustomerMetrics,
  isWholesale,
  type CreditRow,
  type Customer,
  type CustomerMetrics,
  type DebtSummary,
  type HistoryItem,
  type InstallmentRow,
  type PaymentRow,
} from '@/lib/customers';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type Colors = ReturnType<typeof usePalette>;
type Tab = 'summary' | 'credits' | 'history';
type Credits = { credits: CreditRow[]; installments: InstallmentRow[]; payments: PaymentRow[] };

const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Resumen' },
  { key: 'credits', label: 'Créditos' },
  { key: 'history', label: 'Historial' },
];

const PAYMENT: Record<HistoryItem['payment'], { label: string; color: string }> = {
  paid: { label: 'Pagado', color: '#16A34A' },
  partial: { label: 'Parcial', color: '#D97706' },
  unpaid: { label: 'Pendiente', color: '#DC2626' },
  credit: { label: 'A crédito', color: '#2563EB' },
  credit_settled: { label: 'Crédito pagado', color: '#16A34A' },
  no_charge: { label: 'Sin cargo', color: '#64748B' },
};

const METHOD: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

const waNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `595${digits.slice(1)}` : digits;
};

/** Ficha del cliente, como /dashboard/customers/[id]: resumen, deudas, créditos e historial. */
export default function CustomerDetail() {
  const colors = usePalette();
  const { can } = usePanel();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = params.id;
  const [tab, setTab] = useState<Tab>(params.tab === 'credits' || params.tab === 'history' ? params.tab : 'summary');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);
  const [debts, setDebts] = useState<DebtSummary | null>(null);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [history, setHistory] = useState<{ items: HistoryItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [collect, setCollect] = useState<{ focus?: string } | null>(null);
  const [openCredit, setOpenCredit] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCustomer(id)
      .then((row) => {
        if (!active) return;
        setCustomer(row);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el cliente.');
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    const when = <T,>(set: (value: T) => void) => (value: T) => {
      if (active) set(value);
    };
    fetchCustomerMetrics(id).then(when(setMetrics)).catch(() => undefined);
    fetchCustomerDebts(id).then(when(setDebts)).catch(() => undefined);
    fetchCustomerCredits(id)
      .then(when(setCredits))
      .catch(() => when(setCredits)({ credits: [], installments: [], payments: [] }));
    fetchCustomerHistory(id)
      .then(when(setHistory))
      .catch(() => when(setHistory)({ items: [] }));
    return () => {
      active = false;
    };
  }, [id, attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/panel/customers' as never));

  const remove = () => {
    if (!customer) return;
    Alert.alert('Eliminar cliente', `¿Eliminar a ${customer.name}? Si tiene ventas, créditos o reparaciones no se va a poder.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          deleteCustomer(customer.id)
            .then(() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/panel/customers' as never);
            })
            .catch((err) => Alert.alert('No se eliminó', err instanceof Error ? err.message : 'Intentá de nuevo.'))
            .finally(() => setDeleting(false));
        },
      },
    ]);
  };

  const topBar = (
    <View style={[styles.topBar, { borderColor: colors.border }]}>
      <Pressable onPress={back} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.topTitle, { color: colors.text }]}>{customer?.name ?? 'Cliente'}</Text>
      {customer && (
        <>
          <Pressable disabled={!can('crm.customers.manage')} onPress={() => router.push(`/panel/customers/form?id=${customer.id}` as never)} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Editar">
            <Ionicons name="create-outline" size={21} color={colors.text} />
          </Pressable>
          <Pressable onPress={remove} disabled={deleting || !can('crm.customers.manage')} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Eliminar">
            {deleting ? <ActivityIndicator color={palette.danger} /> : <Ionicons name="trash-outline" size={20} color={palette.danger} />}
          </Pressable>
        </>
      )}
    </View>
  );

  if (!customer) {
    return (
      <View style={styles.flex}>
        {topBar}
        <View style={styles.center}>
          {error ? (
            <>
              <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={palette.primary} />
          )}
        </View>
      </View>
    );
  }

  const pendingDebts = debts?.debts.filter((debt) => debt.pendingAmount > 0) ?? [];

  return (
    <View style={styles.flex}>
      {topBar}
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        <Header customer={customer} colors={colors} />

        <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, selected && { backgroundColor: palette.primary }]}>
                <Text style={[styles.tabText, { color: selected ? '#fff' : colors.text }]}>
                  {item.label}
                  {item.key === 'credits' && credits?.credits.length ? ` (${credits.credits.length})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'summary' && (
          <>
            <View style={styles.kpis}>
              <Kpi label="Debe" value={debts ? formatGs(debts.totalDebt) : '…'} tone={debts?.totalDebt ? palette.danger : undefined} colors={colors} />
              <Kpi label="Vencido" value={debts ? formatGs(debts.overdueDebt) : '…'} tone={debts?.overdueDebt ? palette.danger : undefined} colors={colors} />
              <Kpi label="Saldo a favor" value={debts ? formatGs(debts.storeBalance) : '…'} tone={debts?.storeBalance ? palette.success : undefined} colors={colors} />
              <Kpi label="Facturado" value={metrics ? formatGs(metrics.billed) : '…'} colors={colors} />
              <Kpi label="Compras" value={metrics ? String(metrics.purchases) : '…'} colors={colors} />
              <Kpi label="Reparaciones" value={metrics ? String(metrics.repairs) : '…'} colors={colors} />
            </View>

            <Card title="Deudas pendientes" colors={colors} right={debts && debts.collectableDebt > 0 ? <CollectButton onPress={() => setCollect({})} /> : null}>
              {!debts ? (
                <ActivityIndicator color={palette.primary} />
              ) : pendingDebts.length === 0 ? (
                <Text style={[styles.muted, { color: colors.muted }]}>No debe nada. 🎉</Text>
              ) : (
                pendingDebts.map((debt) => (
                  <Pressable key={debt.id} disabled={!debt.collectable} onPress={() => setCollect({ focus: debt.id })} style={[styles.line, { borderColor: colors.border }]}>
                    <Ionicons name={debt.type === 'repair' ? 'construct-outline' : debt.type === 'sale' ? 'cart-outline' : 'calendar-outline'} size={18} color={debt.isOverdue ? palette.danger : colors.muted} />
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={[styles.bold, { color: colors.text }]}>{debt.title}</Text>
                      <Text numberOfLines={1} style={[styles.small, { color: debt.isOverdue ? palette.danger : colors.muted }]}>
                        {[debt.subtitle, debt.dueDate ? `${debt.isOverdue ? 'Venció' : 'Vence'} ${dateOnly(debt.dueDate)}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[styles.bold, { color: debt.isOverdue ? palette.danger : colors.text }]}>{formatGs(debt.pendingAmount)}</Text>
                  </Pressable>
                ))
              )}
              {debts && debts.creditLimit > 0 && <Text style={[styles.small, { color: colors.muted }]}>Límite de crédito: {formatGs(debts.creditLimit)}</Text>}
            </Card>

            <Card title="Datos" colors={colors}>
              <Info icon="card-outline" label="CI / RUC" value={customer.ruc} colors={colors} />
              <Info icon="mail-outline" label="Email" value={customer.email} colors={colors} />
              <Info icon="call-outline" label={customer.alternate_phone_label ? `Otro contacto (${customer.alternate_phone_label})` : 'Otro contacto'} value={customer.alternate_phone} colors={colors} />
              <Info icon="location-outline" label="Dirección" value={[customer.address, customer.city].filter(Boolean).join(', ')} colors={colors} />
              <Info icon="pricetag-outline" label="Código" value={customer.customer_code} colors={colors} />
              <Info icon="calendar-outline" label="Cliente desde" value={customer.created_at ? dateOnly(customer.created_at) : null} colors={colors} />
              {metrics?.loyaltyPoints ? <Info icon="star-outline" label="Puntos" value={String(metrics.loyaltyPoints)} colors={colors} /> : null}
              {customer.notes ? <Text style={[styles.notes, { color: colors.text, backgroundColor: colors.background }]}>{customer.notes}</Text> : null}
            </Card>
          </>
        )}

        {tab === 'credits' && (
          <CreditsTab
            credits={credits}
            openCredit={openCredit}
            onToggle={(creditId) => setOpenCredit((current) => (current === creditId ? null : creditId))}
            onCollect={(installmentId) => setCollect({ focus: installmentId })}
            colors={colors}
          />
        )}

        {tab === 'history' && <HistoryTab history={history} colors={colors} />}
      </ScrollView>

      {collect && (
        <CollectSheet
          customerId={customer.id}
          customerName={customer.name}
          focusDebtId={collect.focus}
          onClose={() => setCollect(null)}
          onDone={() => {
            setCollect(null);
            reload();
          }}
        />
      )}
    </View>
  );
}

function Header({ customer, colors }: { customer: Customer; colors: Colors }) {
  const phone = customer.phone?.trim();
  const wholesale = isWholesale(customer);
  return (
    <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heroRow}>
        <View style={[styles.avatar, { backgroundColor: wholesale ? '#7C3AED1A' : 'rgba(37,99,235,0.1)' }]}>
          <Text style={[styles.avatarText, { color: wholesale ? '#7C3AED' : palette.primary }]}>{customer.name.trim().charAt(0).toUpperCase() || '?'}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]}>{customer.name}</Text>
          <View style={styles.tags}>
            {wholesale && <Tag label="Mayorista" color="#7C3AED" />}
            {customer.customer_type === 'empresa' && <Tag label="Empresa" color="#0891B2" />}
            {customer.status === 'inactive' && <Tag label="Inactivo" color="#64748B" />}
            {phone ? <Text style={[styles.small, { color: colors.muted }]}>{phone}</Text> : null}
          </View>
        </View>
      </View>
      {phone ? (
        <View style={styles.contactRow}>
          <Pressable onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`)} style={[styles.contact, { borderColor: colors.border }]}>
            <Ionicons name="call-outline" size={17} color={palette.primary} />
            <Text style={[styles.bold, { color: palette.primary }]}>Llamar</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(`https://wa.me/${waNumber(phone)}`)} style={[styles.contact, { borderColor: colors.border }]}>
            <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
            <Text style={[styles.bold, { color: '#16A34A' }]}>WhatsApp</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function CreditsTab({
  credits,
  openCredit,
  onToggle,
  onCollect,
  colors,
}: {
  credits: Credits | null;
  openCredit: string | null;
  onToggle: (id: string) => void;
  onCollect: (installmentId: string) => void;
  colors: Colors;
}) {
  if (!credits) return <ActivityIndicator style={styles.loading} color={palette.primary} />;
  if (credits.credits.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="wallet-outline" size={34} color={colors.muted} />
        <Text style={[styles.bold, { color: colors.text }]}>No tiene créditos</Text>
        <Text style={[styles.small, { color: colors.muted }]}>Las ventas a crédito del POS aparecen acá con sus cuotas.</Text>
      </View>
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      {credits.credits.map((credit) => {
        const installments = credits.installments.filter((row) => row.credit_id === credit.id).sort((a, b) => a.installment_number - b.installment_number);
        const payments = credits.payments.filter((row) => row.credit_id === credit.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
        const total = installments.reduce((sum, row) => sum + Number(row.amount), 0);
        const paid = installments.reduce((sum, row) => sum + Number(row.amount_paid ?? (row.status === 'paid' ? row.amount : 0)), 0);
        const pending = Math.max(0, total - paid);
        const progress = total > 0 ? Math.min(1, paid / total) : 0;
        const status = CREDIT_STATUS[credit.status] ?? CREDIT_STATUS.active;
        const open = openCredit === credit.id;
        const next = installments.find((row) => row.status !== 'paid');
        return (
          <View key={credit.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable onPress={() => onToggle(credit.id)} style={styles.creditHead}>
              <View style={styles.flex}>
                <View style={styles.tags}>
                  <Text style={[styles.bold, { color: colors.text }]}>{creditCode(credit)}</Text>
                  <Tag label={status.label} color={status.color} />
                </View>
                <Text style={[styles.small, { color: colors.muted }]}>
                  {formatGs(Number(credit.principal))} · {credit.term_months} cuotas · desde {dateOnly(credit.start_date)}
                </Text>
              </View>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            <View style={[styles.bar, { backgroundColor: colors.background }]}>
              <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <View style={styles.creditTotals}>
              <Text style={[styles.small, { color: colors.muted }]}>Pagado {formatGs(paid)}</Text>
              <Text style={[styles.small, { color: pending ? palette.danger : palette.success, fontWeight: '800' }]}>{pending ? `Debe ${formatGs(pending)}` : 'Saldado'}</Text>
            </View>
            {!open && next && (
              <Text style={[styles.small, { color: next.due_date < today ? palette.danger : colors.muted }]}>
                Próxima: cuota {next.installment_number} · {dateOnly(next.due_date)} · {formatGs(Number(next.amount) - Number(next.amount_paid ?? 0))}
              </Text>
            )}
            {open && (
              <View style={styles.installments}>
                {installments.map((row) => {
                  const rest = Math.max(0, Number(row.amount) - Number(row.amount_paid ?? 0));
                  const late = row.status !== 'paid' && row.due_date < today;
                  const color = row.status === 'paid' ? palette.success : late ? palette.danger : colors.muted;
                  return (
                    <View key={row.id} style={[styles.line, { borderColor: colors.border }]}>
                      <Ionicons name={row.status === 'paid' ? 'checkmark-circle' : late ? 'alert-circle' : 'ellipse-outline'} size={18} color={color} />
                      <View style={styles.flex}>
                        <Text style={[styles.bold, { color: colors.text }]}>Cuota {row.installment_number}</Text>
                        <Text style={[styles.small, { color }]}>
                          {row.status === 'paid' ? `Pagada${row.paid_at ? ` ${dateOnly(row.paid_at)}` : ''}` : `${late ? 'Venció' : 'Vence'} ${dateOnly(row.due_date)}`}
                        </Text>
                      </View>
                      <Text style={[styles.bold, { color: colors.text }]}>{formatGs(row.status === 'paid' ? Number(row.amount) : rest)}</Text>
                      {row.status !== 'paid' && (
                        <Pressable onPress={() => onCollect(row.id)} style={styles.miniCollect}>
                          <Text style={styles.miniCollectText}>Cobrar</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {payments.length > 0 && (
                  <>
                    <Text style={[styles.subTitle, { color: colors.text }]}>Pagos</Text>
                    {payments.map((payment) => (
                      <View key={payment.id} style={styles.payment}>
                        <Text style={[styles.small, { color: colors.muted }]}>
                          {dateOnly(payment.created_at)} · {METHOD[payment.payment_method ?? ''] ?? payment.payment_method ?? '—'}
                        </Text>
                        <Text style={[styles.small, { color: palette.success, fontWeight: '800' }]}>{formatGs(Number(payment.amount))}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}

function HistoryTab({ history, colors }: { history: { items: HistoryItem[] } | null; colors: Colors }) {
  if (!history) return <ActivityIndicator style={styles.loading} color={palette.primary} />;
  if (history.items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="time-outline" size={34} color={colors.muted} />
        <Text style={[styles.bold, { color: colors.text }]}>Sin movimientos</Text>
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {history.items.map((item) => {
        const payment = PAYMENT[item.payment] ?? PAYMENT.paid;
        return (
          <Pressable
            key={`${item.kind}-${item.id}`}
            disabled={item.kind !== 'repair'}
            onPress={() => router.push(`/panel/repairs/${item.id}` as never)}
            style={[styles.line, { borderColor: colors.border }]}>
            <Ionicons name={item.kind === 'repair' ? 'construct-outline' : 'receipt-outline'} size={18} color={colors.muted} />
            <View style={styles.flex}>
              <Text numberOfLines={1} style={[styles.bold, { color: colors.text }]}>{item.title || item.reference}</Text>
              <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
                {[item.reference, dateOnly(item.date), item.detail].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.bold, { color: colors.text }]}>{formatGs(item.total)}</Text>
              <Text style={[styles.tiny, { color: item.overdue ? palette.danger : payment.color }]}>
                {item.overdue ? 'Vencido' : payment.label}
                {item.balance ? ` · ${formatGs(item.balance)}` : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function CollectButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.collect}>
      <Ionicons name="cash-outline" size={16} color="#fff" />
      <Text style={styles.collectText}>Cobrar</Text>
    </Pressable>
  );
}

function Card({ title, right, colors, children }: { title: string; right?: React.ReactNode; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Kpi({ label, value, tone, colors }: { label: string; value: string; tone?: string; colors: Colors }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function Info({ icon, label, value, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string | null; colors: Colors }) {
  if (!value) return null;
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <Text style={[styles.small, styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.small, styles.flex, styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  muted: { fontSize: 13 },
  loading: { paddingVertical: 30 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  hero: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800' },
  name: { fontSize: 19, fontWeight: '800' },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  contactRow: { flexDirection: 'row', gap: 8 },
  contact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 9 },
  tabText: { fontSize: 13, fontWeight: '800' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '31.5%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  kpiValue: { fontSize: 15, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  collect: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: palette.success, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  collectText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  miniCollect: { backgroundColor: palette.success, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  miniCollectText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  infoLabel: { width: 110 },
  infoValue: { fontWeight: '600' },
  notes: { fontSize: 13, borderRadius: 10, padding: 10, marginTop: 4 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36, paddingHorizontal: 24 },
  creditHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: palette.success, borderRadius: 4 },
  creditTotals: { flexDirection: 'row', justifyContent: 'space-between' },
  installments: { marginTop: 4 },
  subTitle: { fontSize: 13, fontWeight: '800', marginTop: 10, marginBottom: 4 },
  payment: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  historyRight: { alignItems: 'flex-end', gap: 2 },
});
