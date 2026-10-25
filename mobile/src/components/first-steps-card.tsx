import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { apiFetch } from '@/lib/api';
import { buildOnboardingSteps, doneCount, hiddenKey, nextStep, shouldShowFirstSteps, toOnboardingProgress, type OnboardingStep } from '@/lib/onboarding-model';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

type Loaded = { organizationId: string; steps: OnboardingStep[]; hidden: boolean };

/**
 * «Primeros pasos» para el dueño o administrador de un comercio nuevo: los
 * mismos pasos que el onboarding de la web, cada uno con su pantalla en la app.
 * Se vuelve a pedir cada vez que se vuelve al panel, así un paso hecho se marca.
 */
export function FirstStepsCard() {
  const colors = usePalette();
  const { data: panel } = usePanel();
  const organizationId = panel?.organization.id ?? null;
  const role = panel?.organization.role ?? null;
  const canConfigure = Boolean(panel?.user.isSuperAdmin || role === 'owner' || role === 'admin');
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!organizationId || !canConfigure) return undefined;
      let alive = true;
      (async () => {
        const hidden = await SecureStore.getItemAsync(hiddenKey(organizationId)).then((value) => value === '1').catch(() => false);
        const res = await apiFetch<{ data?: Record<string, unknown> }>('/api/mobile/onboarding');
        if (alive) setLoaded({ organizationId, steps: buildOnboardingSteps(toOnboardingProgress(res.data)), hidden });
      })().catch(() => {
        // Sin los primeros pasos el panel sigue igual: no es un error para mostrar.
      });
      return () => {
        alive = false;
      };
    }, [organizationId, canConfigure]),
  );

  // Lo cargado es de un comercio: si se cambió de comercio, no se muestra.
  const current = loaded && loaded.organizationId === organizationId ? loaded : null;
  if (!canConfigure || !current || !shouldShowFirstSteps(current.steps, current.hidden)) return null;

  const done = doneCount(current.steps);
  const total = current.steps.length;
  const next = nextStep(current.steps);

  const hide = () => {
    setLoaded({ ...current, hidden: true });
    void SecureStore.setItemAsync(hiddenKey(current.organizationId), '1').catch(() => undefined);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel={`Primeros pasos: ${done} de ${total} listos`}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>Primeros pasos</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>{done} de {total} listos · dejá tu comercio listo para vender</Text>
        </View>
        <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ocultar primeros pasos">
          <Text style={[styles.hide, { color: colors.muted }]}>Ocultar</Text>
        </Pressable>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${Math.round((done / total) * 100)}%` }]} />
      </View>
      {current.steps.map((step) => (
        <Pressable key={step.key} onPress={() => router.push(step.route as never)} accessibilityRole="button"
          accessibilityLabel={`${step.title}, ${step.done ? 'listo' : 'pendiente'}. ${step.hint}`}
          style={({ pressed }) => [styles.step, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
          <View style={[styles.icon, { backgroundColor: step.done ? `${palette.success}18` : step === next ? `${palette.primary}14` : colors.background }]}>
            <Ionicons name={step.done ? 'checkmark' : step.icon} size={18} color={step.done ? palette.success : step === next ? palette.primary : colors.muted} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.stepTitle, { color: colors.text }, step.done && styles.doneTitle]}>{step.title}</Text>
            <Text style={[styles.muted, { color: colors.muted }]}>{step.hint}</Text>
          </View>
          {!step.done ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 16, fontWeight: '800' },
  muted: { fontSize: 12 },
  hide: { fontSize: 13, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.success },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 14, fontWeight: '800' },
  doneTitle: { textDecorationLine: 'line-through', opacity: 0.7 },
});
