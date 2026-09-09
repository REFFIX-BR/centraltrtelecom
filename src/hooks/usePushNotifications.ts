import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

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
  const registeredFor = useRef<string | null>(null);
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web' || !isAuthenticated || !user) return;

    const key = `${user.document}:${user.login}`;
    if (registeredFor.current === key) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token || cancelled) return;
        await registerPushTokenWithApi({
          token,
          document: user.document,
          login: user.login,
          name: user.name,
        });
        if (!cancelled) registeredFor.current = key;
      } catch {
        // Sem permissão, Expo Go no Android ou API offline — o app segue.
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
      await savePendingPushRoute(route);
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
    if (Platform.OS === 'web' || isLoading || !isAuthenticated) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const route = await takePendingPushRoute();
        if (!route || cancelled) return;
        router.replace(route as never);
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated, isLoading, router]);
}
