import { formatDocument, isoDay, isoDayInBrazil, postWebhook } from './sacWebhook.mjs';

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

function text(value) {
  const result = String(value ?? '').trim();
  return result || undefined;
}

function parseAmount(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const asIs = Number(value);
  if (Number.isFinite(asIs)) return asIs;
  const fallback = Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(fallback) ? fallback : 0;
}

function monthLabel(day) {
  const [year, month] = day.split('-').map(Number);
  const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function resolveOpenStatus(dueDate, apiStatus, today) {
  if (dueDate < today) return 'overdue';
  const status = String(apiStatus || '').trim().toUpperCase();
  if (status.includes('VENCID') || status.includes('ATRAS')) return 'overdue';
  return 'open';
}

function mapInvoice(item, kind, today) {
  const dueDate = isoDay(item?.DATA_VENCIMENTO);
  if (!dueDate) return null;

  const transactionId = text(item.ID_TRANSACAO);
  const id =
    transactionId ??
    text(item.COD_ARECEBER) ??
    `${text(item.COD_CLIENTE) ?? 'boleto'}-${dueDate}-${item.VALOR_TOTAL ?? '0'}`;

  return {
    id,
    reference:
      text(item.OBS) ?? (transactionId ? `Transação ${transactionId}` : `Fatura ${dueDate}`),
    monthLabel: monthLabel(dueDate),
    amount: parseAmount(item.VALOR_TOTAL),
    dueDate,
    status: kind === 'paid' ? 'paid' : resolveOpenStatus(dueDate, item.STATUS, today),
    barcode: text(item.CODIGO_BARRA_TRANSACAO) ?? '',
    pixCode: text(item.PIX_TXT) ?? '',
    issuedAt: dueDate,
    pdfUrl: text(item.link_carne_completo),
    paidAt: isoDay(item.DATA_PAGAMENTO) ?? undefined,
    clientCode: text(item.COD_CLIENTE),
  };
}

async function fetchList(pathname, document) {
  const data = await postWebhook(pathname, { documento: formatDocument(document) });
  if (Array.isArray(data)) return data;
  // O n8n responde texto ("nenhum boleto...") quando não há resultado.
  if (typeof data === 'string') return [];
  throw new Error('Resposta inválida do SAC.');
}

/** Faturas em aberto + pagas do documento, já normalizadas (datas em horário de Brasília). */
export async function getAppInvoices(document) {
  const cached = cache.get(document);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const [open, paid] = await Promise.allSettled([
    fetchList('/webhook/consulta_boleto', document),
    fetchList('/webhook/consulta-boletos-pagos', document),
  ]);
  if (open.status === 'rejected' && paid.status === 'rejected') {
    throw new Error('Não foi possível consultar as faturas no momento.');
  }

  const today = isoDayInBrazil();
  const byId = new Map();
  // Pagas primeiro; se o mesmo id aparecer em aberto, o aberto sobrescreve.
  for (const item of paid.status === 'fulfilled' ? paid.value : []) {
    const invoice = mapInvoice(item, 'paid', today);
    if (invoice) byId.set(invoice.id, invoice);
  }
  for (const item of open.status === 'fulfilled' ? open.value : []) {
    const invoice = mapInvoice(item, 'open', today);
    if (invoice) byId.set(invoice.id, invoice);
  }

  const value = {
    today,
    partial: open.status === 'rejected' || paid.status === 'rejected',
    invoices: [...byId.values()].sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1)),
  };
  if (!value.partial) {
    if (cache.size > 1000) {
      for (const [key, entry] of cache) {
        if (Date.now() - entry.at >= CACHE_TTL_MS) cache.delete(key);
      }
    }
    cache.set(document, { at: Date.now(), value });
  }
  return value;
}
