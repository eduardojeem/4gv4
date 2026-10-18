import { PanelAccessState } from '@/components/panel-access-state';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import {
  addBrandsFromCatalog,
  createBrand,
  deleteBrand,
  fetchBrandRows,
  searchBrandCatalog,
  updateBrand,
  type BrandRow,
  type GlobalBrandOption,
} from '@/lib/catalog';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;
type Filter = 'all' | 'official' | 'own';

/**
 * Marcas, como /dashboard/brands: las oficiales (del catálogo de la plataforma,
 * con logo y vinculadas al marketplace) y las propias del comercio.
 */
export default function BrandsScreen() {
  const colors = usePalette();
  const { findItem, can, loading: panelLoading } = usePanel();
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<BrandRow | 'new' | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchBrandRows()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar las marcas.'))
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

  if (panelLoading || !findItem('brands')) return <PanelAccessState />;

  const official = rows.filter((row) => row.global_brand_id).length;
  const q = query.trim().toLowerCase();
  const visible = rows
    .filter((row) => (filter === 'official' ? row.global_brand_id : filter === 'own' ? !row.global_brand_id : true))
    .filter((row) => !q || row.name.toLowerCase().includes(q))
    .sort((a, b) => (b.stats?.product_count ?? 0) - (a.stats?.product_count ?? 0) || a.name.localeCompare(b.name, 'es'));

  return (
    <View style={styles.flex}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>Marcas</Text>
                <Text style={[styles.muted, { color: colors.muted }]}>{loading ? 'Cargando…' : `${rows.length} marcas · ${official} oficiales`}</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable disabled={!can('products.create')} onPress={() => setCatalogOpen(true)} style={[styles.bigBtn, { backgroundColor: palette.primary }]}>
                <Ionicons name="ribbon-outline" size={18} color="#fff" />
                <Text style={styles.bigBtnText}>Agregar oficiales</Text>
              </Pressable>
              <Pressable disabled={!can('products.create')} onPress={() => setEditing('new')} style={[styles.bigBtn, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }]}>
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={[styles.bigBtnText, { color: colors.text }]}>Marca propia</Text>
              </Pressable>
            </View>

            <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Buscar marca" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.text }]} />
            </View>

            <View style={styles.chips}>
              {(['all', 'official', 'own'] as const).map((key) => {
                const selected = filter === key;
                return (
                  <Pressable key={key} onPress={() => setFilter(key)} style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? palette.primary : colors.card }]}>
                    <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text }]}>{key === 'all' ? 'Todas' : key === 'official' ? 'Oficiales' : 'Propias'}</Text>
                  </Pressable>
                );
              })}
            </View>

            {notice && (
              <View style={[styles.notice, { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={[styles.noticeText, { color: '#16A34A' }]}>{notice}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="ribbon-outline" size={36} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{error ?? (q ? 'Sin resultados' : 'Todavía no hay marcas')}</Text>
              <Text style={[styles.muted, { color: colors.muted }]}>{q ? `Nada coincide con «${query}».` : 'Agregá las oficiales que vendés o creá una propia.'}</Text>
              {error ? (
                <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => <BrandCard brand={item} colors={colors} disabled={!can('products.update') && !can('products.delete')} onPress={() => setEditing(item)} />}
      />

      {editing && <BrandEditor brand={editing === 'new' ? null : editing} rows={rows} onClose={() => setEditing(null)} onDone={done} />}
      {catalogOpen && <BrandCatalog onClose={() => setCatalogOpen(false)} onDone={done} />}
    </View>
  );
}

function BrandLogo({ name, logo, colors, size = 52 }: { name: string; logo?: string | null; colors: Colors; size?: number }) {
  return (
    <View style={[styles.logo, { width: size, height: size, borderColor: colors.border, backgroundColor: colors.background }]}>
      {logo ? <Image source={logo} style={styles.logoImg} contentFit="contain" /> : <Text style={[styles.logoInitial, { color: palette.primary }]}>{name.trim().charAt(0).toUpperCase()}</Text>}
    </View>
  );
}

function BrandCard({ brand, colors, disabled, onPress }: { brand: BrandRow; colors: Colors; disabled: boolean; onPress: () => void }) {
  const count = brand.stats?.product_count ?? 0;
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Administrar marca ${brand.name}`}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : brand.is_active === false ? 0.55 : 1 }]}>
      <BrandLogo name={brand.name} logo={brand.logo_url} colors={colors} />
      <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>{brand.name}</Text>
      <Text style={[styles.small, { color: colors.muted }]}>{count} {count === 1 ? 'producto' : 'productos'}</Text>
      <View style={[styles.badge, { backgroundColor: brand.global_brand_id ? '#0891B21A' : colors.background }]}>
        <Text style={[styles.badgeText, { color: brand.global_brand_id ? '#0891B2' : colors.muted }]}>{brand.global_brand_id ? 'Oficial' : 'Propia'}</Text>
      </View>
    </Pressable>
  );
}

function BrandEditor({ brand, rows, onClose, onDone }: { brand: BrandRow | null; rows: BrandRow[]; onClose: () => void; onDone: (text: string) => void }) {
  const colors = usePalette();
  const { can } = usePanel();
  const official = Boolean(brand?.global_brand_id);
  const [name, setName] = useState(brand?.name ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [website, setWebsite] = useState(brand?.website ?? '');
  const [active, setActive] = useState(brand?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = rows.some((row) => row.id !== brand?.id && row.name.trim().toLowerCase() === name.trim().toLowerCase());
  const problem = name.trim().length < 2 ? 'El nombre necesita al menos 2 letras.' : duplicate ? 'Ya existe una marca con ese nombre.' : null;

  const save = async () => {
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      // Una oficial conserva el nombre y el logo del catálogo: solo se edita lo propio.
      const input = official
        ? { is_active: active }
        : { name: name.trim(), description: description.trim() || null, website: website.trim() || null, is_active: active };
      if (brand) await updateBrand(brand.id, input);
      else await createBrand({ name: name.trim(), description: description.trim() || null, website: website.trim() || null, is_active: active });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone(brand ? `«${name.trim()}» actualizada.` : `Marca «${name.trim()}» creada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Eliminar marca', `¿Eliminar «${brand!.name}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deleteBrand(brand!.id);
            onDone(`«${brand!.name}» eliminada.`);
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
      title={brand ? (official ? 'Marca oficial' : 'Editar marca') : 'Nueva marca propia'}
      subtitle={official ? 'El nombre y el logo vienen del catálogo de la plataforma.' : undefined}
      onClose={() => !saving && onClose()}
      footer={
        <View style={styles.footer}>
          {brand && can('products.delete') && (
            <Pressable onPress={remove} disabled={saving} style={[styles.footerBtn, { borderColor: '#DC262655' }]}>
              <Ionicons name="trash-outline" size={18} color={palette.danger} />
            </Pressable>
          )}
          <Pressable onPress={save} disabled={saving || !can(brand ? 'products.update' : 'products.create')} style={[styles.save, { opacity: saving || problem ? 0.6 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{brand ? 'Guardar cambios' : 'Crear marca'}</Text>}
          </Pressable>
        </View>
      }>
      {brand && (
        <View style={styles.editorHead}>
          <BrandLogo name={brand.name} logo={brand.logo_url} colors={colors} size={60} />
          <Text style={[styles.small, { color: colors.muted }]}>{brand.stats?.product_count ?? 0} productos con esta marca</Text>
        </View>
      )}
      <Field label="Nombre" colors={colors}>
        <TextInput
          value={name}
          onChangeText={setName}
          editable={!official}
          autoFocus={!brand}
          placeholder="Nombre de la marca"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: official ? colors.muted : colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />
      </Field>
      {!official && (
        <>
          <Field label="Descripción (opcional)" colors={colors}>
            <TextInput value={description} onChangeText={setDescription} multiline maxLength={500} style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
          </Field>
          <Field label="Sitio web (opcional)" colors={colors}>
            <TextInput value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="https://" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
          </Field>
        </>
      )}
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.text }]}>Activa</Text>
          <Text style={[styles.small, { color: colors.muted }]}>Inactiva no se ofrece al cargar productos</Text>
        </View>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: palette.primary }} />
      </View>
      {!brand && <Text style={[styles.small, { color: colors.muted }]}>¿Es una marca conocida? Agregala desde «Agregar oficiales»: trae el logo y la vincula al marketplace.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
  );
}

function BrandCatalog({ onClose, onDone }: { onClose: () => void; onDone: (text: string) => void }) {
  const colors = usePalette();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<GlobalBrandOption[] | null>(null);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      searchBrandCatalog(query)
        .then((rows) => active && setItems(rows))
        .catch((err) => {
          if (!active) return;
          setItems([]);
          setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const toggle = (item: GlobalBrandOption) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.name);
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await addBrandsFromCatalog([...selected.keys()]);
      onDone(`${result.created} agregadas${result.linked ? ` · ${result.linked} propias pasaron a oficiales` : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron agregar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible
      tall
      title="Marcas oficiales"
      subtitle="Con logo y vinculadas al marketplace. Elegí las que vendés."
      onClose={() => !saving && onClose()}
      footer={
        <Pressable onPress={save} disabled={saving || selected.size === 0} style={[styles.save, { opacity: saving || selected.size === 0 ? 0.5 : 1 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Agregar {selected.size || ''} {selected.size === 1 ? 'marca' : 'marcas'}</Text>}
        </Pressable>
      }>
      <View style={[styles.search, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Buscar en el catálogo" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
      </View>
      {selected.size > 0 && <Text style={[styles.small, { color: palette.primary }]}>Elegidas: {[...selected.values()].join(', ')}</Text>}
      {items === null ? <ActivityIndicator color={palette.primary} /> : null}
      {items?.map((item) => {
        const checked = selected.has(item.id);
        const added = Boolean(item.already_added);
        return (
          <Pressable key={item.id} disabled={added} onPress={() => toggle(item)} style={[styles.catalogRow, { borderColor: colors.border, opacity: added ? 0.5 : 1 }]}>
            <BrandLogo name={item.name} logo={item.logo_url} colors={colors} size={38} />
            <View style={styles.flex}>
              <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
              {item.own_brand_id && !added ? <Text style={[styles.small, { color: '#D97706' }]}>La tenés como propia: se vincula</Text> : null}
            </View>
            <Ionicons name={added ? 'checkmark-circle' : checked ? 'checkbox' : 'square-outline'} size={22} color={added ? '#16A34A' : checked ? palette.primary : colors.muted} />
          </Pressable>
        );
      })}
      {items?.length === 0 && !error ? <Text style={[styles.muted, { color: colors.muted }]}>No está en el catálogo. Creala como «Marca propia».</Text> : null}
      {error && <Text style={styles.error}>{error}</Text>}
    </BottomSheet>
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
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  gridRow: { gap: 12 },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  bigBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, height: 46 },
  bigBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  loading: { paddingVertical: 32 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  card: { flex: 1, maxWidth: '49%', borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  cardName: { fontSize: 15, fontWeight: '800' },
  logo: { borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 4 },
  logoImg: { width: '80%', height: '80%' },
  logoInitial: { fontSize: 20, fontWeight: '900' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  editorHead: { alignItems: 'center', gap: 6 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10 },
  footerBtn: { width: 52, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  save: { flex: 1, backgroundColor: palette.primary, borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
});
