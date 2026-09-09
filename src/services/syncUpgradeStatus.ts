import {
  fetchContractsByDocument,
  shouldDropUnsignedUpgradePending,
} from '@/src/services/contracts';
import {
  clearPendingUpgrade,
  loadActivatedUpgrade,
  loadPendingUpgrade,
  promotePendingToActivated,
  savePendingUpgrade,
  type PendingUpgrade,
} from '@/src/services/pendingUpgrade';
import {
  classifySaleStatus,
  resolveUpgradeStatus,
  type UpgradeProgressStep,
} from '@/src/services/saleStatus';

export type SyncedUpgradeState = {
  pending: PendingUpgrade | null;
  activated: Awaited<ReturnType<typeof loadActivatedUpgrade>>;
  statusLabel: string | null;
  activeStep: UpgradeProgressStep;
};

/**
 * Atualiza o pedido local com o status do comercial.
 * Instalado → promove; cancelado → limpa pendente.
 */
export async function syncPendingUpgradeFromComercial(input: {
  documento: string;
  customerKey: string;
  pending: PendingUpgrade;
}): Promise<SyncedUpgradeState> {
  const remote = await resolveUpgradeStatus({
    documento: input.documento,
    saleId: input.pending.saleId,
  });

  if (!remote) {
    const local = classifySaleStatus(input.pending.status);
    return {
      pending: input.pending,
      activated: await loadActivatedUpgrade(input.customerKey),
      statusLabel: input.pending.status,
      activeStep: local.activeStep,
    };
  }

  if (remote.phase === 'cancelled') {
    await clearPendingUpgrade();
    return {
      pending: null,
      activated: await loadActivatedUpgrade(input.customerKey),
      statusLabel: remote.status,
      activeStep: remote.activeStep,
    };
  }

  if (remote.phase === 'done') {
    const activated = await promotePendingToActivated({
      ...input.pending,
      status: remote.status,
      saleId: remote.sale?.id || input.pending.saleId,
    });
    return {
      pending: null,
      activated,
      statusLabel: remote.status,
      activeStep: 3,
    };
  }

  const next = await savePendingUpgrade({
    ...input.pending,
    status: remote.status,
    saleId: remote.sale?.id || input.pending.saleId,
  });

  return {
    pending: next,
    activated: await loadActivatedUpgrade(input.customerKey),
    statusLabel: next.status,
    activeStep: remote.activeStep,
  };
}

export async function loadAndSyncUpgrade(input: {
  documento: string;
  customerKey: string;
}): Promise<SyncedUpgradeState> {
  const pending = await loadPendingUpgrade(input.customerKey);
  if (!pending) {
    return {
      pending: null,
      activated: await loadActivatedUpgrade(input.customerKey),
      statusLabel: null,
      activeStep: 1,
    };
  }

  try {
    // Só consulta o comercial depois que a venda foi enviada (pós-assinatura).
    if (!pending.comercialSubmitted) {
      try {
        const summary = await fetchContractsByDocument(input.documento);
        if (shouldDropUnsignedUpgradePending(summary, pending)) {
          await clearPendingUpgrade();
          return {
            pending: null,
            activated: await loadActivatedUpgrade(input.customerKey),
            statusLabel: null,
            activeStep: 1,
          };
        }
      } catch {
        // falha na API de contratos — mantém o pendente local
      }

      return {
        pending,
        activated: await loadActivatedUpgrade(input.customerKey),
        statusLabel: pending.status,
        activeStep: 1,
      };
    }

    return await syncPendingUpgradeFromComercial({
      documento: input.documento,
      customerKey: input.customerKey,
      pending,
    });
  } catch {
    const local = classifySaleStatus(pending.status);
    return {
      pending,
      activated: await loadActivatedUpgrade(input.customerKey),
      statusLabel: pending.status,
      activeStep: local.activeStep,
    };
  }
}
