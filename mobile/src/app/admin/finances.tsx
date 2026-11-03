import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
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
  View,
} from 'react-native';

import {
  fetchBranches,
  fetchFinanceSummary,
  type BranchItem,
  type FinanceSummaryData,
} from '@/lib/admin';
import {
  financePeriodDates,
  financeReportKey,
  financeResultState,
  isEmptyFinanceSummary,
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
  data: FinanceSummaryData;
  dates: { startDate: string; endDate: string };
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

export default function FinancesAdminScreen() {
  const colors = usePalette();
  const scope = useSyncExternalStore(
    subscribePrivateCacheContext,
    getPrivateCacheContext,
  );
  const [period, setPeriod] = useState<FinancePeriod>('month');
  const [branch, setBranch] = useState<{
    organizationId: string | null;
    id: string;
  }>({ organizationId: null, id: 'all' });
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
  const visible = report?.key === key ? report : null;
  const error = failure?.key === key ? failure.message : null;
  const loading = busyKey === key;
  const data = visible?.data;
  const accent = colors.text === '#F1F5F9' ? '#93C5FD' : '#1D4ED8';
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
        data: result,
        dates,
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
  const amount = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? 'No calculable'
      : formatMobileCurrency(value, visible?.currency ?? 'PYG');
  const profit = data?.accrued.netProfit;
  const profitState = financeResultState(profit);
  const resultColor =
    profit == null
      ? colors.card
      : profit > 0
        ? '#166534'
        : profit < 0
          ? '#991B1B'
          : colors.card;
  const resultText = profit == null || profit === 0 ? colors.text : '#FFFFFF';
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.text }]}
        >
          Finanzas
        </Text>
        <Text style={{ color: colors.muted }}>Resumen del negocio</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filterContent}
      >
        {PERIODS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: period === item.key }}
            onPress={() => setPeriod(item.key)}
            style={[
              styles.chip,
              {
                borderColor: period === item.key ? accent : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <Text
              style={{
                color: period === item.key ? accent : colors.text,
                fontWeight: '600',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={accent}
          />
        }
      >
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          Sucursal:{' '}
          {branchId === 'all'
            ? 'Todas las sucursales'
            : (visible?.branches.find((item) => item.id === branchId)?.name ??
              'Sucursal seleccionada')}
        </Text>
        {visible && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {[{ id: 'all', name: 'Todas' }, ...visible.branches].map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: branchId === item.id }}
                onPress={() =>
                  setBranch({
                    organizationId: scope.organizationId,
                    id: item.id,
                  })
                }
                style={[
                  styles.chip,
                  {
                    borderColor: branchId === item.id ? accent : colors.border,
                  },
                ]}
              >
                <Text style={{ color: colors.text }}>{item.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {visible?.branchesUnavailable && (
          <Text style={{ color: colors.muted }}>
            No se pudo cargar la lista de sucursales. Deslizá para reintentar.
          </Text>
        )}
        {error && (
          <View
            accessibilityRole="alert"
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text }}>{error}</Text>
            {visible && (
              <Text style={{ color: colors.muted }}>
                Estos son los últimos datos confirmados; no se pudieron
                actualizar.
              </Text>
            )}
            <Action
              label="Reintentar"
              color={accent}
              onPress={() => void load()}
            />
          </View>
        )}
        {!data ? (
          !error && (
            <View style={styles.empty}>
              <ActivityIndicator
                accessibilityLabel="Cargando resumen financiero"
                color={accent}
              />
              <Text style={{ color: colors.muted }}>
                {scope.organizationId
                  ? 'Consultando el informe…'
                  : 'Esperando el negocio activo…'}
              </Text>
            </View>
          )
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text }}>
                {calendarDate(visible!.dates.startDate)} al{' '}
                {calendarDate(visible!.dates.endDate)}
              </Text>
              <Text style={{ color: colors.muted }}>
                Zona horaria: {visible!.timeZone}
              </Text>
              {data.generatedAt && (
                <Text style={{ color: colors.muted }}>
                  Actualizado:{' '}
                  {new Date(data.generatedAt).toLocaleString('es-PY', {
                    timeZone: visible!.timeZone,
                  })}
                </Text>
              )}
              {loading && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: accent }}
                >
                  Actualizando…
                </Text>
              )}
            </View>
            {data.complete === false ||
            Boolean(data.coverageWarnings?.length) ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.bold, { color: colors.text }]}>
                  Informe incompleto
                </Text>
                <Text style={{ color: colors.muted }}>
                  Revisá estos datos antes de usar el resultado para decidir.
                </Text>
                {data.coverageWarnings?.slice(0, 5).map((warning, index) => (
                  <Text
                    key={`${warning.code}-${warning.sourceId}-${index}`}
                    style={{ color: colors.text }}
                  >
                    • {warning.sourceLabel ? `${warning.sourceLabel}: ` : ''}
                    {warning.message}
                  </Text>
                ))}
                {(data.coverageWarnings?.length ?? 0) > 5 && (
                  <Text style={{ color: colors.muted }}>
                    Hay más advertencias en el informe completo.
                  </Text>
                )}
                <Action
                  label="Revisar en la web"
                  color={accent}
                  onPress={web}
                />
              </View>
            ) : null}
            {isEmptyFinanceSummary(data) && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.bold, { color: colors.text }]}>
                  Sin movimientos en este período
                </Text>
                <Text style={{ color: colors.muted }}>
                  Probá otro período o sucursal.
                </Text>
              </View>
            )}
            <View
              style={[
                styles.card,
                { backgroundColor: resultColor, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: resultText }}>
                Resultado neto del período
              </Text>
              <Text style={[styles.heroAmount, { color: resultText }]}>
                {amount(profit)}
              </Text>
              <Text style={{ color: resultText, fontWeight: '700' }}>
                {profitState}
              </Text>
              {profit == null && (
                <Text style={{ color: colors.muted }}>
                  Faltan datos para calcular la utilidad. Revisá las
                  advertencias.
                </Text>
              )}
            </View>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                accessibilityRole="header"
                style={[styles.cardTitle, { color: colors.text }]}
              >
                Estado de resultados
              </Text>
              <AmountRow
                label="Ingresos netos"
                hint="Ventas, pedidos y reparaciones, descontando devoluciones"
                value={amount(data.accrued.revenue)}
                colors={colors}
              />
              <AmountRow
                label="Costos directos"
                hint="Productos y repuestos con costo registrado"
                value={amount(data.accrued.directCosts)}
                colors={colors}
              />
              <AmountRow
                label="Margen bruto"
                value={amount(data.accrued.grossProfit)}
                colors={colors}
              />
              <AmountRow
                label="Gastos operativos"
                value={amount(data.accrued.operatingExpenses)}
                colors={colors}
              />
              <AmountRow
                label="Costo laboral"
                value={amount(data.accrued.payrollCost)}
                colors={colors}
              />
            </View>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.heading}>
                <Ionicons
                  name="swap-vertical-outline"
                  size={20}
                  color={accent}
                />
                <Text
                  accessibilityRole="header"
                  style={[styles.cardTitle, { color: colors.text }]}
                >
                  Cobros y pagos
                </Text>
              </View>
              <Text style={{ color: colors.muted }}>
                Incluye efectivo, tarjetas y transferencias. No representa el
                efectivo del cajón.
              </Text>
              <AmountRow
                label="Total cobrado"
                value={amount(data.cash.collected)}
                colors={colors}
              />
              <AmountRow
                label="Total pagado"
                value={amount(data.cash.paid)}
                colors={colors}
              />
              <AmountRow
                label="Flujo neto del período"
                value={amount(data.cash.netCashFlow)}
                colors={colors}
              />
            </View>
            <Text style={{ color: colors.muted }}>
              Los vencimientos muestran las obligaciones pendientes actuales de
              la sucursal elegida, sin limitarse al período del resultado.
            </Text>
            <DueList
              title="Vencidos"
              items={data.overdue}
              empty="No hay obligaciones vencidas."
              colors={colors}
              amount={amount}
              onOpen={web}
              accent={accent}
            />
            <DueList
              title="Próximos vencimientos"
              items={data.upcomingDue}
              empty="No hay vencimientos pendientes registrados."
              colors={colors}
              amount={amount}
              onOpen={web}
              accent={accent}
            />
          </>
        )}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.bold, { color: colors.text }]}>
            Gestión completa
          </Text>
          <Text style={{ color: colors.muted }}>
            Para registrar gastos, pagar obligaciones o gestionar nómina, abrí
            Finanzas en la web y verificá el negocio activo.
          </Text>
          <Action
            label="Abrir gestión de Finanzas en la web"
            color={accent}
            onPress={web}
          />
        </View>
      </ScrollView>
    </View>
  );
}

