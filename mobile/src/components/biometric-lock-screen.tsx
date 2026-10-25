import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';

/**
 * Tapa la app mientras falta Face ID / huella. Va encima de la navegación, así
 * al desbloquear se vuelve a la misma pantalla en la que estaba la persona.
 */
export function BiometricLockScreen() {
  const { unlock, signOut, biometric } = useSession();
  const colors = usePalette();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const prompted = useRef(false);

  const tryUnlock = async () => {
    setBusy(true);
    setFailed(false);
    const ok = await unlock();
    setBusy(false);
    if (!ok) {
      setFailed(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  // Se pide solo al aparecer, una vez; si cancela, queda el botón.
  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    void tryUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const icon = biometric.label === 'Face ID' || biometric.label === 'reconocimiento facial' ? 'scan-outline' : 'finger-print-outline';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <View style={[styles.logo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image
              source={require('@/assets/images/branding/brand-icon.png')}
              style={styles.logoImage}
              contentFit="contain"
              accessibilityLabel="Logo de Mi tiendaPY.com"
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>App bloqueada</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {failed
              ? `No se pudo verificar. Probá de nuevo con ${biometric.label}.`
              : `Usá ${biometric.label} para entrar.`}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={tryUnlock}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Desbloquear con ${biometric.label}`}
            style={({ pressed }) => [styles.primary, { opacity: pressed || busy ? 0.8 : 1 }]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={icon} size={22} color="#fff" />
                <Text style={styles.primaryText}>Desbloquear con {biometric.label}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => void signOut()}
            disabled={busy}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: palette.primary }]}>Usar email y contraseña</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  logo: { width: 76, height: 76, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoImage: { width: 48, height: 48 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 15, textAlign: 'center' },
  actions: { gap: 12, paddingBottom: 16 },
  primary: {
    height: 54,
    borderRadius: 16,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { alignItems: 'center', paddingVertical: 10 },
  secondaryText: { fontSize: 15, fontWeight: '600' },
});
