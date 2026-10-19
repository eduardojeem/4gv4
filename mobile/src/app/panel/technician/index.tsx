import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PanelAccessState } from '@/components/panel-access-state';
import { QualityCheckSheet } from '@/components/quality-check-sheet';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  changeRepairStatus,
  customerName,
  daysSince,
  DEVICE_ICONS,
  deviceName,
  fetchRepairs,
  fetchTechnicians,
  money,
  onRepairUpdated,
  PRIORITY,
  QUALITY_ROLES,
  rememberRepairs,
  repairOutcome,
  shortDate,
  STATUS,
  ticketOf,
  updateCachedRepair,
  type QualityResult,
  type Repair,
  type RepairFilter,
  type RepairStatus,
  type Technician,
} from '@/lib/repairs';
import { useSession } from '@/lib/session';
import { useListRequestScope } from '@/lib/use-list-request-scope';

type Colors = ReturnType<typeof usePalette>;

type ScopeFilter = 'my' | 'unassigned' | 'all';

const STATUS_FILTERS: { key: RepairFilter; label: string }[] = [
  { key: 'active', label: 'En taller' },
  { key: 'diagnostico', label: 'Diagnóstico' },
  { key: 'reparacion', label: 'En reparación' },
  { key: 'pausado', label: 'Pausadas' },
  { key: 'listo', label: 'Listas' },
  { key: 'recibido', label: 'Recibidas' },
  { key: 'all', label: 'Todas' },
];

function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0')) return `595${digits.slice(1)}`;
  return digits;
}

