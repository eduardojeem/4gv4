import * as SecureStore from 'expo-secure-store';
import { clearLegacyBiometricCredentials } from './legacy-biometric';
import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { apiFetch } from './api';
import { supabase } from './supabase';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    let active = true;
    void clearLegacyBiometricCredentials(SecureStore).catch(() => undefined);
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => { active = false; data.subscription.unsubscribe(); };
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
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } finally {
      await clearLegacyBiometricCredentials(SecureStore).catch(() => undefined);
    }
  };

  return (
    <SessionContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
