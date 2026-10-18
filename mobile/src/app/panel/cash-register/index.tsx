import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { CashSheet } from '@/components/pos-cash';
import { BILLS, COINS, fetchClosures, recordCashCount, type Closure } from '@/lib/cash';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { fetchPosSession, openCashRegister, type PosSession } from '@/lib/pos';

type Colors = ReturnType<typeof usePalette>;
type CashMode = 'summary' | 'cash_in' | 'cash_out' | 'close';

const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

const MOVEMENT: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; sign: string }> = {
  opening: { label: 'Apertura', icon: 'lock-open-outline', color: '#2563EB', sign: '' },
  sale: { label: 'Venta', icon: 'cart-outline', color: '#16A34A', sign: '+' },
  cash_in: { label: 'Ingreso', icon: 'arrow-down-circle-outline', color: '#16A34A', sign: '+' },
  cash_out: { label: 'Egreso', icon: 'arrow-up-circle-outline', color: '#DC2626', sign: '−' },
};
const METHOD: Record<string, string> = { cash: 'efectivo', card: 'tarjeta', transfer: 'transferencia' };

/**
 * Caja, como /dashboard/pos/caja: el turno abierto con lo que tiene que haber
 * en el cajón, ingresos y egresos, arqueos con billetes y monedas, el cierre y
 * el historial de cierres con sus diferencias.
 */
export default function CashRegisterScreen() {
  const colors = usePalette();
  const { findItem, loading: panelLoading } = usePanel();
  const [session, setSession] = useState<PosSession | null>(null);
  const [closures, setClosures] = useState<Closure[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cash, setCash] = useState<CashMode | null>(null);
  const [counting, setCounting] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPosSession()
      .then((data) => {
        if (!active) return;
        setSession(data);
        setError(null);
        if (data.permissions.manageCash) {
          fetchClosures(data.branch.id)
            .then((rows) => active && setClosures(rows))
            .catch(() => active && setClosures([]));
        } else setClosures([]);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo leer la caja.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  if (!panelLoading && !findItem('cash-register') && !findItem('pos')) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.muted} />
        <Text style={[styles.h1, { color: colors.text }]}>Caja no disponible</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
            <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text>
            <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={palette.primary} />
        )}
      </View>
    );
  }

  const summary = session.summary;
  const turn = session.session;
  const manage = session.permissions.manageCash;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Caja</Text>
          <Text style={[styles.muted, styles.left, { color: colors.muted }]}>{session.branch.name}</Text>
        </View>

        {turn ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.dot} />
                <Text style={styles.heroLabel}>
                  {turn.registerName} · abierta {when(turn.openedAt)}
                </Text>
              </View>
              <Text style={styles.heroCaption}>Tiene que haber en el cajón</Text>
              <Text style={styles.heroTotal}>{formatGs(summary?.expectedCash ?? turn.openingBalance)}</Text>
              <Text style={styles.heroSub}>
                Inicial {formatGs(turn.openingBalance)} · {summary?.salesCount ?? 0} ventas por {formatGs(summary?.salesTotal ?? 0)}
              </Text>
            </View>

            <View style={styles.grid}>
              <Kpi icon="cash-outline" label="Efectivo" value={summary?.cash ?? 0} colors={colors} />
              <Kpi icon="card-outline" label="Tarjeta" value={summary?.card ?? 0} colors={colors} />
              <Kpi icon="swap-horizontal-outline" label="Transferencia" value={summary?.transfer ?? 0} colors={colors} />
              <Kpi icon="arrow-down-circle-outline" label="Ingresos" value={summary?.cashIn ?? 0} tone={palette.success} colors={colors} />
              <Kpi icon="arrow-up-circle-outline" label="Egresos" value={summary?.cashOut ?? 0} tone={palette.danger} colors={colors} />
              <Kpi icon="receipt-outline" label="Ventas" value={summary?.salesTotal ?? 0} colors={colors} />
            </View>

            {manage ? (
              <View style={styles.actions}>
                <Action icon="add-circle-outline" label="Ingreso" color={palette.success} onPress={() => setCash('cash_in')} colors={colors} />
                <Action icon="remove-circle-outline" label="Egreso" color={palette.danger} onPress={() => setCash('cash_out')} colors={colors} />
                <Action icon="calculator-outline" label="Arqueo" color={palette.primary} onPress={() => setCounting(true)} colors={colors} />
                <Action icon="lock-closed-outline" label="Cerrar" color="#D97706" onPress={() => setCash('close')} colors={colors} />
              </View>
            ) : (
              <Text style={[styles.small, { color: colors.muted }]}>Solo un encargado puede registrar movimientos o cerrar la caja.</Text>
            )}

            <Card title="Movimientos del turno" colors={colors}>
              {(summary?.movements ?? []).length === 0 ? (
                <Text style={[styles.small, { color: colors.muted }]}>Todavía no hay movimientos.</Text>
              ) : (
                summary?.movements.map((movement) => {
                  const meta = MOVEMENT[movement.type] ?? { label: movement.type, icon: 'ellipse-outline' as const, color: colors.muted, sign: '' };
                  return (
                    <View key={movement.id} style={[styles.line, { borderColor: colors.border }]}>
                      <Ionicons name={meta.icon} size={18} color={meta.color} />
                      <View style={styles.flex}>
                        <Text style={[styles.bold, { color: colors.text }]}>
                          {meta.label}
                          {movement.method && movement.type === 'sale' ? ` · ${METHOD[movement.method] ?? movement.method}` : ''}
                        </Text>
                        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
                          {new Date(movement.at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                          {movement.reason ? ` · ${movement.reason}` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.bold, { color: meta.color }]}>
                        {meta.sign} {formatGs(movement.amount)}
                      </Text>
                    </View>
                  );
                })
              )}
            </Card>
          </>
        ) : (
          <OpenRegister session={session} colors={colors} onOpened={reload} />
        )}

        {manage && (
          <Card title="Cierres anteriores" colors={colors}>
            {closures === null ? (
              <ActivityIndicator color={palette.primary} />
            ) : closures.length === 0 ? (
              <Text style={[styles.small, { color: colors.muted }]}>Todavía no hay cierres en esta sucursal.</Text>
            ) : (
              closures.map((closure) => (
                <ClosureRow key={closure.id} closure={closure} open={open === closure.id} onToggle={() => setOpen(open === closure.id ? null : closure.id)} colors={colors} />
              ))
            )}
          </Card>
        )}
      </ScrollView>

      {cash && turn && (
        <CashSheet
          session={session}
          initialMode={cash}
          onClose={() => setCash(null)}
          onChanged={reload}
          onClosed={() => {
            setCash(null);
            reload();
          }}
        />
      )}
      {counting && turn && (
        <CountSheet
          session={session}
          onClose={() => setCounting(false)}
          onSaved={() => {
            setCounting(false);
            reload();
          }}
        />
      )}
    </View>
  );
}

