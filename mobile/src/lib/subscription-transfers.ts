import { Platform } from 'react-native';

import { ApiError, apiFetch } from './api';
import { formDataFile, type PickedImage } from './website-admin';

/**
 * Pago de la suscripción por transferencia, con la misma API que usa la web
 * (/api/admin/subscriptions/transfers). La base valida plan, importe y estado:
 * acá solo se muestra y se envía lo que el comercio elige.
 */

export type TransferStatus = 'awaiting_receipt' | 'pending_review' | 'approved' | 'rejected' | 'cancelled';

export type TransferRequest = {
  id: string;
  reference: string;
  plan_name: string;
  amount: number;
  currency: 'PYG';
  status: TransferStatus;
  bank_snapshot: {
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    accountAlias?: string;
    instructions?: string;
  };
  rejection_reason: string | null;
  period_ends_at: string | null;
  created_at: string;
};

export type TransferPlan = { code: string; name: string; price: number; currency: 'PYG' };

export type TransferOverview = {
  enabled: boolean;
  plans: TransferPlan[];
  requests: TransferRequest[];
};

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  awaiting_receipt: 'Esperando comprobante',
  pending_review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

const ENDPOINT = '/api/admin/subscriptions/transfers';

export async function fetchTransferOverview(): Promise<TransferOverview> {
  const res = await apiFetch<{ settings?: { enabled?: boolean }; plans?: TransferPlan[]; requests?: TransferRequest[] }>(ENDPOINT);
  return {
    enabled: res.settings?.enabled === true,
    plans: Array.isArray(res.plans) ? res.plans : [],
    requests: Array.isArray(res.requests) ? res.requests : [],
  };
}

export async function createTransferRequest(planCode: string): Promise<TransferRequest> {
  const res = await apiFetch<{ request?: TransferRequest }>(ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  });
  if (!res.request) throw new ApiError('No se pudo crear la solicitud.', 500);
  return res.request;
}

export async function cancelTransferRequest(id: string): Promise<TransferRequest> {
  const res = await apiFetch<{ request?: TransferRequest }>(`${ENDPOINT}/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: '{}',
  });
  if (!res.request) throw new ApiError('No se pudo cancelar la solicitud.', 500);
  return res.request;
}

/** Comprobante como foto de la galería (JPG o PNG); el servidor verifica el archivo. */
export async function uploadTransferReceipt(id: string, image: PickedImage, operationReference: string): Promise<TransferRequest> {
  const mime = image.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const name = image.fileName || `comprobante.${mime === 'image/png' ? 'png' : 'jpg'}`;
  const form = new FormData();
  const file = await formDataFile(image.uri, name, mime);
  if (Platform.OS === 'web') form.append('file', file, name);
  else form.append('file', file);
  if (operationReference.trim()) form.append('operationReference', operationReference.trim());
  const res = await apiFetch<{ request?: TransferRequest }>(`${ENDPOINT}/${encodeURIComponent(id)}/receipt`, {
    method: 'POST',
    body: form,
  });
  if (!res.request) throw new ApiError('No se pudo enviar el comprobante.', 500);
  return res.request;
}
