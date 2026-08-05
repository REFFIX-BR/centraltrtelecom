import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiRequest } from '@/src/services/api';

export type BannerTheme = 'navy' | 'blue' | 'sky';

export type PromoBanner = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  linkUrl: string;
  imageUrl?: string;
  theme: BannerTheme;
  active: boolean;
  order: number;
  showCta: boolean;
  imageOnly: boolean;
};

type BannersResponse = {
  banners?: PromoBanner[];
};

const BANNERS_CACHE_KEY = '@central/promo-banners-v1';

function getDevLanHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    // @ts-expect-error legacy Expo Go field
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    // @ts-expect-error legacy Expo field
    Constants.manifest?.debuggerHost,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      const host = value.split(':')[0]?.trim();
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    }
  }

  return null;
}

function rewriteLocalhostForDevice(baseUrl: string): string {
  try {
    // Caminho relativo (/uploads/...) → monta URL na API de banners
    if (baseUrl.startsWith('/')) {
      const configured = process.env.EXPO_PUBLIC_BANNERS_URL?.replace(/\/$/, '');
      const apiBase = configured
        ? rewriteLocalhostForDevice(configured)
        : (() => {
            const lanHost = getDevLanHost();
            if (lanHost) return `http://${lanHost}:4050`;
            const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
            return `http://${host}:4050`;
          })();
      return `${apiBase}${baseUrl}`;
    }

    const url = new URL(baseUrl);
    const isLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLoopback) return baseUrl;

    // Emulador Android: localhost do PC = 10.0.2.2
    if (Platform.OS === 'android' && !getDevLanHost()) {
      url.hostname = '10.0.2.2';
      return url.toString().replace(/\/$/, '');
    }

    // Celular físico: usa o mesmo IP da rede do Expo/Metro
    const lanHost = getDevLanHost();
    if (lanHost) {
      url.hostname = lanHost;
      return url.toString().replace(/\/$/, '');
    }

    return baseUrl;
  } catch {
    return baseUrl;
  }
}

function resolveBannersApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_BANNERS_URL?.replace(/\/$/, '');
  if (configured) {
    return rewriteLocalhostForDevice(configured);
  }

  if (__DEV__) {
    const lanHost = getDevLanHost();
    if (lanHost) {
      return `http://${lanHost}:4050`;
    }
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    return `http://${host}:4050`;
  }

  return '';
}

function resolveBannersPath(): string {
  const base = resolveBannersApiBase();
  if (base) return `${base}/api/banners`;
  return '/webhook/propagandas';
}

/** Base da API local (banners / ordens de serviço). */
export function getBannersApiBase(): string {
  return resolveBannersApiBase();
}

function normalizeBanner(item: Partial<PromoBanner>): PromoBanner | null {
  if (!item?.id) return null;
  const imageUrl = String(item.imageUrl || '').trim();
  // No app só vale card com foto — título interno fica no painel.
  if (!imageUrl) return null;

  return {
    id: String(item.id),
    title: String(item.title || '').trim(),
    subtitle: String(item.subtitle || '').trim(),
    ctaLabel: '',
    linkUrl: String(item.linkUrl || '').trim(),
    imageUrl: rewriteLocalhostForDevice(imageUrl),
    theme: ['navy', 'blue', 'sky'].includes(String(item.theme))
      ? (item.theme as BannerTheme)
      : 'navy',
    active: item.active !== false,
    order: Number(item.order) || 99,
    showCta: false,
    imageOnly: true,
  };
}

function normalizeList(list: Partial<PromoBanner>[]): PromoBanner[] {
  return list
    .map(normalizeBanner)
    .filter((item): item is PromoBanner => !!item && item.active)
    .sort((a, b) => a.order - b.order);
}

async function readCachedBanners(): Promise<PromoBanner[]> {
  try {
    const raw = await AsyncStorage.getItem(BANNERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeList(parsed);
  } catch {
    return [];
  }
}

async function writeCachedBanners(banners: PromoBanner[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BANNERS_CACHE_KEY, JSON.stringify(banners));
  } catch {
    // cache best-effort
  }
}

/**
 * Carrega banners com cache local.
 * Imagens só baixam de novo quando a URL muda (upload novo no MinIO).
 */
export async function fetchPromoBanners(): Promise<PromoBanner[]> {
  const cached = await readCachedBanners();

  try {
    const data = await apiRequest<BannersResponse | PromoBanner[]>(
      resolveBannersPath(),
      {
        method: 'GET',
        timeoutMs: 12000,
      }
    );

    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.banners)
        ? data.banners
        : [];

    const fresh = normalizeList(list);
    await writeCachedBanners(fresh);
    return fresh;
  } catch {
    return cached;
  }
}

/** Só o cache em disco (abertura rápida). */
export async function getCachedPromoBanners(): Promise<PromoBanner[]> {
  return readCachedBanners();
}

export const bannerGradients: Record<BannerTheme, [string, string, string]> = {
  navy: ['#071B38', '#0E2C5B', '#1B4F91'],
  blue: ['#0E2C5B', '#1B4F91', '#2878D4'],
  sky: ['#1B4F91', '#2878D4', '#3B91F2'],
};
