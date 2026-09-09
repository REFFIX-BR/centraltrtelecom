import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  authenticateWithDocument,
  buildAddress,
  mapSacClientToSubscriber,
  type LoginPointOption,
  type SacClient,
} from '@/src/services/auth';
import {
  addPushInboxItem,
  loadPushInbox,
  markPushInboxRead,
} from '@/src/services/push';
import type {
  DocumentItem,
  NotificationItem,
  Subscriber,
  SupportTicket,
} from '@/src/types';

const SESSION_KEY = '@trtelecom/session_v1';
const LEGACY_STORAGE_KEYS = ['@trtelecom/session', '@trtelecom/users'];

type PendingPointSelection = {
  client: SacClient;
  options: LoginPointOption[];
  fallbackAddress: string;
};

type AuthContextValue = {
  user: Subscriber | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingPointSelection: PendingPointSelection | null;
  login: (document: string, password: string) => Promise<'ok' | 'select_point'>;
  selectLoginPoint: (login: string) => Promise<void>;
  cancelPointSelection: () => void;
  applyInstallationAddress: (address: string) => Promise<void>;
  applyAccountSnapshot: (patch: {
    address?: string;
    invoices?: Subscriber['invoices'];
    clientCode?: string;
    planName?: string;
    speedMbps?: number;
  }) => Promise<void>;
  logout: () => Promise<void>;
  registerFirstAccess: (payload: {
    document: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  findProspect: (document: string) => Promise<Subscriber | null>;
  createTicket: (subject: string, description: string) => Promise<SupportTicket>;
  addDocument: (title: string, type: string) => Promise<DocumentItem>;
  unreadNotifications: number;
  markNotificationsRead: () => Promise<void>;
  ingestPushNotification: (item: NotificationItem) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mergeNotifications(
  session: NotificationItem[] | undefined,
  inbox: NotificationItem[]
): NotificationItem[] {
  const map = new Map<string, NotificationItem>();
  for (const item of [...(session || []), ...inbox]) {
    if (!item?.id) continue;
    const existing = map.get(item.id);
    if (!existing || (existing.read && !item.read)) {
      map.set(item.id, item);
    } else if (!existing) {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function integrationPending(feature: string): never {
  throw new Error(`${feature} ainda não foi integrado com a API da TR Telecom.`);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Subscriber | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPointSelection, setPendingPointSelection] =
    useState<PendingPointSelection | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        await AsyncStorage.multiRemove(LEGACY_STORAGE_KEYS);
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as Subscriber;
          const inbox = await loadPushInbox();
          const merged = mergeNotifications(session.notifications, inbox);
          setUser({ ...session, notifications: merged });
        }
      } finally {
        setIsLoading(false);
      }
    }
    bootstrap();
  }, []);

  const persistSession = useCallback(async (next: Subscriber) => {
    const inbox = await loadPushInbox();
    const withInbox = {
      ...next,
      notifications: mergeNotifications(next.notifications, inbox),
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(withInbox));
    setUser(withInbox);
  }, []);

  const login = useCallback(
    async (document: string, password: string) => {
      const result = await authenticateWithDocument(document, password);

      if (result.status === 'select_point') {
        const fallbackAddress = buildAddress(result.client);
        setPendingPointSelection({
          client: result.client,
          options: result.options,
          fallbackAddress,
        });
        return 'select_point' as const;
      }

      setPendingPointSelection(null);
      await persistSession(result.subscriber);
      return 'ok' as const;
    },
    [persistSession]
  );

  const selectLoginPoint = useCallback(
    async (login: string) => {
      if (!pendingPointSelection) {
        throw new Error('Nenhuma seleção de login pendente.');
      }

      const option = pendingPointSelection.options.find((item) => item.login === login);
      if (!option) {
        throw new Error('Login inválido.');
      }

      const address = option.addressReady
        ? option.address
        : pendingPointSelection.fallbackAddress;

      const subscriber = mapSacClientToSubscriber(
        pendingPointSelection.client,
        option.login,
        address
      );

      setPendingPointSelection(null);
      await persistSession(subscriber);
    },
    [pendingPointSelection, persistSession]
  );

  const cancelPointSelection = useCallback(() => {
    setPendingPointSelection(null);
  }, []);

  const applyInstallationAddress = useCallback(
    async (address: string) => {
      const trimmed = address.trim();
      if (!trimmed || !user || user.address === trimmed) return;

      await persistSession({
        ...user,
        address: trimmed,
        plan: { ...user.plan, installationAddress: trimmed },
      });
    },
    [persistSession, user]
  );

  const applyAccountSnapshot = useCallback(
    async (patch: {
      address?: string;
      invoices?: Subscriber['invoices'];
      clientCode?: string;
      planName?: string;
      speedMbps?: number;
    }) => {
      if (!user) return;

      const nextAddress = patch.address?.trim() || user.address;
      const next = {
        ...user,
        // Sessão identificada pelo LOGIN selecionado; COD_CLIENTE fica no contrato.
        login: user.login,
        address: nextAddress,
        invoices: patch.invoices ?? user.invoices,
        plan: {
          ...user.plan,
          installationAddress: nextAddress,
          name: patch.planName?.trim() || user.plan.name,
          speedMbps:
            typeof patch.speedMbps === 'number' && patch.speedMbps > 0
              ? patch.speedMbps
              : user.plan.speedMbps,
          contractId: patch.clientCode?.trim() || user.plan.contractId,
        },
      };

      await persistSession(next);
    },
    [persistSession, user]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setPendingPointSelection(null);
    setUser(null);
  }, []);

  const findProspect = useCallback(async (_document: string) => {
    return integrationPending('Primeiro acesso');
  }, []);

  const registerFirstAccess = useCallback(
    async (_payload: {
      document: string;
      email: string;
      phone: string;
      password: string;
    }) => {
      integrationPending('Primeiro acesso');
    },
    []
  );

  const createTicket = useCallback(
    async (_subject: string, _description: string) => {
      return integrationPending('Abertura de protocolo');
    },
    []
  );

  const addDocument = useCallback(
    async (_title: string, _type: string) => {
      return integrationPending('Envio de documentos');
    },
    []
  );

  const markNotificationsRead = useCallback(async () => {
    const inbox = await markPushInboxRead();
    if (!user) return;
    const next = {
      ...user,
      notifications: mergeNotifications(
        user.notifications.map((item) => ({ ...item, read: true })),
        inbox
      ),
    };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setUser(next);
  }, [user]);

  const ingestPushNotification = useCallback(
    async (item: NotificationItem) => {
      const inbox = await addPushInboxItem(item);
      setUser((current) => {
        if (!current) return current;
        const next = {
          ...current,
          notifications: mergeNotifications(current.notifications, inbox),
        };
        void AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      pendingPointSelection,
      login,
      selectLoginPoint,
      cancelPointSelection,
      applyInstallationAddress,
      applyAccountSnapshot,
      logout,
      registerFirstAccess,
      findProspect,
      createTicket,
      addDocument,
      unreadNotifications: user?.notifications.filter((n) => !n.read).length ?? 0,
      markNotificationsRead,
      ingestPushNotification,
    }),
    [
      user,
      isLoading,
      pendingPointSelection,
      login,
      selectLoginPoint,
      cancelPointSelection,
      applyInstallationAddress,
      applyAccountSnapshot,
      logout,
      registerFirstAccess,
      findProspect,
      createTicket,
      addDocument,
      markNotificationsRead,
      ingestPushNotification,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
