import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiFetch } from '@/lib/api';
import { getPrivateCacheContext, subscribePrivateCacheContext } from '@/lib/private-cache-context';

type Method = { id: string; available: boolean };
/** Re-read when a payment sheet opens or the private organization context changes. */
export function usePaymentControls(enabled = true) {
  const context = useSyncExternalStore(subscribePrivateCacheContext, getPrivateCacheContext);
  const key = `${context.epoch}:${context.organizationId ?? ''}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; methods?: Method[]; error?: string } | null>(null);
  useEffect(() => {
    if (!enabled || !context.organizationId) return;
    let active = true;
    apiFetch<{ scope: string; organizationId: string; methods: Method[] }>('/api/admin/payment-controls')
      .then(data => {
        if (data.scope !== 'commerce' || data.organizationId !== context.organizationId || !Array.isArray(data.methods)) throw new Error('No se pudo confirmar el comercio y sus medios de cobro.');
        if (active) setResult({ key, methods: data.methods });
      })
      .catch(error => { if (active) setResult({ key, error: error instanceof Error ? error.message : 'No se pudieron cargar los medios de cobro.' }); });
    return () => { active = false; };
  }, [key, context.organizationId, enabled, attempt]);
  const current = enabled && result?.key === key ? result : null;
  return {
    allows: (method: string) => current?.methods?.some(item => item.id === method && item.available === true) === true,
    ready: Boolean(current?.methods), error: current?.error ?? null, retry: () => setAttempt(value => value + 1),
  };
}
