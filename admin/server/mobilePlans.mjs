import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'mobile-plans.json');

const ALTAREDE_URL =
  process.env.ALTAREDE_PLANS_URL ||
  'https://webhook.trtelecom.net/webhook/listar-planos-altarede';

/**
 * Nomes comerciais da tabela oficial (GIGA).
 * O COD_PLANO do AltaRede é a chave estável.
 */
const COMMERCIAL_OVERRIDES = {
  216: {
    displayName: 'Essencial',
    totalGb: 6,
    dataGb: 3,
    portGb: 0,
    bonusGb: 0,
    voice: 'Conforme plano',
    sms: 'Conforme plano',
    benefits: 'WhatsApp ilimitado',
    lineup: 'comercial',
  },
  218: {
    displayName: '10 GIGA',
    totalGb: 10,
    dataGb: 6,
    portGb: 2,
    bonusGb: 2,
    voice: '100 min',
    sms: '50 SMS',
    benefits: 'WhatsApp ilimitado, Plataforma de cursos online',
    lineup: 'comercial',
  },
  219: {
    displayName: '18 GIGA',
    totalGb: 18,
    dataGb: 12,
    portGb: 2,
    bonusGb: 4,
    voice: 'Voz ilimitada',
    sms: '100 SMS',
    benefits: 'WhatsApp ilimitado, Plataforma de cursos online',
    lineup: 'comercial',
  },
  220: {
    displayName: '25 GIGA',
    totalGb: 25,
    dataGb: 15,
    portGb: 3,
    bonusGb: 7,
    voice: 'Voz ilimitada',
    sms: '100 SMS',
    benefits: 'WhatsApp ilimitado, Plataforma de cursos online',
    lineup: 'comercial',
  },
  221: {
    displayName: '35 GIGA',
    totalGb: 35,
    dataGb: 20,
    portGb: 5,
    bonusGb: 10,
    voice: 'Voz ilimitada',
    sms: '100 SMS',
    benefits: 'WhatsApp ilimitado, Plataforma de cursos online',
    lineup: 'comercial',
  },
  222: {
    displayName: '50 GIGA',
    totalGb: 50,
    dataGb: 25,
    portGb: 5,
    bonusGb: 20,
    voice: 'Voz ilimitada',
    sms: '100 SMS',
    benefits: 'WhatsApp ilimitado, Plataforma de cursos online',
    lineup: 'comercial',
  },
};

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

export function readMobilePlans() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function writeMobilePlans(plans) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(plans, null, 2), 'utf8');
}

export function sortMobilePlans(plans) {
  return [...plans].sort((a, b) => {
    const ao = Number(a.order ?? 999);
    const bo = Number(b.order ?? 999);
    if (ao !== bo) return ao - bo;
    return (a.monthlyPrice || 0) - (b.monthlyPrice || 0);
  });
}

export function isMobileAltaRedePlan(name) {
  const value = String(name || '').toUpperCase();
  if (!value) return false;
  if (value === 'TR TELEFONIA') return true;
  if (value.includes('[EAI]')) return true;
  if (value.includes('PORTIN')) return true;
  if (/TRTELECOM_.*\d+\s*GB/.test(value)) return true;
  if (/TRTELECOM_.*\d+MIN/.test(value)) return true;
  return false;
}

function parseDataGb(name) {
  const value = String(name || '');
  const match = value.match(/(\d+)\s*GB/i);
  return match ? Number(match[1]) : 0;
}

function parseMinutes(name) {
  const value = String(name || '');
  const match = value.match(/(\d+)\s*MIN/i);
  return match ? Number(match[1]) : 0;
}

function defaultDisplayName(name, code) {
  const override = COMMERCIAL_OVERRIDES[code];
  if (override?.displayName) return override.displayName;

  return String(name || '')
    .replace(/\[EAI\]/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\+\s*B[OÔ]NUS/gi, '')
    .trim();
}

