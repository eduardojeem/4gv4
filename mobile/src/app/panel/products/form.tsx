import { usePanel } from '@/lib/panel';
import { PanelAccessState } from '@/components/panel-access-state';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { SelectField } from '@/components/select-sheet';
import { createBrand, createCategory } from '@/lib/catalog';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { productCostDraft, productCostPatch } from '@/lib/product-cost-input';
import { getPrivateCacheContext, isPrivateCacheContextCurrent, isSameOrganizationIdentity, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import {
  cachedProduct,
  createProduct,
  fetchBrands,
  fetchCategories,
  fetchProduct,
  imageUrl,
  lookupBarcode,
  notifyProduct,
  productImages,
  rememberProducts,
  suggestSku,
  updateProduct,
  uploadProductImage,
  VISIBILITY,
  type BarcodeLookup,
  type Brand,
  type Category,
  type Product,
  type ProductInput,
} from '@/lib/products';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value ?? '').replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

type Photo = { uri: string; uploaded?: string; mimeType?: string | null; uploading?: boolean };

type Draft = {
  kind: 'product' | 'service';
  name: string;
  sku: string;
  barcode: string;
  description: string;
  cost: string | null;
  price: string;
  wholesale: string;
  hasOffer: boolean;
  offer: string;
  stock: string;
  minStock: string;
  categoryId: string | null;
  brand: string;
  brandId: string | null;
  visibility: 'public' | 'wholesale' | 'hidden';
  active: boolean;
  warranty: number;
};

const EMPTY: Draft = {
  kind: 'product',
  name: '',
  sku: '',
  barcode: '',
  description: '',
  cost: null,
  price: '',
  wholesale: '',
  hasOffer: false,
  offer: '',
  stock: '',
  minStock: '',
  categoryId: null,
  brand: '',
  brandId: null,
  visibility: 'public',
  active: true,
  warranty: 0,
};

const fromProduct = (product: Product): Draft => ({
  kind: product.unit_measure === 'servicio' ? 'service' : 'product',
  name: product.name,
  sku: product.sku,
  barcode: product.barcode ?? '',
  description: product.description ?? '',
  cost: productCostDraft(product.purchase_price),
  price: pretty(product.sale_price),
  wholesale: pretty(Number(product.wholesale_price) || 0),
  hasOffer: Boolean(product.has_offer),
  offer: pretty(Number(product.offer_price) || 0),
  stock: String(Number(product.stock_quantity) || 0),
  minStock: String(Number(product.min_stock) || 0),
  categoryId: product.category_id ?? product.category?.id ?? null,
  brand: product.brand ?? '',
  brandId: product.brand_id ?? null,
  visibility: product.visibility ?? 'public',
  active: product.is_active,
  warranty: Number(product.warranty_months) || 0,
});

