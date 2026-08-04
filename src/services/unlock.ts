import { apiRequest } from '@/src/services/api';

export type UnlockResult = {
  granted: boolean;
  message: string;
};

type UnlockApiItem = {
  data?: {
    resposta?: { obs?: string }[];
    status?: { status?: string }[];
  }[];
};

function humanizeMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function parseUnlockResponse(
  data: UnlockApiItem[] | UnlockApiItem | null
): UnlockResult {
  const item = Array.isArray(data) ? data[0] : data;
  const entry = item?.data?.[0];
  const status = entry?.status?.[0]?.status?.trim().toUpperCase() ?? '';
  const obs = entry?.resposta?.[0]?.obs ?? '';

  return {
    granted: status === 'S',
    message: humanizeMessage(obs) || 'Não recebemos um retorno do sistema.',
  };
}

/**
 * Dispara o desbloqueio em confiança. O webhook já executa a liberação,
 * então só deve ser chamado após a confirmação do assinante.
 */
export async function requestTrustUnlock(document: string): Promise<UnlockResult> {
  const data = await apiRequest<UnlockApiItem[] | UnlockApiItem>(
    '/webhook/consulta_desbloqueio',
    {
      method: 'POST',
      body: { documento: document.replace(/\D/g, '') },
      timeoutMs: 60000,
    }
  );

  return parseUnlockResponse(data);
}
