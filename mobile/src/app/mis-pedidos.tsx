import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

/**
 * Mis pedidos del marketplace, en la app. Antes abría el navegador y ahí no
 * había sesión: el comprador tenía que volver a entrar. Usa la misma API que la
 * web (/api/marketplace/profile/orders), con la sesión de la app.
 */

type Order = {
  id: string;
  order_number: string | null;
  status: string;
  payment_status: string | null;
  fulfillment_type: string | null;
  total: number;
  amount_due: number;
  created_at: string;
  organization: { name: string | null; slug: string | null; logo_url: string | null } | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: '#D97706' },
  CONFIRMED: { label: 'Confirmado', color: palette.primary },
  PREPARING: { label: 'En preparación', color: palette.primary },
  READY: { label: 'Listo para retirar', color: palette.success },
  SHIPPED: { label: 'En camino', color: palette.primary },
  DELIVERED: { label: 'Entregado', color: palette.success },
  CANCELLED: { label: 'Cancelado', color: '#64748B' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyOrdersScreen() {
  const colors = usePalette();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<{ items: Order[]; nextCursor: string | null }>('/api/marketplace/profile/orders')
      .then((res) => {
        if (!active) return;
        setOrders(res.items);
        setCursor(res.nextCursor);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudieron cargar tus pedidos.'))
      .finally(() => active && setRefreshing(false));
    return () => { active = false; };
  }, [attempt]);

  const reload = useCallback(() => { setRefreshing(true); setAttempt((n) => n + 1); }, []);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiFetch<{ items: Order[]; nextCursor: string | null }>(`/api/marketplace/profile/orders?cursor=${encodeURIComponent(cursor)}`);
      setOrders((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar más pedidos.');
    } finally {
      setLoadingMore(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/', params: { tab: 'perfil' } } as never));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Volver al perfil" style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Mis pedidos</Text>
      </View>

      {!orders ? (
        <View style={styles.center}>
          {error ? (
            <>
              <Ionicons name="cloud-offline-outline" size={30} color={colors.muted} />
              <Text style={[styles.body, { color: colors.text }]}>{error}</Text>
              <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]} accessibilityRole="button">
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
              </Pressable>
            </>
          ) : <ActivityIndicator color={palette.primary} />}
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name="bag-handle-outline" size={34} color={colors.muted} />
              <Text style={[styles.bold, { color: colors.text }]}>Todavía no hiciste pedidos</Text>
              <Text style={[styles.body, { color: colors.muted }]}>Cuando compres en una tienda del marketplace, vas a verlo acá.</Text>
              <Pressable onPress={() => router.replace({ pathname: '/', params: { tab: 'productos' } } as never)} style={[styles.primary]} accessibilityRole="button">
                <Text style={styles.primaryText}>Ver productos</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={palette.primary} style={styles.footer} /> : null}
          renderItem={({ item }) => {
            const status = STATUS[item.status] ?? { label: item.status, color: colors.muted };
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.row}>
                  {item.organization?.logo_url ? (
                    <Image source={{ uri: item.organization.logo_url }} style={styles.logo} contentFit="cover" />
                  ) : (
                    <View style={[styles.logo, styles.logoFallback, { backgroundColor: colors.background }]}>
                      <Ionicons name="storefront-outline" size={16} color={colors.muted} />
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.bold, { color: colors.text }]}>{item.organization?.name ?? 'Tienda'}</Text>
                    <Text style={[styles.small, { color: colors.muted }]}>
                      {item.order_number ? `#${item.order_number} · ` : ''}{formatDate(item.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.badge, { color: status.color, borderColor: status.color }]}>{status.label}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={[styles.small, styles.flex, { color: colors.muted }]}>
                    {item.fulfillment_type === 'PICKUP' ? 'Retiro en tienda' : item.fulfillment_type === 'DELIVERY' ? 'Envío a domicilio' : ''}
                  </Text>
                  <Text style={[styles.total, { color: colors.text }]}>{formatGs(item.total)}</Text>
                </View>
                {item.amount_due > 0 && item.status !== 'CANCELLED' ? (
                  <Text style={[styles.small, { color: '#D97706' }]}>Saldo a pagar: {formatGs(item.amount_due)}</Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 10 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  bold: { fontSize: 14, fontWeight: '800' },
  small: { fontSize: 12 },
  total: { fontSize: 16, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  outline: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  primary: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, marginTop: 4 },
  primaryText: { color: '#FFFFFF', fontWeight: '800' },
  footer: { marginVertical: 16 },
});
