import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { apiFetch } from '@/lib/api'
import { usePalette } from '@/lib/palette'
import { resolveNotificationRoute } from '@/lib/push-notifications'
import { useNotifications } from '@/lib/notifications-context'
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context'
import { NOTIFICATION_GROUPS, notificationGroup, notificationDateSection, relativeNotificationTime, isUrgentNotification } from '../../../../src/lib/notifications/presentation'

type Item = { id: string; organizationId: string; branchId: string | null; type: string; title: string; body: string; resourceType: string | null; resourceId: string | null; readAt: string | null; createdAt: string }
type Feed = { items: Item[]; nextCursor: string | null }
/** Aviso que la plataforma publica para todas las tiendas o para esta. */
type Announcement = { id: string; title: string; body: string; type: 'info' | 'warning' | 'success' | 'danger'; read: boolean; timestamp: string }
const ANNOUNCEMENT_COLORS: Record<Announcement['type'], { light: string; dark: string; label: string }> = {
  info: { light: '#1D4ED8', dark: '#93C5FD', label: 'Información' },
  success: { light: '#047857', dark: '#6EE7B7', label: 'Novedad' },
  warning: { light: '#B45309', dark: '#FCD34D', label: 'Aviso' },
  danger: { light: '#9F1239', dark: '#FDA4AF', label: 'Urgente' },
}
export default function NotificationsScreen() {
  const colors = usePalette()
  const { refreshUnreadCount, feedVersion, promptForPermission, permissionStatus, unreadCount } = useNotifications()
  const [items, setItems] = useState<Item[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [reading, setReading] = useState(false)
  const request = useRef(0)
  const loadingMore = useRef(false)
  const readLock = useRef(false)
  const load = useCallback(async () => {
    const generation = ++request.current
    const scope = getPrivateCacheContext()
    setBusy(true)
    try {
      const [result, global] = await Promise.all([
        apiFetch<Feed>('/api/notifications?limit=20'),
        // Los avisos de la plataforma no son críticos: si fallan, se muestra la bandeja igual.
        apiFetch<{ data?: Announcement[] }>('/api/notifications?scope=global').catch(() => null),
      ])
      if (generation !== request.current || scope.epoch !== getPrivateCacheContext().epoch) return
      setItems(result.items); setCursor(result.nextCursor); setError(null)
      if (global) setAnnouncements(global.data ?? [])
      void refreshUnreadCount()
    } catch { if (generation === request.current) setError('No pudimos cargar tus avisos. Revisá tu conexión y reintentá.') }
    finally { if (generation === request.current) setBusy(false) }
  }, [refreshUnreadCount])
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++ } }, [load]))
  useEffect(() => { if (feedVersion) queueMicrotask(() => void load()) }, [load, feedVersion])
  useEffect(() => subscribePrivateCacheContext(() => { request.current++; setItems([]); setAnnouncements([]); setCursor(null); void load() }), [load])
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'active') void load() }); return () => sub.remove() }, [load])
  const loadMore = async () => {
    if (!cursor || busy || loadingMore.current) return
    loadingMore.current = true; setMore(true)
    const generation = request.current
    try {
      const result = await apiFetch<Feed>(`/api/notifications?limit=20&cursor=${encodeURIComponent(cursor)}`)
      if (generation !== request.current) return
      setItems(prev => [...prev, ...result.items.filter(item => !prev.some(old => old.id === item.id))]); setCursor(result.nextCursor); setError(null)
    } catch { setError('No pudimos cargar más avisos. Tocá Reintentar.') }
    finally { loadingMore.current = false; setMore(false) }
  }
  const markRead = async (item?: Item) => {
    if (readLock.current) return false
    readLock.current = true; setReading(true)
    const generation = request.current
    try {
      await apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify(item ? { notificationId: item.id } : { all: true }) })
      // «Marcar todas» también alcanza a los avisos de la plataforma.
      if (!item && announcements.some(row => !row.read)) await apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ all: true, scope: 'global' }) })
      if (generation !== request.current) return false
      setItems(prev => prev.map(row => !item || row.id === item.id ? { ...row, readAt: row.readAt ?? new Date().toISOString() } : row))
      if (!item) setAnnouncements(prev => prev.map(row => ({ ...row, read: true })))
      void refreshUnreadCount(); void Haptics.selectionAsync().catch(() => undefined)
      return true
    } catch { Alert.alert('No se guardó la lectura', 'Revisá tu conexión y volvé a intentar.'); return false }
    finally { readLock.current = false; setReading(false) }
  }
  const updateAnnouncement = async (announcement: Announcement, dismiss: boolean) => {
    const previous = announcements
    setAnnouncements(prev => dismiss ? prev.filter(row => row.id !== announcement.id) : prev.map(row => row.id === announcement.id ? { ...row, read: true } : row))
    try {
      await apiFetch('/api/notifications/read', { method: 'POST', body: JSON.stringify({ id: announcement.id, scope: 'global', dismiss }) })
      void refreshUnreadCount()
    } catch {
      setAnnouncements(previous)
      Alert.alert(dismiss ? 'No se pudo quitar el aviso' : 'No se guardó la lectura', 'Revisá tu conexión y volvé a intentar.')
    }
  }
  const visibleAnnouncements = filter === 'all' ? announcements : filter === 'unread' ? announcements.filter(row => !row.read) : []
  const sections = useMemo(() => {
    const grouped = new Map<string, Item[]>()
    for (const item of items.filter(row => filter === 'all' || (filter === 'unread' ? !row.readAt : notificationGroup(row.type) === filter))) {
      const key = notificationDateSection(item.createdAt)
      grouped.set(key, [...(grouped.get(key) ?? []), item])
    }
    return [...grouped].map(([title, data]) => ({ title, data }))
  }, [items, filter])
  const linkColor = colors.text === '#F1F5F9' ? '#93C5FD' : '#1D4ED8'
  return <GestureHandlerRootView style={{ flex: 1 }}><View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={styles.header}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Notificaciones</Text><NotificationButton color={linkColor} label="Preferencias" action={() => router.push('/panel/settings/notifications')} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
      {[['all', 'Todas'], ['unread', 'No leídas'], ...Object.entries(NOTIFICATION_GROUPS).map(([key, value]) => [key, value.label])].map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[styles.chip, { borderColor: filter === key ? linkColor : colors.border, backgroundColor: filter === key ? colors.card : colors.background }]}><Text style={{ color: filter === key ? linkColor : colors.text }}>{label}</Text></Pressable>)}
    </ScrollView>
    <View style={styles.toolbar}><Text style={{ color: colors.muted }}>Tus avisos del negocio</Text><Pressable accessibilityRole="button" disabled={reading || unreadCount === 0} onPress={() => void markRead()} style={styles.button}><Text style={{ color: linkColor }}>{reading ? 'Guardando…' : 'Marcar todas leídas'}</Text></Pressable></View>
    {error && <View accessibilityRole="alert" style={styles.message}><Text style={{ color: colors.text }}>{error}</Text><NotificationButton color={linkColor} label="Reintentar" action={() => void load()} /></View>}
    {busy && items.length === 0 ? <ActivityIndicator accessibilityLabel="Cargando notificaciones" style={{ margin: 40 }} color={linkColor} /> : <SectionList sections={sections} keyExtractor={item => item.id} stickySectionHeadersEnabled={false} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} tintColor={linkColor} />} onEndReached={() => void loadMore()} onEndReachedThreshold={0.3}
      ListHeaderComponent={visibleAnnouncements.length > 0 ? <View>
        <Text accessibilityRole="header" style={[styles.section, { color: colors.muted }]}>Avisos de la plataforma</Text>
        {visibleAnnouncements.map(announcement => {
          const meta = ANNOUNCEMENT_COLORS[announcement.type] ?? ANNOUNCEMENT_COLORS.info
          const color = colors.text === '#F1F5F9' ? meta.dark : meta.light
          return <View key={announcement.id} style={[styles.row, { backgroundColor: announcement.read ? colors.background : colors.card, borderColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: color + '15' }]}><Ionicons name="megaphone-outline" size={22} color={color} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${announcement.read ? 'Leído' : 'No leído'}. ${meta.label}. ${announcement.title}. ${announcement.body}. ${relativeNotificationTime(announcement.timestamp)}.${announcement.read ? '' : ' Marcar como leído.'}`} onPress={() => { if (!announcement.read) void updateAnnouncement(announcement, false) }} style={{ flex: 1 }}>
              <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{meta.label}</Text>
              <Text style={{ color: colors.text, fontWeight: announcement.read ? '500' : '700', fontSize: 16, marginVertical: 4 }}>{announcement.title}</Text>
              <Text style={{ color: colors.text, lineHeight: 21 }}>{announcement.body}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>{relativeNotificationTime(announcement.timestamp)}</Text>
            </Pressable>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {!announcement.read && <View style={[styles.dot, { backgroundColor: linkColor }]} />}
              <Pressable accessibilityRole="button" accessibilityLabel={`Quitar aviso: ${announcement.title}`} onPress={() => void updateAnnouncement(announcement, true)} style={styles.button}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
            </View>
          </View>
        })}
      </View> : null}
      renderSectionHeader={({ section }) => <Text accessibilityRole="header" style={[styles.section, { color: colors.muted }]}>{section.title}</Text>}
      ListEmptyComponent={!error && visibleAnnouncements.length === 0 ? <View style={styles.empty}><Ionicons name="notifications-outline" size={42} color={colors.muted} /><Text style={[styles.title, { color: colors.text }]}>{filter === 'unread' ? 'Estás al día' : 'Sin avisos por acá'}</Text><Text style={{ color: colors.muted, textAlign: 'center' }}>Acá vas a encontrar las novedades de tu negocio.</Text><NotificationButton color={linkColor} label="Elegí qué avisos recibir" action={() => router.push('/panel/settings/notifications')} />{permissionStatus !== 'granted' && <NotificationButton color={linkColor} label="Activar notificaciones" action={() => void promptForPermission()} />}</View> : null}
      ListFooterComponent={more ? <ActivityIndicator accessibilityLabel="Cargando más avisos" /> : cursor ? <NotificationButton color={linkColor} label="Cargar más" action={() => void loadMore()} /> : null}
      renderItem={({ item }) => {
        const group = NOTIFICATION_GROUPS[notificationGroup(item.type)]
        const urgent = isUrgentNotification(item.type)
        const color = urgent ? (colors.text === '#F1F5F9' ? '#FDA4AF' : '#9F1239') : (colors.text === '#F1F5F9' ? ({ sales: '#86EFAC', orders: '#93C5FD', repairs: '#D8B4FE', services: '#67E8F9', inventory: '#FCD34D', cash: '#FDA4AF', credits: '#FDA4AF', suppliers: '#CBD5E1', employees: '#CBD5E1', security: '#CBD5E1', system: '#CBD5E1' }[notificationGroup(item.type)]) : group.color)
        return <Swipeable onSwipeableOpen={() => void markRead(item)} enabled={!item.readAt && !reading} renderRightActions={() => <Pressable accessibilityRole="button" accessibilityLabel={`Marcar como leída: ${item.title}`} onPress={() => void markRead(item)} style={[styles.swipe, { backgroundColor: colors.card }]}><Text style={{ color: linkColor }}>Marcar leída</Text></Pressable>}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.readAt ? 'Leída' : 'No leída'}. ${urgent ? 'Requiere atención. ' : ''}${item.title}. ${item.body}. ${relativeNotificationTime(item.createdAt)}. Abrir detalle.`} onPress={() => { void (async () => { if (!item.readAt && !await markRead(item)) return; router.push(resolveNotificationRoute(item) as never) })() }} style={[styles.row, { backgroundColor: item.readAt ? colors.background : colors.card, borderColor: colors.border }]}>
            <View style={[styles.icon, { backgroundColor: color + '15' }]}><Ionicons name={group.icon} size={22} color={color} /></View>
            <View style={{ flex: 1 }}><Text style={{ color, fontSize: 12, fontWeight: '700' }}>{group.label}{urgent ? ' · Requiere atención' : ''}</Text><Text style={{ color: colors.text, fontWeight: item.readAt ? '500' : '700', fontSize: 16, marginVertical: 4 }}>{item.title}</Text><Text style={{ color: colors.text, lineHeight: 21 }}>{item.body}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>{relativeNotificationTime(item.createdAt)} · Ver detalle</Text></View>
            {!item.readAt && <View style={[styles.dot, { backgroundColor: linkColor }]} />}
          </Pressable>
        </Swipeable>
      }} />}
  </View></GestureHandlerRootView>
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12 }, title: { fontSize: 22, fontWeight: '700' }, button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, chips: { gap: 8, padding: 16 }, chip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 22, paddingHorizontal: 16 }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }, section: { paddingHorizontal: 16, paddingVertical: 12, fontWeight: '700' }, row: { flexDirection: 'row', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 }, empty: { padding: 32, alignItems: 'center', gap: 12 }, message: { padding: 16 }, swipe: { minWidth: 112, justifyContent: 'center', alignItems: 'center' } })
function NotificationButton({ label, action, color }: { label: string; action: () => void; color: string }) { return <Pressable accessibilityRole="button" onPress={action} style={styles.button}><Text style={{ color, fontWeight: '600' }}>{label}</Text></Pressable> }
