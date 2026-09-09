/**
 * Proxy seguro para a plataforma de contratos.
 * A API Key fica só no servidor (admin/.env).
 */

const CONTRACTS_BASE = (
  process.env.CONTRACTS_BASE_URL || 'https://contrato.trtelecom.net'
).replace(/\/$/, '');

const CONTRACTS_API_KEY = String(
  process.env.CONTRACTS_API_KEY || process.env.CONTRACTS_INTEGRATION_API_KEY || ''
).trim();

/** Templates de upgrade: adesão + comodato (separados por | no .env). */
const DEFAULT_MODALIDADES = String(
  process.env.CONTRACTS_MODALIDADE_UPGRADE ||
    'CONTRATO DE ADESÃO E COMPROMISSO DE FIDELIDADE|Contrato de Comodato de Equipamento'
)
  .split('|')
  .map((item) => item.trim())
  .filter(Boolean);

export function contractsConfigured() {
  return Boolean(CONTRACTS_API_KEY);
}

export function contractsStatus() {
  return {
    configured: contractsConfigured(),
    baseUrl: CONTRACTS_BASE,
    modalidadeUpgrade: DEFAULT_MODALIDADES.join(' + '),
    modalidadesUpgrade: DEFAULT_MODALIDADES,
  };
}

function resolveModalidades(input = {}) {
  if (Array.isArray(input.modalidades) && input.modalidades.length) {
    return input.modalidades.map((item) => String(item).trim()).filter(Boolean);
  }
  if (input.modalidade) {
    return String(input.modalidade)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_MODALIDADES];
}

/**
 * POST /api/contracts/solicitacao na plataforma de contratos.
 * Upgrade usa adesão + comodato (um ou mais templates).
 */
export async function createContractSolicitacao(input = {}) {
  if (!CONTRACTS_API_KEY) {
    const err = new Error(
      'CONTRACTS_API_KEY não configurada no servidor da Central.'
    );
    err.status = 503;
    throw err;
  }

  const modalidades = resolveModalidades(input);
  if (!modalidades.length) {
    const err = new Error('Nenhuma modalidade de contrato configurada.');
    err.status = 400;
    throw err;
  }

  // Campo canônico obrigatório + lista (painel permite 1 ou mais templates).
  const modalidade = modalidades[0];
  const body = {
    modalidade,
    modalidades,
    cpf: input.cpf || input.CPF,
    CPF: input.cpf || input.CPF,
    clientName: input.clientName || input.nomeCompleto,
    nomeCompleto: input.clientName || input.nomeCompleto,
    phone: input.phone || input.telefone,
    telefone: input.phone || input.telefone,
    email: input.email || input.emailContato,
    emailContato: input.email || input.emailContato,
    address: input.address || input.enderecoCompleto,
    enderecoCompleto: input.address || input.enderecoCompleto,
    clientLogin: input.clientLogin || undefined,
    birthDate: input.birthDate || undefined,
    clientCEP: input.clientCEP || undefined,
    ...(input.templateId ? { templateId: input.templateId } : {}),
    ...(input.observacoes ? { observacoes: input.observacoes } : {}),
    ...(input.plano
      ? {
          plano:
            typeof input.plano === 'string'
              ? input.plano
              : String(
                  input.plano.nome ||
                    input.plano.name ||
                    input.plano.plano ||
                    ''
                ).trim(),
        }
      : {}),
  };

  // Remove plano vazio (API espera string).
  if (!body.plano) delete body.plano;

  const response = await fetch(`${CONTRACTS_BASE}/api/contracts/solicitacao`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CONTRACTS_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const available =
      Array.isArray(data?.availableTemplates) && data.availableTemplates.length
        ? ` Modelos disponíveis: ${data.availableTemplates.join(', ')}.`
        : '';
    const detailsText =
      data?.details && typeof data.details === 'object'
        ? ` ${JSON.stringify(data.details)}`
        : '';
    const message =
      data?.message ||
      data?.error ||
      (response.status === 404
        ? `Modalidade de contrato não encontrada.${available}`
        : `Falha ao criar contrato (HTTP ${response.status}).${detailsText || (text ? ` ${text.slice(0, 280)}` : '')}`);
    const detailLine =
      typeof data?.details === 'string' && data.details.trim()
        ? ` (${data.details.trim()})`
        : '';
    const err = new Error(`${String(message).trim()}${detailLine}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return {
    cpf: data.cpf || body.cpf || null,
    assinaturaUrl: data.assinaturaUrl || data.assinatura_url || null,
    contractId: data.contractId || data.id || null,
    modalidade,
    modalidades,
    raw: data,
  };
}
