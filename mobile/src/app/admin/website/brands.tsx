import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { WebsiteImageField } from '@/components/website/website-image-field';
import {
  Field,
  Notice,
  ReorderRow,
  SaveBar,
  Section,
  StateView,
  StatusPill,
  ToggleRow,
  WebsiteScreen,
  useUnsavedChangesGuard,
  websiteStyles,
} from '@/components/website/website-ui';
import { palette, usePalette } from '@/lib/palette';
import {
  fetchStoreBrandsSummary,
  saveWebsiteSettings,
  websiteErrorMessage,
  type StoreBrandSummary,
} from '@/lib/website-admin';
import { useWebsite } from '@/lib/website-context';
import {
  DEFAULT_BRANDS_SECTION,
  POPULAR_PRESET_BRANDS_META,
  brandsSectionIssues,
  getBrandEditorGuidance,
  isDirty,
  moveItem,
  newSlideId,
  type BrandItem,
  type BrandsSectionSettings,
  type WebsiteSettings,
} from '@/lib/website-model';

const MAX_BRANDS = 36;

export default function BrandsScreen() {
  return (
    <WebsiteGate title="Marcas destacadas">
      {(settings) => <BrandsEditor settings={settings} />}
    </WebsiteGate>
  );
}

function BrandsEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const { applySaved, capabilities } = useWebsite();

  const saved = useMemo<BrandsSectionSettings>(
    () => ({
      ...DEFAULT_BRANDS_SECTION,
      ...(settings.brands_section ?? {}),
      items: settings.brands_section?.items ?? [],
    }),
    [settings.brands_section],
  );
  const [brands, setBrands] = useState<BrandsSectionSettings>(saved);
  const [storeBrands, setStoreBrands] = useState<StoreBrandSummary[]>([]);
  const [loadingStoreBrands, setLoadingStoreBrands] = useState(true);
  const [editing, setEditing] = useState<{
    item: BrandItem;
    index: number | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = isDirty(saved, brands);
  const issues = brandsSectionIssues(brands);
  const guidance = getBrandEditorGuidance(capabilities.businessVertical);

  const scanCatalogBrands = useCallback(async () => {
    setLoadingStoreBrands(true);
    try {
      const list = await fetchStoreBrandsSummary();
      setStoreBrands(list);
    } finally {
      setLoadingStoreBrands(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStoreBrandsSummary()
      .then((list) => {
        if (alive) setStoreBrands(list);
      })
      .finally(() => {
        if (alive) setLoadingStoreBrands(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setItems = (next: BrandItem[]) =>
    setBrands((prev) => ({ ...prev, items: next }));

  const existingNames = useMemo(
    () => new Set(brands.items.map((b) => b.name.trim().toLowerCase())),
    [brands.items],
  );

  const addQuickBrand = (entry: {
    id?: string;
    name: string;
    imageUrl?: string;
  }) => {
    if (brands.items.length >= MAX_BRANDS) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_BRANDS} marcas.`);
      return;
    }
    if (existingNames.has(entry.name.trim().toLowerCase())) return;
    setItems([
      ...brands.items,
      {
        id: entry.id || newSlideId(),
        name: entry.name.trim(),
        active: true,
        imageUrl: entry.imageUrl,
      },
    ]);
    void Haptics.selectionAsync();
  };

  const syncAllStoreBrands = () => {
    const missing = storeBrands.filter(
      (b) => !existingNames.has(b.name.trim().toLowerCase()),
    );
    if (missing.length === 0) {
      Alert.alert(
        'Al día',
        'Todas las marcas detectadas en tu catálogo ya están en la lista.',
      );
      return;
    }
    const room = Math.max(0, MAX_BRANDS - brands.items.length);
    const added = missing.slice(0, room).map((b) => ({
      id: b.id || newSlideId(),
      name: b.name,
      active: true,
      imageUrl: b.logoUrl,
    }));
    setItems([...brands.items, ...added]);
    setBrands((prev) => ({ ...prev, enabled: true }));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const save = useCallback(async () => {
    const msgs = Object.values(issues);
    if (msgs.length > 0) {
      Alert.alert('Revisá las marcas', msgs.join('\n'));
      return false;
    }
    setSaving(true);
    try {
      const persisted = await saveWebsiteSettings({ brands_section: brands });
      applySaved(persisted as Partial<WebsiteSettings>);
      if (persisted.brands_section)
        setBrands(persisted.brands_section as BrandsSectionSettings);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return true;
    } catch (error) {
      Alert.alert(
        'No pudimos guardar',
        websiteErrorMessage(error, 'No pudimos guardar las marcas destacadas.'),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [issues, brands, applySaved]);

  useUnsavedChangesGuard(dirty, save, saving);

  const activeItems = brands.items.filter((b) => b.active !== false);
  const presetSuggestions = POPULAR_PRESET_BRANDS_META.filter(
    (p) =>
      guidance.categories.length === 0 ||
      guidance.categories.includes(p.category),
  );

  return (
    <WebsiteScreen
      saving={saving}
      title="Marcas destacadas"
      subtitle="Marquesina y logos de marcas"
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onDiscard={() => setBrands(saved)}
        />
      }
    >
      <OfflineNotice />

      {/* Ribbon preview */}
      <View
        style={[
          styles.previewBox,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.previewTitle, { color: colors.text }]}>
          {brands.title || 'Marcas destacadas'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ribbonRow}
        >
          {activeItems.length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.muted }]}>
              Agregá marcas para ver la vista previa de la marquesina
            </Text>
          ) : (
            activeItems.map((b, i) => (
              <View
                key={b.id || i}
                style={[
                  styles.brandPill,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                {b.imageUrl ? (
                  <Image
                    source={{ uri: b.imageUrl }}
                    style={styles.pillImg}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={[styles.pillText, { color: colors.text }]}>
                    {b.name}
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <Section
        title="Visibilidad y textos"
        icon="ribbon-outline"
        hint={guidance.hint}
      >
        <ToggleRow
          label="Mostrar marcas destacadas"
          value={brands.enabled}
          onValueChange={(val) => setBrands((p) => ({ ...p, enabled: val }))}
        />
        <ToggleRow
          label="En la página de inicio"
          value={brands.showOnHome !== false}
          onValueChange={(val) => setBrands((p) => ({ ...p, showOnHome: val }))}
        />
        <ToggleRow
          label="En la página de productos"
          value={brands.showOnProducts === true}
          onValueChange={(val) =>
            setBrands((p) => ({ ...p, showOnProducts: val }))
          }
        />
        <ToggleRow
          label="En la página de ofertas"
          value={brands.showOnOffers === true}
          onValueChange={(val) =>
            setBrands((p) => ({ ...p, showOnOffers: val }))
          }
        />
        <Field
          label="Título de la sección"
          value={brands.title}
          onChangeText={(val) => setBrands((p) => ({ ...p, title: val }))}
          maxLength={80}
          error={issues.title}
        />
        <Field
          label="Subtítulo (opcional)"
          value={brands.subtitle ?? ''}
          onChangeText={(val) => setBrands((p) => ({ ...p, subtitle: val }))}
          maxLength={160}
        />
      </Section>

      {/* Detector automático del catálogo */}
      <Section
        title="Marcas detectadas en tu tienda"
        icon="scan-outline"
        right={
          <Pressable
            onPress={() => void scanCatalogBrands()}
            disabled={loadingStoreBrands}
            hitSlop={6}
          >
            <Text style={styles.scanLink}>Actualizar</Text>
          </Pressable>
        }
      >
        {loadingStoreBrands ? (
          <ActivityIndicator color={palette.primary} />
        ) : storeBrands.length === 0 ? (
          <Text style={[styles.emptyHint, { color: colors.muted }]}>
            No detectamos marcas cargadas en tus productos todavía. Podés crear una manualmente abajo.
          </Text>
        ) : (
          <>
            <Pressable
              onPress={syncAllStoreBrands}
              style={[
                websiteStyles.secondaryButton,
                { borderColor: palette.primary },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={palette.primary}
              />
              <Text
                style={[websiteStyles.secondaryText, { color: palette.primary }]}
              >
                Importar todas ({storeBrands.length})
              </Text>
            </Pressable>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              {storeBrands.map((sb) => {
                const added = existingNames.has(sb.name.trim().toLowerCase());
                return (
                  <Pressable
                    key={sb.id}
                    disabled={added}
                    onPress={() =>
                      addQuickBrand({
                        id: sb.id,
                        name: sb.name,
                        imageUrl: sb.logoUrl,
                      })
                    }
                    style={[
                      styles.detectedChip,
                      {
                        borderColor: added ? palette.success : colors.border,
                        backgroundColor: added
                          ? `${palette.success}12`
                          : colors.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.detectedName,
                        { color: added ? palette.success : colors.text },
                      ]}
                    >
                      {added ? `✓ ${sb.name}` : `+ ${sb.name}`}
                    </Text>
                    {sb.productCount > 0 ? (
                      <Text
                        style={[styles.detectedCount, { color: colors.muted }]}
                      >
                        ({sb.productCount})
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </Section>

      {/* Presets populares */}
      {presetSuggestions.length > 0 ? (
        <Section title="Marcas sugeridas" icon="star-outline">
          <View style={styles.chipsWrap}>
            {presetSuggestions.map((preset) => {
              const added = existingNames.has(preset.name.toLowerCase());
              return (
                <Pressable
                  key={preset.id}
                  disabled={added}
                  onPress={() =>
                    addQuickBrand({ id: preset.id, name: preset.name })
                  }
                  style={[
                    styles.detectedChip,
                    {
                      borderColor: added ? palette.success : colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.detectedName,
                      { color: added ? palette.success : colors.text },
                    ]}
                  >
                    {added ? `✓ ${preset.name}` : `+ ${preset.name}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : null}

      {/* Lista de marcas configuradas */}
      <Section
        title="Marcas en tu tienda"
        icon="list-outline"
        right={<StatusPill label={`${brands.items.length}/${MAX_BRANDS}`} />}
      >
        {brands.items.length === 0 ? (
          <StateView
            icon="ribbon-outline"
            title="Sin marcas todavía"
            text="Importá desde tu catálogo o agregá una nueva con logo y enlace."
          />
        ) : (
          brands.items.map((item, idx) => (
            <View
              key={item.id || idx}
              style={[
                styles.brandRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Pressable
                onPress={() => setEditing({ item, index: idx })}
                style={styles.brandMain}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.brandThumb}
                    contentFit="contain"
                  />
                ) : (
                  <View
                    style={[
                      styles.brandMonogram,
                      { backgroundColor: `${palette.primary}18` },
                    ]}
                  >
                    <Text style={styles.monogramLetter}>
                      {(item.name || 'M').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={[styles.brandName, { color: colors.text }]}>
                    {item.name}
                  </Text>
                  {item.href ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.brandHref, { color: colors.muted }]}
                    >
                      {item.href}
                    </Text>
                  ) : null}
                </View>
                <Switch
                  value={item.active !== false}
                  onValueChange={(val) =>
                    setItems(
                      brands.items.map((b, i) =>
                        i === idx ? { ...b, active: val } : b,
                      ),
                    )
                  }
                  trackColor={{ false: colors.border, true: palette.primary }}
                />
              </Pressable>
              <View style={[styles.brandActions, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={() => setEditing({ item, index: idx })}
                  style={styles.editLink}
                >
                  <Ionicons
                    name="create-outline"
                    size={15}
                    color={palette.primary}
                  />
                  <Text style={styles.editText}>Editar logo y enlace</Text>
                </Pressable>
                <ReorderRow
                  disableUp={idx === 0}
                  disableDown={idx === brands.items.length - 1}
                  onUp={() => setItems(moveItem(brands.items, idx, -1))}
                  onDown={() => setItems(moveItem(brands.items, idx, 1))}
                  onRemove={() =>
                    setItems(brands.items.filter((_, i) => i !== idx))
                  }
                />
              </View>
            </View>
          ))
        )}

        {brands.items.length < MAX_BRANDS ? (
          <Pressable
            onPress={() =>
              setEditing({
                item: {
                  id: newSlideId(),
                  name: '',
                  active: true,
                  imageUrl: '',
                  href: '',
                },
                index: null,
              })
            }
            style={websiteStyles.primaryButton}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={websiteStyles.primaryText}>Agregar marca</Text>
          </Pressable>
        ) : (
          <Notice text={`Llegaste al límite de ${MAX_BRANDS} marcas.`} />
        )}
      </Section>

      <BrandEditSheet
        visible={Boolean(editing)}
        brand={editing?.item ?? null}
        isNew={editing?.index === null}
        placeholder={guidance.placeholder}
        onClose={() => setEditing(null)}
        onSave={(savedBrand) => {
          const idx = editing?.index ?? null;
          setItems(
            idx === null
              ? [...brands.items, savedBrand]
              : brands.items.map((b, i) => (i === idx ? savedBrand : b)),
          );
          setEditing(null);
        }}
      />
    </WebsiteScreen>
  );
}

function BrandEditSheet({
  visible,
  brand,
  isNew,
  placeholder,
  onClose,
  onSave,
}: {
  visible: boolean;
  brand: BrandItem | null;
  isNew: boolean;
  placeholder: string;
  onClose: () => void;
  onSave: (brand: BrandItem) => void;
}) {
  if (!visible || !brand) return null;
  return (
    <BrandEditSheetInner
      key={`${brand.id}-${isNew ? 'new' : 'edit'}`}
      visible={visible}
      brand={brand}
      isNew={isNew}
      placeholder={placeholder}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function BrandEditSheetInner({
  visible,
  brand,
  isNew,
  placeholder,
  onClose,
  onSave,
}: {
  visible: boolean;
  brand: BrandItem;
  isNew: boolean;
  placeholder: string;
  onClose: () => void;
  onSave: (brand: BrandItem) => void;
}) {
  const colors = usePalette();
  const [draft, setDraft] = useState<BrandItem>(() => ({ ...brand }));

  const commit = () => {
    if (!draft.name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresá el nombre de la marca.');
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
  };

  return (
    <BottomSheet
      visible={visible}
      title={isNew ? 'Nueva marca' : 'Editar marca'}
      subtitle="Logo y enlace de filtrado en tu tienda"
      onClose={onClose}
      footer={
        <View style={styles.sheetFooter}>
          <Pressable
            onPress={onClose}
            style={[
              websiteStyles.secondaryButton,
              { borderColor: colors.border, flex: 1 },
            ]}
          >
            <Text style={[websiteStyles.secondaryText, { color: colors.text }]}>
              Cancelar
            </Text>
          </Pressable>
          <Pressable
            onPress={commit}
            style={[websiteStyles.primaryButton, { flex: 1.4 }]}
          >
            <Text style={websiteStyles.primaryText}>
              {isNew ? 'Agregar' : 'Guardar'}
            </Text>
          </Pressable>
        </View>
      }
    >
      <Field
        label="Nombre de la marca"
        value={draft.name}
        onChangeText={(val) => setDraft({ ...draft, name: val })}
        placeholder={placeholder}
        maxLength={60}
      />
      <WebsiteImageField
        label="Logo de la marca (opcional)"
        kind="brand"
        slideId={draft.id}
        aspect="square"
        value={draft.imageUrl}
        onUploaded={(url) => setDraft({ ...draft, imageUrl: url })}
        onClear={() => setDraft({ ...draft, imageUrl: '' })}
        help="PNG/WebP transparente se ve genial sobre fondo claro u oscuro."
      />
      <Field
        label="Enlace al hacer clic (opcional)"
        value={draft.href ?? ''}
        onChangeText={(val) => setDraft({ ...draft, href: val.trim() })}
        placeholder="/productos?brand=Nike"
        autoCapitalize="none"
      />
      <ToggleRow
        label="Visible en la tienda"
        value={draft.active !== false}
        onValueChange={(val) => setDraft({ ...draft, active: val })}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  previewBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewTitle: { fontSize: 14, fontWeight: '800' },
  ribbonRow: { gap: 10, alignItems: 'center' },
  emptyHint: { fontSize: 12 },
  brandPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  pillImg: { width: 64, height: 34 },
  pillText: { fontSize: 13, fontWeight: '800' },
  scanLink: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  chipsScroll: { gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  detectedName: { fontSize: 12, fontWeight: '700' },
  detectedCount: { fontSize: 11 },
  brandRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  brandMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandThumb: { width: 42, height: 42, borderRadius: 8 },
  brandMonogram: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramLetter: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  brandName: { fontSize: 14, fontWeight: '800' },
  brandHref: { fontSize: 11, marginTop: 1 },
  brandActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  sheetFooter: { flexDirection: 'row', gap: 10, paddingTop: 6 },
});
