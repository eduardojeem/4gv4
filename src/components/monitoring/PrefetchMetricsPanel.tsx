"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/contexts/app-state-context";

type NavPattern = { route: string; count: number };
type PrefetchMark = { route: string; time: number; method?: string };
type SyncEvent = { version: number; lastUpdated: number; receivedAt: number; source: "broadcast" | "local" };

const CRITICAL_ROUTES = ["/dashboard", "/products", "/setup", "/login", "/register"];

function getNavigationPatterns(): NavPattern[] {
  try {
    const raw = localStorage.getItem("navigation_patterns");
    const patterns: Record<string, number> = raw ? JSON.parse(raw) : {};
    return Object.entries(patterns)
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function getPrefetchMarks(): PrefetchMark[] {
  const entries = performance.getEntriesByType("mark");
  const out: PrefetchMark[] = [];
  for (const e of entries) {
    if (!e.name.startsWith("prefetch-start:")) continue;
    const route = e.name.replace("prefetch-start:", "");
    out.push({ route, time: e.startTime });
  }
  return out.slice(-50);
}

export function PrefetchMetricsPanel() {
  const [patterns, setPatterns] = useState<NavPattern[]>([]);
  const [marks, setMarks] = useState<PrefetchMark[]>([]);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const { state } = useAppState();

  const candidates = useMemo(() => {
    const sorted = [...patterns].map((p) => p.route);
    const list = [...CRITICAL_ROUTES];
    for (const r of sorted) {
      if (!list.includes(r)) list.push(r);
    }
    return list.slice(0, 5);
  }, [patterns]);

  useEffect(() => {
    const refresh = () => {
      setPatterns(getNavigationPatterns());
      setMarks(getPrefetchMarks());
    };
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  // Registrar eventos locales cada vez que cambia el estado
  useEffect(() => {
    setSyncEvents((prev) => {
      const next: SyncEvent[] = [
        {
          version: state.version,
          lastUpdated: state.lastUpdated,
          receivedAt: Date.now(),
          source: "local" as const,
        },
        ...prev,
      ].slice(0, 50);
      return next;
    });
  }, [state.version, state.lastUpdated]);

  // Escuchar BroadcastChannel para registrar eventos de sincronización cross-tab
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel("app_state_channel");
    ch.onmessage = (ev) => {
      const incoming = ev.data as { version: number; lastUpdated: number };
      setSyncEvents((prev) => {
        const next: SyncEvent[] = [
          {
            version: incoming.version,
            lastUpdated: incoming.lastUpdated,
            receivedAt: Date.now(),
            source: "broadcast" as const,
          },
          ...prev,
        ].slice(0, 50);
        return next;
      });
    };
    return () => ch.close();
  }, []);

  const clearMetrics = () => {
    try {
      performance.clearMarks();
    } catch {}
    setMarks([]);
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold">Métricas de Prefetch</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Patrones de Navegación (Top 10)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left">Ruta</th>
                <th className="text-right">Conteo</th>
              </tr>
            </thead>
            <tbody>
              {patterns.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-muted-foreground py-6">
                    Sin datos aún
                  </td>
                </tr>
              )}
              {patterns.map((p) => (
                <tr key={p.route}>
                  <td className="py-1">{p.route}</td>
                  <td className="py-1 text-right">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Eventos de Prefetch (últimos 50)</h3>
            <button className="px-3 py-1 text-xs rounded border" onClick={clearMetrics}>
              Limpiar marcas
            </button>
          </div>
          <ul className="space-y-1 text-sm">
            {marks.length === 0 && (
              <li className="text-muted-foreground">Sin eventos registrados</li>
            )}
            {marks.map((m, idx) => (
              <li key={`${m.route}-${idx}`} className="flex justify-between">
                <span>{m.route}</span>
                <span className="text-muted-foreground">{m.time.toFixed(1)}ms</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="font-medium mb-2">Estado Distribuido</h3>
        <div className="text-sm mb-3">
          <span className="mr-4">Versión actual: <strong>{state.version}</strong></span>
          <span>
            Última actualización: <strong>{new Date(state.lastUpdated).toLocaleString()}</strong>
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left">Fuente</th>
              <th className="text-right">Versión</th>
              <th className="text-right">lastUpdated</th>
              <th className="text-right">Recibido</th>
            </tr>
          </thead>
          <tbody>
            {syncEvents.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-6">
                  Sin eventos aún
                </td>
              </tr>
            )}
            {syncEvents.map((e, idx) => (
              <tr key={`${e.version}-${e.receivedAt}-${idx}`}>
                <td className="py-1">{e.source}</td>
                <td className="py-1 text-right">{e.version}</td>
                <td className="py-1 text-right">{new Date(e.lastUpdated).toLocaleTimeString()}</td>
                <td className="py-1 text-right">{new Date(e.receivedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="font-medium mb-2">Candidatos Prioritarios</h3>
        <div className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <span key={c} className="px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}