export default function TechnicianScreen() {
  const colors = usePalette();
  const { data: panel, can, loading: panelLoading } = usePanel();
  const { session } = useSession();

  const [scope, setScope] = useState<ScopeFilter>('my');
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RepairFilter>('active');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Modales de acción
  const [statusTarget, setStatusTarget] = useState<{ repair: Repair; stage: RepairStatus } | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [qcRepair, setQcRepair] = useState<Repair | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const userId = session?.user.id;
  const userRole = panel?.organization.role ?? '';
  const canManageAll = ['owner', 'admin', 'manager'].includes(userRole) || panel?.user.isAdmin === true;

  // Cargar técnicos del taller para filtros
  useEffect(() => {
    let active = true;
    fetchTechnicians()
      .then((data) => {
        if (!active) return;
        setTechnicians(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [attempt]);

  // Búsqueda con debounce
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Request scope para evitar carreras
  const requestScope = useListRequestScope(
    JSON.stringify([panel?.organization.id, scope, selectedTechId, filter, search, attempt])
  );

  // Cálculo de technicianId para el endpoint
  const queryTechId = useMemo(() => {
    if (scope === 'my' && userId) return userId;
    if (scope === 'all' && selectedTechId) return selectedTechId;
    return undefined;
  }, [scope, selectedTechId, userId]);

  // Cargar reparaciones
  useEffect(() => {
    let active = true;
    if (!panel) return () => { active = false; };
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setLoadingMore(false);
      }
    });

    fetchRepairs({
      page: 1,
      filter,
      search,
      technicianId: queryTechId,
      pageSize: 30,
    })
      .then((result) => {
        if (!active) return;
        rememberRepairs(result.repairs);

        // Si el filtro es "sin asignar", filtramos en cliente si el backend no lo filtra
        let items = result.repairs;
        if (scope === 'unassigned') {
          items = items.filter((r) => !r.technician_id && !r.technician?.id);
        }

        setRepairs(items);
        setPage(1);
        setTotalPages(result.pagination.totalPages);
        setTotal(scope === 'unassigned' ? items.length : result.pagination.total);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar las órdenes.');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [panel, scope, queryTechId, filter, search, attempt]);

  // Sincronizar cambios en tiempo real
  useEffect(() => {
    return onRepairUpdated((updated) => {
      setRepairs((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    });
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    const isCurrent = requestScope.capture();
    setLoadingMore(true);

    fetchRepairs({
      page: page + 1,
      filter,
      search,
      technicianId: queryTechId,
      pageSize: 30,
    })
      .then((result) => {
        if (!isCurrent()) return;
        setError(null);
        rememberRepairs(result.repairs);
        let incoming = result.repairs;
        if (scope === 'unassigned') {
          incoming = incoming.filter((r) => !r.technician_id && !r.technician?.id);
        }
        setRepairs((list) => [...list, ...incoming.filter((r) => !list.some((item) => item.id === r.id))]);
        setPage((p) => p + 1);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((err) => {
        if (isCurrent()) setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente página.');
      })
      .finally(() => {
        if (isCurrent()) setLoadingMore(false);
      });
  };

  // KPIs calculados
  const stats = useMemo(() => {
    const diagnostic = repairs.filter((r) => r.status === 'diagnostico').length;
    const inRepair = repairs.filter((r) => r.status === 'reparacion').length;
    const paused = repairs.filter((r) => r.status === 'pausado').length;
    const ready = repairs.filter((r) => r.status === 'listo').length;
    const activeTotal = repairs.filter((r) => ['recibido', 'diagnostico', 'reparacion', 'pausado'].includes(r.status)).length;
    return { diagnostic, inRepair, paused, ready, activeTotal };
  }, [repairs]);

  // Abrir diálogo de confirmación para cambio de estado
  const openStatusChange = (repair: Repair, stage: RepairStatus) => {
    setStatusError(null);
    setStatusNote('');
    setStatusTarget({ repair, stage });
  };

  const confirmStatusChange = async () => {
    if (!statusTarget) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      const updated = await changeRepairStatus(statusTarget.repair.id, statusTarget.stage, statusNote);
      const merged = { ...statusTarget.repair, ...updated };
      setRepairs((list) => list.map((item) => (item.id === merged.id ? merged : item)));
      updateCachedRepair(merged);
      setStatusTarget(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNotice(`Orden ${ticketOf(merged)} cambiada a ${STATUS[statusTarget.stage].label}.`);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStatusSaving(false);
    }
  };

  const hasAccess = can('repairs.orders.read') || QUALITY_ROLES.includes(userRole);

  if (panelLoading || !hasAccess) {
    return <PanelAccessState />;
  }

  return (
    <View style={styles.flex}>
      {/* Aviso flotante temporal */}
      {notice && (
        <View style={[styles.noticeBar, { backgroundColor: palette.success }]}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text numberOfLines={2} style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      )}

      {/* Encabezado del panel técnico */}
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <View style={styles.badgeRow}>
              <Text style={[styles.title, { color: colors.text }]}>Panel Técnico</Text>
              <View style={[styles.techChip, { backgroundColor: `${palette.primary}1A` }]}>
                <Ionicons name="construct" size={13} color={palette.primary} />
                <Text style={[styles.techChipText, { color: palette.primary }]}>Taller</Text>
              </View>
            </View>
            <Text style={[styles.muted, { color: colors.muted }]}>
              {loading ? 'Cargando órdenes…' : `${total} ${total === 1 ? 'orden en taller' : 'órdenes en taller'}`}
            </Text>
          </View>
          <Pressable
            onPress={refresh}
            accessibilityRole="button"
            accessibilityLabel="Actualizar órdenes"
            style={({ pressed }) => [styles.refreshBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="refresh" size={19} color={colors.text} />
          </Pressable>
        </View>

        {/* Selector de asignación / vista */}
        <View style={[styles.scopeWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setScope('my');
              setSelectedTechId(null);
            }}
            accessibilityRole="button"
            style={[styles.scopeBtn, scope === 'my' && { backgroundColor: palette.primary }]}>
            <Ionicons name="person" size={14} color={scope === 'my' ? '#fff' : colors.muted} />
            <Text style={[styles.scopeText, { color: scope === 'my' ? '#fff' : colors.text }, scope === 'my' && styles.bold]}>
              Mis órdenes
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              setScope('unassigned');
              setSelectedTechId(null);
            }}
            accessibilityRole="button"
            style={[styles.scopeBtn, scope === 'unassigned' && { backgroundColor: palette.primary }]}>
            <Ionicons name="help-circle-outline" size={15} color={scope === 'unassigned' ? '#fff' : colors.muted} />
            <Text style={[styles.scopeText, { color: scope === 'unassigned' ? '#fff' : colors.text }, scope === 'unassigned' && styles.bold]}>
              Sin asignar
            </Text>
          </Pressable>

          {canManageAll && (
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setScope('all');
              }}
              accessibilityRole="button"
              style={[styles.scopeBtn, scope === 'all' && { backgroundColor: palette.primary }]}>
              <Ionicons name="apps-outline" size={15} color={scope === 'all' ? '#fff' : colors.muted} />
              <Text style={[styles.scopeText, { color: scope === 'all' ? '#fff' : colors.text }, scope === 'all' && styles.bold]}>
                Todas
              </Text>
            </Pressable>
          )}
        </View>

        {/* Filtro de técnico específico cuando está en 'all' */}
        {scope === 'all' && technicians.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.techScroll}>
            <Pressable
              onPress={() => setSelectedTechId(null)}
              style={[
                styles.techFilterChip,
                {
                  backgroundColor: !selectedTechId ? `${palette.primary}18` : colors.card,
                  borderColor: !selectedTechId ? palette.primary : colors.border,
                },
              ]}>
              <Text style={[styles.techFilterText, { color: !selectedTechId ? palette.primary : colors.text }, !selectedTechId && styles.bold]}>
                Todos los técnicos
              </Text>
            </Pressable>
            {technicians.map((t) => {
              const active = selectedTechId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSelectedTechId(t.id)}
                  style={[
                    styles.techFilterChip,
                    {
                      backgroundColor: active ? `${palette.primary}18` : colors.card,
                      borderColor: active ? palette.primary : colors.border,
                    },
                  ]}>
                  <Text style={[styles.techFilterText, { color: active ? palette.primary : colors.text }, active && styles.bold]}>
                    {t.name || 'Técnico'}
                  </Text>
                  {typeof t.activeJobs === 'number' && t.activeJobs > 0 && (
                    <View style={[styles.miniCount, { backgroundColor: active ? palette.primary : colors.border }]}>
                      <Text style={[styles.miniCountText, { color: active ? '#fff' : colors.text }]}>{t.activeJobs}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Buscador */}
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ticket, cliente, teléfono o modelo"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => setSearch(query)}
            accessibilityLabel="Buscar órdenes en taller"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* KPI Cards de Estado */}
      <View style={styles.kpiContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
          <KpiCard
            title="En taller"
            count={stats.activeTotal}
            icon="construct-outline"
            tone="#2563EB"
            colors={colors}
            selected={filter === 'active'}
            onPress={() => setFilter('active')}
          />
          <KpiCard
            title="Diagnóstico"
            count={stats.diagnostic}
            icon="time-outline"
            tone="#7C3AED"
            colors={colors}
            selected={filter === 'diagnostico'}
            onPress={() => setFilter('diagnostico')}
          />
          <KpiCard
            title="Reparación"
            count={stats.inRepair}
            icon="hammer-outline"
            tone="#D97706"
            colors={colors}
            selected={filter === 'reparacion'}
            onPress={() => setFilter('reparacion')}
          />
          <KpiCard
            title="Pausadas"
            count={stats.paused}
            icon="pause-circle-outline"
            tone="#CA8A04"
            colors={colors}
            selected={filter === 'pausado'}
            onPress={() => setFilter('pausado')}
          />
          <KpiCard
            title="Listas"
            count={stats.ready}
            icon="checkmark-circle-outline"
            tone="#16A34A"
            colors={colors}
            selected={filter === 'listo'}
            onPress={() => setFilter('listo')}
          />
        </ScrollView>
      </View>

      {/* Pestañas de estado */}
      <View>
        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const selected = item.key === filter;
            const tone = item.key in STATUS ? STATUS[item.key as keyof typeof STATUS].color : palette.primary;
            return (
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setFilter(item.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.filter,
                  { borderColor: selected ? tone : colors.border, backgroundColor: selected ? `${tone}18` : colors.card },
                ]}>
                <Text style={[styles.filterText, { color: selected ? tone : colors.text }, selected && styles.bold]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Lista de Reparaciones */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.primary} />
          <Text style={[styles.muted, { color: colors.muted }]}>Cargando órdenes del taller…</Text>
        </View>
      ) : error && repairs.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
          <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text>
          <Pressable onPress={refresh} style={[styles.retryBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={repairs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="construct-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search ? 'Sin coincidencias' : 'No hay órdenes en esta vista'}
              </Text>
              <Text style={[styles.muted, { color: colors.muted }]}>
                {search ? `Ninguna orden coincide con «${search}».` : 'Todo al día con el filtro actual.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            <View>
              {error && <Text accessibilityRole="alert" style={{ color: palette.danger, padding: 12 }}>{error}</Text>}
              {loadingMore ? <ActivityIndicator style={styles.more} color={palette.primary} /> : null}
            </View>
          }
          renderItem={({ item }) => (
            <TechnicianRepairCard
              repair={item}
              colors={colors}
              onStatusChange={openStatusChange}
              onOpenQc={() => setQcRepair(item)}
            />
          )}
        />
      )}

      {/* Modal de Control de Calidad */}
      {qcRepair && (
        <QualityCheckSheet
          repair={qcRepair}
          visible={Boolean(qcRepair)}
          onClose={() => setQcRepair(null)}
          onSaved={(updated, result: QualityResult) => {
            const merged = { ...qcRepair, ...updated };
            setRepairs((list) => list.map((item) => (item.id === merged.id ? merged : item)));
            updateCachedRepair(merged);
            setQcRepair(null);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setNotice(
              result === 'failed'
                ? `Falla registrada en ${ticketOf(merged)}: volvió a reparación.`
                : `Verificación aprobada: ${ticketOf(merged)} quedó listo para retirar.`
            );
          }}
        />
      )}

      {/* Modal de Confirmación de Cambio de Estado */}
      <Modal
        visible={statusTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !statusSaving && setStatusTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !statusSaving && setStatusTarget(null)} />
          {statusTarget && (
            <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Ionicons
                  name={STATUS[statusTarget.stage]?.icon ?? 'sync-outline'}
                  size={24}
                  color={STATUS[statusTarget.stage]?.color ?? palette.primary}
                />
                <View style={styles.flex}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {statusTarget.stage === 'reparacion' && 'Iniciar reparación'}
                    {statusTarget.stage === 'diagnostico' && 'Iniciar diagnóstico'}
                    {statusTarget.stage === 'pausado' && 'Pausar orden'}
                    {statusTarget.stage === 'listo' && 'Marcar como listo'}
                    {statusTarget.stage === 'cancelado' && 'Cancelar orden'}
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.muted }]}>
                    {ticketOf(statusTarget.repair)} · {deviceName(statusTarget.repair)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.modalPrompt, { color: colors.text }]}>
                {statusTarget.stage === 'pausado'
                  ? 'Ingresá el motivo de pausa (ej: esperando repuestos o autorización):'
                  : 'Podés agregar una nota opcional que quedará guardada en el historial:'}
              </Text>

              <TextInput
                value={statusNote}
                onChangeText={setStatusNote}
                placeholder={statusTarget.stage === 'pausado' ? 'Ej: En espera de pantalla original' : 'Nota interna (opcional)'}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={500}
                style={[styles.noteInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />

              {statusError && <Text style={styles.errorText}>{statusError}</Text>}

              <View style={styles.modalActions}>
                <Pressable
                  disabled={statusSaving}
                  onPress={() => setStatusTarget(null)}
                  style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  disabled={statusSaving}
                  onPress={confirmStatusChange}
                  style={[styles.modalBtn, { backgroundColor: STATUS[statusTarget.stage]?.color ?? palette.primary }]}>
                  {statusSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Confirmar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Tarjeta KPI ─────────────────────────────────────────────────────────────

function KpiCard({
  title,
  count,
  icon,
  tone,
  colors,
  selected,
  onPress,
}: {
  title: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  colors: Colors;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      style={[
        styles.kpiCard,
        {
          backgroundColor: selected ? `${tone}18` : colors.card,
          borderColor: selected ? tone : colors.border,
        },
      ]}>
      <View style={styles.kpiTop}>
        <View style={[styles.kpiIconWrap, { backgroundColor: `${tone}20` }]}>
          <Ionicons name={icon} size={16} color={tone} />
        </View>
        <Text style={[styles.kpiCount, { color: selected ? tone : colors.text }]}>{count}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.kpiTitle, { color: selected ? tone : colors.muted }]}>
        {title}
      </Text>
    </Pressable>
  );
}

// ─── Tarjeta de Reparación en el Panel de Técnico ────────────────────────────

function TechnicianRepairCard({
  repair,
  colors,
  onStatusChange,
  onOpenQc,
}: {
  repair: Repair;
  colors: Colors;
  onStatusChange: (repair: Repair, stage: RepairStatus) => void;
  onOpenQc: () => void;
}) {
  const status = STATUS[repair.status] ?? STATUS.recibido;
  const days = daysSince(repair.created_at);
  const urgent = repair.priority === 'high' ? PRIORITY.high : null;
  const outcome = repairOutcome(repair);
  const phone = repair.customer?.phone?.trim();
  const { balance, quoted } = money(repair);

  const isOverdue = repair.status !== 'entregado' && repair.status !== 'cancelado' && days >= 7;

  return (
    <Pressable
      onPress={() => router.push(`/panel/repairs/${repair.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${ticketOf(repair)}, ${deviceName(repair)}, estado ${status.label}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: isOverdue ? `${palette.danger}60` : colors.border, opacity: pressed ? 0.9 : 1 },
      ]}>
      {/* Borde lateral de estado */}
      <View style={[styles.cardStripe, { backgroundColor: status.color }]} />

      <View style={styles.cardContent}>
        {/* Cabecera del ticket y badges */}
        <View style={styles.cardRow}>
          <View style={styles.ticketGroup}>
            <Text style={[styles.ticketCode, { color: colors.text }]}>{ticketOf(repair)}</Text>
            {urgent && (
              <View style={[styles.urgentChip, { backgroundColor: `${urgent.color}1E`, borderColor: urgent.color }]}>
                <Ionicons name="flame" size={11} color={urgent.color} />
                <Text style={[styles.urgentText, { color: urgent.color }]}>{urgent.label}</Text>
              </View>
            )}
            {outcome && (
              <View style={[styles.outcomeChip, { borderColor: outcome.color }]}>
                <Text style={[styles.outcomeText, { color: outcome.color }]}>{outcome.label}</Text>
              </View>
            )}
          </View>

          <View style={[styles.statusBadge, { backgroundColor: `${status.color}1A` }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Datos del Dispositivo */}
        <View style={styles.deviceRow}>
          <Ionicons
            name={DEVICE_ICONS[repair.device_type ?? ''] ?? 'hardware-chip-outline'}
            size={18}
            color={colors.text}
          />
          <Text numberOfLines={1} style={[styles.deviceName, { color: colors.text }]}>
            {deviceName(repair)}
          </Text>
        </View>

        {/* Problema y diagnóstico */}
        {repair.problem_description ? (
          <Text numberOfLines={2} style={[styles.problemText, { color: colors.muted }]}>
            <Text style={{ fontWeight: '700', color: colors.text }}>Falla: </Text>
            {repair.problem_description}
          </Text>
        ) : null}

        {repair.diagnosis ? (
          <View style={[styles.diagBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="bulb-outline" size={13} color={palette.primary} />
            <Text numberOfLines={2} style={[styles.diagText, { color: colors.text }]}>
              {repair.diagnosis}
            </Text>
          </View>
        ) : null}

        {/* Cliente y Acciones Rápidas de Comunicación */}
        <View style={[styles.customerBar, { borderColor: colors.border }]}>
          <View style={styles.customerInfo}>
            <Ionicons name="person-outline" size={13} color={colors.muted} />
            <Text numberOfLines={1} style={[styles.customerName, { color: colors.text }]}>
              {customerName(repair)}
            </Text>
          </View>

          {phone ? (
            <View style={styles.contactActions}>
              <Pressable
                onPress={() => void Linking.openURL(`https://wa.me/${whatsappNumber(phone)}`)}
                hitSlop={6}
                accessibilityLabel="Enviar WhatsApp al cliente"
                style={({ pressed }) => [styles.contactBtn, { backgroundColor: '#25D36622', opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
              </Pressable>
              <Pressable
                onPress={() => void Linking.openURL(`tel:${phone}`)}
                hitSlop={6}
                accessibilityLabel="Llamar al cliente"
                style={({ pressed }) => [styles.contactBtn, { backgroundColor: `${palette.primary}22`, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name="call-outline" size={14} color={palette.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Meta: Técnico asignado + Días en taller + Saldo */}
        <View style={styles.metaRow}>
          <View style={styles.techMeta}>
            <Ionicons
              name={repair.technician?.id ? 'checkmark-circle' : 'alert-circle-outline'}
              size={13}
              color={repair.technician?.id ? palette.primary : colors.muted}
            />
            <Text numberOfLines={1} style={[styles.metaText, { color: repair.technician?.id ? colors.text : colors.muted }]}>
              {repair.technician?.full_name ? `Téc.: ${repair.technician.full_name}` : 'Sin técnico asignado'}
            </Text>
          </View>

          <Text style={[styles.metaText, isOverdue ? { color: palette.danger, fontWeight: '700' } : { color: colors.muted }]}>
            {shortDate(repair.created_at)} · {days} {days === 1 ? 'día' : 'días'}
          </Text>
        </View>

        {quoted && balance > 0 && (
          <View style={styles.balanceRow}>
            <Text style={[styles.balanceLabel, { color: colors.muted }]}>Saldo pendiente:</Text>
            <Text style={[styles.balanceAmount, { color: colors.text }]}>{formatGs(balance)}</Text>
          </View>
        )}

        {/* Barra de Acciones Directas para Técnicos */}
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          {repair.status === 'recibido' && (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onStatusChange(repair, 'diagnostico');
              }}
              style={[styles.primaryActionBtn, { backgroundColor: '#7C3AED' }]}>
              <Ionicons name="time-outline" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Iniciar Diagnóstico</Text>
            </Pressable>
          )}

          {repair.status === 'diagnostico' && (
            <>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStatusChange(repair, 'reparacion');
                }}
                style={[styles.primaryActionBtn, { backgroundColor: '#D97706' }]}>
                <Ionicons name="construct-outline" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>A Reparación</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStatusChange(repair, 'pausado');
                }}
                style={[styles.secondaryActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="pause-circle-outline" size={14} color={colors.text} />
                <Text style={[styles.secondaryActionText, { color: colors.text }]}>Pausar</Text>
              </Pressable>
            </>
          )}

          {repair.status === 'reparacion' && (
            <>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onOpenQc();
                }}
                style={[styles.primaryActionBtn, { backgroundColor: '#16A34A' }]}>
                <Ionicons name="checkmark-done" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Verificar / Listo</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onStatusChange(repair, 'pausado');
                }}
                style={[styles.secondaryActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="pause-circle-outline" size={14} color={colors.text} />
                <Text style={[styles.secondaryActionText, { color: colors.text }]}>Pausar</Text>
              </Pressable>
            </>
          )}

          {repair.status === 'pausado' && (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onStatusChange(repair, 'reparacion');
              }}
              style={[styles.primaryActionBtn, { backgroundColor: '#D97706' }]}>
              <Ionicons name="play-outline" size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Reanudar Trabajo</Text>
            </Pressable>
          )}

          {repair.status === 'listo' && (
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onStatusChange(repair, 'reparacion');
              }}
              style={[styles.secondaryActionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>Reabrir orden</Text>
            </Pressable>
          )}

          {/* Botón Detalle */}
          <Pressable
            onPress={() => router.push(`/panel/repairs/${repair.id}` as never)}
            style={[styles.detailBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.detailBtnText, { color: palette.primary }]}>Ver detalle</Text>
            <Ionicons name="chevron-forward" size={14} color={palette.primary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  top: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  techChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  techChipText: { fontSize: 11, fontWeight: '800' },
  muted: { fontSize: 13 },
  refreshBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Selector de alcance (Mis órdenes / Sin asignar / Todas)
  scopeWrap: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  scopeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  scopeText: { fontSize: 12, fontWeight: '600' },

  // Scroll de técnicos
  techScroll: { paddingVertical: 2, gap: 8 },
  techFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  techFilterText: { fontSize: 12, fontWeight: '600' },
  miniCount: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  miniCountText: { fontSize: 10, fontWeight: '800' },

  // Búsqueda
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },

  // KPIs
  kpiContainer: { marginTop: 10 },
  kpiScroll: { paddingHorizontal: 16, gap: 8 },
  kpiCard: { width: 115, borderWidth: 1, borderRadius: 14, padding: 10, gap: 6 },
  kpiTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiCount: { fontSize: 18, fontWeight: '800' },
  kpiTitle: { fontSize: 11, fontWeight: '700' },

  // Filtros de estado horizontales
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontSize: 12, fontWeight: '600' },

  // Lista
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  more: { paddingVertical: 16 },

  // Tarjeta de Reparación
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  cardStripe: { width: 4 },
  cardContent: { flex: 1, padding: 12, gap: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ticketGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  ticketCode: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  urgentChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  urgentText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  outcomeChip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  outcomeText: { fontSize: 10, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },

  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceName: { flex: 1, fontSize: 16, fontWeight: '800' },
  problemText: { fontSize: 13, lineHeight: 18 },
  diagBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderWidth: 1, borderRadius: 8, padding: 8 },
  diagText: { flex: 1, fontSize: 12, lineHeight: 16 },

  customerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  customerName: { fontSize: 12, fontWeight: '600' },
  contactActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  techMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  metaText: { fontSize: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  balanceLabel: { fontSize: 11 },
  balanceAmount: { fontSize: 12, fontWeight: '800' },

  // Barra de acciones directas
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  primaryActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10 },
  secondaryActionText: { fontSize: 12, fontWeight: '700' },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10 },
  detailBtnText: { fontSize: 12, fontWeight: '700' },

  // Modal
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalSheet: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSub: { fontSize: 13 },
  modalPrompt: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  noteInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  errorText: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  modalBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '800' },

  // Notice
  noticeBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  noticeText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
});
