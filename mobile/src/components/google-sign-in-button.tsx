import { useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';
import { setPostAuthRoute, type PostAuthRoute } from '@/lib/post-auth-route';

/**
 * «Continuar con Google»: entra o crea la cuenta en un paso. Al guardar la
 * sesión, el layout cierra el login solo. `onDone` corre cuando entró.
 */
export function GoogleSignInButton({
  label = 'Continuar con Google',
  disabled,
  onError,
  onDone,
  afterSignIn,
  hint,
}: {
  label?: string;
  /** Texto chico debajo del botón (p. ej. «Sin contraseña»). */
  hint?: string;
  disabled?: boolean;
  onError: (message: string | null) => void;
  onDone?: () => void;
  /** Pantalla a abrir con la sesión ya iniciada (la abre el layout, no esta pantalla). */
  afterSignIn?: PostAuthRoute;
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
    // Antes de guardar la sesión: el layout lo lee en cuanto la ve.
    setPostAuthRoute(afterSignIn ?? null);
    try {
      const result = await signInWithGoogle();
      if (result === 'cancelled') { setPostAuthRoute(null); return; }
      if (result) {
        setPostAuthRoute(null);
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
        {busy ? <ActivityIndicator size="small" /> : <Ionicons name="logo-google" size={20} color="#4285F4" />}
        <Text style={[styles.text, { color: colors.text }]}>{busy ? 'Abriendo Google…' : label}</Text>
      </View>
      {hint && !busy ? <Text style={[styles.hint, { color: colors.muted }]}>{hint}</Text> : null}
    </Pressable>
  );
}

/** Separador «o con tu correo» entre Google y el formulario. */
export function AuthDivider({ text = 'o con tu correo' }: { text?: string }) {
  const colors = usePalette();
  return (
    <View style={styles.divider} accessibilityRole="text">
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      <Text style={[styles.dividerText, { color: colors.muted }]}>{text}</Text>
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8,
    shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  hint: { fontSize: 12, marginTop: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 16, fontWeight: '700' },
});
