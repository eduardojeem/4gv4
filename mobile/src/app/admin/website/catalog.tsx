import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import { Notice, Section, StateView, WebsiteScreen } from '@/components/website/website-ui';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { searchStoreProducts, setProductFeatured, websiteErrorMessage } from '@/lib/website-admin';
import type { PublicProduct, WebsiteSettings } from '@/lib/website-model';

const MODES: Record<string, string> = {
  cart: 'Carrito: tus clientes compran y pagan en la tienda.',
  whatsapp: 'WhatsApp: los pedidos te llegan por mensaje.',
  catalog: 'Catálogo: se muestran productos y precios, sin pedidos.',
};

export default function CatalogScreen() {
  return <WebsiteGate title="Catálogo y destacados">{(settings) => <CatalogEditor settings={settings} />}</WebsiteGate>;
}

function CatalogEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const [featured, setFeatured] = useState<PublicProduct[] | null>(null);
  const [query, setQuery] = useState('');
  // Los resultados quedan atados a la búsqueda que los pidió: si cambió el texto, no se muestran.
  const [found, setFound] = useState<{ query: string; items: PublicProduct[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const text = query.trim();
  const active = text.length >= 2;
  const results = active && found?.query === text ? found.items : [];
  const searching = active && found?.query !== text;

  useEffect(() => {
    let alive = true;
    searchStoreProducts('', true)
      .then((items) => {
        if (alive) setFeatured(items);
      })
      .catch((cause) => {
        if (alive) setError(websiteErrorMessage(cause, 'No pudimos cargar los productos destacados.'));
      });
    return () => {
      alive = false;
    };
  }, []);

  // Búsqueda con espera corta: solo vale la respuesta del último pedido.
  useEffect(() => {
    if (!active) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const items = await searchStoreProducts(text);
        if (id === latest.current) setFound({ query: text, items });
      } catch (cause) {
        if (id === latest.current) {
          setError(websiteErrorMessage(cause, 'No pudimos buscar productos.'));
          setFound({ query: text, items: [] });
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [active, text]);

  const toggle = async (product: PublicProduct, next: boolean) => {
    setBusy(product.id);
    try {
      await setProductFeatured(product.id, next);
      // Lo confirmado por el servidor, no un reflejo optimista.
      const updated = { ...product, featured: next };
      setFound((current) => (current ? { ...current, items: current.items.map((item) => (item.id === product.id ? updated : item)) } : current));
      setFeatured((list) => (next ? [updated, ...(list ?? []).filter((item) => item.id !== product.id)] : (list ?? []).filter((item) => item.id !== product.id)));
    } catch (cause) {
      Alert.alert('No pudimos actualizar el producto', websiteErrorMessage(cause, 'Revisá tu conexión e intentá nuevamente.'));
    } finally {
      setBusy(null);
    }
  };

  const mode = settings.checkout?.commerceMode ?? 'cart';
  return (
    <WebsiteScreen title="Catálogo y destacados" subtitle="Lo que muestra tu tienda">
      <OfflineNotice />
      <Section title="Cómo se vende" icon="cart-outline">
        <Text style={[styles.text, { color: colors.text }]}>{MODES[mode] ?? MODES.cart}</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>La modalidad, los pagos y las entregas se configuran desde la web, en «Pagos y entregas».</Text>
      </Section>
      <Notice text="Tu tienda muestra nombre, fotos, precio de venta, ofertas y disponibilidad. Nunca muestra costos, márgenes ni datos internos del inventario." />

      <Section title="Productos destacados" icon="star-outline" hint="Aparecen primero en tu tienda.">
        {error ? <Notice tone="warning" text={error} /> : null}
        {featured === null ? (
          <ActivityIndicator color={palette.primary} />
        ) : featured.length === 0 ? (
          <Text style={[styles.muted, { color: colors.muted }]}>Todavía no destacaste productos.</Text>
        ) : (
          featured.map((product) => <ProductRow key={product.id} product={product} busy={busy === product.id} onToggle={toggle} />)
        )}
        <Text style={[styles.muted, { color: colors.muted }]}>Los destacados se ordenan solos (primero las ofertas y lo más nuevo): la tienda no guarda un orden propio.</Text>
      </Section>

      <Section title="Destacar un producto" icon="search-outline">
        <View style={[styles.search, { borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar producto…" placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" accessibilityLabel="Buscar producto" style={[styles.searchInput, { color: colors.text }]} />
          {searching ? <ActivityIndicator size="small" color={palette.primary} /> : null}
        </View>
        {query.trim().length >= 2 && !searching && results.length === 0 ? (
          <StateView icon="search-outline" title="Sin resultados" text="Probá con otro nombre o código." />
        ) : (
          results.map((product) => <ProductRow key={product.id} product={product} busy={busy === product.id} onToggle={toggle} />)
        )}
      </Section>
    </WebsiteScreen>
  );
}

function ProductRow({ product, busy, onToggle }: { product: PublicProduct; busy: boolean; onToggle: (product: PublicProduct, next: boolean) => void }) {
  const colors = usePalette();
  const out = product.stock !== null && product.stock <= 0;
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {product.image ? <Image source={{ uri: product.image }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, { backgroundColor: colors.border }]} />}
      <View style={styles.flex}>
        <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>{product.name}</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          {formatGs(product.offerPrice ?? product.salePrice)}{!product.isActive ? ' · Inactivo' : out ? ' · Sin stock' : ''}
        </Text>
      </View>
      <Pressable onPress={() => onToggle(product, !product.featured)} disabled={busy} accessibilityRole="button"
        accessibilityLabel={product.featured ? `Quitar ${product.name} de destacados` : `Destacar ${product.name}`}
        style={[styles.toggle, product.featured ? { borderColor: colors.border } : { backgroundColor: palette.primary, borderColor: palette.primary }]}>
        {busy ? <ActivityIndicator size="small" color={product.featured ? palette.primary : '#fff'} /> : (
          <Text style={[styles.toggleText, { color: product.featured ? colors.text : '#fff' }]}>{product.featured ? 'Quitar' : '+ Destacar'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { fontSize: 14, fontWeight: '600' },
  muted: { fontSize: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  name: { fontSize: 14, fontWeight: '700' },
  toggle: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, minHeight: 38, minWidth: 92, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '800' },
});
