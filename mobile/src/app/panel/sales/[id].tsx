import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { apiFetch } from '@/lib/api'
import { usePalette } from '@/lib/palette'
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context'
type Sale = { id: string; code?: string; total_amount?: number; total?: number; payment_method?: string; status?: string; created_at: string; sale_items?: { id: string; quantity: number; unit_price: number; product?: { name?: string } }[] }
const money = (value: number) => 'Gs. ' + value.toLocaleString('es-PY')
export default function NotificationSaleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const colors = usePalette()
  const [sale, setSale] = useState<Sale | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => subscribePrivateCacheContext(() => { setSale(null); setAttempt(v => v + 1) }), [])
  useEffect(() => {
    let active = true
    const scope = getPrivateCacheContext()
    queueMicrotask(() => { if (active) setLoading(true) })
    apiFetch<{ data: { sales: Sale[] } }>('/api/sales?id=' + encodeURIComponent(id) + '&per_page=1').then(result => {
      if (!active || scope.epoch !== getPrivateCacheContext().epoch) return
      const found = result.data.sales.find(row => row.id === id)
      setSale(found ?? null); setError(found ? null : 'No encontramos esta venta en tu negocio.')
    }).catch(() => { if (active) setError('No pudimos abrir la venta. Revisá tu conexión y tu permiso para consultar ventas.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, attempt])
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Detalle de venta</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Cargando venta" /> : error ? <View accessibilityRole="alert"><Text style={{ color: colors.text }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(v => v + 1)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.text }}>Reintentar</Text></Pressable></View> : sale && <>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Venta #{sale.code ?? sale.id.slice(0, 8)}</Text>
      <Text style={{ color: colors.muted }}>{new Date(sale.created_at).toLocaleString('es-PY')}</Text>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{money(Number(sale.total_amount ?? sale.total ?? 0))}</Text>
      <Text style={{ color: colors.text }}>Medio de pago: {sale.payment_method ?? 'Sin información'}</Text>
      {sale.sale_items?.map(item => <View key={item.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text }}>{item.product?.name ?? 'Producto'} × {item.quantity}</Text><Text style={{ color: colors.muted }}>{money(item.unit_price * item.quantity)}</Text></View>)}
    </>}
  </ScrollView>
}
