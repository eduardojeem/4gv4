import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationColor, navigationInk, colorLuminance } from '@/lib/bottom-nav-model';
import { usePalette } from '@/lib/palette';

export type NavigationItem = { key: string; label: string; accessibilityLabel?: string; icon: keyof typeof Ionicons.glyphMap; active?: boolean; onPress: () => void; action?: boolean };
export function PremiumBottomNav({ items, brand }: { items: NavigationItem[]; brand?: string }) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  const accent = navigationColor(brand);
  const surfaceIsDark = colorLuminance(colors.card) < .2;
  const readable = (Math.max(colorLuminance(accent), colorLuminance(colors.card)) + .05) / (Math.min(colorLuminance(accent), colorLuminance(colors.card)) + .05) >= 4.5 ? accent : colors.text;
  return <View style={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: colors.background }}>
    <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.border, shadowOpacity: surfaceIsDark ? .24 : .08 }]}>
      {items.map(item => <NavigationButton key={item.key} item={item} accent={accent} ink={navigationInk(accent)} readable={readable} />)}
    </View>
  </View>;
}
function NavigationButton({ item, accent, ink, readable }: { item: NavigationItem; accent: string; ink: string; readable: string }) {
  const colors = usePalette();
  const [progress] = useState(() => new Animated.Value(item.active ? 1 : 0));
  useEffect(() => { Animated.spring(progress, { toValue: item.active ? 1 : 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start(); }, [item.active, progress]);
  return <Pressable accessibilityRole={item.action ? 'button' : 'tab'} accessibilityState={item.action ? undefined : { selected: !!item.active }} accessibilityLabel={item.accessibilityLabel ?? item.label} onPress={() => { void Haptics.selectionAsync().catch(() => undefined); item.onPress(); }} style={({ pressed }) => [styles.item, { opacity: pressed ? .65 : 1 }]}>
    <View style={[styles.icon, item.action && [styles.action, { backgroundColor: accent, borderColor: colors.card }]]}>
      {!item.action && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.indicator, { backgroundColor: accent, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, .16] }), transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [.5, 1] }) }] }]} />}
      <Ionicons name={item.active ? item.icon.replace('-outline', '') as typeof item.icon : item.icon} size={item.action ? 27 : 22} color={item.action ? ink : item.active ? colors.text : colors.muted} />
    </View>
    <Text numberOfLines={1} style={[styles.label, { color: item.active ? readable : colors.muted, fontWeight: item.active || item.action ? '700' : '500' }]}>{item.label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, minHeight: 76, paddingHorizontal: 4, shadowColor: '#000', shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 11, minHeight: 76, gap: 5 },
  icon: { width: 46, height: 30, alignItems: 'center', justifyContent: 'center' },
  indicator: { borderRadius: 15 },
  action: { width: 58, height: 58, borderRadius: 22, borderWidth: 4, marginTop: -18, marginBottom: 0 },
  label: { fontSize: 10, paddingHorizontal: 1 },
});
