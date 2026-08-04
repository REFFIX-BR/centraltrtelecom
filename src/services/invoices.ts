import { apiRequest } from '@/src/services/api';
import type { Invoice, InvoiceStatus } from '@/src/types';
import { formatDocument, onlyDigits } from '@/src/utils/format';

export type BoletoApiItem = {
  ID_TRANSACAO?: string | number | null;
  COD_CLIENTE?: string;
  NOME?: string;
  CIDADE?: string;
  BAIRRO?: string;
  RUA?: string;
  DATA_VENCIMENTO?: string;
  VALOR_TOTAL?: string | number;
  PIX_TXT?: string | null;
  CODIGO_BARRA_TRANSACAO?: string | null;
  link_carne_completo?: string | null;
  COD_ARECEBER?: string | number | null;
  OBS?: string | null;
  DATA_PAGAMENTO?: string | null;
  STATUS?: string | null;
};

function parseAmount(value?: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const normalized = value.replace(/\./g, '').replace(',', '.');
  // API already uses "289.70" style with dot as decimal
  const asIs = Number(value);
  if (Number.isFinite(asIs)) return asIs;
  const fallback = Number(normalized);
  return Number.isFinite(fallback) ? fallback : 0;
}

function monthLabelFromDate(dueDate: string): string {
  const date = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  const label = date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function resolveOpenStatus(dueDate: string, apiStatus?: string | null): InvoiceStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T12:00:00`);
  if (!Number.isNaN(due.getTime()) && due < today) return 'overdue';

  const status = (apiStatus || '').trim().toUpperCase();
  if (status.includes('VENCID') || status.includes('ATRAS')) return 'overdue';
  return 'open';
}

export function mapBoletoToInvoice(
  item: BoletoApiItem,
  kind: 'open' | 'paid'
): Invoice | null {
  const dueDate = item.DATA_VENCIMENTO?.trim();
  if (!dueDate) return null;

  const id = String(
    item.ID_TRANSACAO ??
      item.COD_ARECEBER ??
      `${item.COD_CLIENTE ?? 'boleto'}-${dueDate}-${item.VALOR_TOTAL ?? '0'}`
  );

  const reference =
    item.OBS?.trim() ||
    (item.ID_TRANSACAO ? `Transação ${item.ID_TRANSACAO}` : `Fatura ${dueDate}`);

  return {
    id,
    reference,
    monthLabel: monthLabelFromDate(dueDate),
    amount: parseAmount(item.VALOR_TOTAL),
    dueDate,
    status: kind === 'paid' ? 'paid' : resolveOpenStatus(dueDate, item.STATUS),
    barcode: item.CODIGO_BARRA_TRANSACAO?.trim() || '',
    pixCode: item.PIX_TXT?.trim() || '',
    issuedAt: dueDate,
    pdfUrl: item.link_carne_completo?.trim() || undefined,
    paidAt: item.DATA_PAGAMENTO?.trim() || undefined,
    clientCode: item.COD_CLIENTE?.trim() || undefined,
  };
}

function normalizeResponse(data: BoletoApiItem[] | string | null | undefined) {
  if (typeof data === 'string' || !Array.isArray(data)) return [] as BoletoApiItem[];
  return data;
}

export async function fetchOpenBoletos(documento: string): Promise<Invoice[]> {
  const digits = onlyDigits(documento);
  const formatted = formatDocument(digits);
  const data = await apiRequest<BoletoApiItem[] | string>('/webhook/consulta_boleto', {
    method: 'POST',
    body: { documento: formatted || digits },
    timeoutMs: 60000,
  });

  return normalizeResponse(data)
    .map((item) => mapBoletoToInvoice(item, 'open'))
    .filter((item): item is Invoice => !!item);
}

export async function fetchPaidBoletos(documento: string): Promise<Invoice[]> {
  const digits = onlyDigits(documento);
  const formatted = formatDocument(digits);
  const data = await apiRequest<BoletoApiItem[] | string>(
    '/webhook/consulta-boletos-pagos',
    {
      method: 'POST',
      body: { documento: formatted || digits },
      timeoutMs: 60000,
    }
  );

  return normalizeResponse(data)
    .map((item) => mapBoletoToInvoice(item, 'paid'))
    .filter((item): item is Invoice => !!item);
}

export async function fetchAllInvoices(documento: string): Promise<Invoice[]> {
  const [open, paid] = await Promise.all([
    fetchOpenBoletos(documento),
    fetchPaidBoletos(documento),
  ]);

  const byId = new Map<string, Invoice>();
  // Pagas primeiro; se o mesmo id aparecer em aberto, o aberto sobrescreve.
  for (const invoice of paid) byId.set(invoice.id, invoice);
  for (const invoice of open) byId.set(invoice.id, invoice);

  return [...byId.values()].sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );
}

function dueTime(invoice: Invoice): number {
  const time = new Date(`${invoice.dueDate}T12:00:00`).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Fatura a ser paga primeiro: vencida mais antiga ou, se não houver, a que vence antes. */
export function pickNextInvoice(invoices: Invoice[]): Invoice | null {
  const pending = invoices.filter((item) => item.status !== 'paid');
  if (pending.length === 0) return invoices[0] ?? null;

  const overdue = pending
    .filter((item) => item.status === 'overdue')
    .sort((a, b) => dueTime(a) - dueTime(b));
  if (overdue.length > 0) return overdue[0];

  return [...pending].sort((a, b) => dueTime(a) - dueTime(b))[0];
}

/** Pendentes com vencimento mais próximo primeiro; pagas depois, das mais recentes às antigas. */
export function sortInvoicesForList(invoices: Invoice[]): Invoice[] {
  const pending = invoices
    .filter((item) => item.status !== 'paid')
    .sort((a, b) => dueTime(a) - dueTime(b));
  const paid = invoices
    .filter((item) => item.status === 'paid')
    .sort((a, b) => dueTime(b) - dueTime(a));

  return [...pending, ...paid];
}

export function filterInvoicesByClientCode(
  invoices: Invoice[],
  clientCode?: string | null
): Invoice[] {
  if (!clientCode) return invoices;
  return invoices.filter((item) => item.clientCode === clientCode);
}
