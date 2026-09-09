import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/src/contexts/AuthContext';
import { checkPppoeStatus, type ConnectionStatus } from '@/src/services/connection';
import {
  fetchContractsByDocument,
  type ContractSummary,
} from '@/src/services/contracts';
import {
  fetchAllInvoices,
  filterInvoicesByClientCode,
} from '@/src/services/invoices';
import {
  fetchAppMobilePlans,
  fetchMvnoSubscriber,
  type AppMobilePlan,
  type MvnoSubscriberLookup,
} from '@/src/services/mobilePlans';
import {
  attachCommercialIds,
  fetchCommercialPlans,
  type UpgradeOffer,
} from '@/src/services/commercial';
import { fetchCatalogPlans, pickUpgradePlans } from '@/src/services/plans';

type AccountContextValue = {
  connection: ConnectionStatus | null;
  contracts: ContractSummary | null;
  contractError: string | null;
  mvno: MvnoSubscriberLookup | null;
  mobilePlans: AppMobilePlan[];
  mobileReady: boolean;
  upgrades: UpgradeOffer[];
  upgradesReady: boolean;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  reloadContract: () => Promise<void>;
  reloadMobile: () => Promise<void>;
  reloadUpgrades: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, applyAccountSnapshot } = useAuth();
  const login = user?.login ?? null;
  const document = user?.document ?? null;

  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [contracts, setContracts] = useState<ContractSummary | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [mvno, setMvno] = useState<MvnoSubscriberLookup | null>(null);
  const [mobilePlans, setMobilePlans] = useState<AppMobilePlan[]>([]);
  const [mobileReady, setMobileReady] = useState(false);
  const [upgrades, setUpgrades] = useState<UpgradeOffer[]>([]);
  const [upgradesReady, setUpgradesReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const applySnapshotRef = useRef(applyAccountSnapshot);
  applySnapshotRef.current = applyAccountSnapshot;

  const loadAccountData = useCallback(
    async (subscriberLogin: string, subscriberDocument: string) => {
      const currentRequest = ++requestId.current;
      setIsLoading(true);
      setError(null);
      setContracts(null);
      setContractError(null);

      try {
        const statusPromise = checkPppoeStatus(subscriberLogin)
          .then((value) => ({ value, error: null as string | null }))
          .catch((statusError: unknown) => ({
            value: null as ConnectionStatus | null,
            error:
              statusError instanceof Error
                ? statusError.message
                : 'Não foi possível verificar sua conexão.',
          }));

        const invoicesPromise = fetchAllInvoices(subscriberDocument).catch(
          () => [] as Awaited<ReturnType<typeof fetchAllInvoices>>
        );

        const contractPromise = fetchContractsByDocument(subscriberDocument)
          .then((value) => ({ value, error: null as string | null }))
          .catch((contractFetchError: unknown) => ({
            value: null as ContractSummary | null,
            error:
              contractFetchError instanceof Error
                ? contractFetchError.message
                : 'Não foi possível consultar seu contrato.',
          }));

        const mobilePromise = Promise.all([
          fetchAppMobilePlans(),
          fetchMvnoSubscriber(subscriberDocument),
        ]).catch(() => [[], null] as const);

        const upgradesPromise = (async (): Promise<UpgradeOffer[]> => {
          try {
            const statusResult = await statusPromise;
            const status = statusResult.value;
            const [catalog, commercialPlans] = await Promise.all([
              fetchCatalogPlans(),
              fetchCommercialPlans().catch(() => []),
            ]);
            const currentPlanName = status?.planName || '';
            const currentSpeedMbps = status?.speedMbps || 0;
            if (!currentPlanName && currentSpeedMbps <= 0) return [];

            const { upgrades: next } = pickUpgradePlans(catalog, {
              currentPlanName,
              currentSpeedMbps,
              limit: 8,
            });
            return attachCommercialIds(next, commercialPlans).slice(0, 2);
          } catch {
            return [];
          }
        })();

        const [statusResult, invoices, contractResult, mobileResult, nextUpgrades] =
          await Promise.all([
            statusPromise,
            invoicesPromise,
            contractPromise,
            mobilePromise,
            upgradesPromise,
          ]);
        if (requestId.current !== currentRequest) return;

        const status = statusResult.value;
        const [plans, subscriber] = mobileResult;

        setConnection(status);
        setError(statusResult.error);
        setContracts(contractResult.value);
        setContractError(contractResult.error);
        setMobilePlans(plans);
        setMvno(subscriber);
        setMobileReady(true);
        setUpgrades(nextUpgrades);
        setUpgradesReady(true);

        // Faturas vêm por documento; o COD_CLIENTE é só a ponte do LOGIN selecionado.
        const filteredInvoices = filterInvoicesByClientCode(
          invoices,
          status?.clientCode
        );

        await applySnapshotRef.current({
          // Mantém o endereço escolhido no listar-logins do LOGIN.
          invoices: filteredInvoices,
          clientCode: status?.clientCode || undefined,
          planName: status?.planName,
          speedMbps: status?.speedMbps,
        });
      } catch (fetchError) {
        if (requestId.current !== currentRequest) return;
        setConnection(null);
        setMvno(null);
        setMobilePlans([]);
        setMobileReady(false);
        setUpgrades([]);
        setUpgradesReady(false);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Não foi possível carregar os dados da sua conta.'
        );
      } finally {
        if (requestId.current === currentRequest) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isAuthenticated || !login || !document) {
      requestId.current += 1;
      setConnection(null);
      setContracts(null);
      setContractError(null);
      setMvno(null);
      setMobilePlans([]);
      setMobileReady(false);
      setUpgrades([]);
      setUpgradesReady(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    loadAccountData(login, document);
  }, [isAuthenticated, login, document, loadAccountData]);

  const reload = useCallback(async () => {
    if (!login || !document) return;
    await loadAccountData(login, document);
  }, [loadAccountData, login, document]);

  const reloadContract = useCallback(async () => {
    if (!document) return;
    setContractError(null);
    try {
      setContracts(await fetchContractsByDocument(document));
    } catch (fetchError) {
      setContracts(null);
      setContractError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Não foi possível consultar seu contrato.'
      );
    }
  }, [document]);

  const reloadMobile = useCallback(async () => {
    if (!document) return;
    const [plans, subscriber] = await Promise.all([
      fetchAppMobilePlans(),
      fetchMvnoSubscriber(document),
    ]);
    setMobilePlans(plans);
    setMvno(subscriber);
    setMobileReady(true);
  }, [document]);

  const reloadUpgrades = useCallback(async () => {
    try {
      const status = connection;
      const currentPlanName = status?.planName || '';
      const currentSpeedMbps = status?.speedMbps || 0;
      if (!currentPlanName && currentSpeedMbps <= 0) {
        setUpgrades([]);
        setUpgradesReady(true);
        return;
      }

      const [catalog, commercialPlans] = await Promise.all([
        fetchCatalogPlans(),
        fetchCommercialPlans().catch(() => []),
      ]);
      const { upgrades: next } = pickUpgradePlans(catalog, {
        currentPlanName,
        currentSpeedMbps,
        limit: 8,
      });
      setUpgrades(attachCommercialIds(next, commercialPlans).slice(0, 2));
      setUpgradesReady(true);
    } catch {
      setUpgrades([]);
      setUpgradesReady(true);
    }
  }, [connection]);

  const value = useMemo<AccountContextValue>(
    () => ({
      connection,
      contracts,
      contractError,
      mvno,
      mobilePlans,
      mobileReady,
      upgrades,
      upgradesReady,
      isLoading,
      error,
      reload,
      reloadContract,
      reloadMobile,
      reloadUpgrades,
    }),
    [
      connection,
      contracts,
      contractError,
      mvno,
      mobilePlans,
      mobileReady,
      upgrades,
      upgradesReady,
      isLoading,
      error,
      reload,
      reloadContract,
      reloadMobile,
      reloadUpgrades,
    ]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount deve ser usado dentro de AccountProvider');
  }
  return context;
}
