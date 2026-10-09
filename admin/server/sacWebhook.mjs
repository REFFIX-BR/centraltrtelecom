const WEBHOOK_BASE = (
  process.env.SAC_WEBHOOK_BASE || 'https://webhook.trtelecom.net'
).replace(/\/$/, '');

const TIME_ZONE = 'America/Sao_Paulo';

export function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatDocument(value) {
  const d = digits(value);
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return d;
}

/** Aceita "2026-10-10", "2026-10-10 00:00:00", ISO com hora ou "10/10/2026". */
export function isoDay(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.slice(0, 10);
  }
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoDayInBrazil(parsed);
}

export function isoDayInBrazil(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export async function postWebhook(pathname, body, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${WEBHOOK_BASE}${pathname}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}
