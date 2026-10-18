import { Ionicons } from '@expo/vector-icons';
import { useState, type PropsWithChildren } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import { useSaas } from '@/lib/saas';

export function useSaasAccent() {
  return useColorScheme() === 'dark' ? '#60A5FA' : palette.primary;
}

export function SaasPage({ children }: PropsWithChildren) {
  const colors = usePalette();
  const { loading, refresh } = useSaas();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.page}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.text} />}>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

export function SaasHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const colors = usePalette();
  const accent = useSaasAccent();
  return <View style={styles.heading}>
    <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
    <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
  </View>;
}

export function SaasButton({ label, onPress, secondary = false, disabled = false, icon }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = usePalette();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.card : palette.primary, borderColor: secondary ? colors.border : palette.primary, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}>
    {icon && <Ionicons name={icon} color={secondary ? colors.text : '#FFFFFF'} size={20} />}
    <Text style={[styles.buttonLabel, { color: secondary ? colors.text : '#FFFFFF' }]}>{label}</Text>
  </Pressable>;
}

export function SaasCard({ children }: PropsWithChildren) {
  const colors = usePalette();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>;
}

export function SaasFeature({ icon, title, description }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string }) {
  const colors = usePalette();
  const accent = useSaasAccent();
  return <SaasCard>
    <View style={styles.featureHeader}>
      <View style={[styles.icon, { backgroundColor: `${accent}12` }]}><Ionicons name={icon} color={accent} size={23} /></View>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
    </View>
    <Text style={[styles.body, { color: colors.muted }]}>{description}</Text>
  </SaasCard>;
}

export function SaasFaq({ question, answer }: { question: string; answer: string }) {
  const colors = usePalette();
  const [expanded, setExpanded] = useState(false);
  return <View style={[styles.faq, { borderColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.faqButton}>
      <Text style={[styles.faqQuestion, { color: colors.text }]}>{question}</Text>
      <Ionicons name={expanded ? 'remove' : 'add'} size={22} color={colors.muted} />
    </Pressable>
    {expanded && <Text style={[styles.faqAnswer, { color: colors.muted }]}>{answer}</Text>}
  </View>;
}

export const saasStyles = StyleSheet.create({
  sectionTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', marginTop: 12 },
  body: { fontSize: 15, lineHeight: 23 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stack: { gap: 14 },
  note: { fontSize: 13, lineHeight: 20 },
});

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 20 },
  heading: { gap: 12, marginBottom: 4 },
  eyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -0.8 },
  description: { fontSize: 16, lineHeight: 25 },
  button: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonLabel: { fontSize: 15, lineHeight: 21, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  featureHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 23 },
  faq: { borderBottomWidth: 1 },
  faqButton: { minHeight: 52, paddingVertical: 14, flexDirection: 'row', gap: 16, alignItems: 'center' },
  faqQuestion: { flex: 1, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  faqAnswer: { fontSize: 15, lineHeight: 23, paddingBottom: 18 },
});
