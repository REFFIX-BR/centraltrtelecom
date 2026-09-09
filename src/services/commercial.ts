import { ApiError, apiRequest } from '@/src/services/api';
import type { CatalogPlan } from '@/src/services/plans';
import { registerUpgradeOrder } from '@/src/services/serviceOrders';
import type { AddressParts, Subscriber } from '@/src/types';
import { formatDocument, onlyDigits } from '@/src/utils/format';

const COMERCIAL_BASE =
  process.env.EXPO_PUBLIC_COMERCIAL_URL?.replace(/\/$/, '') ||
  'https://comercial.trtelecom.net';

/** Código de indicação do vendedor no comercial (obrigatório no vendachat). */
const fromEnv = process.env.EXPO_PUBLIC_COMERCIAL_VENDEDOR?.trim();
const VENDEDOR_CODIGO =
  fromEnv && fromEnv.toUpperCase() !== 'CENTRAL' ? fromEnv : 'TRJHCRMYIU';

export type CommercialPlan = {
  id: number;
  name: string;
  type: string;
  price: string | number;
  description?: string;
  is_active: boolean;
};

export type UpgradeSaleResult = {
  success: boolean;
  message: string;
  saleId: string | null;
  status: string;
  pendingItems: string[];
};

type CommercialPlansResponse = {
  success?: boolean;
  plans?: CommercialPlan[];
};

type VendachatResponse = {
  success?: boolean;
  message?: string;
  sale_id?: string;
  status?: string;
  itens_pendentes?: string[];
  error?: string;
};

function normalizePlanKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
}

export async function fetchCommercialPlans(): Promise<CommercialPlan[]> {
  const data = await apiRequest<CommercialPlansResponse | CommercialPlan[]>(
    `${COMERCIAL_BASE}/api/plans`,
    { method: 'GET', timeoutMs: 15000 }
  );

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.plans)
      ? data.plans
      : [];

  return list.filter((item) => item?.is_active !== false && item?.id != null);
}

export function matchCommercialPlan(
  catalogPlan: CatalogPlan,
  commercialPlans: CommercialPlan[]
): CommercialPlan | null {
  const target = normalizePlanKey(catalogPlan.name);
  if (!target) return null;

  const exact = commercialPlans.find(
    (plan) => normalizePlanKey(plan.name) === target
  );
  if (exact) return exact;

  // Aceita variação próxima, mantendo PF/PJ.
  const soft = commercialPlans.find((plan) => {
    const key = normalizePlanKey(plan.name);
    const planIsPj = /PJ$/i.test(plan.name);
    if (planIsPj !== catalogPlan.isPj) return false;
    return key.includes(target) || target.includes(key);
  });

  return soft ?? null;
}

export type UpgradeOffer = CatalogPlan & {
  commercialPlanId: number;
  commercialPrice: number;
};

/** Cruza upgrades do catálogo com planos ativos do comercial. */
export function attachCommercialIds(
  upgrades: CatalogPlan[],
  commercialPlans: CommercialPlan[]
): UpgradeOffer[] {
  const result: UpgradeOffer[] = [];

  for (const plan of upgrades) {
    const matched = matchCommercialPlan(plan, commercialPlans);
    if (!matched) continue;
    const commercialPrice = Number(matched.price) || plan.monthlyPrice;
    result.push({
      ...plan,
      commercialPlanId: matched.id,
      commercialPrice,
      monthlyPrice: commercialPrice,
    });
  }

  return result;
}

function isUsableAddress(parts?: AddressParts | null): parts is AddressParts {
  if (!parts) return false;
  const street = parts.endereco?.trim();
  const city = parts.cidade?.trim();
  if (!street || street === 'Não informado') return false;
  if (!city || city === 'Não informado') return false;
  return true;
}

