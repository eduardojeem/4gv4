import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { secureStorage } from './secure-storage';
import { getMobileRuntimeConfig } from './runtime-config';

const { supabaseUrl, supabaseKey } = getMobileRuntimeConfig();

// Mismos usuarios que la web. La sesión queda guardada cifrada en el teléfono,
// así que no hay que volver a iniciar sesión cada vez que se abre la app.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renovar el token solo con la app en pantalla. Al abrirla no hay evento de
// cambio (ya está activa), así que también se arranca acá.
if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
