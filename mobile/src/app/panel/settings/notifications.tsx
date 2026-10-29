import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch } from '@/lib/api'
import { usePalette, palette } from '@/lib/palette'
import { getPushPermissionStatus } from '@/lib/push-notifications'
import { useNotifications } from '@/lib/notifications-context'

interface PreferenceItem {
  notificationType: string
  category: string
  title: string
  description: string
  pushEnabled: boolean
  inAppEnabled: boolean
  source: 'explicit' | 'default'
  hasExplicitSetting: boolean
}

const CATEGORY_NAMES: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  sales: { label: 'Ventas', icon: 'cash-outline' },
  orders: { label: 'Pedidos', icon: 'cart-outline' },
  repairs: { label: 'Reparaciones', icon: 'build-outline' },
  services: { label: 'Reservas y Agenda', icon: 'calendar-outline' },
  inventory: { label: 'Inventario', icon: 'cube-outline' },
  cash: { label: 'Caja', icon: 'wallet-outline' },
  credits: { label: 'Créditos y Pagos', icon: 'card-outline' },
  suppliers: { label: 'Proveedores', icon: 'business-outline' },
  employees: { label: 'Administración', icon: 'people-outline' },
  security: { label: 'Seguridad', icon: 'shield-checkmark-outline' },
  system: { label: 'Sistema y Suscripción', icon: 'information-circle-outline' },
}

export default function NotificationSettingsScreen() {
  const colors = usePalette()
  const { promptForPermission } = useNotifications()

  const [preferences, setPreferences] = useState<PreferenceItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [osPermission, setOsPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined')
  const [attempt] = useState<number>(0)

  useEffect(() => {
    let active = true

    Promise.all([
      apiFetch<{ preferences: PreferenceItem[] }>('/api/notifications/preferences'),
      getPushPermissionStatus(),
    ])
      .then(([res, perm]) => {
        if (!active) return
        setPreferences(res.preferences ?? [])
        setOsPermission(perm)
      })
      .catch((err) => {
        console.warn('[settings/notifications] Error al cargar preferencias:', err)
        Alert.alert('Error', 'No se pudieron cargar tus preferencias de notificación.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [attempt])

  const handleToggle = async (
    notificationType: string,
    field: 'pushEnabled' | 'inAppEnabled',
    currentValue: boolean
  ) => {
    const newValue = !currentValue
    const item = preferences.find((p) => p.notificationType === notificationType)
    if (!item) return

    const updatedPush = field === 'pushEnabled' ? newValue : item.pushEnabled
    const updatedInApp = field === 'inAppEnabled' ? newValue : item.inAppEnabled

    // Actualización optimista
    setPreferences((prev) =>
      prev.map((p) =>
        p.notificationType === notificationType
          ? {
              ...p,
              pushEnabled: updatedPush,
              inAppEnabled: updatedInApp,
              source: 'explicit',
              hasExplicitSetting: true,
            }
          : p
      )
    )

    setSavingKey(`${notificationType}_${field}`)
    try {
      await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          notificationType,
          pushEnabled: updatedPush,
          inAppEnabled: updatedInApp,
        }),
      })
    } catch (err) {
      console.warn('[settings/notifications] Error al guardar preferencia:', err)
      // Revertir si falló
      setPreferences((prev) =>
        prev.map((p) => (p.notificationType === notificationType ? item : p))
      )
      Alert.alert('Error', 'No se pudo guardar el cambio. Intentá nuevamente.')
    } finally {
      setSavingKey(null)
    }
  }

  // Agrupar por categoría
  const grouped = preferences.reduce<Record<string, PreferenceItem[]>>((acc, item) => {
    const cat = item.category || 'system'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Cabecera */}
      <View style={[styles.header, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Preferencias de Notificación
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner de Permiso del Sistema Operativo */}
        <View
          style={[
            styles.osBanner,
            {
              backgroundColor: osPermission === 'granted' ? palette.primary + '10' : '#FEF3C7',
              borderColor: osPermission === 'granted' ? palette.primary + '30' : '#F59E0B',
            },
          ]}>
          <Ionicons
            name={osPermission === 'granted' ? 'notifications-circle' : 'alert-circle'}
            size={24}
            color={osPermission === 'granted' ? palette.primary : '#D97706'}
          />
          <View style={styles.osBannerText}>
            <Text
              style={[
                styles.osBannerTitle,
                { color: osPermission === 'granted' ? colors.text : '#92400E' },
              ]}>
              {osPermission === 'granted'
                ? 'Notificaciones activadas en el teléfono'
                : 'Notificaciones desactivadas en el sistema'}
            </Text>
            <Text
              style={[
                styles.osBannerSubtitle,
                { color: osPermission === 'granted' ? colors.muted : '#B45309' },
              ]}>
              {osPermission === 'granted'
                ? 'Recibirás avisos push según las opciones que marques abajo.'
                : 'Para recibir alertas en tiempo real, habilitá los permisos del dispositivo.'}
            </Text>
          </View>

          {osPermission === 'denied' && (
            <Pressable
              onPress={() => Linking.openSettings()}
              accessibilityRole="button"
              accessibilityLabel="Abrir configuración del teléfono"
              style={[styles.settingsBtn, { backgroundColor: '#D97706' }]}>
              <Text style={styles.settingsBtnText}>Ajustes</Text>
            </Pressable>
          )}

          {osPermission === 'undetermined' && (
            <Pressable
              onPress={() => promptForPermission()}
              accessibilityRole="button"
              accessibilityLabel="Activar permisos"
              style={[styles.settingsBtn, { backgroundColor: palette.primary }]}>
              <Text style={styles.settingsBtnText}>Activar</Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : (
          Object.entries(grouped).map(([category, items]) => {
            const catInfo = CATEGORY_NAMES[category] ?? {
              label: category,
              icon: 'notifications-outline',
            }

            return (
              <View
                key={category}
                style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.categoryHeader, { borderColor: colors.border }]}>
                  <Ionicons name={catInfo.icon} size={20} color={palette.primary} />
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>{catInfo.label}</Text>
                </View>

                {items.map((item) => {
                  const isSaving = savingKey?.startsWith(item.notificationType)

                  return (
                    <View
                      key={item.notificationType}
                      style={[styles.itemRow, { borderColor: colors.border }]}>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.itemDesc, { color: colors.muted }]}>
                          {item.description}
                        </Text>
                      </View>

                      <View style={styles.toggles}>
                        {/* Toggle Push */}
                        <View style={styles.toggleCol}>
                          <Text style={[styles.toggleLabel, { color: colors.muted }]}>Push</Text>
                          <Switch
                            value={item.pushEnabled}
                            onValueChange={() =>
                              handleToggle(item.notificationType, 'pushEnabled', item.pushEnabled)
                            }
                            disabled={isSaving}
                            trackColor={{ false: colors.border, true: palette.primary }}
                          />
                        </View>

                        {/* Toggle In-App */}
                        <View style={styles.toggleCol}>
                          <Text style={[styles.toggleLabel, { color: colors.muted }]}>In-App</Text>
                          <Switch
                            value={item.inAppEnabled}
                            onValueChange={() =>
                              handleToggle(item.notificationType, 'inAppEnabled', item.inAppEnabled)
                            }
                            disabled={isSaving}
                            trackColor={{ false: colors.border, true: palette.primary }}
                          />
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  osBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  osBannerText: {
    flex: 1,
  },
  osBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  osBannerSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  settingsBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  settingsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  categoryCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  toggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleCol: {
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
})
