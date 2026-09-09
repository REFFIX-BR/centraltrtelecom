import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiRequest } from '@/src/services/api';
import { getBannersApiBase } from '@/src/services/banners';
import { readRouteFromPushData } from '@/src/services/pushRoutes';
import type { NotificationItem } from '@/src/types';

const INBOX_KEY = '@trtelecom/push_inbox_v1';
const PENDING_ROUTE_KEY = '@trtelecom/push_pending_route';
const MAX_INBOX = 40;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function notificationFromExpo(
  notification: Notifications.Notification
): NotificationItem {
  const content = notification.request.content;
  return {
    id: notification.request.identifier || `push-${Date.now()}`,
    title: String(content.title || 'TR Telecom'),
    message: String(content.body || ''),
    createdAt: new Date().toISOString(),
    read: false,
    route: readRouteFromPushData(content.data) || undefined,
  };
}

export async function loadPushInbox(): Promise<NotificationItem[]> {
  try {
    const raw = await AsyncStorage.getItem(INBOX_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as NotificationItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function savePushInbox(
  items: NotificationItem[]
): Promise<NotificationItem[]> {
  const next = items.slice(0, MAX_INBOX);
  await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(next));
  return next;
}

export async function addPushInboxItem(
  item: NotificationItem
): Promise<NotificationItem[]> {
  const current = await loadPushInbox();
  const next = [item, ...current.filter((entry) => entry.id !== item.id)];
  return savePushInbox(next);
}

export async function markPushInboxRead(): Promise<NotificationItem[]> {
  const current = await loadPushInbox();
  return savePushInbox(current.map((item) => ({ ...item, read: true })));
}

export function itemFromExpoNotification(
  notification: Notifications.Notification
): NotificationItem {
  return notificationFromExpo(notification);
}

export function routeFromNotificationResponse(
  response: Notifications.NotificationResponse | null
): string | null {
  if (!response) return null;
  return (
    readRouteFromPushData(response.notification.request.content.data) ||
    '/notificacoes'
  );
}

export async function savePendingPushRoute(route: string | null): Promise<void> {
  if (!route) {
    await AsyncStorage.removeItem(PENDING_ROUTE_KEY);
    return;
  }
  await AsyncStorage.setItem(PENDING_ROUTE_KEY, route);
}

export async function takePendingPushRoute(): Promise<string | null> {
  const route = await AsyncStorage.getItem(PENDING_ROUTE_KEY);
  if (!route) return null;
  await AsyncStorage.removeItem(PENDING_ROUTE_KEY);
  return route;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Avisos TR Telecom',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0E2C5B',
    sound: 'default',
  });
}

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    undefined;

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  return token.data || null;
}

export async function registerPushTokenWithApi(input: {
  token: string;
  document: string;
  login: string;
  name: string;
}): Promise<void> {
  const base = getBannersApiBase();
  if (!base || !input.token) return;

  await apiRequest(`${base}/api/push/register`, {
    method: 'POST',
    timeoutMs: 15000,
    body: {
      token: input.token,
      document: input.document,
      login: input.login,
      name: input.name,
      platform: Platform.OS,
    },
  });
}
