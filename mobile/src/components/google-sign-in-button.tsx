import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';

/**
 * «Continuar con Google»: entra o crea la cuenta en un paso. Al guardar la
 * sesión, el layout cierra el login solo. `onDone` corre cuando entró.
 */
export function GoogleSignInButton({
  label = 'Continuar con Google',
  disabled,
  onError,
  onDone,
}: {
  label?: string;
  disabled?: boolean;
  onError: (message: string | null) => void;
  onDone?: () => void;
}) {
  const { signInWithGoogle } = useSession();
  const colors = usePalette();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const press = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    onError(null);
    try {
      const result = await signInWithGoogle();
      if (result === 'cancelled') return;
      if (result) {
        onError(result);
        AccessibilityInfo.announceForAccessibility(result);
        return;
      }
      onDone?.();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={() => void press()}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: off ? 0.6 : pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.row}>
        {busy ? <ActivityIndicator size="small" /> : <Ionicons name="logo-google" size={18} color="#4285F4" />}
        <Text style={[styles.text, { color: colors.text }]}>{busy ? 'Abriendo Google…' : label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 16, fontWeight: '700' },
});