type Colors = ReturnType<typeof usePalette>;
function Action({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.action}
    >
      <Text style={{ color, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
function AmountRow({
  label,
  hint,
  value,
  colors,
}: {
  label: string;
  hint?: string;
  value: string;
  colors: Colors;
}) {
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={styles.rowLabel}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
        {hint && (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{hint}</Text>
        )}
      </View>
      <Text style={[styles.amount, { color: colors.text }]}>{value}</Text>
    </View>
  );
}
function DueList({
  title,
  items,
  empty,
  colors,
  amount,
  onOpen,
  accent,
}: {
  title: string;
  items: FinanceSummaryData['overdue'];
  empty: string;
  colors: Colors;
  amount: (value: number) => string;
  onOpen: () => void;
  accent: string;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.cardTitle, { color: colors.text }]}
      >
        {title} ({items.length})
      </Text>
      {!items.length ? (
        <Text style={{ color: colors.muted }}>{empty}</Text>
      ) : (
        <>
          {items.slice(0, 10).map((item) => (
            <View
              key={item.id}
              style={[styles.row, { borderColor: colors.border }]}
            >
              <View style={styles.rowLabel}>
                <Text style={{ color: colors.text }}>
                  {item.concept || 'Obligación pendiente'}
                </Text>
                <Text style={{ color: colors.muted }}>
                  Vencimiento: {calendarDate(item.dueDate)}
                </Text>
              </View>
              <Text style={[styles.amount, { color: colors.text }]}>
                {amount(item.amount)}
              </Text>
            </View>
          ))}
          {items.length > 10 && (
            <Text style={{ color: colors.muted }}>
              Mostrando 10 de {items.length} obligaciones.
            </Text>
          )}
          <Action
            label="Ver y gestionar obligaciones en la web"
            color={accent}
            onPress={onOpen}
          />
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: 16, gap: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  filters: { flexGrow: 0 },
  filterContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  bold: { fontWeight: '700', fontSize: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  heroAmount: { fontSize: 28, fontWeight: '800', flexShrink: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 150, gap: 4 },
  amount: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  action: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  empty: { alignItems: 'center', padding: 32, gap: 12 },
});
