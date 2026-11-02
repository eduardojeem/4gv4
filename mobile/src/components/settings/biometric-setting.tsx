import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';

/**
 * Interruptor de huella / Face ID para este teléfono. Es una preferencia del
 * dispositivo (no del comercio): se guarda en el teléfono y se apaga al cerrar
 * sesión. Al activarlo pide la huella o la cara una vez para confirmar.
 */
export function BiometricSettingCard() {
  const colors = usePalette();
  const { biometric, setBiometricEnabled } = useSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (next: boolean) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const ok = await setBiometricEnabled(next);
    setSaving(false);
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else {
      setError(next
        ? `No se pudo activar ${biometric.label}. Revisá que esté configurado en el teléfono y probá de nuevo.`
        : `No se pudo desactivar ${biometric.label}. Probá de nuevo.`);
    }
  };

  const hint = !biometric.available
    ? 'Configurá la huella o el reconocimiento facial en los ajustes del teléfono para usarlo acá.'
    : biometric.enabled
      ? `Activado: la app pide ${biometric.label} al abrirse.`
      : `Desbloqueá la app con ${biometric.label}, sin escribir la contraseña.`;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${palette.primary}18` }]}>
          <Ionicons name={biometric.label === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} size={20} color={palette.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>Entrar con {biometric.label}</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text>
        </View>
        <Switch
          value={biometric.enabled}
          disabled={saving || !biometric.available}
          onValueChange={(next) => void toggle(next)}
          trackColor={{ true: palette.primary, false: colors.border }}
          accessibilityLabel={`Entrar con ${biometric.label}`}
          accessibilityHint="Se aplica solo en este teléfono"
        />
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.hint, { color: palette.danger }]}>{error}</Text> : null}
      <Text style={[styles.foot, { color: colors.muted }]}>Solo para este teléfono. Se desactiva si cerrás sesión.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 12, lineHeight: 17 },
  foot: { fontSize: 11 },
});
