import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CASH_STATUS, fetchOverview, WEB_SECTIONS, type AdminOverview } from '@/lib/admin';
import { formatGs, openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Colors = ReturnType<typeof usePalette>;
type IconName = keyof typeof Ionicons.glyphMap;

const hour = (iso: string) => new Date(iso).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

/**
 * Administración, como /admin: el resumen del negocio, las cajas abiertas, el
 * stock que se está acabando, lo pendiente y el acceso al equipo y a las
 * reseñas. Lo que es de escritorio (finanzas, reportes, configuración) abre la web.
 */
export default function AdministrationScreen() {
  const colors = usePalette();
  const { data: panel, findItem, loading: panelLoading } = usePanel();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchOverview()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.'))
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  if (!panelLoading && !findItem('administration') && !panel?.user.isAdmin) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.muted} />
        <Text style={[styles.h1, { color: colors.text }]}>Solo para administradores</Text>
      </View>
    );
  }

  const blocked = data?.cash.filter((session) => session.status !== 'open').length ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}>
      <View>
        <Text style={[styles.title, { color: colors.text }]}>Resumen</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>{panel?.organization.name ?? 'Tu negocio'}</Text>
      </View>

      {!data ? (
        error ? (
          <View style={[styles.card, styles.centerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.bold, { color: colors.text }]}>{error}</Text>
            <Pressable onPress={reload} style={[styles.outline, { borderColor: colors.border }]}>
              <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator style={styles.loading} color={palette.primary} />
        )
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroCaption}>Vendido hoy</Text>
            <Text style={styles.heroTotal}>{formatGs(data.sales.todayTotal)}</Text>
            <Text style={styles.heroSub}>
              {data.sales.todayCount} ventas · en el mes {formatGs(data.sales.monthTotal)} ({data.sales.monthCount})
            </Text>
          </View>

          <View style={styles.grid}>
            <Kpi icon="cash-outline" label="Cajas abiertas" value={String(data.cash.length)} tone={blocked ? palette.danger : undefined} hint={blocked ? `${blocked} con alerta` : undefined} onPress={() => router.push('/admin/cash' as never)} colors={colors} />
            <Kpi icon="alert-circle-outline" label="Stock bajo" value={String(data.lowStock.count)} tone={data.lowStock.count ? '#D97706' : undefined} hint={data.lowStock.outOfStock ? `${data.lowStock.outOfStock} sin stock` : undefined} onPress={findItem('products') ? () => router.push('/panel/products' as never) : undefined} colors={colors} />
            <Kpi icon="people-outline" label="Equipo activo" value={`${data.team.active}/${data.team.total}`} onPress={() => router.push('/admin/users' as never)} colors={colors} />
            <Kpi icon="star-outline" label="Reseñas por revisar" value={String(data.pending.reviews)} tone={data.pending.reviews ? palette.primary : undefined} onPress={() => router.push('/admin/reviews' as never)} colors={colors} />
          </View>

          {data.pending.afterSales > 0 && findItem('after-sales') && (
            <Pressable onPress={() => router.push('/panel/after-sales' as never)} style={[styles.alert, { borderColor: '#D9770655', backgroundColor: '#D9770612' }]}>
              <Ionicons name="refresh-circle-outline" size={20} color="#D97706" />
              <Text style={[styles.small, styles.flex, { color: colors.text }]}>
                {data.pending.afterSales} {data.pending.afterSales === 1 ? 'reclamo de posventa espera' : 'reclamos de posventa esperan'} respuesta.
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          )}

          <Card title="Cajas abiertas" action="Monitor" onAction={() => router.push('/admin/cash' as never)} colors={colors}>
            {data.cash.length === 0 ? (
              <Text style={[styles.small, { color: colors.muted }]}>No hay cajas abiertas ahora.</Text>
            ) : (
              data.cash.slice(0, 4).map((session) => {
                const status = CASH_STATUS[session.status];
                return (
                  <View key={session.id} style={[styles.line, { borderColor: colors.border }]}>
                    <View style={[styles.dot, { backgroundColor: status.color }]} />
                    <View style={styles.flex}>
                      <Text style={[styles.bold, { color: colors.text }]}>{session.registerName}</Text>
                      <Text style={[styles.small, { color: colors.muted }]}>
                        {session.branchName} · desde {hour(session.openedAt)} · {session.salesCount} ventas
                      </Text>
                    </View>
                    <Text style={[styles.bold, { color: colors.text }]}>{formatGs(session.salesTotal)}</Text>
                  </View>
                );
              })
            )}
          </Card>

          {data.lowStock.items.length > 0 && (
            <Card title="Se está acabando" colors={colors}>
              {data.lowStock.items.map((item) => (
                <Pressable key={item.id} disabled={!findItem('products')} onPress={() => router.push(`/panel/products/${item.id}` as never)} style={[styles.line, { borderColor: colors.border }]}>
                  <Ionicons name={item.stock <= 0 ? 'close-circle' : 'warning-outline'} size={18} color={item.stock <= 0 ? palette.danger : '#D97706'} />
                  <Text numberOfLines={1} style={[styles.small, styles.flex, { color: colors.text, fontWeight: '700' }]}>{item.name}</Text>
                  <Text style={[styles.small, { color: item.stock <= 0 ? palette.danger : colors.muted, fontWeight: '800' }]}>
                    {item.stock} / mín. {item.min}
                  </Text>
                </Pressable>
              ))}
            </Card>
          )}
        </>
      )}

      <Card title="Gestión y Operaciones" colors={colors}>
        <Link icon="people-outline" label="Usuarios y roles" hint="Invitar, cambiar rol, suspender" onPress={() => router.push('/admin/users' as never)} colors={colors} />
        <Link icon="business-outline" label="Sucursales" hint="Locales, cajas y puntos de venta" onPress={() => router.push('/admin/branches' as never)} colors={colors} />
        <Link icon="cash-outline" label="Monitor de cajas" hint="Suspender, bloquear o cerrar a distancia" onPress={() => router.push('/admin/cash' as never)} colors={colors} />
        <Link icon="wallet-outline" label="Finanzas" hint="Resultados económicos y flujo de caja" onPress={() => router.push('/admin/finances' as never)} colors={colors} />
        <Link icon="analytics-outline" label="Analítica" hint="Tráfico web y rendimiento comercial" onPress={() => router.push('/admin/analytics' as never)} colors={colors} />
        <Link icon="card-outline" label="Suscripción" hint="Plan, consumo de cuotas y facturación" onPress={() => router.push('/admin/subscriptions' as never)} colors={colors} />
        <Link icon="settings-outline" label="Configuración" hint="Parámetros de comercio e impuestos" onPress={() => router.push('/admin/settings' as never)} colors={colors} />
        <Link icon="star-outline" label="Reseñas" hint="Aprobar, ocultar y responder" onPress={() => router.push('/admin/reviews' as never)} colors={colors} />
      </Card>

      <Card title="Herramientas web adicionales" colors={colors}>
        {WEB_SECTIONS.map((section) => (
          <Link key={section.path} icon={section.icon as IconName} label={section.label} hint={section.hint} web onPress={() => openWeb(section.path)} colors={colors} />
        ))}
      </Card>
    </ScrollView>
  );
}