export default function ProductForm() {
  const colors = usePalette();
  const { can } = usePanel();
  const canReadCost = can('products.read_cost');
  const canWriteCost = can('products.update_cost');
  const params = useLocalSearchParams<{ id?: string; barcode?: string; name?: string }>();
  const editingId = params.id || null;
  const canEdit = can(editingId ? 'products.update' : 'products.create');
  // scopeEpoch vuelve a pedir categorías y marcas; productEpoch, el producto (solo
  // cuando cambia la identidad o todavía no había llegado: no pisa lo que se escribió).
  const [scopeEpoch, setScopeEpoch] = useState(() => getPrivateCacheContext().epoch);
  const [productEpoch, setProductEpoch] = useState(() => getPrivateCacheContext().epoch);
  const [original, setOriginal] = useState<Product | null>(() => (editingId ? cachedProduct(editingId) ?? null : null));
  const [draft, setDraft] = useState<Draft>(() =>
    original ? fromProduct(original) : { ...EMPTY, barcode: params.barcode ?? '', name: params.name ?? '' }
  );
  const [photos, setPhotos] = useState<Photo[]>(() => (original ? productImages(original).map((uri) => ({ uri, uploaded: uri })) : []));
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  // Si la persona eligió la visibilidad a mano, cambiar el tipo ya no la pisa.
  const [visibilityTouched, setVisibilityTouched] = useState(Boolean(editingId));
  const [lookup, setLookup] = useState<BarcodeLookup | null>(null);
  const [looking, setLooking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuTouched, setSkuTouched] = useState(Boolean(editingId));
  const [loadingProduct, setLoadingProduct] = useState(Boolean(editingId));
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  const originalRef = useRef(original);
  useEffect(() => {
    originalRef.current = original;
  }, [original]);

  useEffect(() => subscribePrivateCacheContext((next, previous) => {
    setScopeEpoch(next.epoch);
    // Misma persona y mismo comercio (se resolvió la sucursal, cambió un permiso
    // puntual o llegó un 403 de otra acción): lo que se está cargando se conserva.
    if (isSameOrganizationIdentity(previous, next)) {
      if (editingId && !originalRef.current) setProductEpoch(next.epoch);
      return;
    }
    // Otro usuario, otro comercio o acceso revocado: nada de esta cuenta puede quedar en pantalla.
    setOriginal(null);
    setDraft({ ...EMPTY });
    setPhotos([]);
    setCategories([]);
    setBrands([]);
    setLookup(null);
    setScanning(false);
    setProductEpoch(next.epoch);
    setLoadingProduct(Boolean(editingId));
    setSaving(false);
    setProductLoadError(null);
  }), [editingId]);

  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    const context = getPrivateCacheContext();
    const current = () => active && isPrivateCacheContextCurrent(context);
    fetchCategories().then((rows) => { if (current()) setCategories(rows); }).catch(() => { if (current()) setCategories([]); });
    fetchBrands().then((rows) => { if (current()) setBrands(rows); }).catch(() => { if (current()) setBrands([]); });
    return () => { active = false; };
  }, [canEdit, scopeEpoch]);

  // Al editar se trae el producto completo (con costo si el usuario puede verlo).
  useEffect(() => {
    if (!editingId || !canEdit) return;
    let active = true;
    const context = getPrivateCacheContext();
    fetchProduct(editingId)
      .then((product) => {
        if (!active || !isPrivateCacheContextCurrent(context)) return;
        setProductLoadError(null);
        setOriginal(product);
        setDraft(fromProduct(product));
        setPhotos(productImages(product).map((uri) => ({ uri, uploaded: uri })));
      })
      .catch((err) => {
        if (!active || !isPrivateCacheContextCurrent(context)) return;
        setOriginal(null);
        setDraft({ ...EMPTY });
        setPhotos([]);
        setProductLoadError(err instanceof Error ? err.message : 'No se pudo cargar el producto.');
      })
      .finally(() => {
        if (active && isPrivateCacheContextCurrent(context)) setLoadingProduct(false);
      });
    return () => {
      active = false;
    };
  }, [editingId, canEdit, productEpoch]);

  // Código de barras: avisa si ya existe y ofrece los datos del catálogo global.
  useEffect(() => {
    const code = draft.barcode.trim();
    if (code.length < 6) return;
    let active = true;
    const timer = setTimeout(() => {
      setLooking(true);
      lookupBarcode(code, editingId ?? undefined)
        .then((result) => active && setLookup(result))
        .catch(() => active && setLookup(null))
        .finally(() => active && setLooking(false));
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft.barcode, editingId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const setName = (name: string) =>
    setDraft((current) => ({ ...current, name, sku: skuTouched ? current.sku : name.trim().length >= 3 ? suggestSku(name) : '' }));

  const service = draft.kind === 'service';
  const cost = draft.cost === null ? null : digits(draft.cost);
  const price = digits(draft.price);
  const offer = digits(draft.offer);
  const marginPct = canReadCost && cost !== null && cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : null;

  const problems = {
    name: !draft.name.trim() ? 'Escribí el nombre.' : null,
    sku: !draft.sku.trim() ? 'Falta el SKU.' : !/^[A-Z0-9-_]+$/i.test(draft.sku.trim()) ? 'El SKU solo admite letras, números y guiones.' : null,
    price: price <= 0 ? 'Poné el precio de venta.' : null,
    offer: draft.hasOffer && (offer <= 0 || offer >= price) ? 'La oferta tiene que ser menor que el precio.' : null,
    barcode: lookup?.own ? `Ese código ya es de «${lookup.own.name}».` : null,
  };
  const firstProblem = Object.values(problems).find(Boolean) ?? null;
  const show = (key: keyof typeof problems) => (touched ? problems[key] : null);

  // ── Fotos ──
  const addPhotos = async (source: 'library' | 'camera') => {
    if (photos.length >= 6) return Alert.alert('Máximo 6 fotos', 'Quitá una para agregar otra.');
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert('Sin acceso a la cámara', 'Habilitá la cámara para Mi TiendaPy en los ajustes del teléfono.');
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: 6 - photos.length });
    if (result.canceled) return;
    const added: Photo[] = result.assets.map((asset) => ({ uri: asset.uri, mimeType: asset.mimeType, uploading: true }));
    setPhotos((list) => [...list, ...added].slice(0, 6));
    // Se suben enseguida: al guardar solo queda mandar las URLs.
    for (const photo of added) {
      try {
        const url = await uploadProductImage(photo.uri, photo.mimeType);
        setPhotos((list) => list.map((item) => (item.uri === photo.uri ? { ...item, uploaded: url, uploading: false } : item)));
      } catch (err) {
        setPhotos((list) => list.filter((item) => item.uri !== photo.uri));
        Alert.alert('No se pudo subir la foto', err instanceof Error ? err.message : 'Probá de nuevo.');
      }
    }
  };

  const makeMain = (index: number) => setPhotos((list) => [list[index], ...list.filter((_, i) => i !== index)]);

  const applyGlobal = () => {
    const global = lookup?.global;
    if (!global) return;
    setDraft((current) => ({
      ...current,
      name: current.name || global.name,
      sku: skuTouched || current.sku ? current.sku : suggestSku(global.name),
      description: current.description || global.description || '',
      brand: current.brand || global.brandName || '',
      brandId: current.brandId || global.tenantBrandId || null,
      categoryId: current.categoryId || global.tenantCategoryId || null,
    }));
    if (global.imageUrl && photos.length === 0) setPhotos([{ uri: global.imageUrl, uploaded: global.imageUrl }]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const save = async () => {
    if (saving || loadingProduct || productLoadError || (editingId && original?.id !== editingId) || !can(editingId ? 'products.update' : 'products.create')) return;
    const context = getPrivateCacheContext();
    setTouched(true);
    if (firstProblem) {
      setError(firstProblem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (photos.some((photo) => photo.uploading)) return setError('Esperá a que terminen de subir las fotos.');
    setSaving(true);
    setError(null);
    const images = photos.map((photo) => photo.uploaded).filter((url): url is string => Boolean(url));
    const input: ProductInput = {
      name: draft.name.trim(),
      sku: draft.sku.trim().toUpperCase(),
      barcode: draft.barcode.trim() || null,
      description: draft.description.trim() || null,
      category_id: draft.categoryId,
      brand: draft.brand.trim() || null,
      brand_id: draft.brandId,
      ...productCostPatch(draft.cost, original?.purchase_price, canWriteCost),
      sale_price: price,
      wholesale_price: digits(draft.wholesale) || null,
      has_offer: draft.hasOffer,
      offer_price: draft.hasOffer ? offer : null,
      min_stock: service ? 0 : digits(draft.minStock),
      is_active: draft.active,
      visibility: draft.visibility,
      unit_measure: service ? 'servicio' : original?.unit_measure && original.unit_measure !== 'servicio' ? original.unit_measure : 'unidad',
      images,
      image_url: images[0] ?? null,
      warranty_months: draft.warranty || null,
    };
    try {
      let saved: Product;
      if (editingId) {
        // El stock solo se manda si cambió: un PUT con stock lo registra como ajuste.
        const stockChanged = !service && original && digits(draft.stock) !== Number(original.stock_quantity);
        saved = await updateProduct(editingId, { ...input, ...(stockChanged ? { stock_quantity: digits(draft.stock) } : {}) });
      } else {
        saved = await createProduct({ ...input, stock_quantity: service ? 0 : digits(draft.stock) });
      }
      // El producto es del comercio, no de la sucursal: el guardado vale mientras sea la misma identidad.
      if (!isSameOrganizationIdentity(context)) return;
      const merged = saved;
      rememberProducts([merged], context);
      notifyProduct(merged, context);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (editingId) router.back();
      else router.replace(`/panel/products/${saved.id}` as never);
    } catch (err) {
      if (!isSameOrganizationIdentity(context)) return;
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      if (isSameOrganizationIdentity(context)) setSaving(false);
    }
  };

  const selectedCategory = categories.find((category) => category.id === draft.categoryId);

  // Un servicio nuevo arranca oculto: es trabajo del taller, no algo para
  // publicar en la tienda. Al volver a producto, vuelve a público.
  const changeKind = (kind: Draft['kind']) =>
    setDraft((current) => ({
      ...current,
      kind,
      visibility: visibilityTouched ? current.visibility : kind === 'service' ? 'hidden' : 'public',
    }));

  if (!can(editingId ? 'products.update' : 'products.create')) return <PanelAccessState />;
  const waitingForProduct = Boolean(editingId && original?.id !== editingId);
  if (loadingProduct || productLoadError || waitingForProduct) return (
    <View style={[styles.flex, { padding: 24, justifyContent: 'center', alignItems: 'center' }]}>
      {loadingProduct || (!productLoadError && waitingForProduct) ? <ActivityIndicator accessibilityLabel="Cargando producto" color={palette.primary} /> : <Text accessibilityRole="alert" style={{ color: colors.text }}>{productLoadError}</Text>}
    </View>
  );

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/panel/products' as never))} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>{editingId ? 'Editar producto' : 'Nuevo producto'}</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Guardar">
          {saving ? <ActivityIndicator color={palette.primary} /> : <Text style={[styles.topSave, { color: palette.primary }]}>Guardar</Text>}
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Tipo */}
          <View style={[styles.segment, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {(['product', 'service'] as const).map((kind) => (
              <Pressable key={kind} onPress={() => changeKind(kind)} style={[styles.segmentItem, draft.kind === kind && { backgroundColor: palette.primary }]}>
                <Ionicons name={kind === 'product' ? 'cube-outline' : 'construct-outline'} size={16} color={draft.kind === kind ? '#fff' : colors.muted} />
                <Text style={[styles.segmentText, { color: draft.kind === kind ? '#fff' : colors.text }]}>{kind === 'product' ? 'Producto' : 'Servicio'}</Text>
              </Pressable>
            ))}
          </View>

          {service && draft.visibility === 'hidden' && (
            <View style={[styles.banner, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="eye-off-outline" size={18} color={colors.muted} />
              <Text style={[styles.small, styles.flex, { color: colors.muted }]}>
                Los servicios se guardan ocultos: se usan en el POS y el taller, pero no se publican en la tienda. Podés cambiarlo en «Publicación».
              </Text>
            </View>
          )}

          {/* Fotos */}
          <Section title="Fotos" icon="images-outline" colors={colors} hint="La primera es la principal. Tocá una para hacerla principal.">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {photos.map((photo, index) => (
                <Pressable key={photo.uri} onPress={() => makeMain(index)} style={[styles.photo, { borderColor: index === 0 ? palette.primary : colors.border }]}>
                  <Image source={imageUrl(photo.uploaded) ?? photo.uri} style={styles.fill} contentFit="cover" />
                  {photo.uploading && (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  {index === 0 && (
                    <View style={styles.mainTag}>
                      <Text style={styles.mainText}>Principal</Text>
                    </View>
                  )}
                  <Pressable onPress={() => setPhotos((list) => list.filter((_, i) => i !== index))} hitSlop={6} style={styles.removePhoto} accessibilityLabel="Quitar foto">
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                </Pressable>
              ))}
              {photos.length < 6 && (
                <>
                  <Pressable onPress={() => addPhotos('camera')} style={[styles.addPhoto, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Ionicons name="camera-outline" size={24} color={palette.primary} />
                    <Text style={[styles.addPhotoText, { color: colors.text }]}>Sacar foto</Text>
                  </Pressable>
                  <Pressable onPress={() => addPhotos('library')} style={[styles.addPhoto, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Ionicons name="images-outline" size={24} color={palette.primary} />
                    <Text style={[styles.addPhotoText, { color: colors.text }]}>Galería</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Section>

          {/* Datos básicos */}
          <Section title="Datos" icon="pricetag-outline" colors={colors}>
            <Input label="Nombre" value={draft.name} onChangeText={setName} placeholder={service ? 'Cambio de pantalla' : 'Funda silicona iPhone 13'} colors={colors} error={show('name')} />

            {!service && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Código de barras</Text>
                <View style={[styles.inputWrap, { borderColor: show('barcode') ? palette.danger : colors.border, backgroundColor: colors.background }]}>
                  <TextInput
                    value={draft.barcode}
                    onChangeText={(value) => {
                      set('barcode', value.trim());
                      setLookup(null);
                    }}
                    placeholder="Escaneá o escribí el código"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    accessibilityLabel="Código de barras"
                    style={[styles.input, { color: colors.text }]}
                  />
                  {looking && <ActivityIndicator size="small" color={colors.muted} />}
                  <Pressable onPress={() => setScanning(true)} style={[styles.scanBtn, { backgroundColor: colors.text }]} accessibilityLabel="Escanear código">
                    <Ionicons name="barcode-outline" size={18} color={colors.background} />
                  </Pressable>
                </View>
                {lookup?.own && (
                  <Pressable onPress={() => router.push(`/panel/products/${lookup.own!.id}` as never)} style={[styles.banner, { borderColor: '#DC262655', backgroundColor: '#DC262610' }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={palette.danger} />
                    <Text style={[styles.bannerText, { color: palette.danger }]}>Ya existe: «{lookup.own.name}». Tocá para verlo.</Text>
                  </Pressable>
                )}
                {!lookup?.own && lookup?.global && (
                  <View style={[styles.banner, { borderColor: '#16A34A55', backgroundColor: '#16A34A10' }]}>
                    {lookup.global.imageUrl ? <Image source={lookup.global.imageUrl} style={styles.globalImg} contentFit="cover" /> : <Ionicons name="sparkles-outline" size={18} color="#16A34A" />}
                    <View style={styles.flex}>
                      <Text style={[styles.bannerText, { color: colors.text }]}>{lookup.global.name}</Text>
                      <Text style={[styles.small, { color: colors.muted }]}>Encontrado en el catálogo{lookup.global.brandName ? ` · ${lookup.global.brandName}` : ''}</Text>
                    </View>
                    <Pressable onPress={applyGlobal} style={[styles.useBtn, { backgroundColor: '#16A34A' }]}>
                      <Text style={styles.useText}>Usar datos</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>SKU (código interno)</Text>
              <View style={[styles.inputWrap, { borderColor: show('sku') ? palette.danger : colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  value={draft.sku}
                  onChangeText={(value) => {
                    setSkuTouched(true);
                    set('sku', value.toUpperCase().replace(/\s/g, '-'));
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Se genera con el nombre"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="SKU"
                  style={[styles.input, { color: colors.text }]}
                />
                <Pressable onPress={() => set('sku', suggestSku(draft.name || 'PROD'))} hitSlop={8}>
                  <Text style={[styles.link, { color: palette.primary }]}>Generar</Text>
                </Pressable>
              </View>
              {show('sku') ? <Text style={styles.error}>{show('sku')}</Text> : null}
            </View>

            <Input label="Descripción (opcional)" value={draft.description} onChangeText={(value) => set('description', value)} colors={colors} multiline maxLength={2000} />
          </Section>

          {/* Precios */}
          <Section title="Precios" icon="cash-outline" colors={colors}>
            <View style={styles.pair}>
              <View style={styles.flex}>
                {canWriteCost ? (
                  <Money label="Costo" value={draft.cost ?? ''} onChange={(value) => set('cost', value)} colors={colors} />
                ) : (
                  <Text style={[styles.small, { color: colors.muted }]}>
                    Costo: {canReadCost && cost !== null ? formatGs(cost) : 'No disponible con tus permisos'}
                  </Text>
                )}
              </View>
              <View style={styles.flex}>
                <Money label="Precio de venta" value={draft.price} onChange={(value) => set('price', value)} colors={colors} error={show('price')} />
              </View>
            </View>
            {canReadCost && cost !== null && cost > 0 && (
              <View style={styles.marginRow}>
                <Text style={[styles.small, { color: colors.muted }]}>Precio con margen:</Text>
                {[30, 50, 100].map((pct) => (
                  <Pressable key={pct} onPress={() => set('price', pretty(Math.round(cost * (1 + pct / 100))))} style={[styles.miniChip, { borderColor: colors.border }]}>
                    <Text style={[styles.miniChipText, { color: colors.text }]}>+{pct}%</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {marginPct !== null && (
              <View style={[styles.marginBox, { backgroundColor: marginPct < 15 ? '#DC26261A' : marginPct < 30 ? '#D977061A' : '#16A34A1A' }]}>
                <Ionicons name={marginPct < 0 ? 'trending-down' : 'trending-up'} size={16} color={marginPct < 15 ? palette.danger : marginPct < 30 ? '#D97706' : palette.success} />
                <Text style={[styles.marginText, { color: marginPct < 15 ? palette.danger : marginPct < 30 ? '#D97706' : palette.success }]}>
                  Margen {marginPct}% · ganás {formatGs(Math.max(0, price - (cost ?? 0)))} por unidad
                </Text>
              </View>
            )}
            <Money label="Precio mayorista (opcional)" value={draft.wholesale} onChange={(value) => set('wholesale', value)} colors={colors} />
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: colors.text }]}>En oferta</Text>
                <Text style={[styles.small, { color: colors.muted }]}>Se muestra el precio anterior tachado</Text>
              </View>
              <Switch value={draft.hasOffer} onValueChange={(value) => set('hasOffer', value)} trackColor={{ true: palette.primary }} />
            </View>
            {draft.hasOffer && (
              <>
                <Money label="Precio de oferta" value={draft.offer} onChange={(value) => set('offer', value)} colors={colors} error={show('offer')} />
                {price > 0 && offer > 0 && offer < price && (
                  <Text style={[styles.small, { color: palette.danger }]}>-{Math.round((1 - offer / price) * 100)}% de descuento</Text>
                )}
              </>
            )}
          </Section>

          {/* Stock */}
          {!service && (
            <Section title="Stock" icon="cube-outline" colors={colors} hint={editingId ? 'Si cambiás el stock, se registra como ajuste.' : undefined}>
              <View style={styles.pair}>
                <View style={styles.flex}>
                  <Counter label={editingId ? 'Stock actual' : 'Stock inicial'} value={draft.stock} onChange={(value) => set('stock', value)} colors={colors} />
                </View>
                <View style={styles.flex}>
                  <Counter label="Stock mínimo" value={draft.minStock} onChange={(value) => set('minStock', value)} colors={colors} />
                </View>
              </View>
            </Section>
          )}

          {/* Organización */}
          <Section title="Categoría y marca" icon="folder-outline" colors={colors}>
            <SelectField
              label="Categoría"
              icon="folder-open-outline"
              value={selectedCategory?.name ?? null}
              placeholder="Elegir categoría"
              noneLabel="Sin categoría"
              options={categories.map((category) => ({
                id: category.id,
                label: category.name,
                hint: category.products_count ? String(category.products_count) : undefined,
              }))}
              onSelect={(choice) => set('categoryId', choice.id)}
              createLabel={(text) => `Crear categoría «${text}»`}
              onCreate={async (text) => {
                const created = await createCategory({ name: text });
                setCategories((list) => [...list, { id: created.id, name: created.name, products_count: 0 }]);
                return { id: created.id, label: created.name };
              }}
            />
            <SelectField
              label="Marca"
              icon="ribbon-outline"
              value={draft.brand.trim() || null}
              placeholder="Elegir marca"
              noneLabel="Sin marca"
              options={brands.map((brand) => ({ id: brand.id, label: brand.name }))}
              onSelect={(choice) => setDraft((current) => ({ ...current, brand: choice.label ?? '', brandId: choice.id }))}
              createLabel={(text) => `Crear marca «${text}»`}
              onCreate={async (text) => {
                const created = await createBrand({ name: text });
                setBrands((list) => [...list, { id: created.id, name: created.name }]);
                return { id: created.id, label: created.name };
              }}
            />
          </Section>

          {/* Publicación */}
          <Section title="Publicación" icon="globe-outline" colors={colors}>
            {(Object.keys(VISIBILITY) as (keyof typeof VISIBILITY)[]).map((key) => {
              const option = VISIBILITY[key];
              const selected = draft.visibility === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setVisibilityTouched(true);
                    set('visibility', key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.option, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.07)' : colors.background }]}>
                  <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={18} color={selected ? palette.primary : colors.muted} />
                  <View style={styles.flex}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>{option.label}</Text>
                    <Text style={[styles.small, { color: colors.muted }]}>{option.help}</Text>
                  </View>
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? palette.primary : colors.muted} />
                </Pressable>
              );
            })}
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={[styles.label, { color: colors.text }]}>Activo</Text>
                <Text style={[styles.small, { color: colors.muted }]}>Inactivo no aparece en ventas ni en la tienda</Text>
              </View>
              <Switch value={draft.active} onValueChange={(value) => set('active', value)} trackColor={{ true: palette.primary }} />
            </View>
            <Text style={[styles.label, { color: colors.text }]}>Garantía</Text>
            <View style={styles.chips}>
              {[0, 1, 3, 6, 12].map((months) => (
                <Chip key={months} label={months === 0 ? 'Sin garantía' : `${months} ${months === 1 ? 'mes' : 'meses'}`} selected={draft.warranty === months} onPress={() => set('warranty', months)} colors={colors} />
              ))}
            </View>
          </Section>

          {error && (
            <View style={[styles.banner, { borderColor: '#DC262655', backgroundColor: '#DC262610' }]}>
              <Ionicons name="alert-circle" size={18} color={palette.danger} />
              <Text style={[styles.bannerText, { color: palette.danger }]}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable onPress={save} disabled={saving} style={[styles.submit, { opacity: saving ? 0.7 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text style={styles.submitText}>{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : `Crear ${service ? 'servicio' : 'producto'}`}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BarcodeScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(code) => {
          setScanning(false);
          set('barcode', code);
          setLookup(null);
        }}
      />
    </View>
  );
}

function Section({ title, icon, colors, hint, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; colors: Colors; hint?: string; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={palette.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {hint ? <Text style={[styles.small, { color: colors.muted }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Input({ label, colors, error, ...props }: React.ComponentProps<typeof TextInput> & { label: string; colors: Colors; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        style={[styles.inputBox, props.multiline && styles.multiline, { color: colors.text, borderColor: error ? palette.danger : colors.border, backgroundColor: colors.background }]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Money({ label, value, onChange, colors, error }: { label: string; value: string; onChange: (value: string) => void; colors: Colors; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: error ? palette.danger : colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.prefix, { color: colors.muted }]}>Gs.</Text>
        <TextInput
          value={value}
          onChangeText={(next) => onChange(pretty(next))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          style={[styles.input, styles.moneyInput, { color: colors.text }]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Counter({ label, value, onChange, colors }: { label: string; value: string; onChange: (value: string) => void; colors: Colors }) {
  const number = digits(value);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.counter, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => onChange(String(Math.max(0, number - 1)))} hitSlop={8} accessibilityLabel={`Restar a ${label}`}>
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(next) => onChange(next.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          style={[styles.counterInput, { color: colors.text }]}
        />
        <Pressable onPress={() => onChange(String(number + 1))} hitSlop={8} accessibilityLabel={`Sumar a ${label}`}>
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? 'rgba(37,99,235,0.1)' : colors.background }]}>
      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }, selected && styles.bold]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  bold: { fontWeight: '800' },
  small: { fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  topSave: { fontSize: 15, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  segmentText: { fontSize: 14, fontWeight: '800' },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  photos: { gap: 10 },
  photo: { width: 96, height: 96, borderRadius: 14, borderWidth: 2, overflow: 'hidden' },
  photoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  mainTag: { position: 'absolute', left: 4, bottom: 4, backgroundColor: palette.primary, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  mainText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  removePhoto: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 96, height: 96, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addPhotoText: { fontSize: 12, fontWeight: '700' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '800' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
  inputBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  moneyInput: { fontWeight: '700' },
  prefix: { fontSize: 15, fontWeight: '700' },
  scanBtn: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 13, fontWeight: '800' },
  error: { color: palette.danger, fontSize: 12, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  globalImg: { width: 40, height: 40, borderRadius: 8 },
  useBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  useText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  pair: { flexDirection: 'row', gap: 10 },
  marginRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  miniChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  miniChipText: { fontSize: 12, fontWeight: '700' },
  marginBox: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 10 },
  marginText: { fontSize: 13, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48 },
  counterInput: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  optionTitle: { fontSize: 14, fontWeight: '800' },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 54 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
