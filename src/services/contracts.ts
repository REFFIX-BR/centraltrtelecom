import { ApiError, apiRequest } from '@/src/services/api';
import { getBannersApiBase } from '@/src/services/banners';
import { resolveAddressParts } from '@/src/services/commercial';
import type { AddressParts, Subscriber } from '@/src/types';
import { onlyDigits } from '@/src/utils/format';

export type ContractStatus =
  | 'draft'
  | 'pending'
  | 'pending_review'
  | 'signed'
  | 'cancelled';

export type ClientContract = {
  contractId: string;
  contractNumber: string;
  clientName: string;
  clientLogin: string | null;
  cpf: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  assinaturaUrl: string | null;
};

export type ContractSummary = {
  found: boolean;
  total: number;
  pendingSignature: number;
  pendingReview: number;
  signed: number;
  contracts: ClientContract[];
};

const CONTRACTS_API_URL =
  process.env.EXPO_PUBLIC_CONTRACTS_API_URL?.replace(/\/$/, '') ||
  'https://contrato.trtelecom.net/api/integrations/contracts/status-by-client';

// Chave de teste. Em produção ela precisa sair do app e ficar em um backend,
// porque tudo que vai no bundle do Expo pode ser extraído do aparelho.
const CONTRACTS_API_KEY =
  process.env.EXPO_PUBLIC_CONTRACTS_API_KEY ||
  '3f97011a6548b26f72b9242f3d4821d08e151ae4ddbb1b35e23750d240ca76c0';

const EMPTY_SUMMARY: ContractSummary = {
  found: false,
  total: 0,
  pendingSignature: 0,
  pendingReview: 0,
  signed: 0,
  contracts: [],
};

function normalizeSummary(data: Partial<ContractSummary> | null): ContractSummary {
  if (!data || !Array.isArray(data.contracts)) return EMPTY_SUMMARY;

  return {
    found: !!data.found,
    total: data.total ?? data.contracts.length,
    pendingSignature: data.pendingSignature ?? 0,
    pendingReview: data.pendingReview ?? 0,
    signed: data.signed ?? 0,
    contracts: data.contracts,
  };
}

async function fetchContractSummary(query: string): Promise<ContractSummary> {
  try {
    const data = await apiRequest<Partial<ContractSummary>>(
      `${CONTRACTS_API_URL}?${query}`,
      {
        method: 'GET',
        token: CONTRACTS_API_KEY,
        timeoutMs: 30000,
      }
    );

    return normalizeSummary(data);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        throw new Error('A chave de acesso da API de contratos foi recusada.');
      }
      if (error.status === 503) {
        throw new Error(
          'O sistema de contratos ainda não configurou a chave de integração.'
        );
      }
    }
    throw error;
  }
}

export async function fetchContractsByDocument(
  document: string
): Promise<ContractSummary> {
  const cpf = document.replace(/\D/g, '');
  return fetchContractSummary(`cpf=${encodeURIComponent(cpf)}`);
}

export async function fetchContractsByLogin(
  login: string
): Promise<ContractSummary> {
  return fetchContractSummary(`clientLogin=${encodeURIComponent(login.trim())}`);
}

/** Contrato que o cliente ainda precisa assinar, com link disponível. */
export function pickSignableContract(
  summary: ContractSummary | null
): ClientContract | null {
  if (!summary?.found) return null;
  const pending = summary.contracts.filter((item) => item.status === 'pending');
  return pending.find((item) => !!item.assinaturaUrl) ?? pending[0] ?? null;
}

/** Contrato assinado/em análise com link para o cliente visualizar. */
export function pickViewableContract(
  summary: ContractSummary | null
): ClientContract | null {
  if (!summary?.found) return null;
  const viewable = summary.contracts.filter(
    (item) =>
      (item.status === 'signed' || item.status === 'pending_review') &&
      !!item.assinaturaUrl
  );
  return (
    viewable.find((item) => item.status === 'signed') ?? viewable[0] ?? null
  );
}

export function canOpenContract(contract: ClientContract): boolean {
  return !!contract.assinaturaUrl?.trim();
}

export function isContractViewOnly(contract: ClientContract): boolean {
  return (
    contract.status === 'signed' || contract.status === 'pending_review'
  );
}

/** Assinado pelo cliente (em análise ou aprovado). */
export function isContractSignedStatus(
  status: string | null | undefined
): boolean {
  return status === 'signed' || status === 'pending_review';
}

export function findContractByAssinaturaUrl(
  summary: ContractSummary | null,
  assinaturaUrl: string | null | undefined
): ClientContract | null {
  const url = String(assinaturaUrl || '').trim();
  if (!summary?.found || !url) return null;
  return (
    summary.contracts.find((item) => String(item.assinaturaUrl || '').trim() === url) ||
    null
  );
}

export function findContractById(
  summary: ContractSummary | null,
  contractId: string | null | undefined
): ClientContract | null {
  const id = String(contractId || '').trim();
  if (!summary?.found || !id) return null;
  return summary.contracts.find((item) => item.contractId === id) || null;
}

/**
 * Localiza o contrato de upgrade após a criação (ainda pending ou já assinado).
 */
export function resolveUpgradeContract(
  summary: ContractSummary | null,
  opts: {
    contractId?: string | null;
    assinaturaUrl?: string | null;
  }
): ClientContract | null {
  return (
    findContractById(summary, opts.contractId) ||
    findContractByAssinaturaUrl(summary, opts.assinaturaUrl)
  );
}

/** Evita limpar o pendente nos segundos logo após a criação do contrato. */
const UNSIGNED_CONTRACT_GRACE_MS = 90_000;

/**
 * Contrato de upgrade sem assinatura foi cancelado/excluído na plataforma
 * → o app deve limpar o pendente para o cliente solicitar de novo.
 */
