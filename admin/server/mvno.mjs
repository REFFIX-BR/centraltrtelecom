import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { findAltaRedePlanByMvnoName } from './mobilePlans.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const BASE_URL = (
  process.env.MVNO_BASE_URL || 'https://api.corevo.dev'
).replace(/\/$/, '');
const TENANT = String(process.env.MVNO_TENANT || '').trim();
const CLIENT_ID = String(process.env.MVNO_CLIENT_ID || '').trim();
const CLIENT_SECRET = String(process.env.MVNO_CLIENT_SECRET || '').trim();

const PREFIX = '/api/rest/service_telecom';

let cachedAuth = null;

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function authHeaders(accessToken, companyToken) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (TENANT) headers['x-tenant'] = TENANT;
  if (companyToken) {
    headers.CompanyToken = companyToken;
    headers['company-token'] = companyToken;
  }
  return headers;
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function getAccessToken() {
  if (!isConfigured()) {
    throw new Error(
      'MVNO não configurada. Informe MVNO_CLIENT_ID e MVNO_CLIENT_SECRET em admin/.env'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (TENANT) headers['x-tenant'] = TENANT;

  const response = await fetch(`${BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers,
    body,
  });
  const data = await parseJson(response);
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.message ||
        data.error_description ||
        data.error ||
        `Falha OAuth MVNO (${response.status})`
    );
  }

  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 25,
  };
}

async function getCompanyToken(accessToken) {
  const response = await fetch(`${BASE_URL}${PREFIX}/companies`, {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      data.message || `Falha ao obter CompanyToken (${response.status})`
    );
  }

  const list = Array.isArray(data?.companies)
    ? data.companies
    : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];

  const first = list[0];
  const token = first?.token || first?.companyToken || first?.CompanyToken;
  if (!token) {
    throw new Error('Nenhuma empresa/CompanyToken retornada pela MVNO.');
  }
  return String(token);
}

async function ensureAuth() {
  const now = Date.now();
  if (
    cachedAuth &&
    cachedAuth.expiresAt > now + 3000 &&
    cachedAuth.accessToken &&
    cachedAuth.companyToken
  ) {
    return cachedAuth;
  }

  const { accessToken, expiresIn } = await getAccessToken();
  const companyToken = await getCompanyToken(accessToken);
  cachedAuth = {
    accessToken,
    companyToken,
    expiresAt: now + Math.max(8, expiresIn - 5) * 1000,
  };
  return cachedAuth;
}

async function mvnoRequest(pathname, options = {}) {
  const auth = await ensureAuth();
  const response = await fetch(`${BASE_URL}${PREFIX}${pathname}`, {
    ...options,
    headers: {
      ...authHeaders(auth.accessToken, auth.companyToken),
      ...(options.headers || {}),
    },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    const err = new Error(
      data.message || data.error || `MVNO ${response.status}`
    );
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

function pickArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.lines)) return data.lines;
  if (Array.isArray(data?.plans)) return data.plans;
  if (Array.isArray(data?.customers)) return data.customers;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function statusLabel(status) {
  const map = {
    mlsActive: 'Ativa',
    mlsInactive: 'Inativa',
    mlsWaitingPortability: 'Aguardando portabilidade',
    mlsCanceled: 'Cancelada',
    mlsPorted: 'Portada',
    mlsPortout: 'Portabilidade saída',
    mlsBlocked: 'Bloqueada',
    mlsSuspended: 'Suspensa',
    mlsQuarantine: 'Quarentena',
    mlsNone: 'Sem status',
  };
  return map[status] || status || '—';
}

function formatMsisdn(value) {
  const digits = onlyDigits(value);
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const num = digits.slice(4);
    if (num.length === 9) {
      return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    }
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return value || '—';
}

function mbToGb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 1024) * 10) / 10;
}

function formatPlanName(name) {
  const text = String(name || '').trim();
  if (!text) return 'Plano atual';
  return text.replace(/_/g, ' ');
}

function quotaBucket(obj) {
  if (!obj || typeof obj !== 'object') {
    return { used: null, total: null, available: null };
  }
  const used = obj.used ?? obj.consumed ?? obj.usage ?? null;
  const total = obj.plan ?? obj.total ?? obj.limit ?? obj.quota ?? null;
  const available = obj.available ?? null;
  return { used, total, available };
}

function mapLine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.lineId || raw.uuid || '');
  if (!id) return null;

  const plan =
    raw.recurrenceData?.plan ||
    raw.lastLinePlan?.plan ||
    raw.plan ||
    raw.mvnoPlan ||
    raw.currentPlan ||
    raw.product ||
    null;

  const person = raw.person || raw.customer || null;
  const personId =
    String(person?.id || raw.personId || raw.customerId || '') || null;
  const document = onlyDigits(person?.document || raw.document || '');

  const internetMb = Number(plan?.internet);
  const eaiCost = Number(plan?.value ?? plan?.price ?? raw.lastLinePlan?.value);
  const altaRede = findAltaRedePlanByMvnoName(plan?.name || plan?.description);
  // Preço exibido = o que o cliente paga (AltaRede), não o custo EAI.
  const customerPrice = Number(altaRede?.monthlyPrice);
  const planMonthlyPrice = Number.isFinite(customerPrice)
    ? customerPrice
    : null;

  return {
    id,
    msisdn: raw.msisdn || raw.MSISDN || raw.phone || raw.number || null,
    msisdnLabel: formatMsisdn(
      raw.msisdn || raw.MSISDN || raw.phone || raw.number || ''
    ),
    iccid: raw.iccid || raw.ICCID || null,
    status: raw.status || raw.lineStatus || null,
    statusLabel: statusLabel(raw.status || raw.lineStatus),
    planId: String(plan?.id || raw.planId || raw.mvnoPlanId || '') || null,
    planName:
      altaRede?.displayName ||
      formatPlanName(
        plan?.name || plan?.description || raw.planName || raw.productName
      ),
    planMonthlyPrice,
    planEaiCost: Number.isFinite(eaiCost) ? eaiCost : null,
    planAltaRedeCode: altaRede?.code ?? null,
    planDataGb: Number.isFinite(internetMb) ? mbToGb(internetMb) : null,
    planVoice: plan?.voice != null ? String(plan.voice) : null,
    planSms: plan?.sms != null ? String(plan.sms) : null,
    personId: personId && personId !== '0' ? personId : null,
    document: document || null,
    raw,
  };
}

function mapConsumption(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Payload real: { data: {...}, voice: {...}, sms: {...} }
  // Evitar usar raw.data como envelope inteiro.
  const hasBuckets =
    raw.data || raw.voice || raw.sms || raw.whatsapp || raw.whatsApp;
  const data = hasBuckets
    ? raw.data || raw.dados || raw.internet || {}
    : raw;
  const voice = hasBuckets ? raw.voice || raw.voz || {} : {};
  const sms = hasBuckets ? raw.sms || {} : {};
  const whatsapp = hasBuckets ? raw.whatsapp || raw.whatsApp || {} : {};

  const dataQ = quotaBucket(data);
  const voiceQ = quotaBucket(voice);
  const smsQ = quotaBucket(sms);
  const whatsappQ = quotaBucket(whatsapp);

  const dataTotalMb = Number(dataQ.total);
  const useGb = Number.isFinite(dataTotalMb) && dataTotalMb >= 1024;

  return {
    dataUsed: useGb ? mbToGb(dataQ.used) : dataQ.used,
    dataTotal: useGb ? mbToGb(dataQ.total) : dataQ.total,
    dataAvailable: useGb ? mbToGb(dataQ.available) : dataQ.available,
    dataUnit: useGb ? 'GB' : 'MB',
    voiceUsed: voiceQ.used,
    voiceTotal: voiceQ.total,
    voiceAvailable: voiceQ.available,
    smsUsed: smsQ.used,
    smsTotal: smsQ.total,
    smsAvailable: smsQ.available,
    whatsappUsed: whatsappQ.used,
    whatsappTotal: whatsappQ.total,
    periodStart: raw.periodStart || raw.startDate || raw.begin || null,
    periodEnd: raw.periodEnd || raw.endDate || raw.end || null,
    raw,
  };
}

export async function lookupSubscriberByDocument(document) {
  const cpfCnpj = onlyDigits(document);
  if (cpfCnpj.length < 11) {
    throw new Error('Informe um CPF/CNPJ válido.');
  }

  if (!isConfigured()) {
    return {
      configured: false,
      hasLine: false,
      customer: null,
      line: null,
      consumption: null,
      upgrades: [],
      message: 'Integração MVNO ainda sem credenciais completas.',
    };
  }

  let existsPayload = null;
  try {
    existsPayload = await mvnoRequest(
      `/customers/check_already_exists/${cpfCnpj}`,
      { method: 'GET' }
    );
  } catch (error) {
    // Sem tenant a API pode falhar — propaga mensagem clara.
    if (!TENANT && (error.status === 400 || error.status === 401)) {
      throw new Error(
        'MVNO respondeu erro de autenticação. Sem x-tenant a API pode bloquear; confirme o tenant com a Corevo/EAI.'
      );
    }
    throw error;
  }

  const rawPersonId = String(
    existsPayload?.personId ||
      existsPayload?.id ||
      existsPayload?.customer?.id ||
      existsPayload?.data?.personId ||
      existsPayload?.data?.id ||
      ''
  );
  const personId = rawPersonId && rawPersonId !== '0' ? rawPersonId : '';

  const exists =
    existsPayload?.exists === true ||
    existsPayload?.alreadyExists === true ||
    existsPayload?.data?.exists === true ||
    Boolean(personId || existsPayload?.customer);

  // Busca linhas filtrando por documento/person quando a API permitir.
  const queryCandidates = [
    `?pagination.page=1&pagination.limit=20&cpfCnpj=${cpfCnpj}`,
    `?pagination.page=1&pagination.limit=20&document=${cpfCnpj}`,
    personId
      ? `?pagination.page=1&pagination.limit=20&personId=${encodeURIComponent(personId)}`
      : null,
    // Fallback amplo: depois filtra estritamente pelo CPF no app.
    `?pagination.page=1&pagination.limit=100`,
  ].filter(Boolean);

  let lines = [];
  for (const query of queryCandidates) {
    try {
      const payload = await mvnoRequest(`/mvno_lines${query}`, {
        method: 'GET',
      });
      const list = pickArray(payload).map(mapLine).filter(Boolean);
      const filtered = list.filter((item) => {
        const doc = onlyDigits(item.document);
        if (doc && doc === cpfCnpj) return true;
        if (personId && item.personId === personId) return true;
        return false;
      });
      if (filtered.length) {
        lines = filtered;
        break;
      }
    } catch {
      // tenta próximo filtro
    }
  }

  const active =
    lines.find((item) => /active|ativa/i.test(String(item.status || ''))) ||
    lines[0] ||
    null;

  if (!active) {
    return {
      configured: true,
      hasLine: false,
      customer: personId || exists ? { personId: personId || null, document: cpfCnpj } : null,
      line: null,
      consumption: null,
      upgrades: [],
    };
  }

  let consumption = null;
  try {
    const payload = await mvnoRequest(
      `/mvno_lines/${encodeURIComponent(active.id)}/consumption`,
      { method: 'GET' }
    );
    // Não usar payload.data — isso é o bucket de internet, não o envelope.
    consumption = mapConsumption(payload);
  } catch {
    consumption = null;
  }

  // Por enquanto só plano atual + consumo (sem upgrades).
  return {
    configured: true,
    hasLine: true,
    customer: {
      personId: active.personId || personId || null,
      document: cpfCnpj,
    },
    line: active,
    consumption,
    upgrades: [],
    tenantConfigured: Boolean(TENANT),
  };
}

export function getMvnoStatus() {
  return {
    configured: isConfigured(),
    tenantConfigured: Boolean(TENANT),
    baseUrl: BASE_URL,
  };
}
