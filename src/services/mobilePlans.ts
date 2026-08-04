import { apiRequest } from '@/src/services/api';
import { getBannersApiBase } from '@/src/services/banners';

export type AppMobilePlan = {
  id: string;
  code: number;
  name: string;
  displayName: string;
  monthlyPrice: number;
  dataGb: number;
  portGb: number;
  bonusGb: number;
  totalGb: number;
  voiceMinutes: string;
  sms: string;
  benefits: string;
  lineup: string;
  order: number;
};

export type MvnoLine = {
  id: string;
  msisdn: string | null;
  msisdnLabel: string;
  iccid: string | null;
  status: string | null;
  statusLabel: string;
  planId: string | null;
  planName: string;
  planMonthlyPrice?: number | null;
  planDataGb?: number | null;
  planVoice?: string | null;
  planSms?: string | null;
  personId: string | null;
  document?: string | null;
};

export type MvnoConsumption = {
  dataUsed: number | string | null;
  dataTotal: number | string | null;
  dataAvailable?: number | string | null;
  dataUnit: string;
  voiceUsed: number | string | null;
  voiceTotal: number | string | null;
  voiceAvailable?: number | string | null;
  smsUsed: number | string | null;
  smsTotal: number | string | null;
  smsAvailable?: number | string | null;
  whatsappUsed: number | string | null;
  whatsappTotal: number | string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type MvnoUpgradePlan = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  dataGb: number | null;
};

export type MvnoSubscriberLookup = {
  configured: boolean;
  hasLine: boolean;
  tenantConfigured?: boolean;
  customer: { personId: string | null; document: string } | null;
  line: MvnoLine | null;
  consumption: MvnoConsumption | null;
  upgrades: MvnoUpgradePlan[];
  message?: string;
};

/**
 * Planos móveis liberados no painel (showInApp).
 * Se a API local estiver offline, retorna lista vazia.
 */
export async function fetchAppMobilePlans(): Promise<AppMobilePlan[]> {
  const base = getBannersApiBase();
  if (!base) return [];

  try {
    const data = await apiRequest<{ plans?: AppMobilePlan[] }>(
      `${base}/api/mobile-plans`,
      { method: 'GET', timeoutMs: 12000 }
    );
    return Array.isArray(data?.plans) ? data.plans : [];
  } catch {
    return [];
  }
}

/** Consulta linha MVNO do CPF: plano atual + consumo. */
export async function fetchMvnoSubscriber(
  document: string
): Promise<MvnoSubscriberLookup | null> {
  const base = getBannersApiBase();
  if (!base) return null;

  try {
    return await apiRequest<MvnoSubscriberLookup>(
      `${base}/api/mobile/subscriber?document=${encodeURIComponent(document)}`,
      { method: 'GET', timeoutMs: 20000 }
    );
  } catch {
    return null;
  }
}
