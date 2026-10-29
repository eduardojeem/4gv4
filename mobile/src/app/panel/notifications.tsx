import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiFetch } from '@/lib/api'
import { usePalette, palette } from '@/lib/palette'
import { resolveNotificationRoute } from '@/lib/push-notifications'
import { useNotifications } from '@/lib/notifications-context'

interface NotificationItem {
  id: string
  organizationId: string
  branchId: string | null
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  resourceType: string | null
  resourceId: string | null
  readAt: string | null
  createdAt: string
}

interface NotificationsFeedResponse {
  items: NotificationItem[]
  nextCursor: string | null
}

export default function NotificationsScreen() {
  const colors = usePalette()
  const { refreshUnreadCount } = useNotifications()

  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [attempt, setAttempt] = useState<number>(0)

  useEffect(() => {
    let active = true

    const query = new URLSearchParams({ limit: '20' })
    apiFetch<NotificationsFeedResponse>(`/api/notifications?${query.toString()}`)
      .then((res) => {
        if (!active) return
        setItems(res.items ?? [])
        setNextCursor(res.nextCursor ?? null)
      })
      .catch((err) => {
        console.warn('[notifications] Error al cargar el feed:', err)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
          setRefreshing(false)
        }
      })

    return () => {
      active = false
    }
  }, [attempt])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setAttempt((v) => v + 1)
  }, [])

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return

    setLoadingMore(true)
    try {
      const query = new URLSearchParams({ limit: '20', cursor: nextCursor })
      const res = await apiFetch<NotificationsFeedResponse>(`/api/notifications?${query.toString()}`)

      setItems((prev) => [...prev, ...(res.items ?? [])])
      setNextCursor(res.nextCursor ?? null)
    } catch (err) {
      console.warn('[notifications] Error al cargar más notificaciones:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    // Actualización optimista
    setItems((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item
      )
    )

    try {
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ notificationId }),
      })
      await refreshUnreadCount()
    } catch (err) {
      console.warn('[notifications] Error al marcar leída:', err)
    }
  }

  const markAllAsRead = async () => {
    // Actualización optimista
    const now = new Date().toISOString()
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })))

    try {
      await apiFetch('/api/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ all: true }),
      })
      await refreshUnreadCount()
    } catch (err) {
      console.warn('[notifications] Error al marcar todas como leídas:', err)
    }
  }

  const handlePressItem = async (item: NotificationItem) => {
    if (!item.readAt) {
      await markAsRead(item.id)
    }

    const route = resolveNotificationRoute({
      type: item.type,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
    })

    if (route && route !== '/panel/notifications') {
      router.push(route as any)
    }
  }

  const renderIcon = (type: string) => {
    if (type.startsWith('SALE_')) return 'cash-outline'
    if (type.startsWith('REPAIR_')) return 'build-outline'
    if (type.startsWith('BOOKING_')) return 'calendar-outline'
    if (type.startsWith('ORDER_')) return 'cart-outline'
    if (type.includes('STOCK')) return 'cube-outline'
    if (type.startsWith('CASH_')) return 'wallet-outline'
    if (type.startsWith('CREDIT_')) return 'card-outline'
    return 'notifications-outline'
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Barra de título con botón Volver y Marcar todas */}
      <View style={[styles.header, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>Notificaciones</Text>

        <Pressable
          onPress={markAllAsRead}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Marcar todas como leídas"
          style={styles.markAllBtn}>
          <Text style={[styles.markAllText, { color: palette.primary }]}>Marcar leídas</Text>
        </Pressable>
      </View>

      {/* Lista del Feed */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin notificaciones</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Acá vas a ver las alertas de ventas, reparaciones y pedidos de tu comercio.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={palette.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isUnread = !item.readAt
            return (
              <Pressable
                onPress={() => handlePressItem(item)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: colors.border,
                    backgroundColor: isUnread
                      ? colors.card
                      : pressed
                      ? colors.border + '30'
                      : 'transparent',
                  },
                ]}>
                <View
                  style={[
                    styles.itemIconCircle,
                    {
                      backgroundColor: isUnread ? palette.primary + '18' : colors.border + '60',
                    },
                  ]}>
                  <Ionicons
                    name={renderIcon(item.type)}
                    size={20}
                    color={isUnread ? palette.primary : colors.muted}
                  />
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.itemTitle,
                        { color: colors.text, fontWeight: isUnread ? '700' : '500' },
                      ]}>
                      {item.title}
                    </Text>
                    {isUnread && (
                      <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} />
                    )}
                  </View>

                  <Text
                    numberOfLines={2}
                    style={[styles.itemBody, { color: isUnread ? colors.text : colors.muted }]}>
                    {item.body}
                  </Text>

                  <Text style={[styles.itemDate, { color: colors.muted }]}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    ·{' '}
                    {new Date(item.createdAt).toLocaleDateString([], {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </Pressable>
            )
          }}
        />
      )}
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
  markAllBtn: {
    padding: 4,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  item: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
  },
  itemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  itemBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  itemDate: {
    fontSize: 11,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
})
