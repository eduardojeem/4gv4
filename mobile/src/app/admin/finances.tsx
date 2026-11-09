import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  fetchBranches,
  fetchFinanceSummary,
  type BranchItem,
  type FinanceSummaryData,
} from '@/lib/admin';
import {
  financeBreakdown,
  financeHeadline,
  financePeriodDates,
  financeReportKey,
  groupFinanceWarnings,
  isEmptyFinanceSummary,
  sumDue,
  type FinancePeriod,
} from '@/lib/finance-model';
import { openWeb } from '@/lib/marketplace';
import { usePalette } from '@/lib/palette';
import {
  getPrivateCacheContext,
  subscribePrivateCacheContext,
} from '@/lib/private-cache-context';
import { formatMobileCurrency } from '@/lib/regional-format';
import { fetchOrgSettings } from '@/lib/settings-admin';

type Report = {
  key: string;
  organizationId: string;
  epoch: number;
  data: FinanceSummaryData;
  timeZone: string;
  currency: string;
  branches: BranchItem[];
  branchesUnavailable: boolean;
};
const PERIODS = [
  { key: 'today', label: 'Hoy' },
  { key: 'month', label: 'Este mes' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'year', label: 'Este año' },
] as const;
const calendarDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};
const periodText = (dates: { startDate: string; endDate: string }) =>
  dates.startDate === dates.endDate
    ? calendarDate(dates.startDate)
    : `Del ${calendarDate(dates.startDate)} al ${calendarDate(dates.endDate)}`;

/** Colores de lectura rápida: verde gana, rojo pierde, ámbar revisar. */
const TONES = {
  light: { good: '#15803D', bad: '#B91C1C', warn: '#B45309', warnBg: '#FFFBEB', badBg: '#FEF2F2', accent: '#1D4ED8', onAccent: '#FFFFFF' },
  dark: { good: '#4ADE80', bad: '#F87171', warn: '#FBBF24', warnBg: '#2A2110', badBg: '#2A1215', accent: '#93C5FD', onAccent: '#0B1120' },
} as const;
const BAR = { goods: '#F59E0B', expenses: '#8B5CF6', payroll: '#0EA5E9', profit: '#22C55E' } as const;

