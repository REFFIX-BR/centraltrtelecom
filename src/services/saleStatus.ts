import { ApiError, apiRequest } from '@/src/services/api';
import { onlyDigits } from '@/src/utils/format';

const COMERCIAL_BASE =
  process.env.EXPO_PUBLIC_COMERCIAL_URL?.replace(/\/$/, '') ||
  'https://comercial.trtelecom.net';

export type SaleStatusItem = {
  id: string;
  status: string;
  saleDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  installedAt?: string | null;
  planId?: number | null;
  pedidoTipo?: string | null;
  clienteNome?: string | null;
  clienteTelefone?: string | null;
};

export type SaleStatusResponse = {
  success: boolean;
  encontrado: boolean;
  documento: string;
  tipoDocumento?: string;
  status: string | null;
  venda: SaleStatusItem | null;
  total?: number;
  vendas?: SaleStatusItem[];
  message?: string;
};

/** Passo visual do modal (1 = enviada, 2 = análise, 3 = ativação). */
export type UpgradeProgressStep = 1 | 2 | 3;

export type UpgradeSalePhase =
  | 'analysis'
  | 'activation'
  | 'done'
  | 'cancelled'
  | 'unknown';

export type UpgradeStatusView = {
  status: string;
  phase: UpgradeSalePhase;
  /** Último passo concluído/ativo no stepper (1–3). */
  activeStep: UpgradeProgressStep;
  sale: SaleStatusItem | null;
};

function normalizeStatus(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function classifySaleStatus(
  status: string | null | undefined
): UpgradeStatusView {
  const raw = String(status || '').trim() || 'Aguardando Análise';
  const key = normalizeStatus(raw);

  if (
    key.includes('cancel') ||
    key.includes('desist') ||
    key.includes('inadimpl')
  ) {
    return { status: raw, phase: 'cancelled', activeStep: 2, sale: null };
  }

  if (key.includes('instal')) {
    return { status: raw, phase: 'done', activeStep: 3, sale: null };
  }

  if (key.includes('aprovad') || key.includes('agendad')) {
    return { status: raw, phase: 'activation', activeStep: 3, sale: null };
  }

  // Aguardando Análise, Prospecção, etc.
  return { status: raw, phase: 'analysis', activeStep: 2, sale: null };
}

function isUpgradePedido(pedidoTipo: string | null | undefined): boolean {
  return /upgrade/i.test(String(pedidoTipo || ''));
}

/** Escolhe a venda de upgrade relevante (por saleId ou mais recente Upgrade). */
export function pickRelevantSale(
  data: SaleStatusResponse,
  saleId?: string | null
): SaleStatusItem | null {
  const list = Array.isArray(data.vendas)
    ? data.vendas
    : data.venda
      ? [data.venda]
      : [];

  if (saleId) {
    const byId = list.find((item) => String(item.id) === String(saleId));
    if (byId) return byId;
  }

  const upgrades = list.filter((item) => isUpgradePedido(item.pedidoTipo));
  if (upgrades.length) return upgrades[0];

  return data.venda || list[0] || null;
}

/**
 * GET /api/vendas/status?documento=
 * 404 → encontrado: false (não lança).
 */
export async function fetchSaleStatusByDocument(
  documento: string
): Promise<SaleStatusResponse> {
  const digits = onlyDigits(documento);
  if (digits.length !== 11 && digits.length !== 14) {
    throw new Error('Informe um CPF ou CNPJ válido.');
  }

  try {
    return await apiRequest<SaleStatusResponse>(
      `${COMERCIAL_BASE}/api/vendas/status?documento=${encodeURIComponent(digits)}`,
      { method: 'GET', timeoutMs: 12000 }
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const data = (error.data || {}) as Partial<SaleStatusResponse>;
      return {
        success: false,
        encontrado: false,
        documento: digits,
        status: null,
        venda: null,
        message:
          data.message ||
          'Nenhuma venda encontrada para o documento informado.',
      };
    }
    throw error;
  }
}

export async function resolveUpgradeStatus(input: {
  documento: string;
  saleId?: string | null;
}): Promise<UpgradeStatusView | null> {
  const data = await fetchSaleStatusByDocument(input.documento);
  if (!data.encontrado) return null;

  const sale = pickRelevantSale(data, input.saleId);
  const status = sale?.status || data.status;
  if (!status) return null;

  const view = classifySaleStatus(status);
  return { ...view, sale };
}