export function shouldDropUnsignedUpgradePending(
  summary: ContractSummary | null,
  pending: {
    contractId?: string | null;
    assinaturaUrl?: string | null;
    createdAt: string;
    comercialSubmitted?: boolean;
  }
): boolean {
  if (!summary || pending.comercialSubmitted) return false;

  const contract = resolveUpgradeContract(summary, {
    contractId: pending.contractId,
    assinaturaUrl: pending.assinaturaUrl,
  });

  if (contract) {
    return contract.status === 'cancelled';
  }

  const hasRef =
    !!String(pending.contractId || '').trim() ||
    !!String(pending.assinaturaUrl || '').trim();
  if (!hasRef) return false;

  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < UNSIGNED_CONTRACT_GRACE_MS) {
    return false;
  }

  // Não está mais na lista (excluído) ou cliente sem contratos.
  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET status-by-client em loop até o contrato estar assinado
 * (`pending_review` ou `signed`), conforme a documentação.
 */
export async function waitForContractSigned(
  document: string,
  opts: {
    contractId?: string | null;
    assinaturaUrl?: string | null;
    createdAfter?: string | null;
    attempts?: number;
    delayMs?: number;
  } = {}
): Promise<ClientContract | null> {
  const attempts = opts.attempts ?? 15;
  const delayMs = opts.delayMs ?? 2000;
  const createdAfterMs = opts.createdAfter
    ? new Date(opts.createdAfter).getTime()
    : 0;

  for (let i = 0; i < attempts; i++) {
    const summary = await fetchContractsByDocument(document);
    const direct = resolveUpgradeContract(summary, opts);
    if (direct && isContractSignedStatus(direct.status)) {
      return direct;
    }

    // Após assinar, o link pode mudar/zerar — pega o mais recente assinado
    // criado perto do pedido de upgrade.
    const signedList = summary.contracts.filter((item) =>
      isContractSignedStatus(item.status)
    );
    const recent = signedList.find((item) => {
      if (!createdAfterMs) return i >= 1;
      const created = new Date(item.createdAt || item.updatedAt).getTime();
      return (
        Number.isFinite(created) && created + 60_000 >= createdAfterMs
      );
    });
    if (recent) return recent;

    if (i < attempts - 1) {
      await sleep(delayMs);
    }
  }

  return null;
}

/** Marca amarela: sem contrato, ou com contrato ainda não assinado. */
export function contractNeedsAttention(summary: ContractSummary | null): boolean {
  if (!summary) return false;
  if (!summary.found) return true;
  if (summary.pendingSignature > 0) return true;
  return summary.signed === 0 && summary.pendingReview === 0;
}

export type CreateContractResult = {
  cpf: string | null;
  assinaturaUrl: string;
  contractId: string | null;
  modalidade?: string;
};

function formatFullAddress(parts: AddressParts | null, fallback?: string | null): string {
  if (parts?.endereco) {
    return [
      parts.endereco,
      parts.numero,
      parts.bairro,
      parts.cidade && parts.estado
        ? `${parts.cidade} - ${parts.estado}`
        : parts.cidade || parts.estado,
      parts.cep,
      parts.complemento,
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(', ');
  }
  return String(fallback || '').trim();
}

/**
 * Cria contrato de upgrade via proxy da Central (API Key no servidor).
 */
export async function createUpgradeContract(input: {
  user: Subscriber;
  planName: string;
  speedMbps: number;
  monthlyPrice: number;
  connectionAddress?: string | null;
  connectionAddressParts?: AddressParts | null;
}): Promise<CreateContractResult> {
  const base = getBannersApiBase();
  if (!base) {
    throw new Error('API da Central não configurada (EXPO_PUBLIC_BANNERS_URL).');
  }

  const phone = onlyDigits(input.user.phone);
  if (phone.length < 10) {
    throw new Error(
      'Atualize seu telefone no cadastro antes de solicitar o upgrade.'
    );
  }

  const parts = resolveAddressParts(
    input.user,
    input.connectionAddressParts,
    input.connectionAddress
  );
  const address = formatFullAddress(
    parts,
    input.connectionAddress || input.user.address
  );
  if (!address || address.length < 8) {
    throw new Error(
      'Não encontramos seu endereço completo. Atualize o cadastro ou fale com o suporte.'
    );
  }

  const email =
    String(input.user.email || '').trim() ||
    `${onlyDigits(input.user.document)}@cliente.trtelecom.net`;

  try {
    const data = await apiRequest<
      Partial<CreateContractResult> & { error?: string; details?: unknown }
    >(`${base}/api/contracts/solicitacao`, {
      method: 'POST',
      timeoutMs: 45000,
      body: {
        // Modalidade (adesão + comodato) é definida no servidor.
        cpf: input.user.document,
        nomeCompleto: input.user.name,
        telefone: input.user.phone,
        emailContato: email,
        enderecoCompleto: address,
        clientLogin: input.user.login,
        birthDate: input.user.birthDate || undefined,
        clientCEP: parts?.cep,
        observacoes: `Upgrade Central do Assinante · ${input.planName} · ${input.speedMbps} Mbps · R$ ${input.monthlyPrice}`,
        plano: `${input.planName} · ${input.speedMbps} Mbps`,
      },
    });

    const assinaturaUrl = String(data.assinaturaUrl || '').trim();
    if (!assinaturaUrl) {
      throw new Error(
        data.error ||
          'Contrato criado sem link de assinatura. Fale com o suporte.'
      );
    }

    return {
      cpf: data.cpf || null,
      assinaturaUrl,
      contractId: data.contractId || null,
      modalidade: data.modalidade,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(error.message);
    }
    throw error;
  }
}
