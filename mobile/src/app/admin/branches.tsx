import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BottomSheet } from '@/components/bottom-sheet';
import { Field, useUnsavedChangesGuard } from '@/components/website/website-ui';
import {
  createBranch,
  fetchBranches,
  updateBranch,
  type BranchItem,
} from '@/lib/admin';
import {
  branchDraft,
  branchDraftIssue,
  branchPayload,
  type BranchDraft,
} from '@/lib/branch-model';
import { formatGs } from '@/lib/marketplace';
import { usePalette } from '@/lib/palette';
import {
  getPrivateCacheContext,
  subscribePrivateCacheContext,
} from '@/lib/private-cache-context';

export default function BranchesAdminScreen() {
  const scope = useSyncExternalStore(
    subscribePrivateCacheContext,
    getPrivateCacheContext,
  );
  return scope.organizationId ? (
    <Branches key={scope.epoch} organizationId={scope.organizationId} />
  ) : (
    <ActivityIndicator accessibilityLabel="Esperando el negocio activo" />
  );
}
function Branches({ organizationId }: { organizationId: string }) {
  const colors = usePalette();
  const accent = colors.text === '#F1F5F9' ? '#93C5FD' : '#1D4ED8';
  const [branches, setBranches] = useState<BranchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<BranchItem | 'new' | null>(null);
  const [working, setWorking] = useState(false);
  const actionLock = useRef(false);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const generation = ++request.current;
    const scope = getPrivateCacheContext();
    setRefreshing(true);
    try {
      const result = await fetchBranches(organizationId);
      if (
        generation !== request.current ||
        scope.epoch !== getPrivateCacheContext().epoch
      )
        return;
      setBranches(result);
      setError(null);
    } catch (error) {
      if (
        generation === request.current &&
        scope.epoch === getPrivateCacheContext().epoch
      )
        setError(
          error instanceof Error
            ? error.message
            : 'No pudimos cargar las sucursales.',
        );
    } finally {
      if (generation === request.current) setRefreshing(false);
    }
  }, [organizationId]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        request.current++;
      };
    }, [reload]),
  );
  const action = (branch: BranchItem, makeDefault: boolean) => {
    if (actionLock.current) return;
    const scope = getPrivateCacheContext();
    Alert.alert(
      makeDefault
        ? 'Cambiar sucursal principal'
        : branch.is_active
          ? 'Desactivar sucursal'
          : 'Activar sucursal',
      makeDefault
        ? `¿Marcar ${branch.name} como principal?`
        : `¿${branch.is_active ? 'Desactivar' : 'Activar'} ${branch.name}? La sucursal principal y la única activa deben seguir operativas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            void (async () => {
              if (
                actionLock.current ||
                scope.epoch !== getPrivateCacheContext().epoch
              )
                return;
              actionLock.current = true;
              setWorking(true);
              try {
                await updateBranch(
                  branch.id,
                  makeDefault
                    ? { is_default: true }
                    : { is_active: !branch.is_active },
                );
                await reload();
                void Haptics.selectionAsync().catch(() => undefined);
              } catch (error) {
                Alert.alert(
                  'No se pudo actualizar',
                  error instanceof Error ? error.message : 'Volvé a intentar.',
                );
              } finally {
                actionLock.current = false;
                setWorking(false);
              }
            })();
          },
        },
      ],
    );
  };
  const query = search.trim().toLocaleLowerCase('es-PY');
  const filtered = (branches ?? []).filter(
    (branch) =>
      (filter === 'all' || branch.is_active === (filter === 'active')) &&
      [branch.name, branch.code, branch.city, branch.manager_name].some(
        (value) => value?.toLocaleLowerCase('es-PY').includes(query),
      ),
  );
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            Sucursales
          </Text>
          <Text style={{ color: colors.muted }}>Locales y puntos de venta</Text>
        </View>
        <Action
          label="Nueva"
          color={accent}
          disabled={working}
          onPress={() => setEditor('new')}
        />
      </View>
      <View style={styles.search}>
        <TextInput
          accessibilityLabel="Buscar sucursales"
          value={search}
          onChangeText={setSearch}
          placeholder="Nombre, código, ciudad o encargado"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            { color: colors.text, borderColor: colors.border },
          ]}
        />
      </View>
      <View style={styles.filters}>
        {[
          ['all', 'Todas'],
          ['active', 'Activas'],
          ['inactive', 'Inactivas'],
        ].map(([value, label]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            key={value}
            onPress={() => setFilter(value)}
            style={[
              styles.chip,
              { borderColor: filter === value ? accent : colors.border },
            ]}
          >
            <Text style={{ color: filter === value ? accent : colors.text }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload()}
            tintColor={accent}
          />
        }
      >
        {error && (
          <View
            accessibilityRole="alert"
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Text style={{ color: colors.text }}>{error}</Text>
            {branches && (
              <Text style={{ color: colors.muted }}>
                Ves la última lista confirmada.
              </Text>
            )}
            <Action
              label="Reintentar"
              color={accent}
              onPress={() => void reload()}
            />
          </View>
        )}
        {!branches && !error ? (
          <ActivityIndicator
            accessibilityLabel="Cargando sucursales"
            color={accent}
          />
        ) : (
          !filtered.length && (
            <Text style={{ color: colors.muted }}>
              {search || filter !== 'all'
                ? 'No hay sucursales que coincidan con estos filtros.'
                : 'Todavía no hay sucursales. Tocá Nueva para empezar.'}
            </Text>
          )
        )}
        {filtered.map((branch) => (
          <View
            key={branch.id}
            style={[
              styles.card,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]}>
                  {branch.name}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {branch.is_default ? 'Principal · ' : ''}
                  {branch.is_active ? 'Activa' : 'Inactiva'}
                  {branch.code ? ` · ${branch.code}` : ''}
                </Text>
              </View>
              <Action
                label="Editar"
                color={accent}
                disabled={working}
                onPress={() => setEditor(branch)}
              />
            </View>
            {(branch.address || branch.city) && (
              <Text style={{ color: colors.text }}>
                {[branch.address, branch.city].filter(Boolean).join(', ')}
              </Text>
            )}
            {branch.phone && (
              <Text style={{ color: colors.text }}>
                Teléfono: {branch.phone}
              </Text>
            )}
            {branch.manager_name && (
              <Text style={{ color: colors.text }}>
                Contacto responsable: {branch.manager_name}
              </Text>
            )}
            <View style={styles.metrics}>
              <Metric
                label="Cajas abiertas"
                value={`${branch.open_registers_count}/${branch.registers_count}`}
                colors={colors}
              />
              <Metric
                label="Miembros"
                value={String(branch.users_count)}
                colors={colors}
              />
              <Metric
                label="Ventas del mes"
                value={String(branch.sales_count)}
                colors={colors}
              />
              <Metric
                label="Facturación del mes"
                value={formatGs(branch.revenue_total)}
                colors={colors}
              />
            </View>
            <View style={styles.actions}>
              <Action
                label="Ver detalle"
                color={accent}
                onPress={() => router.push({ pathname: '/admin/branch-detail', params: { id: branch.id, name: branch.name } })}
              />
              {!branch.is_default && branch.is_active && (
                <Action
                  label="Hacer principal"
                  color={accent}
                  disabled={working}
                  onPress={() => action(branch, true)}
                />
              )}
              <Action
                label={branch.is_active ? 'Desactivar' : 'Activar'}
                color={accent}
                disabled={working || (branch.is_default && branch.is_active)}
                onPress={() => action(branch, false)}
              />
            </View>
          </View>
        ))}
      </ScrollView>
      {editor && (
        <BranchEditor
          key={typeof editor === 'string' ? 'new' : editor.id}
          branch={typeof editor === 'string' ? null : editor}
          organizationId={organizationId}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void reload();
          }}
        />
      )}
    </View>
  );
}
function BranchEditor({
  branch,
  organizationId,
  onClose,
  onSaved,
}: {
  branch: BranchItem | null;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = usePalette();
  const original = branchDraft(branch ?? undefined);
  const [draft, setDraft] = useState(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const set = (key: keyof BranchDraft, value: string) => {
    if (!lock.current) setDraft((current) => ({ ...current, [key]: value }));
  };
  const close = () => {
    if (lock.current) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert(
      '¿Descartar los cambios?',
      'Todavía no guardaste esta sucursal.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: onClose },
      ],
    );
  };
  const save = async () => {
    if (lock.current) return false;
    const issue = branchDraftIssue(draft);
    if (issue) {
      setError(issue);
      return false;
    }
    const scope = getPrivateCacheContext();
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      const payload = branchPayload(draft);
      if (branch) await updateBranch(branch.id, payload);
      else
        await createBranch({
          ...payload,
          organization_id: organizationId,
          is_active: true,
        });
      if (scope.epoch !== getPrivateCacheContext().epoch) return false;
      onSaved();
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      return true;
    } catch (error) {
      if (scope.epoch === getPrivateCacheContext().epoch)
        setError(
          error instanceof Error ? error.message : 'No se pudo guardar.',
        );
      return false;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  useUnsavedChangesGuard(dirty, save, saving);
  return (
    <BottomSheet
      visible
      tall
      title={branch ? 'Editar sucursal' : 'Nueva sucursal'}
      subtitle="Datos del local y contacto"
      onClose={close}
      footer={
        <View style={styles.actions}>
          <Action
            label="Cancelar"
            color={colors.text}
            disabled={saving}
            onPress={close}
          />
          <Action
            label={saving ? 'Guardando…' : 'Guardar sucursal'}
            color={colors.text}
            disabled={saving}
            onPress={() => void save()}
          />
        </View>
      }
    >
      <View pointerEvents={saving ? 'none' : 'auto'}>
        <Field
          label="Nombre de la sucursal"
          value={draft.name}
          onChangeText={(value) => set('name', value)}
          maxLength={100}
        />
        <Field
          label="Código"
          value={draft.code}
          onChangeText={(value) => set('code', value)}
          maxLength={30}
          autoCapitalize="none"
          help="Si es nueva y lo dejás vacío, se genera automáticamente."
        />
        <Field
          label="Dirección"
          value={draft.address}
          onChangeText={(value) => set('address', value)}
          maxLength={300}
        />
        <Field
          label="Ciudad"
          value={draft.city}
          onChangeText={(value) => set('city', value)}
          maxLength={100}
        />
        <Field
          label="Teléfono"
          value={draft.phone}
          onChangeText={(value) => set('phone', value)}
          keyboardType="phone-pad"
          maxLength={30}
        />
        <Field
          label="Correo"
          value={draft.email}
          onChangeText={(value) => set('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={150}
        />
        <Field
          label="Contacto responsable"
          value={draft.manager_name}
          onChangeText={(value) => set('manager_name', value)}
          maxLength={100}
          help="Este nombre no asigna permisos ni incorpora un usuario al local."
        />
        {!branch && (
          <View style={[styles.card, { borderColor: colors.border }]}>
            <Ionicons name="cube-outline" size={22} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              Inventario inicial vacío
            </Text>
            <Text style={{ color: colors.muted }}>
              Los productos empiezan con stock cero en este local. Para copiar
              existencias desde otra sucursal, usá la gestión web.
            </Text>
          </View>
        )}
        {error && (
          <Text accessibilityRole="alert" style={{ color: colors.text }}>
            {error}
          </Text>
        )}
      </View>
    </BottomSheet>
  );
}
function Action({
  label,
  color,
  disabled,
  onPress,
}: {
  label: string;
  color: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, { opacity: disabled ? 0.45 : 1 }]}
    >
      <Text style={{ color, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
function Metric({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof usePalette>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
        {value}
      </Text>
      <Text style={{ color: colors.muted }}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  search: { paddingHorizontal: 16 },
  input: { minHeight: 48, borderWidth: 1, padding: 12, borderRadius: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 22,
  },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 18, fontWeight: '700' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { flexBasis: '45%', flexGrow: 1, gap: 4 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
});