export default function FinancesAdminScreen() {
  const colors = usePalette();
  const tone = TONES[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const accent = tone.accent;
  const scope = useSyncExternalStore(
    subscribePrivateCacheContext,
    getPrivateCacheContext,
  );
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [branch, setBranch] = useState<{
    organizationId: string | null;
    id: string;
  }>({ organizationId: null, id: 'all' });
  const [showUpcoming, setShowUpcoming] = useState(false);
  const branchId =
    branch.organizationId === scope.organizationId ? branch.id : 'all';
  const key = financeReportKey(
    scope.organizationId,
    scope.epoch,
    period,
    branchId,
  );
  const [report, setReport] = useState<Report | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const generation = useRef(0);
  // Al cambiar de período o sucursal queda lo anterior (atenuado) mientras
  // carga, en vez de vaciar la pantalla; nunca de otro negocio o sesión.
  const shown =
    report &&
    report.organizationId === scope.organizationId &&
    report.epoch === scope.epoch
      ? report
      : null;
  const stale = Boolean(shown && shown.key !== key);
  const error = failure?.key === key ? failure.message : null;
  const loading = busyKey === key;
  const data = shown?.data;
  const load = useCallback(async () => {
    const snapshot = getPrivateCacheContext();
    const request = ++generation.current;
    if (!snapshot.userId || !snapshot.organizationId) return;
    setBusyKey(key);
    try {
      const [settings, branchResult] = await Promise.all([
        fetchOrgSettings(),
        fetchBranches(snapshot.organizationId)
          .then((branches) => ({ branches, failed: false }))
          .catch(() => ({ branches: [] as BranchItem[], failed: true })),
      ]);
      if (
        request !== generation.current ||
        snapshot.epoch !== getPrivateCacheContext().epoch
      )
        return;
      const dates = financePeriodDates(period, settings.timeZone);
      const result = await fetchFinanceSummary({
        ...dates,
        ...(branchId !== 'all' ? { branchId } : {}),
      });
      if (
        request !== generation.current ||
        snapshot.epoch !== getPrivateCacheContext().epoch
      )
        return;
      setReport({
        key,
        organizationId: snapshot.organizationId,
        epoch: snapshot.epoch,
        data: result,
        timeZone: settings.timeZone,
        currency: settings.currency,
        branches: branchResult.branches,
        branchesUnavailable: branchResult.failed,
      });
      setFailure(null);
    } catch (error) {
      if (
        request === generation.current &&
        snapshot.epoch === getPrivateCacheContext().epoch
      )
        setFailure({
          key,
          message:
            error instanceof Error
              ? error.message
              : 'No pudimos actualizar el informe.',
        });
    } finally {
      if (request === generation.current) setBusyKey(null);
    }
  }, [key, period, branchId]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        generation.current++;
      };
    }, [load]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [load]);
  const web = () => {
    void openWeb('/admin/finances').catch(() =>
      Alert.alert('No pudimos abrir Finanzas', 'Volvé a intentar.'),
    );
  };
  const amount = (value: number) =>
    formatMobileCurrency(Number.isFinite(value) ? value : 0, shown?.currency ?? 'PYG');
  const headline = data ? financeHeadline(data) : null;
  const warnings = data ? groupFinanceWarnings(data.coverageWarnings) : [];
  const breakdown = data && headline ? financeBreakdown(data, headline.profit) : null;
  const branches = shown?.branches ?? [];
  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }];
  const profitColor = !headline || headline.profit === 0 ? colors.text : headline.profit > 0 ? tone.good : tone.bad;
  const profitTitle = !headline
    ? ''
    : headline.profit < 0
      ? headline.estimated ? 'Pérdida estimada' : 'Pérdida'
      : headline.estimated ? 'Ganancia estimada' : 'Ganancia';

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Finanzas
        </Text>
        <Text style={{ color: colors.muted }}>
          {shown
            ? periodText(financePeriodDates(period, shown.timeZone))
            : 'Cómo le va a tu negocio'}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filterContent}
      >
        {PERIODS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            selected={period === item.key}
            accent={accent}
            onAccent={tone.onAccent}
            colors={colors}
            onPress={() => setPeriod(item.key)}
          />
        ))}
      </ScrollView>
      {/* Con una sola sucursal «Todas» y esa muestran lo mismo: no se ofrece elegir. */}
      {branches.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={styles.filterContent}
        >
          {[{ id: 'all', name: 'Todas las sucursales' }, ...branches].map((item) => (
            <Chip
              key={item.id}
              icon={item.id === 'all' ? 'business-outline' : 'storefront-outline'}
              label={item.name}
              selected={branchId === item.id}
              accent={accent}
              onAccent={tone.onAccent}
              colors={colors}
              onPress={() => setBranch({ organizationId: scope.organizationId, id: item.id })}
            />
          ))}
        </ScrollView>
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading && Boolean(data) && !stale}
            onRefresh={() => void load()}
            tintColor={accent}
          />
        }
      >
        {shown?.branchesUnavailable && (
          <Text style={{ color: colors.muted }}>
            No se pudo cargar la lista de sucursales. Deslizá hacia abajo para reintentar.
          </Text>
        )}
        {stale && loading && (
          <View style={styles.updating} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={accent} />
            <Text style={{ color: accent, fontWeight: '600' }}>Actualizando…</Text>
          </View>
        )}
        {error && (
          <View accessibilityRole="alert" style={[styles.card, { backgroundColor: tone.badBg, borderColor: tone.bad }]}>
            <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
            {shown && (
              <Text style={{ color: colors.muted }}>
                Abajo ves los últimos datos que pudimos traer.
              </Text>
            )}
            <Action label="Reintentar" color={accent} onPress={() => void load()} />
          </View>
        )}
        {!data || !headline ? (
          !error && (
            <View style={styles.empty}>
              <ActivityIndicator accessibilityLabel="Cargando finanzas" color={accent} />
              <Text style={{ color: colors.muted }}>
                {scope.organizationId ? 'Calculando cómo te fue…' : 'Esperando el negocio activo…'}
              </Text>
            </View>
          )
        ) : (
          <View style={[styles.content, styles.noPad, stale && styles.dim]}>
            {isEmptyFinanceSummary(data) ? (
              <View style={[card, styles.center]}>
                <Ionicons name="calendar-clear-outline" size={32} color={colors.muted} />
                <Text style={[styles.bold, { color: colors.text }]}>Sin movimientos en este período</Text>
                <Text style={[styles.centerText, { color: colors.muted }]}>
                  No hubo ventas, gastos ni pagos. Probá con otro período
                  {branches.length > 1 ? ' o sucursal' : ''}.
                </Text>
              </View>
            ) : (
              <>
                <View
                  accessible
                  accessibilityLabel={`${profitTitle}: ${amount(headline.profit)}`}
                  style={card}
                >
                  <View style={styles.between}>
                    <Text style={[styles.bold, { color: colors.muted }]}>{profitTitle}</Text>
                    {headline.estimated && (
                      <View style={[styles.pill, { backgroundColor: tone.warnBg }]}>
                        <Text style={{ color: tone.warn, fontSize: 12, fontWeight: '700' }}>Faltan costos</Text>
                      </View>
                    )}
                  </View>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.heroAmount, { color: profitColor }]}>
                    {amount(headline.profit)}
                  </Text>
                  {headline.marginPct != null && headline.profit > 0 && (
                    <Text style={{ color: colors.text }}>
                      De cada {amount(100)} que vendiste te quedaron {amount(headline.marginPct)}.
                    </Text>
                  )}
                  {headline.profit < 0 && (
                    <Text style={{ color: colors.text }}>
                      Gastaste más de lo que ganaste con las ventas.
                    </Text>
                  )}
                  {headline.estimated && (
                    <Text style={{ color: colors.muted }}>
                      Es aproximada: algunas ventas no tienen el costo cargado y cuentan como si no te hubieran costado nada.
                    </Text>
                  )}
                </View>

                <View style={styles.tiles}>
                  <Tile
                    icon="trending-up-outline"
                    label="Vendiste"
                    value={amount(data.accrued.revenue)}
                    hint="Ventas, servicios, pedidos y reparaciones entregadas"
                    colors={colors}
                    accent={accent}
                  />
                  <Tile
                    icon="swap-vertical-outline"
                    label="Entró − salió"
                    value={amount(data.cash.netCashFlow)}
                    valueColor={data.cash.netCashFlow < 0 ? tone.bad : undefined}
                    hint="Plata cobrada menos pagada"
                    colors={colors}
                    accent={accent}
                  />
                </View>

                {warnings.length > 0 && (
                  <View accessibilityRole="alert" style={[styles.card, { backgroundColor: tone.warnBg, borderColor: tone.warn }]}>
                    <View style={styles.heading}>
                      <Ionicons name="alert-circle-outline" size={20} color={tone.warn} />
                      <Text style={[styles.bold, { color: colors.text }]}>Para que los números sean exactos</Text>
                    </View>
                    {warnings.map((group) => (
                      <View key={group.code} style={{ gap: 2 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>• {group.title}</Text>
                        <Text style={{ color: colors.muted }}>{group.hint}</Text>
                      </View>
                    ))}
                    {warnings.some((group) => group.code === 'MISSING_DIRECT_COST') && (
                      <Action
                        label="Cargar costos en Productos"
                        color={accent}
                        onPress={() => router.push('/panel/products' as never)}
                      />
                    )}
                    <Action label="Ver cuáles son en la web" color={accent} onPress={web} />
                  </View>
                )}

                {data.accrued.revenueBreakdown && data.accrued.revenueBreakdown.grossRevenue > 0 && (
                  <View style={card}>
                    <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>
                      De dónde vienen las ventas
                    </Text>
                    <Line icon="cube-outline" label="Mercadería" hint="Productos vendidos en caja" value={amount(data.accrued.revenueBreakdown.merchandise)} colors={colors} />
                    <Line icon="cut-outline" label="Servicios" hint="Servicios y turnos cobrados en caja" value={amount(data.accrued.revenueBreakdown.services)} colors={colors} />
                    <Line
                      icon="construct-outline"
                      label="Reparaciones"
                      hint={`${data.accrued.revenueBreakdown.repairs.count === 1 ? '1 entregada' : `${data.accrued.revenueBreakdown.repairs.count} entregadas`} · mano de obra ${amount(data.accrued.revenueBreakdown.repairs.labor)}, repuestos ${amount(data.accrued.revenueBreakdown.repairs.parts)}`}
                      value={amount(data.accrued.revenueBreakdown.repairs.total)}
                      colors={colors}
                    />
                    <Line icon="globe-outline" label="Pedidos web" value={amount(data.accrued.revenueBreakdown.orders)} colors={colors} />
                    {data.accrued.revenueBreakdown.refunds > 0 && (
                      <Line icon="return-down-back-outline" label="Devoluciones" value={`− ${amount(data.accrued.revenueBreakdown.refunds)}`} colors={colors} />
                    )}
                  </View>
                )}

                <View style={card}>
                  <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>
                    De dónde sale la ganancia
                  </Text>
                  {breakdown && (
                    <View
                      accessible
                      accessibilityLabel={`De lo vendido: ${Math.round(breakdown.goods * 100)}% mercadería, ${Math.round(breakdown.expenses * 100)}% gastos, ${Math.round(breakdown.payroll * 100)}% sueldos y ${Math.round(breakdown.profit * 100)}% ganancia`}
                      style={[styles.bar, { backgroundColor: colors.border }]}
                    >
                      {(['goods', 'expenses', 'payroll', 'profit'] as const).map((part) =>
                        breakdown[part] > 0 ? (
                          <View key={part} style={{ flex: breakdown[part], backgroundColor: BAR[part] }} />
                        ) : null,
                      )}
                    </View>
                  )}
                  <Line label="Vendiste" value={amount(data.accrued.revenue)} colors={colors} />
                  <Line
                    dot={BAR.goods}
                    label="Mercadería y repuestos"
                    hint={headline.estimated ? 'Solo lo que tiene costo cargado' : 'Lo que te costó lo que vendiste'}
                    value={`− ${amount(data.accrued.directCosts)}`}
                    colors={colors}
                  />
                  <Line dot={BAR.expenses} label="Gastos del negocio" hint="Alquiler, servicios, compras varias" value={`− ${amount(data.accrued.operatingExpenses)}`} colors={colors} />
                  <Line dot={BAR.payroll} label="Sueldos" value={`− ${amount(data.accrued.payrollCost)}`} colors={colors} />
                  <Line
                    dot={BAR.profit}
                    label={profitTitle}
                    value={amount(headline.profit)}
                    valueColor={profitColor}
                    strong
                    colors={colors}
                  />
                </View>

                <View style={card}>
                  <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>
                    Plata que se movió
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    Lo que cobraste y pagaste de verdad en el período, en efectivo, tarjeta o transferencia. No es lo que hay en la caja.
                  </Text>
                  <Line icon="arrow-down-circle-outline" iconColor={tone.good} label="Entró" value={amount(data.cash.collected)} colors={colors} />
                  <Line icon="arrow-up-circle-outline" iconColor={tone.bad} label="Salió" value={amount(data.cash.paid)} colors={colors} />
                  <Line
                    label="Diferencia"
                    value={amount(data.cash.netCashFlow)}
                    valueColor={data.cash.netCashFlow < 0 ? tone.bad : undefined}
                    strong
                    colors={colors}
                  />
                </View>
              </>
            )}

            {data.overdue.length > 0 && (
              <View accessibilityRole="alert" style={[styles.card, { backgroundColor: tone.badBg, borderColor: tone.bad }]}>
                <View style={styles.heading}>
                  <Ionicons name="alarm-outline" size={20} color={tone.bad} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {data.overdue.length === 1 ? 'Tenés 1 cuenta vencida' : `Tenés ${data.overdue.length} cuentas vencidas`}
                  </Text>
                </View>
                <Text style={{ color: tone.bad, fontWeight: '700' }}>Total: {amount(sumDue(data.overdue))}</Text>
                <DueRows items={data.overdue.slice(0, 5)} amount={amount} colors={colors} />
                {data.overdue.length > 5 && (
                  <Text style={{ color: colors.muted }}>Y {data.overdue.length - 5} más.</Text>
                )}
                <Action label="Pagar o revisar en la web" color={accent} onPress={web} />
              </View>
            )}

            {data.upcomingDue.length > 0 && (
              <View style={card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showUpcoming }}
                  onPress={() => setShowUpcoming((value) => !value)}
                  style={[styles.between, styles.action]}
                >
                  <View style={{ flexShrink: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>
                      Próximos pagos ({data.upcomingDue.length})
                    </Text>
                    <Text style={{ color: colors.muted }}>Total: {amount(sumDue(data.upcomingDue))}</Text>
                  </View>
                  <Ionicons name={showUpcoming ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
                </Pressable>
                {showUpcoming && (
                  <>
                    <DueRows items={data.upcomingDue.slice(0, 10)} amount={amount} colors={colors} />
                    {data.upcomingDue.length > 10 && (
                      <Text style={{ color: colors.muted }}>Y {data.upcomingDue.length - 10} más.</Text>
                    )}
                  </>
                )}
              </View>
            )}

            {data.generatedAt && (
              <Text style={[styles.centerText, { color: colors.muted, fontSize: 12 }]}>
                Actualizado a las{' '}
                {new Date(data.generatedAt).toLocaleTimeString('es-PY', {
                  timeZone: shown!.timeZone,
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                . Deslizá hacia abajo para actualizar.
              </Text>
            )}
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={web} style={[card, styles.between]}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            <Text style={[styles.bold, { color: colors.text }]}>Registrar gastos y pagar cuentas</Text>
            <Text style={{ color: colors.muted }}>Gastos, cuentas a pagar y sueldos se cargan en la web.</Text>
          </View>
          <Ionicons name="open-outline" size={20} color={accent} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

type Colors = ReturnType<typeof usePalette>;
type IconName = keyof typeof Ionicons.glyphMap;

function Chip({
  label,
  icon,
  selected,
  accent,
  onAccent,
  colors,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  accent: string;
  onAccent: string;
  colors: Colors;
  onPress: () => void;
}) {
  const fg = selected ? onAccent : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? accent : colors.border,
          backgroundColor: selected ? accent : colors.card,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={fg} />}
      <Text style={{ color: fg, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={{ color, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Tile({
  icon,
  label,
  value,
  hint,
  valueColor,
  colors,
  accent,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint: string;
  valueColor?: string;
  colors: Colors;
  accent: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}. ${hint}`}
      style={[styles.card, styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.heading}>
        <Ionicons name={icon} size={18} color={accent} />
        <Text style={{ color: colors.muted, fontWeight: '600' }}>{label}</Text>
      </View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.tileAmount, { color: valueColor ?? colors.text }]}>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{hint}</Text>
    </View>
  );
}

function Line({
  label,
  hint,
  value,
  valueColor,
  dot,
  icon,
  iconColor,
  strong,
  colors,
}: {
  label: string;
  hint?: string;
  value: string;
  valueColor?: string;
  dot?: string;
  icon?: IconName;
  iconColor?: string;
  strong?: boolean;
  colors: Colors;
}) {
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={[styles.rowLabel, styles.heading]}>
        {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
        {icon && <Ionicons name={icon} size={18} color={iconColor ?? colors.muted} />}
        <View style={{ flexShrink: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontWeight: strong ? '800' : '600' }}>{label}</Text>
          {hint && <Text style={{ color: colors.muted, fontSize: 12 }}>{hint}</Text>}
        </View>
      </View>
      <Text style={[styles.amount, { color: valueColor ?? colors.text }, strong && styles.amountStrong]}>{value}</Text>
    </View>
  );
}

function DueRows({
  items,
  amount,
  colors,
}: {
  items: FinanceSummaryData['overdue'];
  amount: (value: number) => string;
  colors: Colors;
}) {
  return (
    <>
      {items.map((item) => (
        <View key={item.id} style={[styles.row, { borderColor: colors.border }]}>
          <View style={styles.rowLabel}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{item.concept || 'Cuenta a pagar'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Vence el {calendarDate(item.dueDate)}</Text>
          </View>
          <Text style={[styles.amount, { color: colors.text }]}>{amount(item.amount)}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 2 },
  title: { fontSize: 24, fontWeight: '800' },
  filters: { flexGrow: 0 },
  filterContent: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  noPad: { padding: 0, paddingBottom: 0 },
  dim: { opacity: 0.55 },
  updating: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 10 },
  center: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  bold: { fontWeight: '700', fontSize: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  heroAmount: { fontSize: 34, fontWeight: '800' },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 6 },
  tileAmount: { fontSize: 20, fontWeight: '800' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 150, gap: 2 },
  amount: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  amountStrong: { fontSize: 18, fontWeight: '800' },
  action: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  empty: { alignItems: 'center', padding: 32, gap: 12 },
});
