import { apiRequest } from '@/src/services/api';
import type { AddressParts } from '@/src/types';

export type PppoeStatusResponse = {
  COD_CLIENTE?: string;
  nomeCliente?: string;
  CPF?: string;
  plano?: string;
  velocidadeContratada?: string;
  LOGIN?: string;
  statusIP?: string;
  statusPPPoE?: string;
  conectadoDesde?: string;
  minutosConectado?: number;
  ipv4?: string;
  ENDERECO?: string;
  BAIRRO?: string;
  CIDADE?: string;
  COMPLEMENTO?: string;
  ESTADO?: string;
  CEP?: string;
  NUMERO?: string | number;
  CTO?: string;
  PON?: string;
  OLT?: string;
  STATUS_TIPO?: string;
  SERIAL?: string;
  os_aberta?: string;
  onu_run_state?: string;
  onu_last_down_cause?: string;
};

export type ConnectionStatus = {
  isOnline: boolean;
  pppoeStatus: string;
  ipStatus: string;
  contractStatus: string;
  planName: string;
  speedMbps: number;
  connectedSince: string | null;
  connectedMinutes: number;
  ipv4: string | null;
  address: string | null;
  addressParts: AddressParts | null;
  city: string | null;
  clientCode: string | null;
  cto: string | null;
  pon: string | null;
  olt: string | null;
  serial: string | null;
  hasOpenServiceOrder: boolean;
  onuState: string | null;
  lastDownCause: string | null;
};

export function buildPppoeAddress(data: PppoeStatusResponse): string | null {
  const parts = [
    data.ENDERECO?.trim(),
    data.COMPLEMENTO?.trim(),
    data.BAIRRO?.trim(),
    data.CIDADE?.trim(),
  ].filter(Boolean);

  return parts.length ? parts.join(' — ') : null;
}

function extractStreetNumber(street: string): string {
  const match =
    street.match(/,\s*(\d+[A-Za-z\-]?)(?:\s|$)/) ||
    street.match(/\bn[ºo.]?\s*(\d+[A-Za-z\-]?)\b/i);
  return match?.[1]?.trim() || '';
}

export function buildPppoeAddressParts(
  data: PppoeStatusResponse
): AddressParts | null {
  const street = data.ENDERECO?.trim() || '';
  const city = data.CIDADE?.trim() || '';
  if (!street && !city) return null;

  const numero =
    String(data.NUMERO ?? '').trim() ||
    extractStreetNumber(street) ||
    'S/N';

  return {
    endereco: street || 'Não informado',
    numero,
    bairro: data.BAIRRO?.trim() || 'Não informado',
    cidade: city || 'Não informado',
    estado: (data.ESTADO?.trim() || 'RJ').slice(0, 2).toUpperCase(),
    cep: String(data.CEP || '').replace(/\D/g, '').slice(0, 8) || '00000000',
    complemento: data.COMPLEMENTO?.trim() || undefined,
  };
}

function kbpsToMbps(value?: string): number {
  const kbps = Number(value);
  if (!Number.isFinite(kbps) || kbps <= 0) return 0;
  return Math.round(kbps / 1024);
}

export function mapPppoeStatus(data: PppoeStatusResponse): ConnectionStatus {
  const pppoe = (data.statusPPPoE || '').trim().toUpperCase();

  return {
    isOnline: pppoe === 'ONLINE',
    pppoeStatus: pppoe || 'DESCONHECIDO',
    ipStatus: (data.statusIP || '').trim().toUpperCase() || 'DESCONHECIDO',
    contractStatus: (data.STATUS_TIPO || '').trim().toUpperCase() || 'DESCONHECIDO',
    planName: data.plano?.trim() || 'Plano não informado',
    speedMbps: kbpsToMbps(data.velocidadeContratada),
    connectedSince: data.conectadoDesde?.trim() || null,
    connectedMinutes: Number(data.minutosConectado) || 0,
    ipv4: data.ipv4?.trim() || null,
    address: buildPppoeAddress(data),
    addressParts: buildPppoeAddressParts(data),
    city: data.CIDADE?.trim() || null,
    clientCode: data.COD_CLIENTE?.trim() || null,
    cto: data.CTO?.trim() || null,
    pon: data.PON?.trim() || null,
    olt: data.OLT?.trim() || null,
    serial: data.SERIAL?.trim() || null,
    hasOpenServiceOrder: (data.os_aberta || '').trim().toUpperCase() === 'TRUE',
    onuState: data.onu_run_state?.trim() || null,
    lastDownCause: data.onu_last_down_cause?.trim() || null,
  };
}

export async function fetchPppoeList(
  login: string,
  timeoutMs = 75000
): Promise<PppoeStatusResponse[]> {
  const data = await apiRequest<PppoeStatusResponse[] | string>(
    '/webhook/check_pppoe_status',
    {
      method: 'POST',
      body: { login },
      timeoutMs,
    }
  );

  if (typeof data === 'string' || !Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data;
}

export async function fetchPppoeRaw(
  login: string,
  timeoutMs = 75000
): Promise<PppoeStatusResponse | null> {
  const data = await fetchPppoeList(login, timeoutMs);
  return (
    data.find((item) => item.LOGIN?.trim() === login.trim()) ??
    (data.length === 1 ? data[0] : null)
  );
}

export async function checkPppoeStatus(
  login: string
): Promise<ConnectionStatus | null> {
  const raw = await fetchPppoeRaw(login);
  return raw ? mapPppoeStatus(raw) : null;
}

export function formatConnectedTime(minutes: number): string {
  if (!minutes || minutes <= 0) return '—';

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}
