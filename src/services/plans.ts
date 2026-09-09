import { apiRequest } from '@/src/services/api';

export type CatalogPlan = {
  id: string;
  code: number;
  name: string;
  displayName: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number;
  isPj: boolean;
  family: PlanFamily;
  rawName: string;
};

export type PlanFamily = 'tr_fiber' | 'turbo_fibra' | 'other';

type RawPlan = {
  COD_PLANO?: number | string;
  NOME?: string;
  VALOR_MENSAL?: string | number;
  VEL_DOWNLOAD?: string | number;
  VEL_UPLOAD?: string | number;
  EXCLUIDO?: string;
  HABILITAR_CONTRATACAO?: string;
};

/** Fora de linha / legado / add-on / promo regional. */
const EXCLUDE_NAME =
  /DEDICADO|CELETIHUB|\[EAI\]|SOFTSWITCH|ADICIONAL|BLOQUEIO|TELEFONIA|WIFI_CENTRAL|COLOCATION|CAMERAS|CONNECT_|LINK_|DUPLA|HISTORINHAAS|LE_AI|TELEMEDICINA|PREMIERE|GLOBOPLAY|TELECINE|SAPERX|PROMO|S\.PEREIRA|ULTRA FIBRA|BRONZE|COLOCATION|MEGA TURBO/i;

function kbpsToMbps(value?: string | number): number {
  const kbps = Number(value);
  if (!Number.isFinite(kbps) || kbps <= 0) return 0;
  return Math.round(kbps / 1024);
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export function formatPlanDisplayName(name: string): string {
  const cleaned = name
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\sPJ$/i, '')
    .trim();

  return cleaned
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bMegas?\b/gi, 'Mbps')
    .replace(/\bMega\b/gi, 'Mbps')
    .replace(/\b1 G\b/gi, '1 Gbps')
    .replace(/\b1g\b/gi, '1 Gbps');
}

function isPjPlan(name: string): boolean {
  return /(?:^|[\s_])PJ(?:$|[\s_])/i.test(name) || /_PJ$/i.test(name);
}

export function detectPlanFamily(name: string): PlanFamily {
  const value = name.toUpperCase();
  if (value.includes('TR FIBER') || value.includes('TRFIBER')) return 'tr_fiber';
  if (value.includes('TURBO FIBRA') || value.includes('TURBOFIBRA')) {
    return 'turbo_fibra';
  }
  return 'other';
}

/**
 * Planos comerciais em vigor hoje:
 * - linha TR Fiber (principal)
 * - linha Turbo Fibra (ainda ativa)
 * Sem promo, regional, dedicado ou legado Ultra.
 */
function isActiveCatalogPlan(raw: RawPlan): boolean {
  if (String(raw.EXCLUIDO || 'N').toUpperCase() === 'S') return false;
  if (String(raw.HABILITAR_CONTRATACAO || 'S').toUpperCase() === 'N') {
    return false;
  }

  const name = String(raw.NOME || '').trim();
  if (!name || EXCLUDE_NAME.test(name)) return false;

  const family = detectPlanFamily(name);
  if (family === 'other') return false;

  const downloadMbps = kbpsToMbps(raw.VEL_DOWNLOAD);
  const price = Number(raw.VALOR_MENSAL);

  if (downloadMbps < 25) return false;
  if (!Number.isFinite(price) || price < 50 || price > 200) return false;

  return true;
}

function mapPlan(raw: RawPlan): CatalogPlan | null {
  if (!isActiveCatalogPlan(raw)) return null;

  const name = String(raw.NOME || '').trim();
  const code = Number(raw.COD_PLANO) || 0;

  return {
    id: String(code || normalizeKey(name)),
    code,
    name,
    displayName: formatPlanDisplayName(name),
    downloadMbps: kbpsToMbps(raw.VEL_DOWNLOAD),
    uploadMbps: kbpsToMbps(raw.VEL_UPLOAD),
    monthlyPrice: Number(raw.VALOR_MENSAL) || 0,
    isPj: isPjPlan(name),
    family: detectPlanFamily(name),
    rawName: name,
  };
}

export async function fetchCatalogPlans(): Promise<CatalogPlan[]> {
  const data = await apiRequest<RawPlan[] | { planos?: RawPlan[] }>(
    '/webhook/listar-planos-altarede',
    { method: 'GET', timeoutMs: 20000 }
  );

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.planos)
      ? data.planos
      : [];

  return list
    .map(mapPlan)
    .filter((item): item is CatalogPlan => !!item)
    .sort(
      (a, b) =>
        a.downloadMbps - b.downloadMbps || a.monthlyPrice - b.monthlyPrice
    );
}

