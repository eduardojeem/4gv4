import { PanelAccessState } from '@/components/panel-access-state';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { SelectField } from '@/components/select-sheet';
import {
  categoryTree,
  createCategory,
  deleteCategory,
  fetchCategoryRows,
  fetchGlobalCategories,
  importGlobalCategories,
  updateCategory,
  type CategoryRow,
  type GlobalCategory,
} from '@/lib/catalog';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;

/**
 * Categorías del catálogo, como /dashboard/categories: árbol con subcategorías,
 * cantidad de productos, alta y edición, borrado con las reglas de la API y
 * «Agregar desde el catálogo» del rubro.
 */
export default function CategoriesScreen() {
  const colors = usePalette();
  const { findItem, can, loading: panelLoading } = usePanel();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCategoryRows()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar las categorías.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = () => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  };

  const done = (text: string) => {
    setEditing(null);
    setCatalogOpen(false);
    setNotice(text);
    reload();
  };

  if (panelLoading || !findItem('categories')) return <PanelAccessState />;

  const q = query.trim().toLowerCase();
  const tree = categoryTree(rows);
  const visible = q ? tree.filter((row) => row.name.toLowerCase().includes(q)) : tree;
  const linked = rows.filter((row) => row.global_category_id).length;
  const totalProducts = rows.reduce((sum, row) => sum + (row.products_count ?? 0), 0);

  return (
    <View style={styles.flex}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>Categorías</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>
                  {loading ? 'Cargando…' : `${rows.length} categorías · ${totalProducts.toLocaleString('es-PY')} productos`}
                </Text>
              </View>
              <Pressable disabled={!can('products.create')} onPress={() => setEditing('new')} style={styles.newBtn} accessibilityRole="button">
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.newText}>Nueva</Text>
              </Pressable>
            </View>

            <View style={styles.kpis}>
              <Kpi label="Categorías" value={rows.length} colors={colors} />
              <Kpi label="Subcategorías" value={rows.filter((row) => row.parent_id).length} colors={colors} />
              <Kpi label="En el marketplace" value={linked} colors={colors} />
            </View>

            <Pressable disabled={!can('products.create')} onPress={() => setCatalogOpen(true)} style={[styles.catalogBtn, { borderColor: palette.primary, backgroundColor: 'rgba(37,99,235,0.06)' }]}>
              <Ionicons name="sparkles-outline" size={18} color={palette.primary} />
              <View style={styles.flex}>
                <Text style={[styles.catalogTitle, { color: palette.primary }]}>Agregar desde el catálogo</Text>
                <Text style={[styles.small, { color: colors.muted }]}>Categorías listas para tu rubro, vinculadas al marketplace</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.primary} />
            </Pressable>

            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar categoría" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.text }]} />
            </View>

            {notice && (
              <View style={[styles.notice, { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={[styles.noticeText, { color: '#16A34A' }]}>{notice}</Text>
              </View>
            )}
            {error && rows.length > 0 && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : error ? (
            <View style={styles.empty}>
              <Text style={[styles.muted, { color: colors.muted }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{q ? 'Sin resultados' : 'Todavía no hay categorías'}</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{q ? `Nada coincide con «${query}».` : 'Creá una o agregalas desde el catálogo.'}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={!can('products.update') && !can('products.delete')} onPress={() => setEditing(item)}
            style={({ pressed }) => [
              styles.row,
              { marginLeft: q ? 0 : item.level * 18, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : item.is_active === false ? 0.55 : 1 },
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: item.level > 0 ? colors.background : 'rgba(37,99,235,0.1)' }]}>
              <Ionicons name={item.level > 0 ? 'return-down-forward-outline' : 'folder-outline'} size={17} color={palette.primary} />
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={[styles.rowName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>
                {item.products_count ?? 0} {item.products_count === 1 ? 'producto' : 'productos'}
                {item.childCount ? ` · ${item.childCount} subcategorías` : ''}
                {item.is_active === false ? ' · Inactiva' : ''}
              </Text>
            </View>
            {item.global_category_id ? (
              <View style={[styles.badge, { backgroundColor: '#0891B21A' }]}>
                <Text style={[styles.badgeText, { color: '#0891B2' }]}>Marketplace</Text>
              </View>
            ) : null}
            {item.products_count ? (
              <Pressable onPress={() => router.push(`/panel/products?category=${item.id}` as never)} hitSlop={8} accessibilityLabel={`Ver productos de ${item.name}`}>
                <Ionicons name="cube-outline" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        )}
      />

      {editing && (
        <CategoryEditor
          category={editing === 'new' ? null : editing}
          rows={rows}
          onClose={() => setEditing(null)}
          onDone={done}
        />
      )}
      {catalogOpen && <CatalogImport existing={rows} onClose={() => setCatalogOpen(false)} onDone={done} />}
    </View>
  );
}

function Kpi({ label, value, colors }: { label: string; value: number; colors: Colors }) {
  return (
    <View style={[styles.kpi, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.kpiValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function CategoryEditor({ category, rows, onClose, onDone }: { category: CategoryRow | null; rows: CategoryRow[]; onClose: () => void; onDone: (text: string) => void }) {
  const colors = usePalette();
  const { can } = usePanel();
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [parentId, setParentId] = useState<string | null>(category?.parent_id ?? null);
  const [active, setActive] = useState(category?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Una categoría no puede ser hija de sí misma ni de una de sus hijas.
  const descendants = new Set<string>();
  if (category) {
    const collect = (id: string) =>
      rows.filter((row) => row.parent_id === id).forEach((row) => {
        descendants.add(row.id);
        collect(row.id);
      });
    collect(category.id);
  }
  const parents = rows.filter((row) => row.id !== category?.id && !descendants.has(row.id) && !row.parent_id);
  const parent = rows.find((row) => row.id === parentId);
  const duplicate = rows.some((row) => row.id !== category?.id && row.name.trim().toLowerCase() === name.trim().toLowerCase());
  const problem = name.trim().length < 2 ? 'El nombre necesita al menos 2 letras.' : duplicate ? 'Ya existe una categoría con ese nombre.' : null;

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const input = { name: name.trim(), description: description.trim() || null, parent_id: parentId, is_active: active };
      if (category) await updateCategory(category.id, input);
      else await createCategory(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(category ? `«${name.trim()}» actualizada.` : `Categoría «${name.trim()}» creada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar categoría', `¿Eliminar «${category!.name}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteCategory(category!.id);
            onDone(`«${category!.name}» eliminada.`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);

  return (
    <BottomSheet
      visible
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      onClose={() => !saving && onClose()}
      footer={
        <View style={styles.footer}>
          {category && can('products.delete') && (
            <Pressable onPress={remove} disabled={saving} style={[styles.footerBtn, { borderColor: '#DC262655' }]}>
              <Ionicons name="trash-outline" size={18} color={palette.danger} />
            </Pressable>
          )}
          <Pressable onPress={save} disabled={saving || !can(category ? 'products.update' : 'products.create')} style={[styles.save, { opacity: saving || problem ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{category ? 'Guardar cambios' : 'Crear categoría'}</Text>}
          </Pressable>
        </View>
      }>
      <Field label="Nombre" colors={colors}>
        <TextInput value={name} onChangeText={setName} autoFocus={!category} placeholder="Fundas, Cargadores, Repuestos…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
      </Field>
      <SelectField
        label="Dentro de (opcional)"
        icon="git-branch-outline"
        value={parent?.name ?? null}
        placeholder="Categoría principal"
        noneLabel="Es una categoría principal"
        options={parents.map((row) => ({ id: row.id, label: row.name }))}
        onSelect={(choice) => setParentId(choice.id)}
      />
      <Field label="Descripción (opcional)" colors={colors}>
        <TextInput value={description} onChangeText={setDescription} multiline maxLength={500} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
      </Field>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.text }]}>Activa</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Inactiva no aparece en la tienda</Text>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: palette.primary }} />
      </View>
      {category?.products_count ? (
        <Text style={[styles.small, { color: colors.muted }]}>Tiene {category.products_count} productos: para eliminarla primero hay que moverlos.</Text>
      ) : null}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function CatalogImport({ existing, onClose, onDone }: { existing: CategoryRow[]; onClose: () => void; onDone: (text: string) => void }) {
  const colors = usePalette();
  const [items, setItems] = useState<GlobalCategory[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGlobalCategories()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
      });
  }, []);

  const linked = new Set(existing.map((row) => row.global_category_id).filter(Boolean));
  const names = new Set(existing.map((row) => row.name.trim().toLowerCase()));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const roots = (items ?? []).filter((item) => !item.parent_id);
  const childrenOf = (id: string) => (items ?? []).filter((item) => item.parent_id === id);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await importGlobalCategories([...selected]);
      onDone(`${result.created} creadas · ${result.linked} vinculadas al marketplace.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron agregar.');
    } finally {
      setSaving(false);
    }
  };

  const isAdded = (item: GlobalCategory) => linked.has(item.id) || names.has(item.name.trim().toLowerCase());

  return (
    <BottomSheet
      visible
      tall
      title="Agregar desde el catálogo"
      subtitle="Elegí las que uses. Si elegís una subcategoría, se agrega también su categoría."
      onClose={() => !saving && onClose()}
      footer={
        <Pressable onPress={save} disabled={saving || selected.size === 0} style={[styles.save, { opacity: saving || selected.size === 0 ? 0.5 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Agregar {selected.size || ''} {selected.size === 1 ? 'categoría' : 'categorías'}</Text>}
        </Pressable>
      }>
      {items === null ? <ActivityIndicator color={palette.primary} /> : null}
      {items?.length === 0 && !error ? <Text style={[styles.muted, { color: colors.muted }]}>No hay catálogo para tu rubro.</Text> : null}
      {roots.map((root) => (
        <View key={root.id} style={styles.catalogGroup}>
          <CatalogItem item={root} added={isAdded(root)} checked={selected.has(root.id)} onToggle={() => toggle(root.id)} colors={colors} />
          {childrenOf(root.id).map((child) => (
            <CatalogItem key={child.id} item={child} child added={isAdded(child)} checked={selected.has(child.id)} onToggle={() => toggle(child.id)} colors={colors} />
          ))}
        </View>
      ))}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function CatalogItem({
  item,
  child,
  added,
  checked,
  onToggle,
  colors,
}: {
  item: GlobalCategory;
  child?: boolean;
  added: boolean;
  checked: boolean;
  onToggle: () => void;
  colors: Colors;
}) {
  return (
    <Pressable
      disabled={added}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: added || checked, disabled: added }}
      style={[styles.catalogRow, child && styles.catalogChild, { borderColor: colors.border, opacity: added ? 0.5 : 1 }]}>
      <Ionicons name={added ? 'checkmark-circle' : checked ? 'checkbox' : 'square-outline'} size={20} color={added ? '#16A34A' : checked ? palette.primary : colors.muted} />
      <Text style={[styles.rowName, styles.flex, { color: colors.text }]}>{item.name}</Text>
      {added ? <Text style={[styles.small, { color: '#16A34A' }]}>Ya la tenés</Text> : null}
    </Pressable>
  );
}

function Field({ label, colors, children }: { label: string; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 14, height: 42 },
  newText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 10, alignItems: 'center' },
  kpiValue: { fontSize: 20, fontWeight: '900' },
  catalogBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  catalogTitle: { fontSize: 14, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  loading: { paddingVertical: 32 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { flexDirection: 'row', gap: 10 },
  footerBtn: { width: 52, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  save: { flex: 1, backgroundColor: palette.primary, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  catalogGroup: { gap: 4 },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 11 },
  catalogChild: { paddingLeft: 26 },
});