function mapRawPlan(raw, existing = null) {
  const code = Number(raw.COD_PLANO) || 0;
  if (!code) return null;

  const name = String(raw.NOME || '').trim();
  if (!isMobileAltaRedePlan(name)) return null;
  if (String(raw.EXCLUIDO || 'N').toUpperCase() === 'S') return null;

  const override = COMMERCIAL_OVERRIDES[code] || {};
  const monthlyPrice = Number(raw.VALOR_MENSAL) || 0;
  const now = new Date().toISOString();

  return {
    id: `mobile-${code}`,
    code,
    name,
    displayName: existing?.displayName || override.displayName || defaultDisplayName(name, code),
    monthlyPrice,
    dataGb: override.dataGb ?? parseDataGb(name),
    portGb: override.portGb ?? 0,
    bonusGb: override.bonusGb ?? 0,
    totalGb: override.totalGb ?? parseDataGb(name),
    voiceMinutes: override.voice || (parseMinutes(name) ? `${parseMinutes(name)} min` : ''),
    sms: override.sms || '',
    benefits: existing?.benefits || override.benefits || '',
    lineup: override.lineup || 'altarede',
    habilitarContratacao: String(raw.HABILITAR_CONTRATACAO || 'S').toUpperCase() !== 'N',
    /** Controla se aparece no app. */
    showInApp: existing?.showInApp === true,
    order:
      existing?.order ??
      (override.lineup === 'comercial' ? code - 200 : 500 + code),
    syncedAt: now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export async function syncMobilePlansFromAltaRede() {
  const response = await fetch(ALTAREDE_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`AltaRede respondeu ${response.status}`);
  }

  const data = await response.json();
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.planos)
      ? data.planos
      : [];

  const existing = readMobilePlans();
  const byCode = new Map(existing.map((item) => [item.code, item]));
  const next = [];

  for (const raw of list) {
    const mapped = mapRawPlan(raw, byCode.get(Number(raw.COD_PLANO)) || null);
    if (mapped) next.push(mapped);
  }

  // Mantém planos locais que sumiram do AltaRede (histórico), só marca.
  for (const old of existing) {
    if (!next.some((item) => item.code === old.code)) {
      next.push({
        ...old,
        missingFromAltaRede: true,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  writeMobilePlans(sortMobilePlans(next));
  return sortMobilePlans(next);
}

export function toggleMobilePlan(id) {
  const plans = readMobilePlans();
  const index = plans.findIndex((item) => item.id === id);
  if (index < 0) return null;
  plans[index] = {
    ...plans[index],
    showInApp: !plans[index].showInApp,
    updatedAt: new Date().toISOString(),
  };
  writeMobilePlans(plans);
  return plans[index];
}

export function updateMobilePlan(id, patch = {}) {
  const plans = readMobilePlans();
  const index = plans.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = plans[index];
  plans[index] = {
    ...current,
    displayName:
      patch.displayName !== undefined
        ? String(patch.displayName || '').trim() || current.displayName
        : current.displayName,
    benefits:
      patch.benefits !== undefined
        ? String(patch.benefits || '').trim()
        : current.benefits,
    order:
      patch.order !== undefined && Number.isFinite(Number(patch.order))
        ? Number(patch.order)
        : current.order,
    showInApp:
      patch.showInApp !== undefined ? !!patch.showInApp : current.showInApp,
    updatedAt: new Date().toISOString(),
  };
  writeMobilePlans(plans);
  return plans[index];
}

export function listPublicMobilePlans() {
  return sortMobilePlans(readMobilePlans()).filter(
    (item) => item.showInApp && item.habilitarContratacao !== false
  );
}

/** Normaliza nome EAI/AltaRede para cruzar planos. */
export function normalizeMobilePlanKey(name) {
  return String(name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[EAI\]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s*\+\s*/g, '+')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Localiza o plano AltaRede (preço que o cliente paga) a partir do nome EAI/MVNO.
 */
export function findAltaRedePlanByMvnoName(planName) {
  const key = normalizeMobilePlanKey(planName);
  if (!key) return null;

  const plans = readMobilePlans();
  const exact = plans.find((plan) => {
    const nameKey = normalizeMobilePlanKey(plan.name);
    const displayKey = normalizeMobilePlanKey(plan.displayName);
    return nameKey === key || displayKey === key;
  });
  if (exact) return exact;

  // Fallback: chave contida (ex.: nome MVNO sem sufixos extras).
  return (
    plans.find((plan) => {
      const nameKey = normalizeMobilePlanKey(plan.name);
      return nameKey.includes(key) || key.includes(nameKey);
    }) || null
  );
}