/** Monta endereço a partir do texto já exibido no app (sessões antigas). */
export function parseAddressString(raw?: string | null): AddressParts | null {
  const value = String(raw || '').trim();
  if (!value || value === 'Endereço não informado') return null;

  const chunks = value
    .split(/\s+[—\-–]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length === 0) return null;

  let endereco = chunks[0];
  let numero = 'S/N';
  let complemento: string | undefined;
  let bairro = 'Não informado';
  let cidade = 'Não informado';
  let estado = 'RJ';
  let cep = '00000000';

  const numberChunk = chunks.find((chunk) => /^n[ºo.]?\s*\d+/i.test(chunk));
  if (numberChunk) {
    numero = numberChunk.replace(/^n[ºo.]?\s*/i, '').trim() || 'S/N';
  } else {
    const embedded = endereco.match(/,\s*(\d+[A-Za-z\-]?)\s*$/);
    if (embedded) {
      numero = embedded[1];
      endereco = endereco.replace(/,\s*\d+[A-Za-z\-]?\s*$/, '').trim();
    }
  }

  const cityChunk = [...chunks].reverse().find((chunk) => /\/[A-Z]{2}$/i.test(chunk));
  if (cityChunk) {
    const [cityName, uf] = cityChunk.split('/');
    cidade = cityName.trim() || cidade;
    estado = (uf || estado).slice(0, 2).toUpperCase();
  } else if (chunks.length >= 2) {
    cidade = chunks[chunks.length - 1];
  }

  const cepChunk = chunks.find((chunk) => /^\d{5}-?\d{3}$/.test(chunk.replace(/\s/g, '')));
  if (cepChunk) {
    cep = cepChunk.replace(/\D/g, '').slice(0, 8);
  }

  const bairroCandidate = chunks.find(
    (chunk) =>
      chunk !== endereco &&
      chunk !== numberChunk &&
      chunk !== cityChunk &&
      chunk !== cepChunk &&
      !/^n[ºo.]?\s*\d+/i.test(chunk)
  );
  if (bairroCandidate) {
    // Se sobrou mais de um candidato, o complemento costuma vir antes do bairro.
    const extras = chunks.filter(
      (chunk) =>
        chunk !== endereco &&
        chunk !== numberChunk &&
        chunk !== cityChunk &&
        chunk !== cepChunk
    );
    if (extras.length === 1) {
      bairro = extras[0];
    } else if (extras.length >= 2) {
      complemento = extras[0];
      bairro = extras[1];
    }
  }

  return {
    endereco: endereco || 'Não informado',
    numero,
    bairro,
    cidade,
    estado,
    cep,
    complemento,
  };
}

export function resolveAddressParts(
  user: Subscriber,
  connectionAddressParts?: AddressParts | null,
  connectionAddress?: string | null
): AddressParts | null {
  if (isUsableAddress(user.addressParts)) return user.addressParts;
  if (isUsableAddress(connectionAddressParts)) return connectionAddressParts;

  const fromUserText = parseAddressString(user.address);
  if (isUsableAddress(fromUserText)) return fromUserText;

  const fromConnectionText = parseAddressString(connectionAddress);
  if (isUsableAddress(fromConnectionText)) return fromConnectionText;

  // Último recurso: monta com o que existir para não bloquear o comercial.
  const fallback = fromUserText || fromConnectionText || user.addressParts;
  if (fallback?.endereco?.trim()) {
    return {
      endereco: fallback.endereco.trim(),
      numero: fallback.numero?.trim() || 'S/N',
      bairro: fallback.bairro?.trim() || 'Não informado',
      cidade: fallback.cidade?.trim() || connectionAddress?.split(/[—\-–]/).pop()?.trim() || 'Não informado',
      estado: (fallback.estado || 'RJ').slice(0, 2).toUpperCase(),
      cep: onlyDigits(fallback.cep || '').slice(0, 8) || '00000000',
      complemento: fallback.complemento,
    };
  }

  return null;
}

/**
 * Abre ticket no webhook após concluir a solicitação de upgrade
 * (contrato assinado + venda no comercial).
 * Não deve bloquear o assinante se o webhook falhar.
 */
