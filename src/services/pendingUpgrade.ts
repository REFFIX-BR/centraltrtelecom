import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = '@trtelecom/pending_upgrade_v1';
const ACTIVATED_KEY = '@trtelecom/activated_upgrade_v1';

/** Banner de “upgrade ativado” fica 3 dias. */
export const ACTIVATED_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type PendingUpgrade = {
  planName: string;
  speedMbps: number;
  price: number;
  saleId: string | null;
  protocol: string;
  status: string;
  currentPlanName: string;
  currentSpeedMbps: number;
  customerKey: string;
  assinaturaUrl?: string | null;
  contractId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivatedUpgrade = {
  planName: string;
  speedMbps: number;
  price: number;
  saleId: string | null;
  protocol: string;
  previousPlanName: string;
  previousSpeedMbps: number;
  customerKey: string;
  activatedAt: string;
  expiresAt: string;
};

function protocolFromSaleId(saleId: string | null | undefined): string {
  const value = String(saleId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase();
  return value || `OS${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function customerKeyFrom(document: string, login?: string): string {
  return `${String(document || '').replace(/\D/g, '')}:${String(login || '').trim()}`;
}

export function daysLeftLabel(expiresAt: string, now = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'Expira hoje';
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'Some amanhã';
  return `Visível por mais ${days} dias`;
}

export async function loadPendingUpgrade(
  customerKey: string
): Promise<PendingUpgrade | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingUpgrade;
    if (!data?.customerKey || data.customerKey !== customerKey) return null;
    if (!data.planName || !data.speedMbps) return null;
    return data;
  } catch {
    return null;
  }
}

export async function savePendingUpgrade(
  input: Omit<PendingUpgrade, 'protocol' | 'createdAt' | 'updatedAt'> & {
    protocol?: string;
  }
): Promise<PendingUpgrade> {
  const now = new Date().toISOString();
  const existing = await loadPendingUpgrade(input.customerKey);
  const next: PendingUpgrade = {
    ...input,
    protocol: input.protocol || protocolFromSaleId(input.saleId),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next));
  return next;
}

export async function clearPendingUpgrade(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_KEY);
}

export async function loadActivatedUpgrade(
  customerKey: string
): Promise<ActivatedUpgrade | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVATED_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ActivatedUpgrade;
    if (!data?.customerKey || data.customerKey !== customerKey) return null;
    if (!data.expiresAt || Date.now() >= new Date(data.expiresAt).getTime()) {
      await clearActivatedUpgrade();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function saveActivatedUpgrade(
  input: Omit<ActivatedUpgrade, 'activatedAt' | 'expiresAt'> & {
    activatedAt?: string;
  }
): Promise<ActivatedUpgrade> {
  const activatedAt = input.activatedAt || new Date().toISOString();
  const expiresAt = new Date(
    new Date(activatedAt).getTime() + ACTIVATED_TTL_MS
  ).toISOString();
  const next: ActivatedUpgrade = {
    ...input,
    activatedAt,
    expiresAt,
  };
  await AsyncStorage.setItem(ACTIVATED_KEY, JSON.stringify(next));
  return next;
}

export async function clearActivatedUpgrade(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVATED_KEY);
}

/** Converte pedido pendente em banner de ativado (3 dias) e limpa o pendente. */
export async function promotePendingToActivated(
  pending: PendingUpgrade
): Promise<ActivatedUpgrade> {
  const activated = await saveActivatedUpgrade({
    customerKey: pending.customerKey,
    planName: pending.planName,
    speedMbps: pending.speedMbps,
    price: pending.price,
    saleId: pending.saleId,
    protocol: pending.protocol,
    previousPlanName: pending.currentPlanName,
    previousSpeedMbps: pending.currentSpeedMbps,
  });
  await clearPendingUpgrade();
  return activated;
}
