import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { usePanel } from '@/lib/panel';
import { usePalette } from '@/lib/palette';

export function SubscriptionExpiryBanner() {
  const { data } = usePanel();
  const colors = usePalette();
  const notice = data?.subscriptionNotice;
  const allowed = data?.user.isSuperAdmin || ['owner', 'admin'].includes(data?.organization.role ?? '');
  if (!notice || !allowed) return null;
  const accent = notice.tone === 'danger' ? '#DC2626' : '#D97706';
  return <Pressable accessibilityRole="button" accessibilityLabel={notice.title + '. Fecha: ' + notice.dateLabel + '. Ver suscripción'} onPress={() => router.push('/admin/subscriptions' as never)} style={({ pressed }) => ({ backgroundColor: colors.card, borderColor: accent, borderWidth: 1, borderRadius: 18, padding: 16, gap: 10, opacity: pressed ? .7 : 1 })}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Ionicons name="time-outline" size={23} color={accent} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' }}>{notice.title}</Text>
    </View>
    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>Fecha: {notice.dateLabel}. Revisá el estado de tu suscripción.</Text>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Text style={{ color: colors.text, fontWeight: '700' }}>Ver suscripción</Text><Ionicons name="chevron-forward" size={16} color={colors.text} /></View>
  </Pressable>;
}
