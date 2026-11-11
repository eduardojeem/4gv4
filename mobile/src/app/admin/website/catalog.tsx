import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OfflineNotice, WebsiteGate } from '@/components/website/website-gate';
import {
  Notice,
  Section,
  StateView,
  StatusPill,
  WebsiteScreen,
  websiteStyles,
} from '@/components/website/website-ui';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import {
  searchStoreProductsPage,
  setProductFeatured,
  websiteErrorMessage,
} from '@/lib/website-admin';
import type { PublicProduct, WebsiteSettings } from '@/lib/website-model';

const MODES: Record<string, { label: string; desc: string }> = {
  cart: {
    label: 'Carrito online',
    desc: 'Tus clientes agregan al carrito, eligen entrega y forma de pago.',
  },
  whatsapp: {
    label: 'Pedidos por WhatsApp',
    desc: 'El catálogo arma el pedido y te lo envían directo por mensaje.',
  },
  catalog: {
    label: 'Solo catálogo',
    desc: 'Se exhiben productos y precios sin botones de compra ni carrito.',
  },
};

export default function CatalogScreen() {
  return (
    <WebsiteGate title="Catálogo y destacados">
      {(settings) => <CatalogEditor settings={settings} />}
    </WebsiteGate>
  );
}

function CatalogEditor({ settings }: { settings: WebsiteSettings }) {
  const colors = usePalette();
  const [featured, setFeatured] = useState<PublicProduct[] | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{
    query: string;
    items: PublicProduct[];
    nextPage: number | null;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [nextFeatured, setNextFeatured] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageLock = useRef(false);
  const text = query.trim();
  const active = text.length >= 2;
  const results = active && found?.query === text ? found.items : [];
  const searching = active && found?.query !== text;

  useEffect(() => {
    let alive = true;
    searchStoreProductsPage('', true)
      .then((result) => {
        if (alive) {
          setFeatured(result.items);
          setNextFeatured(result.nextPage);
          setError(null);
        }
      })
      .catch((cause) => {
        if (alive)
          setError(
            websiteErrorMessage(
              cause,
              'No pudimos cargar los productos destacados.',
            ),
          );
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!active) return;
    const id = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const result = await searchStoreProductsPage(text);
        if (id === latest.current) {
          setFound({ query: text, ...result });
          setError(null);
        }
      } catch (cause) {
        if (id === latest.current) {
          setError(websiteErrorMessage(cause, 'No pudimos buscar productos.'));
          setFound({ query: text, items: [], nextPage: null });
        }
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [active, text]);

  const toggle = async (product: PublicProduct, next: boolean) => {
    if (busy || pageLock.current) return;
    setBusy(product.id);
    try {
      await setProductFeatured(product.id, next);
      const updated = { ...product, featured: next };
      setFeatured(null);
      setNextFeatured(null);
      setAttempt((value) => value + 1);
      setFound((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === product.id ? updated : item,
              ),
            }
          : current,
      );
    } catch (cause) {
      Alert.alert(
        'No pudimos actualizar el producto',
        websiteErrorMessage(cause, 'Revisá tu conexión e intentá nuevamente.'),
      );
    } finally {
      setBusy(null);
    }
  };

  const loadMore = async (featuredOnly: boolean) => {
    const page = featuredOnly ? nextFeatured : found?.nextPage;
    if (!page || pageLock.current || busy) return;
    const request = latest.current;
    pageLock.current = true;
    setLoadingMore(true);
    try {
      const result = await searchStoreProductsPage(
        featuredOnly ? '' : text,
        featuredOnly,
        page,
      );
      if (request !== latest.current) return;
      if (featuredOnly) {
        setFeatured((list) => [
          ...(list ?? []),
          ...result.items.filter(
            (item) => !(list ?? []).some((old) => old.id === item.id),
          ),
        ]);
        setNextFeatured(result.nextPage);
      } else
        setFound((current) =>
          current?.query === text
            ? {
                query: text,
                items: [
                  ...current.items,
                  ...result.items.filter(
                    (item) => !current.items.some((old) => old.id === item.id),
                  ),
                ],
                nextPage: result.nextPage,
              }
            : current,
        );
      setError(null);
    } catch (cause) {
      setError(websiteErrorMessage(cause, 'No pudimos cargar más productos.'));
    } finally {
      pageLock.current = false;
      setLoadingMore(false);
    }
  };

  const mode = settings.checkout?.commerceMode ?? 'cart';
  const modeInfo = MODES[mode] ?? MODES.cart;

  return (
    <WebsiteScreen
      title="Catálogo y destacados"
      subtitle="Productos que sobresalen en tu tienda"
    >
      <OfflineNotice />

      <Section
        title="Modalidad de venta"
        icon="cart-outline"
        right={<StatusPill label={modeInfo.label} tone="primary" />}
      >
        <Text style={[styles.text, { color: colors.text }]}>
          {modeInfo.desc}
        </Text>
        <Pressable
          onPress={() => router.push('/admin/website/checkout' as never)}
          accessibilityRole="button"
          style={[
            websiteStyles.secondaryButton,
            { borderColor: palette.primary },
          ]}
        >
          <Ionicons name="card-outline" size={16} color={palette.primary} />
          <Text style={[websiteStyles.secondaryText, { color: palette.primary }]}>
            Configurar pagos y entregas
          </Text>
        </Pressable>
      </Section>

      <Notice text="Tu tienda solo muestra nombre, fotos, precio de venta, ofertas y disponibilidad. Nunca muestra costos ni márgenes." />

      <Section
        title="Productos destacados"
        icon="star-outline"
        hint="Aparecen al inicio para captar atención apenas entran."
        right={
          featured ? (
            <StatusPill label={`${featured.length}`} tone="primary" />
          ) : undefined
        }
      >
        {error ? (
          <>
            <Notice tone="warning" text={error} />
            <Pressable
              accessibilityRole="button"
              style={websiteStyles.secondaryButton}
              onPress={() => {
                setFeatured(null);
                setAttempt((value) => value + 1);
              }}
            >
              <Text style={{ color: colors.text }}>Reintentar</Text>
            </Pressable>
          </>
        ) : null}
        {featured === null && error ? null : featured === null ? (
          <ActivityIndicator color={palette.primary} />
        ) : !featured?.length ? (
          <Text style={[styles.muted, { color: colors.muted }]}>
            Todavía no destacaste productos. Buscá abajo para marcar tus mejores productos.
          </Text>
        ) : (
          (featured ?? []).map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              busy={Boolean(busy) || loadingMore}
              onToggle={toggle}
            />
          ))
        )}
        {nextFeatured && (
          <Pressable
            disabled={loadingMore}
            accessibilityRole="button"
            style={[
              websiteStyles.secondaryButton,
              { borderColor: colors.border },
            ]}
            onPress={() => void loadMore(true)}
          >
            <Text style={{ color: colors.text }}>
              {loadingMore ? 'Cargando…' : 'Cargar más destacados'}
            </Text>
          </Pressable>
        )}
      </Section>

      <Section title="Destacar un producto" icon="search-outline">
        <View
          style={[
            styles.search,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar producto por nombre o código…"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar producto"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searching ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : null}
        </View>
        {query.trim().length >= 2 && !searching && results.length === 0 ? (
          <StateView
            icon="search-outline"
            title="Sin resultados"
            text="Probá con otro nombre o código."
          />
        ) : (
          results.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              busy={busy === product.id}
              onToggle={toggle}
            />
          ))
        )}
        {active && found?.nextPage && (
          <Pressable
            disabled={loadingMore}
            accessibilityRole="button"
            style={[
              websiteStyles.secondaryButton,
              { borderColor: colors.border },
            ]}
            onPress={() => void loadMore(false)}
          >
            <Text style={{ color: colors.text }}>
              {loadingMore ? 'Cargando…' : 'Cargar más resultados'}
            </Text>
          </Pressable>
        )}
      </Section>
    </WebsiteScreen>
  );
}

