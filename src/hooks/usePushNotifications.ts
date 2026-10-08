import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAccount } from '@/src/contexts/AccountContext';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  itemFromExpoNotification,
  registerForPushNotificationsAsync,
  registerPushTokenWithApi,
  routeFromNotificationResponse,
  savePendingPushRoute,
  takePendingPushRoute,
} from '@/src/services/push';

export function usePushNotifications() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, ingestPushNotification } = useAuth();
  const { isLoading: accountLoading } = useAccount();
  const registeredFor = useRef<string | null>(null);
  const handledResponse = useRef<string | null>(null);
  const navigatedRoute = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated || !user) return;

    const key = `${user.document}:${user.login}`;
    if (registeredFor.current === key) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token || cancelled) {
          if (__DEV__ && !token) {
            console.warn(
              '[push] Token não gerado (permissão negada, emulador ou FCM/APNs ausente).'
            );
          }
          return;
        }
        await registerPushTokenWithApi({
          token,
          document: user.document,
          login: user.login,
          name: user.name,
        });
        if (!cancelled) registeredFor.current = key;
      } catch (error) {
        if (__DEV__) {
          console.warn('[push] Falha ao registrar token', error);
        }
        registeredFor.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function openFromResponse(
      response: Notifications.NotificationResponse | null
    ) {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponse.current === id) return;
      handledResponse.current = id;

      const item = itemFromExpoNotification(response.notification);
      void ingestPushNotification(item);
      const route = routeFromNotificationResponse(response);
      navigatedRoute.current = null;
      await savePendingPushRoute(route);

      // Evita reprocessar o mesmo toque em cold start / remount.
      try {
        await Notifications.clearLastNotificationResponseAsync();
      } catch {
        // Versões antigas do expo-notifications podem não ter o método.
      }
    }

    const received = Notifications.addNotificationReceivedListener(
      (notification) => {
        void ingestPushNotification(itemFromExpoNotification(notification));
      }
    );

    const response = Notifications.addNotificationResponseReceivedListener(
      (event) => {
        void openFromResponse(event);
      }
    );

    void Notifications.getLastNotificationResponseAsync().then((last) => {
      void openFromResponse(last);
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, [ingestPushNotification]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Espera sessão + dados da conta (splash) antes de navegar.
    if (isLoading || !isAuthenticated || accountLoading) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const route = await takePendingPushRoute();
        if (!route || cancelled) return;
        if (navigatedRoute.current === route) return;
        navigatedRoute.current = route;
        router.replace(route as never);
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, isLoading, accountLoading, router]);
}
