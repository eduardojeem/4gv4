import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

import { apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';

type Kind = 'bug' | 'idea' | 'praise';

const KINDS: { value: Kind; label: string; icon: keyof typeof Ionicons.glyphMap; placeholder: string }[] = [
  { value: 'bug', label: 'Un error', icon: 'bug-outline', placeholder: '¿Qué pasó y qué esperabas que pase?' },
  { value: 'idea', label: 'Una idea', icon: 'bulb-outline', placeholder: '¿Qué te gustaría que haga la app?' },
  { value: 'praise', label: 'Funciona bien', icon: 'thumbs-up-outline', placeholder: '¿Qué es lo que más te sirve?' },
];

/** «Enviar comentarios» del menú del avatar: misma API que el botón del header de la web. */
export default function FeedbackScreen() {
  const colors = usePalette();
  const isDark = useColorScheme() === 'dark';
  const sending = useRef(false);

  const [kind, setKind] = useState<Kind>('bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = message.trim().length >= 3 && !busy;
  const current = KINDS.find((item) => item.value === kind)!;

  const submit = async () => {
    Keyboard.dismiss();
    if (!canSubmit || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ kind, message, source: 'app', appVersion: Constants.expoConfig?.version }),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      AccessibilityInfo.announceForAccessibility('Comentario enviado. Gracias.');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'No se pudo enviar el comentario. Probá de nuevo.';
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(text);
      AccessibilityInfo.announceForAccessibility(text);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/panel' as never));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={10} style={styles.back}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
              <Text style={[styles.backText, { color: colors.text }]}>Volver</Text>
            </Pressable>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.iconCircle}>
                <Ionicons name={sent ? 'checkmark-circle-outline' : 'chatbox-ellipses-outline'} size={26} color={palette.primary} />
              </View>

              {sent ? (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>¡Gracias!</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>Recibimos tu comentario. Lo leemos todo para mejorar Mi TiendaPy.</Text>
                  <Pressable onPress={goBack} accessibilityRole="button" style={({ pressed }) => [styles.button, { opacity: pressed ? 0.88 : 1 }]}>
                    <Text style={styles.buttonText}>Listo</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>Enviar comentarios</Text>
                  <Text style={[styles.body, { color: colors.muted }]}>Informá de un error, sugerí una idea o contanos qué funciona bien.</Text>

                  <View accessibilityRole="radiogroup" style={styles.kinds}>
                    {KINDS.map((item) => {
                      const selected = item.value === kind;
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() => setKind(item.value)}
                          disabled={busy}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected, disabled: busy }}
                          style={[styles.kind, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? `${palette.primary}1A` : 'transparent' }]}>
                          <Ionicons name={item.icon} size={20} color={selected ? palette.primary : colors.muted} />
                          <Text numberOfLines={2} style={[styles.kindText, { color: selected ? palette.primary : colors.text }]}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <TextInput
                    value={message}
                    onChangeText={(value) => { setMessage(value); setError(null); }}
                    accessibilityLabel="Comentario"
                    placeholder={current.placeholder}
                    placeholderTextColor={colors.muted}
                    multiline
                    maxLength={2000}
                    textAlignVertical="top"
                    editable={!busy}
                    style={[styles.textArea, { color: colors.text, backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                  />

                  {error && (
                    <View accessibilityRole="alert" style={styles.errorCard}>
                      <Ionicons name="alert-circle" size={20} color={palette.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  <Pressable
                    onPress={submit}
                    disabled={!canSubmit}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSubmit, busy }}
                    style={({ pressed }) => [styles.button, { opacity: !canSubmit ? 0.5 : pressed ? 0.88 : 1 }]}>
                    {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.buttonText}>Enviar</Text>}
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, maxWidth: 480, width: '100%', alignSelf: 'center', gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { fontSize: 15, fontWeight: '600' },
  card: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 16 },
  iconCircle: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(37, 99, 235, 0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  body: { fontSize: 14, lineHeight: 20 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, minHeight: 64, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 8 },
  kindText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  textArea: { minHeight: 130, borderWidth: 1, borderRadius: 15, padding: 14, fontSize: 15, lineHeight: 21 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  errorText: { flex: 1, color: palette.danger, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  button: { height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
