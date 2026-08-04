import { apiRequest } from '@/src/services/api';
import { getBannersApiBase } from '@/src/services/banners';
import type { CatalogPlan } from '@/src/services/plans';
import type { Subscriber } from '@/src/types';
import { formatDocument, onlyDigits } from '@/src/utils/format';

export type RegisteredServiceOrder = {
  id: string;
  protocol: string;
  saleId: string | null;
  status: string;
  statusLabel: string;
};

/**
 * Espelha o upgrade no painel admin (ordens de serviço).
 * Não deve bloquear o fluxo do assinante se a API local estiver offline.
 */
export async function registerUpgradeOrder(input: {
  user: Subscriber;
  plan: CatalogPlan;
  commercialPlanId: number;
  currentPlanName: string;
  currentSpeedMbps: number;
  saleId: string | null;
  status: string;
}): Promise<RegisteredServiceOrder | null> {
  const base = getBannersApiBase();
  if (!base) return null;

  const digits = onlyDigits(input.user.document);

  try {
    const data = await apiRequest<{ order?: RegisteredServiceOrder }>(
      `${base}/api/service-orders`,
      {
        method: 'POST',
        timeoutMs: 10000,
        body: {
          type: 'upgrade',
          saleId: input.saleId,
          status: input.status,
          customerName: input.user.name,
          customerDocument: formatDocument(digits),
          customerPhone: input.user.phone,
          customerEmail: input.user.email || '',
          customerLogin: input.user.login,
          contractId: input.user.plan.contractId || '',
          currentPlanName: input.currentPlanName,
          currentSpeedMbps: input.currentSpeedMbps,
          requestedPlanName: input.plan.name,
          requestedSpeedMbps: input.plan.downloadMbps,
          monthlyPrice: input.plan.monthlyPrice,
          commercialPlanId: input.commercialPlanId,
          notes: `Upgrade solicitado pelo app · ${input.currentPlanName} → ${input.plan.name}`,
          source: 'central-assinante',
        },
      }
    );
    return data.order ?? null;
  } catch {
    return null;
  }
}