function ClosureRow({ closure, open, onToggle, colors }: { closure: Closure; open: boolean; onToggle: () => void; colors: Colors }) {
  const diff = Math.round(closure.difference);
  const tone = diff === 0 ? palette.success : diff > 0 ? '#2563EB' : palette.danger;
  return (
    <Pressable onPress={onToggle} style={[styles.closure, { borderColor: colors.border }]}>
      <View style={styles.closureTop}>
        <View style={styles.flex}>
          <Text style={[styles.bold, { color: colors.text }]}>{when(closure.closedAt)}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>
            {closure.registerName} · ventas {formatGs(closure.salesTotal)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${tone}1A` }]}>
          <Text style={[styles.badgeText, { color: tone }]}>{diff === 0 ? 'Cuadró' : `${diff > 0 ? 'Sobró' : 'Faltó'} ${formatGs(Math.abs(diff))}`}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
      </View>
      {open && (
        <View style={styles.closureBody}>
          <Row label="Apertura" value={`${when(closure.openedAt)} · ${formatGs(closure.openingBalance)}`} colors={colors} />
          <Row label="Efectivo" value={formatGs(closure.cash)} colors={colors} />
          <Row label="Tarjeta" value={formatGs(closure.card)} colors={colors} />
          <Row label="Transferencia" value={formatGs(closure.transfer)} colors={colors} />
          {closure.mixed > 0 && <Row label="Mixto" value={formatGs(closure.mixed)} colors={colors} />}
          <Row label="Ingresos" value={formatGs(closure.cashIn)} colors={colors} />
          <Row label="Egresos" value={formatGs(closure.cashOut)} colors={colors} />
          <Row label="Esperado en efectivo" value={formatGs(closure.expectedCash)} colors={colors} strong />
          <Row label="Contado" value={formatGs(closure.countedCash)} colors={colors} strong />
          {closure.notes ? <Text style={[styles.small, { color: colors.muted }]}>{closure.notes}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Arqueo: contar billetes y monedas y registrar la diferencia, sin cerrar la caja. */
function CountSheet({ session, onClose, onSaved }: { session: PosSession; onClose: () => void; onSaved: () => void }) {
  const colors = usePalette();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expected = session.summary?.expectedCash ?? session.session?.openingBalance ?? 0;
  const total = [...BILLS, ...COINS].reduce((sum, value) => sum + value * (counts[value] ?? 0), 0);
  const difference = total - expected;

  const save = () => {
    setSaving(true);
    setError(null);
    const pick = (list: number[]) => Object.fromEntries(list.filter((value) => counts[value]).map((value) => [String(value), counts[value]]));
    recordCashCount({ session, total, bills: pick(BILLS), coins: pick(COINS) })
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSaved();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo registrar el arqueo.'))
      .finally(() => setSaving(false));
  };

  const denomination = (value: number) => (
    <View key={value} style={[styles.denom, { borderColor: colors.border }]}>
      <Text style={[styles.denomLabel, { color: colors.text }]}>{value.toLocaleString('es-PY')}</Text>
      <Pressable onPress={() => setCounts((current) => ({ ...current, [value]: Math.max(0, (current[value] ?? 0) - 1) }))} hitSlop={6} style={styles.step}>
        <Ionicons name="remove" size={18} color={colors.text} />
      </Pressable>
      <TextInput
        value={counts[value] ? String(counts[value]) : ''}
        onChangeText={(text) => setCounts((current) => ({ ...current, [value]: Number(text.replace(/\D/g, '')) || 0 }))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        accessibilityLabel={`Cantidad de ${value.toLocaleString('es-PY')}`}
        style={[styles.denomInput, { color: colors.text, borderColor: colors.border }]}
      />
      <Pressable onPress={() => setCounts((current) => ({ ...current, [value]: (current[value] ?? 0) + 1 }))} hitSlop={6} style={styles.step}>
        <Ionicons name="add" size={18} color={colors.text} />
      </Pressable>
      <Text style={[styles.denomTotal, { color: colors.muted }]}>{formatGs(value * (counts[value] ?? 0))}</Text>
    </View>
  );

  return (
    <BottomSheet
      visible
      tall
      title="Arqueo de caja"
      subtitle="Contá el efectivo del cajón. No cierra la caja."
      onClose={() => !saving && onClose()}
      footer={
        <View style={styles.footer}>
          <Row label="Esperado" value={formatGs(expected)} colors={colors} />
          <Row label="Contado" value={formatGs(total)} colors={colors} strong />
          <Text style={[styles.diff, { color: difference === 0 ? palette.success : difference > 0 ? '#2563EB' : palette.danger }]}>
            {difference === 0 ? 'Cuadra justo' : `${difference > 0 ? 'Sobran' : 'Faltan'} ${formatGs(Math.abs(difference))}`}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={save} disabled={saving || total <= 0} style={[styles.primary, { opacity: saving || total <= 0 ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Registrar arqueo</Text>}
          </Pressable>
        </View>
      }>
      <Text style={[styles.label, { color: colors.text }]}>Billetes</Text>
      {BILLS.map(denomination)}
      <Text style={[styles.label, { color: colors.text }]}>Monedas</Text>
      {COINS.map(denomination)}
    </BottomSheet>
  );
}

function OpenRegister({ session, colors, onOpened }: { session: PosSession; colors: Colors; onOpened: () => void }) {
  const [registerId, setRegisterId] = useState(session.registers[0]?.id ?? 'principal');
  const [opening, setOpening] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setSaving(true);
    setError(null);
    openCashRegister({ registerId, branchId: session.branch.id, openingBalance: Number(opening.replace(/\D/g, '')) || 0 })
      .then(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onOpened();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo abrir la caja.'))
      .finally(() => setSaving(false));
  };

  return (
    <View style={[styles.card, styles.openCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.openIcon, { backgroundColor: '#D977061A' }]}>
        <Ionicons name="lock-closed-outline" size={28} color="#D97706" />
      </View>
      <Text style={[styles.h1, { color: colors.text }]}>La caja está cerrada</Text>
      {session.permissions.manageCash ? (
        <>
          {session.registers.length > 1 && (
            <View style={styles.chips}>
              {session.registers.map((register) => (
                <Pressable key={register.id} onPress={() => setRegisterId(register.id)} style={[styles.chip, { borderColor: registerId === register.id ? palette.primary : colors.border }]}>
                  <Text style={[styles.bold, { color: registerId === register.id ? palette.primary : colors.text }]}>{register.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={[styles.money, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
            <TextInput value={opening} onChangeText={(value) => setOpening(pretty(value))} keyboardType="number-pad" placeholder="Efectivo inicial" placeholderTextColor={colors.muted} style={[styles.moneyInput, { color: colors.text }]} />
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={open} disabled={saving} style={[styles.primary, styles.stretch, { opacity: saving ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Abrir caja</Text>}
          </Pressable>
        </>
      ) : (
        <Text style={[styles.muted, { color: colors.muted }]}>Pedile a un encargado que abra la caja.</Text>
      )}
    </View>
  );
}

function Kpi({ icon, label, value, tone, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; tone?: string; colors: Colors }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon} size={16} color={tone ?? colors.muted} />
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.kpiValue, { color: tone ?? colors.text }]}>{formatGs(value)}</Text>
    </View>
  );
}

function Action({ icon, label, color, onPress, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.small, styles.bold, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Card({ title, colors, children }: { title: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, colors, strong }: { label: string; value: string; colors: Colors; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
      <Text style={[strong ? styles.bold : styles.small, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  left: { textAlign: 'left' },
  stretch: { alignSelf: 'stretch' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  h1: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  hero: { backgroundColor: palette.primary, borderRadius: 20, padding: 16, gap: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800' },
  heroCaption: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  heroTotal: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '31.5%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  kpiValue: { fontSize: 14, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 9 },
  closure: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 8 },
  closureTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closureBody: { gap: 4, paddingLeft: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  footer: { gap: 4 },
  diff: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginVertical: 4 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 52, marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  denom: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  denomLabel: { width: 70, fontSize: 14, fontWeight: '800' },
  step: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  denomInput: { width: 54, borderWidth: 1, borderRadius: 8, paddingVertical: 6, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  denomTotal: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  openCard: { alignItems: 'center', gap: 12, padding: 20 },
  openIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  money: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, alignSelf: 'stretch' },
  moneyInput: { flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 },
});
