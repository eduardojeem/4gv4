import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Factor } from '@supabase/supabase-js';

import { describeMfaError, formatTotpSecret, normalizeTotpCode, TOTP_ISSUER, totpSetupUri } from '@/lib/mfa-model';
import { palette, usePalette } from '@/lib/palette';
import { useSession } from '@/lib/session';
import { supabase, verifyCurrentPassword } from '@/lib/supabase';

type Pending = { factorId: string; secret: string; uri: string; qrCode: string | null };
type Mode = 'idle' | 'enrolling' | 'disabling';

/**
 * Verificación en dos pasos desde la app, con el mismo MFA de Supabase que la
 * web: lo que se activa acá vale allá y al revés.
 * - Activar: abre la app autenticadora del teléfono con el enlace otpauth (el
 *   QR no se puede escanear desde la misma pantalla) o se carga la clave a mano,
 *   y se confirma con el primer código.
 * - Desactivar: pide la contraseña y un código actual, para que no lo haga
 *   cualquiera con el teléfono desbloqueado.
 */
export default function TwoFactorScreen() {
  const colors = usePalette();
  const { session } = useSession();
  const email = session?.user?.email ?? '';

  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa.listFactors()
      .then(({ data, error: listError }) => {
        if (listError) throw listError;
        if (!active) return;
        setFactors((data?.totp ?? []).filter((factor) => factor.status === 'verified'));
        setLoadError(null);
      })
      .catch((err) => active && setLoadError(describeMfaError(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [attempt]);

  const enabled = factors.length > 0;

  const reset = () => {
    setMode('idle');
    setPending(null);
    setCode('');
    setPassword('');
    setError(null);
  };

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      // Una activación a medias deja un factor sin verificar y haría fallar la nueva.
      const { data: current } = await supabase.auth.mfa.listFactors();
      const stale = (current?.all ?? []).filter((factor) => factor.factor_type === 'totp' && factor.status !== 'verified');
      await Promise.all(stale.map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })));

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: TOTP_ISSUER,
        friendlyName: factors.length > 0 ? `App autenticadora ${factors.length + 1}` : 'App autenticadora',
      });
      if (enrollError || !data) throw enrollError ?? new Error('enroll');
      setPending({
        factorId: data.id,
        secret: data.totp.secret,
        uri: totpSetupUri({ uri: data.totp.uri, secret: data.totp.secret, account: email }),
        qrCode: data.totp.qr_code || null,
      });
      setMode('enrolling');
      setCode('');
    } catch (err) {
      setError(describeMfaError(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (pending) await supabase.auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => undefined);
    reset();
  };

  const openAuthenticator = async () => {
    if (!pending) return;
    try {
      await Linking.openURL(pending.uri);
    } catch {
      Alert.alert(
        'No encontramos una app autenticadora',
        'Instalá Google Authenticator o Microsoft Authenticator desde Play Store, o cargá la clave a mano en la app que uses.',
      );
    }
  };

  const confirmEnroll = async () => {
    if (!pending || code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.factorId, code });
      if (verifyError) throw verifyError;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      reset();
      setDone('Listo. La verificación en dos pasos quedó activada.');
      load();
    } catch (err) {
      setError(describeMfaError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    const factor = factors[0];
    if (!factor || busy) return;
    if (!password) return setError('Escribí tu contraseña.');
    if (code.length !== 6) return setError('Escribí los 6 dígitos que muestra tu app autenticadora.');
    setBusy(true);
    setError(null);
    try {
      if (!(await verifyCurrentPassword(email, password))) {
        setError('La contraseña no es correcta.');
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyError) throw verifyError;
      // Con varias apps cargadas se quitan todas: «desactivar» es que no se pida más el código.
      for (const item of factors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: item.id });
        if (unenrollError) throw unenrollError;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      reset();
      setDone('Desactivaste la verificación en dos pasos. Para entrar alcanza con la contraseña.');
      load();
    } catch (err) {
      setError(describeMfaError(err));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    if (mode === 'enrolling') {
      Alert.alert('Dejar la activación', 'La verificación en dos pasos no quedará activada.', [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => void cancelEnroll().then(() => router.back()) },
      ]);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/panel/profile' as never);
  };

  const codeInput = (
    <TextInput
      value={code}
      onChangeText={(value) => { setCode(normalizeTotpCode(value)); setError(null); }}
      placeholder="000000"
      placeholderTextColor={colors.muted}
      keyboardType="number-pad"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={7}
      editable={!busy}
      accessibilityLabel="Código de 6 dígitos"
      style={[styles.codeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Verificación en dos pasos</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.headRow}>
              <View style={[styles.iconCircle, { backgroundColor: enabled ? 'rgba(22,163,74,0.12)' : 'rgba(37,99,235,0.12)' }]}>
                <Ionicons name={enabled ? 'shield-checkmark' : 'shield-outline'} size={24} color={enabled ? palette.success : palette.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>{loading ? 'Cargando…' : enabled ? 'Activada' : 'Desactivada'}</Text>
                <Text style={[styles.help, { color: colors.muted }]}>
                  Además de la contraseña, al iniciar sesión se pide un código de 6 dígitos de una app autenticadora. Si alguien consigue tu contraseña, no puede entrar sin tu teléfono.
                </Text>
              </View>
            </View>

            {loadError && (
              <View style={styles.gap}>
                <Text style={[styles.help, { color: palette.danger }]}>{loadError}</Text>
                <Pressable onPress={() => { setLoading(true); load(); }} style={[styles.outlineBtn, { borderColor: colors.border }]} accessibilityRole="button">
                  <Text style={[styles.outlineText, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              </View>
            )}

            {done && (
              <View accessibilityRole="alert" style={styles.success}>
                <Ionicons name="checkmark-circle" size={18} color={palette.success} />
                <Text style={styles.successText}>{done}</Text>
              </View>
            )}

            {!loading && !loadError && mode === 'idle' && (
              enabled ? (
                <>
                  {factors.map((factor) => (
                    <View key={factor.id} style={[styles.factorRow, { borderColor: colors.border }]}>
                      <Ionicons name="phone-portrait-outline" size={18} color={colors.muted} />
                      <Text style={[styles.factorText, { color: colors.text }]}>{factor.friendly_name || 'App autenticadora'}</Text>
                      <Text style={[styles.help, { color: colors.muted }]}>
                        desde {new Date(factor.created_at).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  ))}
                  <Pressable onPress={() => { setMode('disabling'); setDone(null); setError(null); }} accessibilityRole="button" style={[styles.outlineBtn, { borderColor: palette.danger }]}>
                    <Text style={[styles.outlineText, { color: palette.danger }]}>Desactivar</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => void startEnroll()} disabled={busy} accessibilityRole="button" style={[styles.primaryBtn, { opacity: busy ? 0.6 : 1 }]}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Activar</Text>}
                </Pressable>
              )
            )}

            {mode === 'enrolling' && pending && (
              <View style={styles.gap}>
                <Step n={1} text="Si no tenés una, instalá Google Authenticator o Microsoft Authenticator desde Play Store." colors={colors} />
                <Step n={2} text="Tocá el botón para agregar tu cuenta en esa app." colors={colors} />
                <Pressable onPress={() => void openAuthenticator()} accessibilityRole="button" style={styles.primaryBtn}>
                  <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryText}>Abrir mi app autenticadora</Text>
                </Pressable>

                <View style={[styles.secretBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.help, { color: colors.muted }]}>¿No se abrió? Cargá esta clave a mano (cuenta: {email || TOTP_ISSUER}):</Text>
                  <Text selectable style={[styles.secret, { color: colors.text }]}>{formatTotpSecret(pending.secret)}</Text>
                  <Pressable onPress={() => void Share.share({ message: pending.secret })} accessibilityRole="button" style={styles.linkRow} hitSlop={6}>
                    <Ionicons name="share-outline" size={16} color={palette.primary} />
                    <Text style={[styles.link, { color: palette.primary }]}>Copiar o compartir la clave</Text>
                  </Pressable>
                  {pending.qrCode ? (
                    <>
                      <Text style={[styles.help, { color: colors.muted }]}>O escaneá el código desde otro teléfono:</Text>
                      <Image source={{ uri: pending.qrCode }} style={styles.qr} contentFit="contain" accessibilityLabel="Código QR para la app autenticadora" />
                    </>
                  ) : null}
                </View>

                <Step n={3} text="Escribí el código de 6 dígitos que muestra la app." colors={colors} />
                {codeInput}
                {error && <Text accessibilityRole="alert" style={[styles.help, { color: palette.danger }]}>{error}</Text>}
                <Pressable onPress={() => void confirmEnroll()} disabled={code.length !== 6 || busy} accessibilityRole="button" style={[styles.primaryBtn, { opacity: code.length !== 6 || busy ? 0.5 : 1 }]}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Confirmar y activar</Text>}
                </Pressable>
                <Pressable onPress={() => void cancelEnroll()} disabled={busy} accessibilityRole="button" style={styles.cancel} hitSlop={6}>
                  <Text style={[styles.link, { color: colors.muted }]}>Cancelar</Text>
                </Pressable>
              </View>
            )}

            {mode === 'disabling' && (
              <View style={styles.gap}>
                <View style={styles.warning}>
                  <Ionicons name="warning-outline" size={18} color="#B45309" />
                  <Text style={styles.warningText}>Sin el segundo paso, cualquiera que sepa tu contraseña puede entrar a tu cuenta.</Text>
                </View>
                <Text style={[styles.label, { color: colors.text }]}>Tu contraseña</Text>
                <TextInput
                  value={password}
                  onChangeText={(value) => { setPassword(value); setError(null); }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="current-password"
                  textContentType="password"
                  editable={!busy}
                  accessibilityLabel="Tu contraseña"
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Text style={[styles.label, { color: colors.text }]}>Código actual de tu app autenticadora</Text>
                {codeInput}
                {error && <Text accessibilityRole="alert" style={[styles.help, { color: palette.danger }]}>{error}</Text>}
                <Pressable onPress={() => void confirmDisable()} disabled={busy} accessibilityRole="button" style={[styles.dangerBtn, { opacity: busy ? 0.6 : 1 }]}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Desactivar la verificación</Text>}
                </Pressable>
                <Pressable onPress={reset} disabled={busy} accessibilityRole="button" style={styles.cancel} hitSlop={6}>
                  <Text style={[styles.link, { color: palette.primary }]}>No, mantenerla activa</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={[styles.footnote, { color: colors.muted }]}>
            Es la misma verificación que en la web: si la activás acá, también te la pide en la computadora.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Step({ n, text, colors }: { n: number; text: string; colors: ReturnType<typeof usePalette> }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <Text style={[styles.help, styles.flex, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gap: { gap: 12 },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 16, fontWeight: '800' },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 16 },
  headRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconCircle: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  help: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700' },
  success: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(22,163,74,0.1)' },
  successText: { flex: 1, color: '#166534', fontSize: 13, fontWeight: '700' },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.1)' },
  warningText: { flex: 1, color: '#B45309', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  factorText: { flex: 1, fontSize: 14, fontWeight: '700' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secretBox: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  secret: { fontSize: 16, fontWeight: '800', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  qr: { width: 160, height: 160, alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  link: { fontSize: 14, fontWeight: '700' },
  codeInput: { height: 56, borderWidth: 1, borderRadius: 14, textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: 8 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  primaryBtn: { minHeight: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  dangerBtn: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.danger },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  outlineBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontSize: 15, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 4 },
  footnote: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
});
