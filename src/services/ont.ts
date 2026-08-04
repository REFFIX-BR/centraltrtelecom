import { apiRequest } from '@/src/services/api';

export type OntCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type WifiBand = '2g' | '5g' | 'both';

type OntApiItem = {
  code?: number;
  signal?: string | null;
  stdout?: string;
  stderr?: string;
};

const WELCOME_LINE = /^Bem-vindo ao Bot ONU[^\n]*\n*/;

function quoteToken(value: string): string {
  const trimmed = value.trim();
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

function extractErrorMessage(stdout: string): string | null {
  const line = stdout
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item.startsWith('ERRO'));

  return line ? line.replace(/^ERRO:?\s*/, '') : null;
}

export async function runOntCommand(command: string): Promise<OntCommandResult> {
  const data = await apiRequest<OntApiItem[] | OntApiItem | string>(
    '/webhook/alterar-config-onts',
    {
      method: 'POST',
      body: { command },
      timeoutMs: 180000,
    }
  );

  const item = Array.isArray(data) ? data[0] : typeof data === 'object' ? data : null;
  if (!item) {
    throw new Error('Não foi possível falar com o equipamento agora.');
  }

  const stdout = (item.stdout ?? '').replace(WELCOME_LINE, '').trim();
  const result: OntCommandResult = {
    code: Number(item.code ?? 0),
    stdout,
    stderr: item.stderr ?? '',
  };

  const errorMessage = extractErrorMessage(stdout);
  if (result.code !== 0 || errorMessage) {
    throw new Error(errorMessage || 'O equipamento não concluiu a operação.');
  }

  return result;
}

export function buildWifiCommand(params: {
  login: string;
  band: WifiBand;
  ssid: string;
  password: string;
  ssid5g?: string;
  password5g?: string;
}): string {
  const tokens = [
    '2',
    params.login.trim(),
    params.band,
    quoteToken(params.ssid),
    quoteToken(params.password),
  ];

  // Em "both" o bot exige os quatro parâmetros (2.4 GHz e 5 GHz).
  if (params.band === 'both') {
    tokens.push(
      quoteToken(params.ssid5g?.trim() || params.ssid),
      quoteToken(params.password5g || params.password)
    );
  }

  return tokens.join(' ');
}

export async function updateWifiSettings(params: {
  login: string;
  band: WifiBand;
  ssid: string;
  password: string;
  ssid5g?: string;
  password5g?: string;
}): Promise<OntCommandResult> {
  return runOntCommand(buildWifiCommand(params));
}

export async function fetchOntSystemInfo(login: string): Promise<OntCommandResult> {
  return runOntCommand(`4 ${login.trim()}`);
}

/** Extrai pares "Campo : valor" do relatório do bot. */
export function parseOntFields(stdout: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const rawLine of stdout.split('\n')) {
    const match = rawLine.match(/^\s*([A-Za-zÀ-ÿ0-9 /()._-]+?)\s{2,}:\s*(.+?)\s*$/);
    if (match) {
      fields[match[1].trim()] = match[2].trim();
    }
  }

  return fields;
}
