import { Linking } from 'react-native';

import { formatCurrency, formatDocument, onlyDigits } from '@/src/utils/format';

const DEFAULT_UPGRADE_WHATSAPP = '24993279575';

function resolveWhatsAppDigits(): string {
  const fromEnv = process.env.EXPO_PUBLIC_UPGRADE_WHATSAPP?.replace(/\D/g, '');
  const raw = fromEnv || DEFAULT_UPGRADE_WHATSAPP;
  // Garante DDI 55 (Brasil)
  if (raw.startsWith('55') && raw.length >= 12) return raw;
  return `55${raw}`;
}

export type UpgradeWhatsAppPayload = {
  customerName: string;
  customerDocument: string;
  customerPhone?: string;
  customerLogin?: string;
  contractId?: string;
  currentPlanName: string;
  currentSpeedMbps: number;
  requestedPlanName: string;
  requestedSpeedMbps: number;
  monthlyPrice: number;
  saleId?: string | null;
  status?: string;
};

export function buildUpgradeWhatsAppMessage(input: UpgradeWhatsAppPayload): string {
  const protocol = input.saleId
    ? input.saleId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()
    : null;

  const lines = [
    '*Solicitação de upgrade — Central do Assinante*',
    '',
    `*Cliente:* ${input.customerName}`,
    `*Documento:* ${formatDocument(onlyDigits(input.customerDocument))}`,
  ];

  if (input.customerPhone) {
    lines.push(`*Telefone:* ${input.customerPhone}`);
  }
  if (input.customerLogin) {
    lines.push(`*Login PPPoE:* ${input.customerLogin}`);
  }
  if (input.contractId) {
    lines.push(`*Contrato:* ${input.contractId}`);
  }

  lines.push(
    '',
    '*Plano atual:*',
    `${input.currentPlanName || 'Não informado'}${
      input.currentSpeedMbps > 0 ? ` (${input.currentSpeedMbps} Mbps)` : ''
    }`,
    '',
    '*Upgrade solicitado:*',
    `${input.requestedPlanName} — ${input.requestedSpeedMbps} Mbps`,
    `*Valor:* ${formatCurrency(input.monthlyPrice)}/mês`
  );

  if (protocol) {
    lines.push('', `*Protocolo:* ${protocol}`);
  }
  if (input.status) {
    lines.push(`*Status:* ${input.status}`);
  }

  return lines.join('\n');
}

export function getUpgradeWhatsAppUrl(input: UpgradeWhatsAppPayload): string {
  const phone = resolveWhatsAppDigits();
  const text = encodeURIComponent(buildUpgradeWhatsAppMessage(input));
  return `https://wa.me/${phone}?text=${text}`;
}

/** Desativado: upgrade não redireciona mais para WhatsApp. */
export async function openUpgradeWhatsApp(
  _input: UpgradeWhatsAppPayload
): Promise<boolean> {
  return false;
}

export type MobileInterestWhatsAppPayload = {
  customerName: string;
  customerDocument: string;
  customerPhone?: string;
  customerLogin?: string;
  contractId?: string;
  planName: string;
  totalGb: number;
  monthlyPrice: number;
  voiceMinutes?: string;
  sms?: string;
};

export function buildMobileInterestWhatsAppMessage(
  input: MobileInterestWhatsAppPayload
): string {
  const lines = [
    '*Interesse em telefonia móvel — Central do Assinante*',
    '',
    `*Cliente:* ${input.customerName}`,
    `*Documento:* ${formatDocument(onlyDigits(input.customerDocument))}`,
  ];

  if (input.customerPhone) lines.push(`*Telefone:* ${input.customerPhone}`);
  if (input.customerLogin) lines.push(`*Login PPPoE:* ${input.customerLogin}`);
  if (input.contractId) lines.push(`*Contrato:* ${input.contractId}`);

  lines.push(
    '',
    '*Plano de interesse:*',
    `${input.planName}${input.totalGb > 0 ? ` — ${input.totalGb} GB` : ''}`,
    `*Valor:* ${formatCurrency(input.monthlyPrice)}/mês`
  );

  if (input.voiceMinutes) lines.push(`*Voz:* ${input.voiceMinutes}`);
  if (input.sms) lines.push(`*SMS:* ${input.sms}`);

  return lines.join('\n');
}

