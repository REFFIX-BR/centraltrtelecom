import { apiRequest } from '@/src/services/api';

export type ConnectionSession = {
  username: string;
  startedAt: string;
  endedAt: string | null;
  duration: string;
  upload: string;
  download: string;
  isOnline: boolean;
};

type ExtratoApiItem = {
  UserName?: string;
  inicio_conexao?: string;
  fim_conexao?: string | null;
  tempo_conexao?: string;
  upload?: string;
  download?: string;
};

function shortenDuration(raw: string): string {
  const text = raw.trim();
  if (!text) return '—';

  if (/ainda online/i.test(text)) {
    return text
      .replace(/^Ainda online há\s*/i, 'Online · ')
      .replace(/\s+0 dias\s+/i, ' ')
      .replace(/\s+0 horas\s+/i, ' ')
      .replace(/\s+0 minutos\s+/i, ' ')
      .replace(/\s+0 segundos$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return text
    .replace(/\s+0 dias\s+/i, ' ')
    .replace(/\s+0 horas\s+/i, ' ')
    .replace(/\s+0 minutos\s+/i, ' ')
    .replace(/\s+0 segundos$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapConnectionSession(item: ExtratoApiItem): ConnectionSession {
  const endedAt = item.fim_conexao?.trim() || null;
  const duration = item.tempo_conexao?.trim() || '—';

  return {
    username: item.UserName?.trim() || '',
    startedAt: item.inicio_conexao?.trim() || '—',
    endedAt,
    duration: shortenDuration(duration),
    upload: item.upload?.trim() || '—',
    download: item.download?.trim() || '—',
    isOnline: !endedAt || /ainda online/i.test(duration),
  };
}

export async function fetchConnectionHistory(
  login: string
): Promise<ConnectionSession[]> {
  const data = await apiRequest<ExtratoApiItem[] | string>(
    `/webhook/extrato-conexao?login=${encodeURIComponent(login.trim())}`,
    {
      method: 'GET',
      timeoutMs: 60000,
    }
  );

  if (typeof data === 'string' || !Array.isArray(data)) {
    return [];
  }

  return data
    .map(mapConnectionSession)
    .filter((item) => item.startedAt !== '—')
    .reverse();
}

export function summarizeConnectionHistory(sessions: ConnectionSession[]): {
  total: number;
  online: ConnectionSession | null;
  lastEnded: ConnectionSession | null;
} {
  const online = sessions.find((item) => item.isOnline) ?? null;
  const lastEnded =
    sessions.find((item) => !item.isOnline) ?? sessions[0] ?? null;

  return {
    total: sessions.length,
    online,
    lastEnded,
  };
}