function findCurrentPlan(
  plans: CatalogPlan[],
  planName: string,
  speedMbps: number
): CatalogPlan | null {
  const key = normalizeKey(planName);
  if (key) {
    const byName = plans.find(
      (plan) =>
        normalizeKey(plan.name) === key ||
        normalizeKey(plan.name).includes(key) ||
        key.includes(normalizeKey(plan.name))
    );
    if (byName) return byName;
  }

  if (speedMbps > 0) {
    const bySpeed = plans
      .filter((plan) => plan.downloadMbps === speedMbps)
      .sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    if (bySpeed.length) return bySpeed[0];
  }

  return null;
}

/** Próximos planos em vigor maiores que o atual. */
export function pickUpgradePlans(
  plans: CatalogPlan[],
  options: {
    currentPlanName: string;
    currentSpeedMbps: number;
    limit?: number;
  }
): {
  current: CatalogPlan | null;
  upgrades: CatalogPlan[];
} {
  const limit = options.limit ?? 2;
  const current = findCurrentPlan(
    plans,
    options.currentPlanName,
    options.currentSpeedMbps
  );

  const currentSpeed =
    current?.downloadMbps ||
    (options.currentSpeedMbps > 0 ? options.currentSpeedMbps : 0);

  if (currentSpeed <= 0) {
    return { current, upgrades: [] };
  }

  const preferPj = current?.isPj ?? isPjPlan(options.currentPlanName);
  const preferredFamily =
    current?.family ??
    detectPlanFamily(options.currentPlanName);

  let pool = plans.filter(
    (plan) =>
      plan.downloadMbps > currentSpeed && plan.isPj === preferPj
  );

  // Prioriza a mesma linha comercial (TR Fiber / Turbo Fibra).
  if (preferredFamily !== 'other') {
    const sameFamily = pool.filter((plan) => plan.family === preferredFamily);
    if (sameFamily.length) pool = sameFamily;
  } else {
    // Cliente em plano legado: sobe pela linha principal em vigor.
    const trFiber = pool.filter((plan) => plan.family === 'tr_fiber');
    if (trFiber.length) pool = trFiber;
  }

  const bySpeed = new Map<number, CatalogPlan>();
  for (const plan of pool) {
    const existing = bySpeed.get(plan.downloadMbps);
    if (!existing || plan.monthlyPrice < existing.monthlyPrice) {
      bySpeed.set(plan.downloadMbps, plan);
    }
  }

  const upgrades = [...bySpeed.values()]
    .sort((a, b) => a.downloadMbps - b.downloadMbps)
    .slice(0, limit);

  return { current, upgrades };
}

/** Planos em vigor hoje para contratação nova: 50 Mbps, 650 Mbps e 1 Gbps. */
export const HIRE_OFFER_SPEEDS = [50, 650, 1000] as const;

export function matchHireOfferSpeed(mbps: number): number | null {
  if (mbps >= 900 && mbps <= 1100) return 1000;
  if (Math.abs(mbps - 650) <= 40) return 650;
  if (Math.abs(mbps - 50) <= 15) return 50;
  return null;
}

export function hireSpeedLabel(mbps: number): string {
  const speed = matchHireOfferSpeed(mbps) ?? mbps;
  return speed >= 1000 ? '1 Gbps' : `${speed} Mbps`;
}

/** Planos residenciais (ou PJ) em vigor hoje: 50, 650 e 1 Gb. */
export function pickHirePlans(
  plans: CatalogPlan[],
  options: { isPj?: boolean } = {}
): CatalogPlan[] {
  const preferPj = options.isPj ?? false;
  let pool = plans.filter((plan) => plan.isPj === preferPj);
  if (!pool.length) pool = plans.filter((plan) => !plan.isPj);

  const trFiber = pool.filter((plan) => plan.family === 'tr_fiber');
  if (trFiber.length) pool = trFiber;

  const byOffer = new Map<number, CatalogPlan>();
  for (const plan of pool) {
    const offerSpeed = matchHireOfferSpeed(plan.downloadMbps);
    if (offerSpeed == null) continue;
    const existing = byOffer.get(offerSpeed);
    if (!existing || plan.monthlyPrice < existing.monthlyPrice) {
      byOffer.set(offerSpeed, plan);
    }
  }

  return HIRE_OFFER_SPEEDS.map((speed) => byOffer.get(speed)).filter(
    (plan): plan is CatalogPlan => !!plan
  );
}

export function speedGainLabel(fromMbps: number, toMbps: number): string {
  if (fromMbps <= 0) return `Até ${toMbps} Mbps`;
  const gain = Math.round((toMbps / fromMbps) * 10) / 10;
  if (gain >= 2) return `${gain}x mais rápido`;
  const delta = toMbps - fromMbps;
  return `+${delta} Mbps`;
}