function Kpi({ icon, label, value, hint, tone, onPress, colors }: { icon: IconName; label: string; value: string; hint?: string; tone?: string; onPress?: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.kpi, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
      <Ionicons name={icon} size={18} color={tone ?? colors.muted} />
      <Text style={[styles.kpiValue, { color: tone ?? colors.text }]}>{value}</Text>
      <Text style={[styles.tiny, { color: colors.muted }]}>{label}</Text>
      {hint ? <Text style={[styles.tiny, { color: tone ?? colors.muted, fontWeight: '700' }]}>{hint}</Text> : null}
    </Pressable>
  );
}

function Card({ title, action, onAction, colors, children }: { title: string; action?: string; onAction?: () => void; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={[styles.small, { color: palette.primary, fontWeight: '800' }]}>{action} ›</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Link({ icon, label, hint, web, onPress, colors }: { icon: IconName; label: string; hint: string; web?: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.line, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.linkIcon, { backgroundColor: web ? colors.background : 'rgba(37,99,235,0.1)' }]}>
        <Ionicons name={icon} size={18} color={web ? colors.muted : palette.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.bold, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.tiny, { color: colors.muted }]}>{hint}</Text>
      </View>
      <Ionicons name={web ? 'open-outline' : 'chevron-forward'} size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  h1: { fontSize: 19, fontWeight: '800', textAlign: 'center' },
  muted: { fontSize: 13 },
  small: { fontSize: 12 },
  tiny: { fontSize: 11 },
  bold: { fontSize: 14, fontWeight: '800' },
  loading: { paddingVertical: 30 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  centerCard: { alignItems: 'center' },
  hero: { backgroundColor: palette.primary, borderRadius: 20, padding: 16, gap: 2 },
  heroCaption: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  heroTotal: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  kpiValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  linkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
