"use client";
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";

type Preferences = {
  language: string;
  theme: "light" | "dark" | "system";
};

export type AppState = {
  version: number;
  lastUpdated: number;
  preferences: Preferences;
  // Espacio para cachear datos críticos (rutas, filtros, etc.)
  cache: Record<string, unknown>;
};

type AppAction =
  | { type: "SET_STATE"; payload: AppState }
  | { type: "UPDATE_PREFERENCES"; payload: Partial<Preferences>; baseVersion?: number }
  | { type: "SET_CACHE"; key: string; value: unknown };

const STORAGE_KEY = "app_state";
const CHANNEL_NAME = "app_state_channel";

function now() {
  return Date.now();
}

const initialState: AppState = {
  version: 1,
  lastUpdated: now(),
  preferences: { language: "es", theme: "system" },
  cache: {},
};

function mergeStates(local: AppState, incoming: AppState): AppState {
  // Regla simple de resolución de conflictos: preferir el estado con mayor versión
  if (incoming.version > local.version) return incoming;
  if (incoming.version < local.version) return local;
  // Si la versión es igual, usar lastUpdated para decidir
  if (incoming.lastUpdated > local.lastUpdated) return incoming;
  if (incoming.lastUpdated < local.lastUpdated) return local;
  // Igualdad: combinar preferencias y cache
  return {
    ...local,
    preferences: { ...local.preferences, ...incoming.preferences },
    cache: { ...local.cache, ...incoming.cache },
  };
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_STATE": {
      const next = { ...action.payload };
      return next;
    }
    case "UPDATE_PREFERENCES": {
      const baseVersion = action.baseVersion ?? state.version;
      const updated: AppState = {
        ...state,
        preferences: { ...state.preferences, ...action.payload },
        version: baseVersion + 1,
        lastUpdated: now(),
      };
      return updated;
    }
    case "SET_CACHE": {
      const next: AppState = {
        ...state,
        cache: { ...state.cache, [action.key]: action.value },
        version: state.version + 1,
        lastUpdated: now(),
      };
      return next;
    }
    default:
      return state;
  }
}

type AppStateContextType = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isHydratedRef = useRef(false);

  // Hidratación desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: AppState = JSON.parse(raw);
        dispatch({ type: "SET_STATE", payload: mergeStates(initialState, saved) });
      }
    } catch (err) {
      console.warn("AppState: error al hidratar", err);
    } finally {
      isHydratedRef.current = true;
    }
     
  }, []);

  // Persistencia
  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("AppState: error al persistir", err);
    }
  }, [state]);

  // Sincronización en tiempo real entre pestañas/componentes
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (ev) => {
      const incoming: AppState = ev.data;
      dispatch({ type: "SET_STATE", payload: mergeStates(state, incoming) });
    };
    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anunciar cambios a otras pestañas
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      ch.postMessage(state);
    } catch (err) {
      console.warn("AppState: error al anunciar cambios", err);
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState debe usarse dentro de AppStateProvider");
  return ctx;
}