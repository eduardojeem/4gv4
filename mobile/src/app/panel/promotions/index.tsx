import { useEffect, useState } from 'react'
import { ScrollView, Text, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { PanelAccessState } from '@/components/panel-access-state'
import { usePanel } from '@/lib/panel'
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context'
import { DiscountTab } from '@/components/promotions/discounts'
import { LoyaltyTab } from '@/components/promotions/loyalty'
import { CustomersTab } from '@/components/promotions/customers'
import { RafflesTab } from '@/components/promotions/raffles'
import { usePromotionColors } from '@/components/promotions/ui'
type Tab = 'discounts' | 'loyalty' | 'customers' | 'raffles'
const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'discounts', label: 'Descuentos', icon: 'pricetags-outline' },
  { id: 'loyalty', label: 'Fidelización', icon: 'heart-outline' },
  { id: 'customers', label: 'Clientes', icon: 'people-outline' },
  { id: 'raffles', label: 'Sorteos', icon: 'gift-outline' },
]
export default function PromotionsScreen() {
  const { data, findItem, loading } = usePanel()
  const [scope, setScope] = useState(getPrivateCacheContext)
  useEffect(() => subscribePrivateCacheContext((next) => setScope(next)), [])
  if (
    loading ||
    !data ||
    !findItem('promotions') ||
    (scope.organizationId && scope.organizationId !== data.organization.id)
  )
    return <PanelAccessState />
  return (
    <PromotionWorkspace
      key={JSON.stringify([
        scope.userId,
        scope.organizationId,
        scope.branchId,
        scope.permissionFingerprint,
        scope.access,
      ])}
    />
  )
}
function PromotionWorkspace() {
  const { width } = useWindowDimensions()
  const colors = usePromotionColors()
  const params = useLocalSearchParams<{ tab?: string; section?: string }>()
  const initial: Tab =
    params.section === 'sorteos'
      ? 'raffles'
      : params.section === 'clientes' || params.section === 'resumen'
        ? 'customers'
        : params.tab === 'puntos'
          ? 'loyalty'
          : 'discounts'
  const [tab, setTab] = useState<Tab>(initial)
  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          Promociones
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
          Descuentos claros y beneficios para que tus clientes vuelvan.
        </Text>
        <View style={styles.tabs}>
          {tabs.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.id }}
              onPress={() => setTab(item.id)}
              style={[
                styles.tab,
                {
                  flexBasis: width >= 600 ? '22%' : '45%',
                  backgroundColor: tab === item.id ? colors.brand : colors.card,
                  borderColor: tab === item.id ? colors.brand : colors.border,
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={17}
                color={tab === item.id ? colors.ink : colors.muted}
              />
              <Text
                style={{
                  color: tab === item.id ? colors.ink : colors.text,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        key={tab}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
      >
        {tab === 'discounts' ? (
          <DiscountTab />
        ) : tab === 'loyalty' ? (
          <LoyaltyTab />
        ) : tab === 'customers' ? (
          <CustomersTab />
        ) : (
          <RafflesTab />
        )}
      </ScrollView>
    </View>
  )
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 14, borderBottomWidth: 1, gap: 5 },
  title: { fontSize: 24, fontWeight: '800' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  tab: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
})
