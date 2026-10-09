import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  digits,
  formatDocument,
  isoDay,
  isoDayInBrazil,
  postWebhook,
} from './sacWebhook.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILES_FILE = path.join(__dirname, 'data', 'push-profiles.json');

const PROFILE_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 4;
/** Faturas pagas mais recentes avaliadas para "paga em dia". */
const RECURRENCE_WINDOW = 6;
const RECURRENCE_MIN_PAID = 3;

export const CONTRACT_SEGMENTS = [
  { id: 'ativo', label: 'Ativos' },
  { id: 'cancelado_inadimplencia', label: 'Cancelados por inadimplência' },
  { id: 'cancelado', label: 'Cancelados (outros)' },
  { id: 'suspenso', label: 'Suspensos / bloqueados' },
  { id: 'outro', label: 'Outras situações' },
  { id: 'desconhecido', label: 'Sem informação' },
];

export const FINANCIAL_SEGMENTS = [
  { id: 'em_dia', label: 'Em dia' },
  { id: 'em_atraso', label: 'Com fatura em atraso' },
  { id: 'desconhecido', label: 'Sem informação' },
];

export const RECURRENCE_SEGMENTS = [
  { id: 'recorrente', label: 'Recorrente (paga em dia)' },
  { id: 'nao_recorrente', label: 'Não recorrente (atrasa)' },
  { id: 'sem_historico', label: 'Sem histórico suficiente' },
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function profileKey(document, login) {
  return `${digits(document)}:${String(login || '').trim()}`;
}

function readProfiles() {
  try {
    if (!fs.existsSync(PROFILES_FILE)) return {};
    const data = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeProfiles(profiles) {
  fs.mkdirSync(path.dirname(PROFILES_FILE), { recursive: true });
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
}

export function classifyContract(statusTipo) {
  const value = normalizeText(statusTipo);
  if (!value) return 'desconhecido';
  if (value.includes('CANCEL')) {
    return value.includes('INADIMPL') || value.includes('DEBITO')
      ? 'cancelado_inadimplencia'
      : 'cancelado';
  }
  if (value.includes('SUSPEN') || value.includes('BLOQ')) return 'suspenso';
  if (value.includes('ATIV')) return 'ativo';
  return 'outro';
}

export function classifyFinancial(openInvoices) {
  if (!Array.isArray(openInvoices)) return 'desconhecido';
  const today = isoDayInBrazil();
  const overdue = openInvoices.some((item) => {
    const due = isoDay(item?.DATA_VENCIMENTO);
    return due ? due < today : false;
  });
  return overdue ? 'em_atraso' : 'em_dia';
}

export function classifyRecurrence(paidInvoices, financial) {
  if (financial === 'em_atraso') return 'nao_recorrente';
  if (!Array.isArray(paidInvoices)) return 'sem_historico';

  const recent = paidInvoices
    .map((item) => ({
      due: isoDay(item?.DATA_VENCIMENTO),
      paid: isoDay(item?.DATA_PAGAMENTO),
    }))
    .filter((item) => item.due && item.paid)
    .sort((a, b) => (a.due < b.due ? 1 : -1))
    .slice(0, RECURRENCE_WINDOW);

  if (recent.some((item) => item.paid > item.due)) return 'nao_recorrente';
  if (recent.length < RECURRENCE_MIN_PAID) return 'sem_historico';
  return 'recorrente';
}

async function fetchContractStatus(login) {
  if (!login) return null;
  const data = await postWebhook('/webhook/check_pppoe_status', { login }, 80000);
  if (!Array.isArray(data) || !data.length) return null;
  const match =
    data.find((item) => String(item?.LOGIN || '').trim() === login) ||
    (data.length === 1 ? data[0] : null);
  return match ? String(match.STATUS_TIPO || '').trim() || null : null;
}

async function fetchInvoices(pathname, document) {
  const data = await postWebhook(pathname, { documento: formatDocument(document) });
  return Array.isArray(data) ? data : typeof data === 'string' ? [] : null;
}

async function buildProfile(token) {
  const document = digits(token.document);
  const login = String(token.login || '').trim();

  const [statusResult, openResult, paidResult] = await Promise.allSettled([
    fetchContractStatus(login),
    document ? fetchInvoices('/webhook/consulta_boleto', document) : null,
    document ? fetchInvoices('/webhook/consulta-boletos-pagos', document) : null,
  ]);

  const statusTipo = statusResult.status === 'fulfilled' ? statusResult.value : null;
  const openInvoices = openResult.status === 'fulfilled' ? openResult.value : null;
  const paidInvoices = paidResult.status === 'fulfilled' ? paidResult.value : null;
  const financial = classifyFinancial(openInvoices);

  return {
    document,
    login,
    statusTipo,
    contract: classifyContract(statusTipo),
    financial,
    recurrence: classifyRecurrence(paidInvoices, financial),
    updatedAt: new Date().toISOString(),
  };
}

async function runLimited(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => next())
  );
  return results;
}

/**
 * Devolve o perfil (contrato / financeiro / recorrência) de cada token.
 * Usa cache em disco por CPF+login; `refresh` força nova consulta ao SAC.
 */
export async function getPushProfiles(tokens, { refresh = false } = {}) {
  const cache = readProfiles();
  const now = Date.now();
  const pending = [];

  for (const token of tokens) {
    const key = profileKey(token.document, token.login);
    const cached = cache[key];
    const fresh =
      cached && now - new Date(cached.updatedAt).getTime() < PROFILE_TTL_MS;
    if (refresh || !fresh) pending.push(token);
  }

  const uniquePending = [
    ...new Map(
      pending.map((item) => [profileKey(item.document, item.login), item])
    ).values(),
  ];

  if (uniquePending.length) {
    const built = await runLimited(uniquePending, async (token) => {
      try {
        return await buildProfile(token);
      } catch {
        return null;
      }
    });
    for (const profile of built) {
      if (profile) cache[profileKey(profile.document, profile.login)] = profile;
    }
    writeProfiles(cache);
  }

  const result = {};
  for (const token of tokens) {
    const key = profileKey(token.document, token.login);
    result[token.token] = cache[key] || {
      document: digits(token.document),
      login: String(token.login || '').trim(),
      statusTipo: null,
      contract: 'desconhecido',
      financial: 'desconhecido',
      recurrence: 'sem_historico',
      updatedAt: null,
    };
  }
  return result;
}

function normalizeFilterList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

export function normalizeSegmentFilters(input) {
  const filters = input && typeof input === 'object' ? input : {};
  return {
    contract: normalizeFilterList(filters.contract),
    financial: normalizeFilterList(filters.financial),
    recurrence: normalizeFilterList(filters.recurrence),
  };
}

export function hasSegmentFilters(filters) {
  return Boolean(
    filters &&
      (filters.contract.length ||
        filters.financial.length ||
        filters.recurrence.length)
  );
}

/** Dentro de cada grupo é OU; entre grupos é E. Grupo vazio não restringe. */
export function matchesSegment(profile, filters) {
  if (!profile) return false;
  const pass = (list, value) => !list.length || list.includes(value);
  return (
    pass(filters.contract, profile.contract) &&
    pass(filters.financial, profile.financial) &&
    pass(filters.recurrence, profile.recurrence)
  );
}
