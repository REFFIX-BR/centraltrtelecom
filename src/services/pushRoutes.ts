/** Telas que o painel pode abrir ao tocar no push. */
export const PUSH_SCREENS = [
  { group: 'Abas do app', label: 'Início', href: '/(tabs)' },
  { group: 'Abas do app', label: 'Plano', href: '/(tabs)/plano' },
  { group: 'Abas do app', label: 'Faturas', href: '/(tabs)/faturas' },
  { group: 'Abas do app', label: 'Suporte', href: '/(tabs)/suporte' },
  { group: 'Abas do app', label: 'Mais', href: '/(tabs)/mais' },
  { group: 'Telas', label: 'Telefonia móvel', href: '/telefonia' },
  { group: 'Telas', label: 'Wi-Fi', href: '/wifi' },
  { group: 'Telas', label: 'Desbloqueio', href: '/desbloqueio' },
  { group: 'Telas', label: 'Extrato', href: '/extrato' },
  { group: 'Telas', label: 'Documentos', href: '/documentos' },
  { group: 'Telas', label: 'Perfil', href: '/perfil' },
  { group: 'Telas', label: 'Notificações', href: '/notificacoes' },
  { group: 'Telas', label: 'Novo chamado', href: '/suporte/novo' },
] as const;

const ALIASES: Record<string, string> = {
  '/': '/(tabs)',
  '/index': '/(tabs)',
  '/inicio': '/(tabs)',
  '/(tabs)/index': '/(tabs)',
  '/plano': '/(tabs)/plano',
  '/faturas': '/(tabs)/faturas',
  '/suporte': '/(tabs)/suporte',
  '/mais': '/(tabs)/mais',
};

const ALLOWED = new Set<string>([
  ...PUSH_SCREENS.map((item) => item.href),
  ...Object.values(ALIASES),
]);

export function labelForPushRoute(href: string): string {
  const normalized = normalizePushRoute(href) || href;
  return PUSH_SCREENS.find((item) => item.href === normalized)?.label || normalized;
}

export function normalizePushRoute(raw: string | null | undefined): string | null {
  const value = String(raw || '')
    .trim()
    .replace(/\/+$/, '');
  if (!value) return null;

  const aliased = ALIASES[value] || ALIASES[value.toLowerCase()] || value;
  if (ALLOWED.has(aliased)) return aliased;
  if (aliased.startsWith('/') && ALLOWED.has(aliased)) return aliased;
  return null;
}

export function readRouteFromPushData(data: unknown): string | null {
  let payload: unknown = data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return normalizePushRoute(payload);
    }
  }
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as { route?: unknown; url?: unknown };
  return normalizePushRoute(String(record.route || record.url || ''));
}
