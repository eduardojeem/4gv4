"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type PrefetchMetric = {
  route: string;
  triggeredAt: number;
  method: "link" | "fetch";
};

const CRITICAL_ROUTES = ["/dashboard", "/dashboard/products", "/setup", "/login", "/register"];

function addLinkPrefetch(href: string) {
  if (typeof document === "undefined") return false;
  // Evitar duplicados
  const existing = document.querySelector(`link[rel="prefetch"][href="${href}"]`);
  if (existing) return true;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = href;
  link.as = "document";
  document.head.appendChild(link);
  return true;
}

export function usePredictivePrefetch() {
  const pathname = usePathname();
  const metricsRef = useRef<PrefetchMetric[]>([]);

  useEffect(() => {
    // Cargar historial simple desde localStorage
    const raw = localStorage.getItem("navigation_patterns");
    let patterns: Record<string, number> = {};
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        patterns = parsed as Record<string, number>;
      }
    } catch {
      patterns = {};
    }
    const increment = (route: string) => {
      patterns[route] = (patterns[route] ?? 0) + 1;
      localStorage.setItem("navigation_patterns", JSON.stringify(patterns));
    };

    increment(pathname);

    // Seleccionar rutas probables basadas en critical + historial
    const candidates = [...CRITICAL_ROUTES];
    const sortedByHistory = Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .map(([route]) => route)
      .filter((r) => r !== pathname);
    for (const r of sortedByHistory) {
      if (!candidates.includes(r)) candidates.push(r);
    }

    // Prefetch bajo condiciones de red e inactividad
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const isGoodNetwork = !connection || ["4g", "wifi"].includes(connection.effectiveType || "");
    const idle = (cb: () => void) => {
      if (typeof (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void }).requestIdleCallback === "function") {
        (window as Window & { requestIdleCallback: (cb: () => void, options?: { timeout: number }) => void }).requestIdleCallback(cb, { timeout: 1500 });
      } else {
        setTimeout(cb, 600);
      }
    };

    idle(() => {
      if (!isGoodNetwork) return;
      const toPrefetch = candidates.slice(0, 3);
      for (const href of toPrefetch) {
        const ok = addLinkPrefetch(href);
        if (ok) {
          performance.mark(`prefetch-start:${href}`);
          metricsRef.current.push({ route: href, triggeredAt: Date.now(), method: "link" });
        }
        // Warmup básico para assets/JSON (si existen endpoints API relacionados)
        try {
          fetch(href, { method: "GET", mode: "no-cors" }).catch(() => {});
          metricsRef.current.push({ route: href, triggeredAt: Date.now(), method: "fetch" });
        } catch {}
      }
    });
  }, [pathname]);

  // Exponer métrica via console en dev
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const id = setInterval(() => {
      if (metricsRef.current.length === 0) return;
      // Mostrar últimas 5 métricas
      const tail = metricsRef.current.slice(-5);
      console.table(tail);
    }, 3000);
    return () => clearInterval(id);
  }, []);
}
