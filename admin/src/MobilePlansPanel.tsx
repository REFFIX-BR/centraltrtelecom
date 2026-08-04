import { useEffect, useMemo, useState } from 'react';

import {
  listMobilePlans,
  syncMobilePlans,
  toggleMobilePlan,
  updateMobilePlan,
  type MobilePlan,
} from './api';

type FilterKey = 'all' | 'app' | 'hidden' | 'comercial';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dataSummary(plan: MobilePlan) {
  if (plan.totalGb > 0 && (plan.portGb > 0 || plan.bonusGb > 0)) {
    const parts = [`${plan.dataGb || plan.totalGb}GB`];
    if (plan.portGb > 0) parts.push(`+${plan.portGb}GB port.`);
    if (plan.bonusGb > 0) parts.push(`+${plan.bonusGb}GB bônus`);
    return parts.join(' ');
  }
  if (plan.totalGb > 0 || plan.dataGb > 0) {
    return `${plan.totalGb || plan.dataGb} GB`;
  }
  if (plan.voiceMinutes) return plan.voiceMinutes;
  return '—';
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    refresh:
      'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15',
    phone:
      'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.3a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.8-1.2a2 2 0 0 1 2.1-.4c.7.3 1.5.5 2.3.6a2 2 0 0 1 1.7 2z',
    eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff:
      'M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a18.6 18.6 0 0 1-2.16 3.19M1 1l22 22M14.12 14.12a3 3 0 0 1-4.24-4.24',
  };

  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name] || paths.phone} />
    </svg>
  );
}

type Props = {
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
  onCounts?: (counts: { total: number; visible: number }) => void;
};

export function MobilePlansPanel({ onError, onSuccess, onCounts }: Props) {
  const [plans, setPlans] = useState<MobilePlan[]>([]);
  const [filter, setFilter] = useState<FilterKey>('comercial');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const next = await listMobilePlans();
      setPlans(next);
      onError(null);
      if (next.length === 0) {
        // Primeira visita: sincroniza sozinho do AltaRede.
        await runSync(true);
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os planos móveis.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function runSync(silent = false) {
    setSyncing(true);
    try {
      const result = await syncMobilePlans();
      setPlans(result.plans);
      if (!silent) onSuccess(result.message);
      onError(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Falha ao sincronizar com o AltaRede.'
      );
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const visible = plans.filter((p) => p.showInApp).length;
    const comercial = plans.filter((p) => p.lineup === 'comercial').length;
    return {
      total: plans.length,
      visible,
      hidden: plans.length - visible,
      comercial,
    };
  }, [plans]);

  useEffect(() => {
    onCounts?.({ total: counts.total, visible: counts.visible });
  }, [counts.total, counts.visible, onCounts]);

  const visible = useMemo(() => {
    if (filter === 'app') return plans.filter((p) => p.showInApp);
    if (filter === 'hidden') return plans.filter((p) => !p.showInApp);
    if (filter === 'comercial') {
      return plans.filter((p) => p.lineup === 'comercial');
    }
    return plans;
  }, [filter, plans]);

  async function handleToggle(plan: MobilePlan) {
    setBusyId(plan.id);
    try {
      const updated = await toggleMobilePlan(plan.id);
      setPlans((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      onSuccess(
        updated.showInApp
          ? `${updated.displayName} liberado no app.`
          : `${updated.displayName} oculto no app.`
      );
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Falha ao atualizar plano.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(plan: MobilePlan) {
    const next = window.prompt('Nome exibido no app', plan.displayName);
    if (next === null) return;
    const displayName = next.trim();
    if (!displayName || displayName === plan.displayName) return;

    setBusyId(plan.id);
    try {
      const updated = await updateMobilePlan(plan.id, { displayName });
      setPlans((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      onSuccess('Nome atualizado.');
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Falha ao renomear plano.'
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mobile-panel">
      <div className="section-head">
        <div>
          <h2>Telefonia móvel</h2>
          <p>
            Planos do AltaRede · ative só o que deve aparecer no app
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={syncing}
          onClick={() => void runSync()}
        >
          <Icon name="refresh" />
          {syncing ? 'Sincronizando…' : 'Sincronizar AltaRede'}
        </button>
      </div>

      <div className="filters">
        {(
          [
            ['comercial', 'Tabela GIGA', counts.comercial],
            ['all', 'Todos', counts.total],
            ['app', 'No app', counts.visible],
            ['hidden', 'Ocultos', counts.hidden],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className={`filter-chip ${filter === key ? 'is-on' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
            <em>{count}</em>
          </button>
        ))}
      </div>

      {loading && plans.length === 0 ? (
        <div className="empty">
          <p>Carregando planos…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="phone" />
          </div>
          <h3>Nenhum plano nesta lista</h3>
          <p>
            Clique em “Sincronizar AltaRede” para importar os chips EAI.
          </p>
        </div>
      ) : (
        <div className="mobile-table-wrap">
          <table className="mobile-table">
            <thead>
              <tr>
                <th>No app</th>
                <th>Plano</th>
                <th>Internet</th>
                <th>Voz / SMS</th>
                <th>Valor</th>
                <th>AltaRede</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((plan) => (
                <tr
                  key={plan.id}
                  className={plan.showInApp ? 'is-on-app' : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className={`app-toggle ${plan.showInApp ? 'is-on' : ''}`}
                      disabled={busyId === plan.id}
                      onClick={() => void handleToggle(plan)}
                      aria-pressed={plan.showInApp}
                      title={
                        plan.showInApp ? 'Ocultar no app' : 'Liberar no app'
                      }
                    >
                      <span className="app-toggle-ui" />
                      <strong>{plan.showInApp ? 'Ativo' : 'Off'}</strong>
                    </button>
                  </td>
                  <td>
                    <div className="mobile-plan-name">
                      <strong>{plan.displayName}</strong>
                      {plan.lineup === 'comercial' ? (
                        <em className="tag-comercial">Tabela</em>
                      ) : null}
                      {plan.missingFromAltaRede ? (
                        <em className="tag-warn">Fora do AltaRede</em>
                      ) : null}
                    </div>
                    <span className="mobile-plan-code">COD {plan.code}</span>
                  </td>
                  <td>
                    <span className="mobile-cell-main">{dataSummary(plan)}</span>
                    {plan.benefits ? (
                      <span className="mobile-cell-sub">{plan.benefits}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className="mobile-cell-main">
                      {plan.voiceMinutes || '—'}
                    </span>
                    <span className="mobile-cell-sub">{plan.sms || '—'}</span>
                  </td>
                  <td>
                    <strong className="mobile-price">
                      {formatMoney(plan.monthlyPrice)}
                    </strong>
                  </td>
                  <td>
                    <span className="mobile-raw" title={plan.name}>
                      {plan.name}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === plan.id}
                      onClick={() => void handleRename(plan)}
                    >
                      Renomear
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
