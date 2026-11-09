import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch } from '@/lib/api'
import { usePalette } from '@/lib/palette'
import { useNotifications } from '@/lib/notifications-context'
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context'
import { NOTIFICATION_GROUPS, type NotificationGroup } from '../../../../../src/lib/notifications/presentation'
interface Preference { notificationType: string; category: string; title: string; pushEnabled: boolean; inAppEnabled: boolean }
export default function NotificationSettingsScreen() {
  const colors = usePalette()
  const { permissionStatus, promptForPermission } = useNotifications()
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const lock = useRef(false)
  const generation = useRef(0)
  const accent = colors.text === '#F1F5F9' ? '#93C5FD' : '#1D4ED8'
  useEffect(() => subscribePrivateCacheContext(() => { generation.current++; setPreferences([]); setAttempt(v => v + 1) }), [])
  useEffect(() => {
    let active = true
    const current = ++generation.current
    queueMicrotask(() => { if (active) setLoading(true) })
    apiFetch<{ preferences: Preference[] }>('/api/notifications/preferences').then(result => { if (active && current === generation.current) { setPreferences(result.preferences); setError(false) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  const change = async (targets: Preference[], enabled: boolean, field: 'pushEnabled' | 'inAppEnabled' = 'pushEnabled') => {
    if (lock.current) return
    lock.current = true; setSaving(true)
    const scope = getPrivateCacheContext()
    let failed = false
    // El endpoint vigente guarda un tipo por vez. No fingir éxito si una parte falla.
    for (const item of targets) {
      if (scope.epoch !== getPrivateCacheContext().epoch) break
      try {
        await apiFetch('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ notificationType: item.notificationType, pushEnabled: field === 'pushEnabled' ? enabled : item.pushEnabled, inAppEnabled: field === 'inAppEnabled' ? enabled : item.inAppEnabled }) })
        if (scope.epoch === getPrivateCacheContext().epoch) setPreferences(prev => prev.map(row => row.notificationType === item.notificationType ? { ...row, [field]: enabled } : row))
      } catch { failed = true; break }
    }
    lock.current = false; setSaving(false)
    if (failed) { Alert.alert('No se guardaron todos los cambios', 'Los cambios confirmados se conservaron. Revisá la conexión y volvé a intentar.'); setAttempt(v => v + 1) }
  }
  const news = preferences.find(item=>item.notificationType === 'SYSTEM_NEWS')
  const all = preferences.length > 0 && preferences.every(item => item.pushEnabled)
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Qué avisos querés recibir</Text>
    <Text style={{ color: colors.muted, lineHeight: 22 }}>Elegí qué novedades llegan al teléfono. Los avisos dentro de la app se configuran en cada categoría.</Text>
    {permissionStatus !== 'granted' && <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={{ color: colors.text, fontWeight: '700' }}>Activá los avisos en tu teléfono</Text><Text style={{ color: colors.muted }}>Tus preferencias quedan guardadas aunque el permiso esté apagado.</Text><Pressable accessibilityRole="button" onPress={() => { if (permissionStatus === 'denied') void Linking.openSettings().catch(() => Alert.alert('No pudimos abrir Ajustes')); else void promptForPermission() }} style={styles.button}><Text style={{ color: accent }}>{permissionStatus === 'denied' ? 'Activar en Ajustes' : 'Activar notificaciones'}</Text></Pressable></View>}
    {loading ? <ActivityIndicator accessibilityLabel="Cargando preferencias" color={accent} /> : error ? <View accessibilityRole="alert"><Text style={{ color: colors.text }}>No pudimos cargar tus preferencias.</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(v => v + 1)} style={styles.button}><Text style={{ color: accent }}>Reintentar</Text></Pressable></View> : <>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.row}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Avisos en el teléfono</Text><Text style={{ color: colors.muted }}>{all ? 'Todas las categorías activadas' : preferences.some(item => item.pushEnabled) ? 'Algunas categorías activadas' : 'Push silenciado'}</Text></View><Switch accessibilityLabel="Activar o silenciar todos los avisos push" disabled={saving} value={all} onValueChange={value => void change(preferences, value)} /></View></View>
      {news && <View style={[styles.card,{backgroundColor:colors.card,borderColor:colors.border}]}><View style={styles.row}><View style={{flex:1}}><Text style={{color:colors.text,fontWeight:'700'}}>Novedades del sistema</Text><Text style={{color:colors.muted}}>Recibir push sobre nuevas funciones y mejoras. Desactivado por defecto; no silencia avisos críticos.</Text></View><Switch accessibilityLabel="Recibir push de novedades del sistema" disabled={saving} value={news.pushEnabled} onValueChange={value=>void change([news],value)}/></View></View>}
      {Object.entries(NOTIFICATION_GROUPS).map(([key, group]) => {
        const items = preferences.filter(item => item.category === key && item.notificationType !== 'SYSTEM_NEWS')
        if (!items.length) return null
        const enabled = items.every(item => item.pushEnabled)
        return <View key={key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.row}><Ionicons name={NOTIFICATION_GROUPS[key as NotificationGroup].icon} size={24} color={accent} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{group.label}</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>{group.example}</Text>{!enabled && items.some(item => item.pushEnabled) && <Text style={{ color: accent }}>Activada parcialmente</Text>}</View><Switch accessibilityLabel={`Avisos push de ${group.label}`} disabled={saving} value={enabled} onValueChange={value => void change(items, value)} /></View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === key }} style={styles.button} onPress={() => setExpanded(expanded === key ? null : key)}><Text style={{ color: accent }}>{expanded === key ? 'Ocultar tipos de aviso' : 'Configurar por tipo'}</Text></Pressable>
          {expanded === key && items.map(item => <View key={item.notificationType} style={[styles.type, { borderColor: colors.border }]}><Text style={{ color: colors.text, fontWeight: '600' }}>{item.title}</Text><View style={styles.row}><Text style={{ color: colors.muted, flex: 1 }}>En el teléfono</Text><Switch accessibilityLabel={`${item.title}: en el teléfono`} value={item.pushEnabled} disabled={saving} onValueChange={value => void change([item], value)} /></View><View style={styles.row}><Text style={{ color: colors.muted, flex: 1 }}>Dentro de la app</Text><Switch accessibilityLabel={`${item.title}: dentro de la app`} value={item.inAppEnabled} disabled={saving} onValueChange={value => void change([item], value, 'inAppEnabled')} /></View></View>)}
        </View>
      })}
    </>}
    {saving && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Guardando preferencias…</Text>}
  </ScrollView>
}
const styles = StyleSheet.create({ container: { padding: 16, gap: 16, paddingBottom: 40 }, title: { fontSize: 24, fontWeight: '700' }, card: { padding: 16, borderWidth: 1, borderRadius: 12, gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }, button: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 }, type: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4 } })