import { MarketplacePlanCarousel } from './marketplace-plan-carousel';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { palette, usePalette } from '../lib/palette';
import { BUSINESS_PROMO_PROFILES, type BusinessPromoIcon } from '../../../src/lib/public/marketplace-business-promo';
const ICONS: Record<BusinessPromoIcon, keyof typeof Ionicons.glyphMap> = { sales: 'card-outline', stock: 'layers-outline', catalog: 'globe-outline', repair: 'construct-outline', warranty: 'shield-checkmark-outline', calendar: 'calendar-outline', customers: 'people-outline' };
export function MarketplaceBusinessPromo({ onPlans, onSystem }: { onPlans(): void; onSystem(): void }) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [selected, setSelected] = useState(0);
  const profile = BUSINESS_PROMO_PROFILES[selected];
  return <View style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={[styles.content, wide && styles.wide]}>
      <View style={[styles.intro, wide && styles.column]}>
        <View style={[styles.eyebrow, { backgroundColor: palette.primary + '0C', borderColor: palette.primary + '30' }]}><Ionicons name="storefront-outline" size={14} color={colors.text}/><Text style={[styles.eyebrowText, { color: colors.text }]}>Para tu negocio</Text></View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Tu negocio,<Text style={{ color: colors.muted }}>{' '}en un solo lugar.</Text></Text>
        <Text style={[styles.note, { color: colors.muted }]}>Gestión desde la app y la web.</Text>
      </View>
      <View style={[styles.details, { backgroundColor: colors.background, borderColor: colors.border }, wide && styles.column]}>
        <View accessibilityRole="tablist" accessibilityLabel="Tipo de negocio" style={[styles.tabs, { borderColor: colors.border }]}>{BUSINESS_PROMO_PROFILES.map((item, index) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: selected === index }} onPress={() => setSelected(index)} style={({ pressed }) => [styles.tab, { backgroundColor: selected === index ? colors.card : 'transparent', borderColor: selected === index ? colors.border : 'transparent', opacity: pressed ? .7 : 1 }]}><Text style={[styles.tabText, { color: selected === index ? colors.text : colors.muted }]}>{item.label}</Text></Pressable>)}</View>
        <View style={styles.profile} accessibilityLiveRegion="polite">{wide && <Text accessibilityRole="header" style={[styles.profileTitle, { color: colors.text }]}>{profile.title}</Text>}<Text style={[styles.description, { color: colors.muted }]}>{profile.description}</Text></View>
        <View>{profile.benefits.map((benefit, index) => <View key={benefit.title} style={[styles.benefit, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}><View style={[styles.icon, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name={ICONS[benefit.icon]} size={20} color={colors.text}/></View><View style={styles.flex}><Text style={[styles.benefitTitle, { color: colors.text }]}>{benefit.title}</Text><Text style={[styles.benefitDescription, { color: colors.muted }]}>{benefit.description}</Text></View><Ionicons name="checkmark" size={16} color={colors.muted}/></View>)}</View>
      </View>
    </View>
    <View style={[styles.footer, { borderColor: colors.border }]}>
      <View style={[styles.actions, wide && styles.actionsWide]}><Pressable accessibilityRole="button" onPress={onPlans} style={({ pressed }) => [styles.button, { backgroundColor: palette.primary, opacity: pressed ? .8 : 1 }]}><Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Ver planes</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF"/></Pressable><Pressable accessibilityRole="button" onPress={onSystem} style={({ pressed }) => [styles.button, { borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.background : colors.card }]}><Text style={[styles.buttonText, { color: colors.text }]}>Ver funciones</Text></Pressable></View>
      <Text style={[styles.note, { color: colors.muted }]}>Las funciones y los límites dependen del plan.</Text>
    </View>
    <MarketplacePlanCarousel/>
  </View>;
}
const styles = StyleSheet.create({
  root: { marginTop: 28, marginHorizontal: 16, borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  content: { flexDirection: 'column' }, wide: { flexDirection: 'row' }, column: { flex: 1 }, flex: { flex: 1, minWidth: 0 },
  intro: { padding: 20, gap: 12 }, eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 }, eyebrowText: { fontSize: 11, fontWeight: '700' }, title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -.7 }, description: { fontSize: 13, lineHeight: 20 }, platform: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  details: { padding: 18, borderTopWidth: StyleSheet.hairlineWidth }, tabs: { flexDirection: 'row', gap: 3, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 }, tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 8, borderRadius: 9, borderWidth: 1 }, tabText: { fontSize: 12, fontWeight: '700' }, profile: { marginTop: 20, marginBottom: 6, gap: 6 }, profileTitle: { fontSize: 17, lineHeight: 23, fontWeight: '800', letterSpacing: -.2 }, benefit: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 }, icon: { width: 38, height: 38, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' }, benefitTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700' }, benefitDescription: { fontSize: 11, lineHeight: 17, marginTop: 3 },
  footer: { padding: 18, gap: 12, borderTopWidth: StyleSheet.hairlineWidth }, actions: { gap: 8, flexDirection: 'row' }, actionsWide: { flexDirection: 'row' }, button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, flex: 1 }, buttonText: { fontSize: 13, fontWeight: '700', textAlign: 'center', flexShrink: 1 }, note: { fontSize: 11, lineHeight: 17 },
});
