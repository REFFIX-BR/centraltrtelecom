import { apiRequest } from '@/src/services/api';
import type { AddressParts, PlanInfo, Subscriber } from '@/src/types';
import { formatDocument, onlyDigits } from '@/src/utils/format';

export type LoginListItem = {
  LOGIN: string;
  ENDERECO?: string;
  BAIRRO?: string;
  COMPLEMENTO?: string;
  CIDADE?: string;
};

export type SacClient = {
  COD_CLIENTE: string;
  CODIGO: number;
  COD_EMPRESA: number;
  NOME: string;
  ATIVO: string;
  CPF?: string;
  CNPJ?: string;
  DATA_NASCIMENTO?: string;
  CEP?: string;
  LOGRADOURO?: string;
  ENDERECO?: string;
  NUMERO?: string | number;
  NRO?: string | number;
  COMPLEMENTO?: string;
  BAIRRO?: string;
  CIDADE?: string;
  ESTADO?: string;
  TELEFONE_CELULAR1?: string;
  TELEFONE_RESIDENCIAL?: string;
  EMAIL1?: string;
  SENHA_WEB?: string;
  HABILITA_ACESSO_WEB?: string;
  BLOQUEIA_ACESSO?: string;
  [key: string]: unknown;
};

export type LoginPointOption = {
  login: string;
  address: string;
  addressReady: boolean;
};

export type AuthResult =
  | { status: 'authenticated'; subscriber: Subscriber }
  | { status: 'select_point'; client: SacClient; options: LoginPointOption[] };

const EMPTY_PLAN: PlanInfo = {
  name: 'Plano em atualização',
  speedMbps: 0,
  uploadMbps: 0,
  price: 0,
  status: 'active',
  contractId: '—',
  installationAddress: '—',
  services: [],
};

export function buildLoginAddress(item: LoginListItem): string {
  const parts = [
    item.ENDERECO?.trim(),
    item.COMPLEMENTO?.trim(),
    item.BAIRRO?.trim(),
    item.CIDADE?.trim(),
  ].filter(Boolean);

  return parts.join(' — ');
}

export async function listarLogins(documento: string): Promise<LoginListItem[]> {
  const digits = onlyDigits(documento);
  const data = await apiRequest<LoginListItem[] | string>(
    `/webhook/listar-logins?documento=${encodeURIComponent(digits)}`,
    { method: 'GET' }
  );

  if (typeof data === 'string') {
    throw new Error(data.trim() || 'Não foi possível localizar o login deste documento.');
  }

  const seen = new Set<string>();
  const items = (data ?? []).filter((item) => {
    const login = item?.LOGIN?.trim();
    if (!login || seen.has(login)) return false;
    seen.add(login);
    return true;
  });

  if (items.length === 0) {
    throw new Error('Nenhum login encontrado para este CPF/CNPJ.');
  }

  return items;
}

export async function loginSac(documento: string, senha: string): Promise<SacClient> {
  const digits = onlyDigits(documento);
  const formatted = formatDocument(digits);
  const timestamp = new Date().toISOString();

  const data = await apiRequest<SacClient[] | string>('/webhook/login-sac', {
    method: 'POST',
    body: {
      documento: formatted || digits,
      senha,
      codigo_gerado: '',
      timestamp,
    },
  });

  if (typeof data === 'string') {
    throw new Error(
      data.trim() || 'Cliente não encontrado com CPF e senha digitados.'
    );
  }

  const client = Array.isArray(data) ? data[0] : null;
  if (!client?.COD_CLIENTE && !client?.CODIGO) {
    throw new Error('Cliente não encontrado com CPF e senha digitados.');
  }

  return client;
}

export function buildAddress(client: SacClient): string {
  const street = [client.LOGRADOURO, client.ENDERECO]
    .filter(Boolean)
    .join(' ')
    .trim();
  const parts = [
    street,
    client.NUMERO || client.NRO ? `nº ${client.NUMERO || client.NRO}` : null,
    client.COMPLEMENTO,
    client.BAIRRO,
    client.CIDADE && client.ESTADO
      ? `${client.CIDADE}/${client.ESTADO}`
      : client.CIDADE || client.ESTADO,
    client.CEP,
  ].filter(Boolean);

  return parts.join(' — ') || 'Endereço não informado';
}

function extractStreetNumber(street: string): string {
  const match = street.match(/,\s*(\d+[A-Za-z\-]?)\s*$/) || street.match(/\bn[ºo.]?\s*(\d+[A-Za-z\-]?)\b/i);
  return match?.[1]?.trim() || '';
}

export function buildAddressParts(client: SacClient): AddressParts {
  const street = [client.LOGRADOURO, client.ENDERECO]
    .filter(Boolean)
    .join(' ')
    .trim();
  const numero =
    String(client.NUMERO ?? client.NRO ?? '').trim() ||
    extractStreetNumber(street) ||
    'S/N';

  return {
    endereco: street || 'Não informado',
    numero,
    bairro: client.BAIRRO?.trim() || 'Não informado',
    cidade: client.CIDADE?.trim() || 'Não informado',
    estado: (client.ESTADO?.trim() || 'RJ').slice(0, 2).toUpperCase(),
    cep: onlyDigits(client.CEP || '').slice(0, 8) || '00000000',
    complemento: client.COMPLEMENTO?.trim() || undefined,
  };
}

export function mapSacClientToSubscriber(
  client: SacClient,
  login: string,
  installationAddress?: string
): Subscriber {
  const fullName = (client.NOME || 'Assinante TR').trim();
  const firstName = fullName.split(/\s+/)[0] || 'Assinante';
  const document = onlyDigits(client.CPF || client.CNPJ || '');
  const addressParts = buildAddressParts(client);
  const address = installationAddress || buildAddress(client);

  return {
    id: login,
    login,
    name: fullName,
    firstName,
    document,
    email: client.EMAIL1?.trim() || '',
    phone: client.TELEFONE_CELULAR1?.trim() || client.TELEFONE_RESIDENCIAL?.trim() || '',
    address,
    addressParts,
    birthDate: client.DATA_NASCIMENTO && client.DATA_NASCIMENTO !== '0000-00-00'
      ? client.DATA_NASCIMENTO
      : '',
    plan: {
      ...EMPTY_PLAN,
      contractId: String(client.COD_CLIENTE || client.CODIGO),
      installationAddress: address,
      status: client.ATIVO === 'S' ? 'active' : 'blocked',
    },
    invoices: [],
    tickets: [],
    documents: [],
    notifications: [],
  };
}

export function buildLoginPointOptions(
  items: LoginListItem[],
  fallbackAddress: string
): LoginPointOption[] {
  return items.map((item) => {
    const address = buildLoginAddress(item);
    return {
      login: item.LOGIN.trim(),
      address: address || fallbackAddress,
      addressReady: !!address,
    };
  });
}

export async function authenticateWithDocument(
  documento: string,
  senha: string
): Promise<AuthResult> {
  const client = await loginSac(documento, senha);
  const items = await listarLogins(documento);
  const fallbackAddress = buildAddress(client);
  const options = buildLoginPointOptions(items, fallbackAddress);

  if (options.length === 1) {
    return {
      status: 'authenticated',
      subscriber: mapSacClientToSubscriber(
        client,
        options[0].login,
        options[0].address
      ),
    };
  }

  return {
    status: 'select_point',
    client,
    options,
  };
}