export async function openMobileInterestWhatsApp(
  input: MobileInterestWhatsAppPayload
): Promise<boolean> {
  try {
    const phone = resolveWhatsAppDigits();
    const text = encodeURIComponent(buildMobileInterestWhatsAppMessage(input));
    const url = `https://wa.me/${phone}?text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export type MobileRechargeWhatsAppPayload = {
  customerName: string;
  customerDocument: string;
  customerPhone?: string;
  customerLogin?: string;
  contractId?: string;
  lineMsisdn: string;
  planName: string;
  planMonthlyPrice?: number | null;
  dataLeftLabel?: string | null;
};

export function buildMobileRechargeWhatsAppMessage(
  input: MobileRechargeWhatsAppPayload
): string {
  const lines = [
    '*Solicitação de recarga — Central do Assinante*',
    '',
    `*Cliente:* ${input.customerName}`,
    `*Documento:* ${formatDocument(onlyDigits(input.customerDocument))}`,
  ];

  if (input.customerPhone) lines.push(`*Telefone:* ${input.customerPhone}`);
  if (input.customerLogin) lines.push(`*Login PPPoE:* ${input.customerLogin}`);
  if (input.contractId) lines.push(`*Contrato:* ${input.contractId}`);

  lines.push(
    '',
    '*Linha / chip:*',
    input.lineMsisdn,
    `*Plano atual:* ${input.planName || 'Não informado'}`
  );

  if (input.planMonthlyPrice != null) {
    lines.push(`*Mensalidade:* ${formatCurrency(input.planMonthlyPrice)}`);
  }
  if (input.dataLeftLabel) {
    lines.push(`*Internet restante:* ${input.dataLeftLabel}`);
  }

  lines.push('', 'Gostaria de fazer uma *recarga* neste chip.');

  return lines.join('\n');
}

/** Abre o WhatsApp pedindo recarga do chip móvel. */
export async function openMobileRechargeWhatsApp(
  input: MobileRechargeWhatsAppPayload
): Promise<boolean> {
  try {
    const phone = resolveWhatsAppDigits();
    const text = encodeURIComponent(buildMobileRechargeWhatsAppMessage(input));
    const url = `https://wa.me/${phone}?text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export type HirePlanWhatsAppPayload = {
  planName: string;
  speedMbps: number;
  monthlyPrice: number;
  customerDocument?: string;
};

export function buildHirePlanWhatsAppMessage(
  input: HirePlanWhatsAppPayload
): string {
  const lines = [
    '*Quero contratar internet — Central do Assinante*',
    '',
    '*Plano selecionado:*',
    `${input.planName} — ${
      input.speedMbps >= 1000 ? '1 Gbps' : `${input.speedMbps} Mbps`
    }`,
    `*Valor:* ${formatCurrency(input.monthlyPrice)}/mês`,
  ];

  const digits = onlyDigits(input.customerDocument || '');
  if (digits.length === 11 || digits.length === 14) {
    lines.push('', `*Documento:* ${formatDocument(digits)}`);
  }

  lines.push(
    '',
    'Vim pela tela de login do app e gostaria de assinar este plano. Podem me atender?'
  );

  return lines.join('\n');
}

export async function openHirePlanWhatsApp(
  input: HirePlanWhatsAppPayload
): Promise<boolean> {
  try {
    const phone = resolveWhatsAppDigits();
    const text = encodeURIComponent(buildHirePlanWhatsAppMessage(input));
    const url = `https://wa.me/${phone}?text=${text}`;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function buildSacPasswordWhatsAppMessage(document: string): string {
  const digits = onlyDigits(document);
  const lines = [
    '*Primeiro acesso — Central do Assinante*',
    '',
  ];

  if (digits.length === 11 || digits.length === 14) {
    lines.push(`*Documento:* ${formatDocument(digits)}`, '');
  }

  lines.push(
    'Gostaria de saber a minha *senha SAC* para acessar o aplicativo da Central do Assinante.'
  );

  return lines.join('\n');
}

export async function openSacPasswordWhatsApp(
  document: string
): Promise<boolean> {
  try {
    const phone = resolveWhatsAppDigits();
    const text = encodeURIComponent(buildSacPasswordWhatsAppMessage(document));
    const url = `https://wa.me/${phone}?text=${text}`;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