function ProductRow({
  product,
  busy,
  onToggle,
}: {
  product: PublicProduct;
  busy: boolean;
  onToggle: (product: PublicProduct, next: boolean) => void;
}) {
  const colors = usePalette();
  const out = product.stock !== null && product.stock <= 0;
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      {product.image ? (
        <Image
          source={{ uri: product.image }}
          style={styles.thumb}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.border }]} />
      )}
      <View style={styles.flex}>
        <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
          {product.name}
        </Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          {formatGs(product.offerPrice ?? product.salePrice)}
          {!product.isActive ? ' · Inactivo' : out ? ' · Sin stock' : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => onToggle(product, !product.featured)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={
          product.featured
            ? `Quitar ${product.name} de destacados`
            : `Destacar ${product.name}`
        }
        style={[
          styles.toggle,
          product.featured
            ? { borderColor: colors.border }
            : {
                backgroundColor: palette.primary,
                borderColor: palette.primary,
              },
        ]}
      >
        {busy ? (
          <ActivityIndicator
            size="small"
            color={product.featured ? palette.primary : '#fff'}
          />
        ) : (
          <Text
            style={[
              styles.toggleText,
              { color: product.featured ? colors.text : '#fff' },
            ]}
          >
            {product.featured ? 'Quitar' : '+ Destacar'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { fontSize: 13, lineHeight: 19 },
  muted: { fontSize: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  name: { fontSize: 14, fontWeight: '700' },
  toggle: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 38,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { fontSize: 13, fontWeight: '800' },
});
