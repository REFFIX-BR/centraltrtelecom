import { ApiError, apiRequest } from '@/src/services/api';
import { getBannersApiBase } from '@/src/services/banners';
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

function formatFullAddress(
  user: {
    address?: string;
    addressParts?: {
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      complemento?: string;
    };
  },
  connectionAddress?: string | null,
  connectionParts?: {
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    complemento?: string;
  } | null
): string {
  const parts = connectionParts || user.addressParts;
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
  return (
    String(connectionAddress || user.address || '').trim() || 'Não informado'
  );
}

/**
 * Cria contrato de upgrade via proxy da Central (API Key no servidor).
 */
export async function createUpgradeContract(input: {
  user: {
    name: string;
    document: string;
    phone: string;
    email: string;
    login: string;
    birthDate?: string;
    address?: string;
    addressParts?: {
      endereco?: string;
      numero?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
      cep?: string;
      complemento?: string;
    };
  };
  planName: string;
  speedMbps: number;
  monthlyPrice: number;
  connectionAddress?: string | null;
  connectionAddressParts?: {
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
    complemento?: string;
  } | null;
}): Promise<CreateContractResult> {
  const base = getBannersApiBase();
  if (!base) {
    throw new Error('API da Central não configurada (EXPO_PUBLIC_BANNERS_URL).');
  }

  const address = formatFullAddress(
    input.user,
    input.connectionAddress,
    input.connectionAddressParts
  );
  const cep =
    input.connectionAddressParts?.cep ||
    input.user.addressParts?.cep ||
    undefined;

  const data = await apiRequest<Partial<CreateContractResult> & { error?: string }>(
    `${base}/api/contracts/solicitacao`,
    {
      method: 'POST',
      timeoutMs: 45000,
      body: {
        // Modalidade (adesão + comodato) é definida no servidor.
        cpf: input.user.document,
        nomeCompleto: input.user.name,
        telefone: input.user.phone,
        emailContato:
          input.user.email ||
          `${onlyDigits(input.user.document)}@cliente.trtelecom.net`,
        enderecoCompleto: address,
        clientLogin: input.user.login,
        birthDate: input.user.birthDate || undefined,
        clientCEP: cep,
        observacoes: `Upgrade Central do Assinante · ${input.planName} · ${input.speedMbps} Mbps · R$ ${input.monthlyPrice}`,
        plano: {
          nome: input.planName,
          velocidade: input.speedMbps,
          valor: input.monthlyPrice,
        },
      },
    }
  );

  const assinaturaUrl = String(data.assinaturaUrl || '').trim();
  if (!assinaturaUrl) {
    throw new Error(
      data.error || 'Contrato criado sem link de assinatura. Fale com o suporte.'
    );
  }

  return {
    cpf: data.cpf || null,
    assinaturaUrl,
    contractId: data.contractId || null,
    modalidade: data.modalidade,
  };
}