export async function openUpgradeTicket(input: {
  user: Subscriber;
  planName: string;
  speedMbps: number;
  monthlyPrice: number;
  currentPlanName: string;
  currentSpeedMbps: number;
  saleId?: string | null;
  protocol?: string | null;
}): Promise<boolean> {
  const documento = onlyDigits(input.user.document);
  if (documento.length < 11) return false;

  const fromPlan = input.currentPlanName?.trim() || 'plano atual';
  const fromSpeed =
    input.currentSpeedMbps > 0 ? ` (${input.currentSpeedMbps} Mbps)` : '';
  const toPlan = input.planName?.trim() || 'plano solicitado';
  const priceLabel = Number.isFinite(input.monthlyPrice)
    ? ` · R$ ${Number(input.monthlyPrice).toFixed(2).replace('.', ',')}/mês`
    : '';
  const protocol =
    String(input.protocol || input.saleId || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 12)
      .toUpperCase() || null;

  const resumo = [
    `Cliente ${input.user.name} (login ${input.user.login}) solicitou upgrade pela Central do Assinante.`,
    `De ${fromPlan}${fromSpeed} para ${toPlan} (${input.speedMbps} Mbps${priceLabel}).`,
    'Contrato assinado no app; aguardando análise do comercial.',
    protocol ? `Protocolo/venda: ${protocol}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  try {
    await apiRequest('/webhook/abrir_ticket', {
      method: 'POST',
      timeoutMs: 20000,
      body: {
        documento,
        resumo,
        setor: 'COMERCIAL',
        motivo: 'UPGRADE',
        finalizar: 'S',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function submitUpgradeSale(input: {
  user: Subscriber;
  plan: CatalogPlan;
  commercialPlanId: number;
  currentPlanName: string;
  currentSpeedMbps: number;
  connectionAddressParts?: AddressParts | null;
  connectionAddress?: string | null;
}): Promise<UpgradeSaleResult> {
  const {
    user,
    plan,
    commercialPlanId,
    currentPlanName,
    currentSpeedMbps,
    connectionAddressParts,
    connectionAddress,
  } = input;

  const phone = onlyDigits(user.phone);
  if (phone.length < 10) {
    throw new Error(
      'Atualize seu telefone no cadastro antes de solicitar o upgrade.'
    );
  }

  const endereco = resolveAddressParts(
    user,
    connectionAddressParts,
    connectionAddress
  );
  if (!endereco) {
    throw new Error(
      'Não encontramos seu endereço completo para abrir a solicitação. Fale com o suporte ou entre novamente no app.'
    );
  }

  const digits = onlyDigits(user.document);
  const isPj = digits.length === 14;
  const body = {
    vendedor: { codigo: VENDEDOR_CODIGO },
    nome_cliente: user.name,
    telefone_cliente: user.phone,
    email_cliente: user.email || undefined,
    ...(isPj
      ? { cnpj_cliente: formatDocument(digits), tipo_cliente: 'PJ' }
      : { cpf_cliente: formatDocument(digits) }),
    data_nascimento: user.birthDate || undefined,
    plano_id: commercialPlanId,
    valor_mensal: plan.monthlyPrice,
    pedido_tipo: 'Upgrade',
    status: 'Aguardando Análise',
    observacoes: [
      'Solicitação de upgrade pela Central do Assinante.',
      `Login PPPoE: ${user.login}`,
      `Plano atual: ${currentPlanName || 'não informado'}${
        currentSpeedMbps > 0 ? ` (${currentSpeedMbps} Mbps)` : ''
      }`,
      `Plano desejado: ${plan.name} (${plan.downloadMbps} Mbps)`,
      `Contrato/COD_CLIENTE: ${user.plan.contractId || '—'}`,
    ].join(' | '),
    utm_source: 'central-assinante',
    utm_medium: 'app',
    utm_campaign: 'upgrade-plano',
    tag: 'upgrade-app',
    endereco: {
      endereco: endereco.endereco,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      estado: endereco.estado,
      cep: endereco.cep,
      ...(endereco.complemento
        ? { complemento: endereco.complemento }
        : {}),
    },
  };

  try {
    const data = await apiRequest<VendachatResponse>(
      `${COMERCIAL_BASE}/api/vendachat`,
      {
        method: 'POST',
        body,
        timeoutMs: 25000,
      }
    );

    const result: UpgradeSaleResult = {
      success: data.success !== false,
      message:
        data.message || 'Solicitação de upgrade enviada para o comercial.',
      saleId: data.sale_id || null,
      status: data.status || 'Aguardando Análise',
      pendingItems: Array.isArray(data.itens_pendentes)
        ? data.itens_pendentes
        : [],
    };

    // Espelha no painel (não interrompe o assinante se falhar).
    void registerUpgradeOrder({
      user,
      plan,
      commercialPlanId,
      currentPlanName,
      currentSpeedMbps,
      saleId: result.saleId,
      status: result.status,
    });

    // Abre ticket no SAC/comercial ao concluir a solicitação.
    void openUpgradeTicket({
      user,
      planName: plan.displayName || plan.name,
      speedMbps: plan.downloadMbps,
      monthlyPrice: plan.monthlyPrice,
      currentPlanName,
      currentSpeedMbps,
      saleId: result.saleId,
    });

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      const payload =
        typeof error.data === 'object' && error.data !== null
          ? (error.data as { error?: string; message?: string })
          : null;
      const detail =
        payload?.error || payload?.message || error.message || 'Falha no envio';

      if (error.status === 404) {
        throw new Error(
          `Vendedor "${VENDEDOR_CODIGO}" não encontrado no comercial. Confira o código de indicação.`
        );
      }
      if (error.status === 400) {
        throw new Error(detail);
      }
      throw new Error(detail);
    }
    throw error;
  }
}
