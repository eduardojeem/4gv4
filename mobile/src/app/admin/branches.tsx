import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createBranch, fetchBranches, updateBranch, type BranchItem } from '@/lib/admin';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

type Filter = 'all' | 'active' | 'inactive';

export default function BranchesAdminScreen() {
  const colors = usePalette();
  const [branches, setBranches] = useState<BranchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formManager, setFormManager] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchBranches()
      .then((data) => {
        if (!active) return;
        setBranches(data);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormName('');
    setFormCode('');
    setFormAddress('');
    setFormCity('');
    setFormPhone('');
    setFormEmail('');
    setFormManager('');
    setFormActive(true);
    setModalVisible(true);
  };

  const openEditModal = (branch: BranchItem) => {
    setEditingBranch(branch);
    setFormName(branch.name);
    setFormCode(branch.code || '');
    setFormAddress(branch.address || '');
    setFormCity(branch.city || '');
    setFormPhone(branch.phone || '');
    setFormEmail(branch.email || '');
    setFormManager(branch.manager_name || '');
    setFormActive(branch.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Datos incompletos', 'Ingresá el nombre de la sucursal.');
      return;
    }
    setSaving(true);
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, {
          name: formName.trim(),
          code: formCode.trim() || undefined,
          address: formAddress.trim() || undefined,
          city: formCity.trim() || undefined,
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          manager_name: formManager.trim() || undefined,
          is_active: formActive,
        });
      } else {
        await createBranch({
          name: formName.trim(),
          code: formCode.trim() || undefined,
          address: formAddress.trim() || undefined,
          city: formCity.trim() || undefined,
          phone: formPhone.trim() || undefined,
          email: formEmail.trim() || undefined,
          manager_name: formManager.trim() || undefined,
          is_active: formActive,
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(false);
      reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la sucursal.');
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchActive = (branch: BranchItem) => {
    Alert.alert(
      branch.is_active ? 'Desactivar sucursal' : 'Activar sucursal',
      `¿Deseás ${branch.is_active ? 'desactivar' : 'activar'} "${branch.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: branch.is_active ? 'Desactivar' : 'Activar',
          style: branch.is_active ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await updateBranch(branch.id, { is_active: !branch.is_active });
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              reload();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
            }
          },
        },
      ]
    );
  };

  const setAsDefault = (branch: BranchItem) => {
    Alert.alert(
      'Establecer como principal',
      `¿Deseás marcar "${branch.name}" como la sucursal principal del negocio?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await updateBranch(branch.id, { is_default: true });
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              reload();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar.');
            }
          },
        },
      ]
    );
  };

  const filteredBranches = (branches ?? []).filter((b) => {
    if (filter === 'active' && !b.is_active) return false;
    if (filter === 'inactive' && b.is_active) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.city && b.city.toLowerCase().includes(q)) ||
        (b.code && b.code.toLowerCase().includes(q)) ||
        (b.manager_name && b.manager_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <View style={styles.flex}>
          <Text style={[styles.topTitle, { color: colors.text }]}>Sucursales</Text>
          <Text style={[styles.topSub, { color: colors.muted }]}>Gestión de locales y puntos de venta</Text>
        </View>
        <Pressable onPress={openCreateModal} style={styles.newButton}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newButtonText}>Nueva</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            placeholder="Buscar por nombre, código o ciudad…"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'active', 'inactive'] as const).map((key) => {
          const active = filter === key;
          const label = key === 'all' ? 'Todas' : key === 'active' ? 'Activas' : 'Inactivas';
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? (palette.primary) : colors.card,
                  borderColor: active ? palette.primary : colors.border,
                },
              ]}>
              <Text style={[styles.filterText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
        {branches === null ? (
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
        ) : filteredBranches.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="business-outline" size={40} color={colors.muted} />
            <Text style={[styles.bold, { color: colors.text }]}>
              {search ? 'Sin coincidencias' : 'No hay sucursales registradas'}
            </Text>
            <Text style={[styles.small, { color: colors.muted, textAlign: 'center' }]}>
              {search ? 'Probá con otro término de búsqueda' : 'Tocá en "Nueva" para dar de alta tu primera sucursal.'}
            </Text>
          </View>
        ) : (
          filteredBranches.map((branch) => (
            <View
              key={branch.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                !branch.is_active && { opacity: 0.75 },
              ]}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.branchName, { color: colors.text }]}>{branch.name}</Text>
                    {branch.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>Principal</Text>
                      </View>
                    )}
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: branch.is_active ? '#16A34A' : '#94A3B8' },
                      ]}
                    />
                  </View>
                  {branch.code ? (
                    <Text style={[styles.small, { color: colors.muted }]}>Código: {branch.code}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => openEditModal(branch)} hitSlop={8} style={styles.iconBtn}>
                  <Ionicons name="pencil" size={17} color={palette.primary} />
                </Pressable>
              </View>

              <View style={styles.cardBody}>
                {branch.address || branch.city ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="location-outline" size={15} color={colors.muted} />
                    <Text style={[styles.small, { color: colors.text, flex: 1 }]}>
                      {[branch.address, branch.city].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                ) : null}

                {branch.manager_name ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="person-outline" size={15} color={colors.muted} />
                    <Text style={[styles.small, { color: colors.text }]}>
                      Encargado: {branch.manager_name}
                    </Text>
                  </View>
                ) : null}

                {branch.phone ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={15} color={colors.muted} />
                    <Text style={[styles.small, { color: colors.text }]}>{branch.phone}</Text>
                  </View>
                ) : null}
              </View>

              {/* Métricas operativas */}
              <View style={[styles.metricsRow, { borderColor: colors.border }]}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: colors.text }]}>
                    {branch.open_registers_count}/{branch.registers_count}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Cajas abiertas</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: colors.text }]}>{branch.sales_count}</Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Ventas del mes</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: colors.text }]}>{branch.users_count}</Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Miembros</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: palette.primary }]}>{formatGs(branch.revenue_total)}</Text>
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>Facturado</Text>
                </View>
              </View>

              {/* Botones de acción rápida */}
              <View style={styles.actionsFooter}>
                {!branch.is_default && (
                  <Pressable onPress={() => setAsDefault(branch)} style={styles.actionBtn}>
                    <Ionicons name="star-outline" size={14} color={palette.primary} />
                    <Text style={[styles.actionBtnText, { color: palette.primary }]}>Hacer principal</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => toggleBranchActive(branch)} style={styles.actionBtn}>
                  <Ionicons
                    name={branch.is_active ? 'eye-off-outline' : 'eye-outline'}
                    size={14}
                    color={branch.is_active ? '#DC2626' : '#16A34A'}
                  />
                  <Text style={[styles.actionBtnText, { color: branch.is_active ? '#DC2626' : '#16A34A' }]}>
                    {branch.is_active ? 'Desactivar' : 'Activar'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Crear / Editar Sucursal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingBranch ? 'Editar sucursal' : 'Nueva sucursal'}
              </Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.formBody}>
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Nombre de la sucursal *</Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Ej: Sucursal Central / Shopping"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Código</Text>
                <TextInput
                  value={formCode}
                  onChangeText={setFormCode}
                  placeholder="Ej: SUC-01"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Dirección</Text>
                <TextInput
                  value={formAddress}
                  onChangeText={setFormAddress}
                  placeholder="Calle y número"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Ciudad</Text>
                <TextInput
                  value={formCity}
                  onChangeText={setFormCity}
                  placeholder="Asunción, Luque, CDE…"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Encargado / Administrador</Text>
                <TextInput
                  value={formManager}
                  onChangeText={setFormManager}
                  placeholder="Nombre del responsable"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Teléfono</Text>
                <TextInput
                  value={formPhone}
                  onChangeText={setFormPhone}
                  placeholder="Ej: 0981 123 456"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Email</Text>
                <TextInput
                  value={formEmail}
                  onChangeText={setFormEmail}
                  placeholder="sucursal@comercio.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderColor: colors.border }]}>
              <Pressable onPress={() => setModalVisible(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveBtn, { opacity: saving ? 0.7 : 1 }]}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingBranch ? 'Guardar cambios' : 'Crear sucursal'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  topSub: { fontSize: 12, marginTop: 1 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  newButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 13 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  filterText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  loading: { paddingVertical: 40 },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  branchName: { fontSize: 16, fontWeight: '800' },
  defaultBadge: {
    backgroundColor: 'rgba(37,99,235,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { padding: 4 },
  cardBody: { gap: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  metricItem: { alignItems: 'center' },
  metricVal: { fontSize: 13, fontWeight: '800' },
  metricLabel: { fontSize: 10, marginTop: 1 },
  actionsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 6,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  formBody: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 2,
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
