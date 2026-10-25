import { setPrivateCacheUser } from './private-cache-context';
import * as SecureStore from 'expo-secure-store';
import { clearLegacyBiometricCredentials } from './legacy-biometric';
import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { apiFetch } from './api';
import { supabase } from './supabase';
import {
  authenticateWithBiometrics,
  clearBiometricUnlock,
  getBiometricSupport,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
  shouldRelock,
  type BiometricSupport,
} from './biometric-lock';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Hay sesión guardada pero falta Face ID / huella para mostrarla. */
  locked: boolean;
  unlock: () => Promise<boolean>;
  biometric: BiometricSupport & { enabled: boolean };
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession debe usarse dentro de <SessionProvider />');
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [biometric, setBiometric] = useState<BiometricSupport & { enabled: boolean }>({
    available: false,
    label: Platform.OS === 'ios' ? 'Face ID' : 'huella',
    enabled: false,
  });
  const biometricRef = useRef(biometric);
  const sessionRef = useRef(session);
  useEffect(() => {
    biometricRef.current = biometric;
    sessionRef.current = session;
  }, [biometric, session]);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    void clearLegacyBiometricCredentials(SecureStore).catch(() => undefined);
    Promise.all([
      supabase.auth.getSession(),
      getBiometricSupport(Platform.OS),
      isBiometricUnlockEnabled(),
    ]).then(([{ data }, support, enabled]) => {
      if (!active) return;
      const restoredSession = authChanged ? sessionRef.current : data.session;
      const on = support.available && enabled;
      setBiometric({ ...support, enabled: on });
      // Al abrir la app con sesión guardada y Face ID activado, primero se desbloquea.
      setLocked(Boolean(restoredSession) && on);
      setPrivateCacheUser(restoredSession?.user.id ?? null);
      setSession(restoredSession);
      setIsLoading(false);
    }).catch(() => {
      if (!active || authChanged) return;
      setPrivateCacheUser(null);
      setSession(null);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (_event !== 'INITIAL_SESSION') authChanged = true; sessionRef.current = next; setPrivateCacheUser(next?.user.id ?? null); setSession(next); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  // Volver de segundo plano después de un rato también pide Face ID.
  useEffect(() => {
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt = Date.now();
      } else if (state === 'active') {
        if (biometricRef.current.enabled && sessionRef.current && shouldRelock(backgroundedAt, Date.now())) {
          setLocked(true);
        }
        backgroundedAt = null;
      }
    });
    return () => subscription.remove();
  }, []);

  const unlock = useCallback(async () => {
    const ok = await authenticateWithBiometrics(biometricRef.current.label);
    if (ok) setLocked(false);
    return ok;
  }, []);

  /** Activar pide Face ID una vez, así se confirma que funciona antes de depender de él. */
  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const support = await getBiometricSupport(Platform.OS);
      if (!support.available || !(await authenticateWithBiometrics(support.label))) return false;
      await setBiometricUnlockEnabled(true);
      setBiometric({ ...support, enabled: true });
      return true;
    }
    await setBiometricUnlockEnabled(false);
    setBiometric((current) => ({ ...current, enabled: false }));
    return true;
  }, []);

  // El login pasa por el servidor: Supabase exige un captcha que solo corre
  // en la web, y el servidor puede iniciar sesión sin él (con límite de intentos).
  const signIn = async (email: string, password: string) => {
    try {
      const tokens = await apiFetch<{ access_token: string; refresh_token: string }>('/api/mobile/auth/login', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const { error } = await supabase.auth.setSession(tokens);
      return error ? 'No se pudo guardar la sesión en el teléfono. Probá de nuevo.' : null;
    } catch (err) {
      return err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
    }
  };

  const signOut = async () => {
    setPrivateCacheUser(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } finally {
      await clearLegacyBiometricCredentials(SecureStore).catch(() => undefined);
      await clearBiometricUnlock();
      setBiometric((current) => ({ ...current, enabled: false }));
      setLocked(false);
    }
  };

  return (
    <SessionContext.Provider value={{ session, isLoading, signIn, signOut, locked, unlock, biometric, setBiometricEnabled }}>
      {children}
    </SessionContext.Provider>
  );
}
