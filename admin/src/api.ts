export type BannerTheme = 'navy' | 'blue' | 'sky';

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  linkUrl: string;
  imageUrl: string;
  theme: BannerTheme;
  active: boolean;
  showCta: boolean;
  imageOnly: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type BannerInput = Omit<Banner, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

const TOKEN_KEY = 'trtelecom_admin_token';

/** Em produção (rota /central-admin-app) a API continua em centralapi. */
const API_BASE = String(import.meta.env.VITE_ADMIN_API_URL || '').replace(
  /\/$/,
  ''
);

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  }
  return data as T;
}

export async function login(password: string) {
  const data = await request<{ token: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setToken(data.token);
  return data.token;
}

export async function listBanners() {
  const data = await request<{ banners: Banner[] }>('/api/admin/banners');
  return data.banners;
}

export async function createBanner(input: BannerInput) {
  const data = await request<{ banner: Banner }>('/api/admin/banners', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.banner;
}

export async function updateBanner(id: string, input: BannerInput) {
  const data = await request<{ banner: Banner }>(`/api/admin/banners/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.banner;
}

export async function toggleBanner(id: string) {
  const data = await request<{ banner: Banner }>(`/api/admin/banners/${id}/toggle`, {
    method: 'PATCH',
  });
  return data.banner;
}

export async function deleteBanner(id: string) {
  await request<{ ok: boolean }>(`/api/admin/banners/${id}`, {
    method: 'DELETE',
  });
}

export async function uploadImage(file: File) {
  const token = getToken();
  const body = new FormData();
  body.append('image', file);

  const response = await fetch(apiUrl('/api/admin/upload'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível enviar a imagem.');
  }

  return data as { path: string; url: string; key?: string; storage?: string };
}

export type OrderStatus =
  | 'aguardando'
  | 'em_analise'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada';

export type ServiceOrder = {
  id: string;
  type: string;
  protocol: string;
  saleId: string | null;
  status: OrderStatus;
  statusLabel: string;
  customerName: string;
  customerDocument: string;
  customerPhone: string;
  customerEmail: string;
  customerLogin: string;
  contractId: string;
  currentPlanName: string;
  currentSpeedMbps: number;
  requestedPlanName: string;
  requestedSpeedMbps: number;
  monthlyPrice: number;
  commercialPlanId: number | null;
  notes: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export async function listOrders() {
  const data = await request<{ orders: ServiceOrder[] }>(
    '/api/admin/service-orders'
  );
  return data.orders;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  notes?: string
) {
  const data = await request<{ order: ServiceOrder }>(
    `/api/admin/service-orders/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }
  );
  return data.order;
}

export async function deleteOrder(id: string) {
  await request<{ ok: boolean }>(`/api/admin/service-orders/${id}`, {
    method: 'DELETE',
  });
}

export type MobilePlan = {
  id: string;
  code: number;
  name: string;
  displayName: string;
  monthlyPrice: number;
  dataGb: number;
  portGb: number;
  bonusGb: number;
  totalGb: number;
  voiceMinutes: string;
  sms: string;
  benefits: string;
  lineup: string;
  habilitarContratacao: boolean;
  showInApp: boolean;
  order: number;
  missingFromAltaRede?: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export async function listMobilePlans() {
  const data = await request<{ plans: MobilePlan[] }>('/api/admin/mobile-plans');
  return data.plans;
}

export async function syncMobilePlans() {
  const data = await request<{
    plans: MobilePlan[];
    synced: number;
    message: string;
  }>('/api/admin/mobile-plans/sync', { method: 'POST' });
  return data;
}

export async function toggleMobilePlan(id: string) {
  const data = await request<{ plan: MobilePlan }>(
    `/api/admin/mobile-plans/${id}/toggle`,
    { method: 'PATCH' }
  );
  return data.plan;
}

export async function updateMobilePlan(
  id: string,
  patch: Partial<Pick<MobilePlan, 'displayName' | 'benefits' | 'order' | 'showInApp'>>
) {
  const data = await request<{ plan: MobilePlan }>(
    `/api/admin/mobile-plans/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }
  );
  return data.plan;
}

export type PushToken = {
  token: string;
  document: string;
  login: string;
  name: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
};

export type PushHistoryItem = {
  id: string;
  title: string;
  body: string;
  route: string;
  sendToAll: boolean;
  document: string;
  login: string;
  recipients: number;
  delivered: number;
  errors: string[];
  createdAt: string;
};

export async function listPushTokens() {
  const data = await request<{ tokens: PushToken[] }>('/api/admin/push/tokens');
  return data.tokens;
}

export async function listPushHistory() {
  const data = await request<{ history: PushHistoryItem[] }>(
    '/api/admin/push/history'
  );
  return data.history;
}

export async function sendPush(input: {
  title: string;
  body: string;
  route?: string;
  document?: string;
  login?: string;
  token?: string;
  sendToAll?: boolean;
}) {
  const data = await request<{ result: PushHistoryItem }>('/api/admin/push/send', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.result;
}
