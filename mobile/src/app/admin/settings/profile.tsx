import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SettingsGate } from '@/components/settings/settings-gate';
import { Notice, Section, StateView, WebsiteScreen, websiteStyles } from '@/components/website/website-ui';
import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { fetchBusinessProfile, settingsErrorMessage } from '@/lib/settings-admin';
import { MODEL_LABELS, MODULE_LABELS, VERTICAL_LABELS, type BusinessProfile } from '@/lib/settings-model';

export default function BusinessProfileScreen() {
  return <SettingsGate title="Perfil del negocio">{() => <ProfileView />}</SettingsGate>;
}

function ProfileView() {
  const colors = usePalette();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchBusinessProfile()
      .then((next) => {
        if (!alive) return;
        setProfile(next);
        setError(null);
      })
      .catch((cause) => {
        if (alive) setError(settingsErrorMessage(cause, 'No pudimos cargar el perfil del negocio.'));
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  if (!profile) {
    return (
      <WebsiteScreen title="Perfil del negocio">
        {error ? <StateView icon="alert-circle-outline" title="No pudimos cargar el perfil" text={error} action="Reintentar" onAction={reload} /> : <StateView loading title="Cargando el perfil…" />}
      </WebsiteScreen>
    );
  }

  return (
    <WebsiteScreen title="Perfil del negocio" subtitle="Qué herramientas usa tu comercio">
      <Section title="Tu negocio" icon="briefcase-outline">
        <Row label="Rubro" value={VERTICAL_LABELS[profile.businessVertical] ?? profile.businessVertical} />
        <Row label="Forma de trabajo" value={MODEL_LABELS[profile.operatingModel] ?? profile.operatingModel} />
      </Section>

      <Section title="Herramientas activas" icon="apps-outline" hint="Las que tenés prendidas y entran en tu plan.">
        {profile.effectiveModules.length === 0 ? (
          <Text style={[styles.muted, { color: colors.muted }]}>No hay herramientas activas.</Text>
        ) : (
          <View style={styles.modules}>
            {profile.effectiveModules.map((module) => (
              <View key={module} style={[styles.module, { borderColor: colors.border }]}>
                <Ionicons name="checkmark-circle" size={15} color={palette.success} />
                <Text style={[styles.moduleText, { color: colors.text }]}>{MODULE_LABELS[module] ?? module}</Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Notice text="Cambiar el rubro o las herramientas prende y apaga secciones para todo el equipo y depende de tu plan, así que por ahora se hace desde la web." />
      <Pressable onPress={() => void openWeb('/admin/settings')} accessibilityRole="button" style={[websiteStyles.secondaryButton, { borderColor: colors.border }]}>
        <Ionicons name="open-outline" size={17} color={colors.text} />
        <Text style={[websiteStyles.secondaryText, { color: colors.text }]}>Cambiar desde la web</Text>
      </Pressable>
    </WebsiteScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.muted, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  muted: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  modules: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  module: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  moduleText: { fontSize: 12, fontWeight: '700' },
});
