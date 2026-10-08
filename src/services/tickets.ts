import { apiRequest } from '@/src/services/api';
import { formatPhone, onlyDigits } from '@/src/utils/format';

export type TicketSector = {
  setor: string;
  cod_setor: number;
  motivos: string[];
  cod_motivos: number[];
};

export type OpenSupportTicketInput = {
  documento: string;
  setor: string;
  motivo: string;
  resumo: string;
  phone: string;
};

function normalizeSectors(data: unknown): TicketSector[] {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown })?.data)
      ? ((data as { data: unknown[] }).data)
      : [];

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Partial<TicketSector>;
      const setor = String(row.setor || '').trim();
      if (!setor) return null;
      const motivos = Array.isArray(row.motivos)
        ? row.motivos.map((m) => String(m).trim()).filter(Boolean)
        : [];
      const cod_motivos = Array.isArray(row.cod_motivos)
        ? row.cod_motivos.map((c) => Number(c)).filter((n) => Number.isFinite(n))
        : [];
      return {
        setor,
        cod_setor: Number(row.cod_setor) || 0,
        motivos,
        cod_motivos,
      };
    })
    .filter((item): item is TicketSector => !!item);
}

export async function fetchTicketSectors(): Promise<TicketSector[]> {
  const data = await apiRequest<unknown>('/webhook/coletarsetoresemotivos', {
    method: 'POST',
    body: {},
    timeoutMs: 30000,
  });
  const sectors = normalizeSectors(data);
  if (!sectors.length) {
    throw new Error('Não encontramos setores disponíveis no momento.');
  }
  return sectors;
}

/** Monta o texto do webhook: resumo do cliente + contato fixo. */
export function buildTicketResumo(resumo: string, phone: string): string {
  const text = resumo.trim().replace(/\s+/g, ' ');
  const contact = formatPhone(phone);
  return `${text} /// ENTRAR EM CONTATO COM: ${contact}`;
}

export async function openSupportTicket(
  input: OpenSupportTicketInput
): Promise<void> {
  const documento = onlyDigits(input.documento);
  if (documento.length < 11) {
    throw new Error('Documento do assinante inválido.');
  }
  const setor = input.setor.trim();
  const motivo = input.motivo.trim();
  if (!setor || !motivo) {
    throw new Error('Selecione o setor e o motivo do chamado.');
  }
  const phoneDigits = onlyDigits(input.phone);
  if (phoneDigits.length < 10) {
    throw new Error('Informe um telefone válido com DDD.');
  }
  const resumo = input.resumo.trim();
  if (resumo.length < 8) {
    throw new Error('Descreva o que você precisa com um pouco mais de detalhe.');
  }

  await apiRequest('/webhook/abrir_ticket', {
    method: 'POST',
    timeoutMs: 30000,
    body: {
      documento,
      resumo: buildTicketResumo(resumo, input.phone),
      setor,
      motivo,
    },
  });
}
