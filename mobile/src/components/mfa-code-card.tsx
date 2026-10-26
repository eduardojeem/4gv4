import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { normalizeTotpCode } from '@/lib/mfa-model';
import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';

type MfaCodeCardProps = {
  /** El código fue correcto: la sesión ya es aal2 y el panel se abre solo. */
  onVerified?: () => void;
};

/**
 * Segundo paso del ingreso cuando la cuenta tiene 2FA: el código de 6 dígitos
 * de la app autenticadora. Se verifica solo al completar los dígitos.
 */
export function MfaCodeCard({ onVerified }: MfaCodeCardProps) {
  const { verifyMfa, signOut } = useSession();
  const colors = usePalette();
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSubmitted = useRef<string | null>(null);

  const submit = async (value = code) => {
    if (value.length !== 6 || busy) return;
    lastSubmitted.current = value;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    const message = await verifyMfa(value);
    if (message) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(message);
      setCode('');
      AccessibilityInfo.announceForAccessibility(message);
      setBusy(false);
      inputRef.current?.focus();
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onVerified?.();
  };

  useEffect(() => {
    if (code.length === 6 && lastSubmitted.current !== code) void submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={22} color={palette.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Verificación en dos pasos</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          Escribí el código de 6 dígitos que muestra tu app autenticadora.
        </Text>
      </View>

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(text) => {
          setCode(normalizeTotpCode(text));
          if (error) setError(null);
        }}
        accessibilityLabel="Código de verificación"
        placeholder="000000"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={7}
        autoFocus
        editable={!busy}
        style={[styles.input, { color: colors.text, borderColor: error ? palette.danger : colors.border }]}
      />

      {error && (
        <View accessibilityRole="alert" style={styles.errorRow}>
          <Ionicons name="alert-circle" size={18} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        onPress={() => void submit()}
        disabled={busy || code.length !== 6}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || code.length !== 6, busy }}
        style={({ pressed }) => [styles.primary, { opacity: busy || code.length !== 6 ? 0.6 : pressed ? 0.88 : 1 }]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Verificar</Text>}
      </Pressable>

      <Pressable onPress={() => void signOut()} disabled={busy} accessibilityRole="button" hitSlop={8} style={styles.secondary}>
        <Text style={[styles.secondaryText, { color: palette.primary }]}>Usar otra cuenta</Text>
      </Pressable>

      <Text style={[styles.help, { color: colors.muted }]}>
        ¿Perdiste el teléfono? Pedile al soporte de la plataforma que desactive la verificación en dos pasos de tu cuenta.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 16 },
  header: { alignItems: 'center', gap: 6 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  input: {
    height: 58,
    borderWidth: 1.5,
    borderRadius: 15,
    textAlign: 'center',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 10,
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { flex: 1, color: palette.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  primary: {
    height: 52,
    borderRadius: 15,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 4 },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  help: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
