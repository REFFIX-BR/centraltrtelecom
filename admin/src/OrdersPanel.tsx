import { useEffect, useMemo, useState } from 'react';

import {
  deleteOrder,
  listOrders,
  updateOrderStatus,
  type OrderStatus,
  type ServiceOrder,
} from './api';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

type FilterKey = 'open' | 'all' | OrderStatus;

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0 0 20.5 15',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M4 12l2-8h12l2 8v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.3a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.8-1.2a2 2 0 0 1 2.1-.4c.7.3 1.5.5 2.3.6a2 2 0 0 1 1.7 2z',
    mail: 'M4 4h16v16H4zM22 6l-10 7L2 6',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    check: 'M20 6L9 17l-5-5',
    close: 'M18 6L6 18M6 6l12 12',
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
      <path d={paths[name] || paths.inbox} />
    </svg>
  );
}

type Props = {
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
  onCounts?: (counts: { total: number; open: number }) => void;
};

export function OrdersPanel({ onError, onSuccess, onCounts }: Props) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [filter, setFilter] = useState<FilterKey>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ServiceOrder | null>(null);

  async function load() {
    setLoading(true);
    try {
      const next = await listOrders();
      setOrders(next);
      onError(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar as ordens.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const open = orders.filter(
      (item) => !['concluida', 'cancelada'].includes(item.status)
    ).length;
    return {
      total: orders.length,
      open,
      aguardando: orders.filter((o) => o.status === 'aguardando').length,
      em_analise: orders.filter((o) => o.status === 'em_analise').length,
      em_andamento: orders.filter((o) => o.status === 'em_andamento').length,
      concluida: orders.filter((o) => o.status === 'concluida').length,
      cancelada: orders.filter((o) => o.status === 'cancelada').length,
    };
  }, [orders]);

  useEffect(() => {
    onCounts?.({ total: counts.total, open: counts.open });
  }, [counts.open, counts.total, onCounts]);

  const visible = useMemo(() => {
    if (filter === 'all') return orders;
    if (filter === 'open') {
      return orders.filter(
        (item) => !['concluida', 'cancelada'].includes(item.status)
      );
    }
    return orders.filter((item) => item.status === filter);
  }, [filter, orders]);

  async function changeStatus(order: ServiceOrder, status: OrderStatus) {
    setBusyId(order.id);
    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrders((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
      onSuccess(`Ordem ${updated.protocol} atualizada.`);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Falha ao atualizar status.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(order: ServiceOrder) {
    if (!window.confirm(`Remover a ordem ${order.protocol}?`)) return;
    setBusyId(order.id);
    try {
      await deleteOrder(order.id);
      setOrders((prev) => prev.filter((item) => item.id !== order.id));
      if (selected?.id === order.id) setSelected(null);
      onSuccess(`Ordem ${order.protocol} removida.`);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Falha ao remover ordem.'
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="orders-layout">
      <section className="orders-list-panel">
        <div className="section-head">
          <div>
            <h2>Ordens de serviço</h2>
            <p>Upgrades solicitados pela Central do Assinante</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={() => void load()}>
            <Icon name="refresh" />
            Atualizar
          </button>
        </div>

        <div className="filters">
          {(
            [
              ['open', 'Abertas', counts.open],
              ['all', 'Todas', counts.total],
              ['aguardando', 'Aguardando', counts.aguardando],
              ['em_analise', 'Em análise', counts.em_analise],
              ['em_andamento', 'Andamento', counts.em_andamento],
              ['concluida', 'Concluídas', counts.concluida],
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

        {loading && orders.length === 0 ? (
          <div className="empty">
            <p>Carregando ordens…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="inbox" />
            </div>
            <h3>Nenhuma ordem por aqui</h3>
            <p>
              Quando um assinante pedir upgrade no app, a solicitação aparece
              nesta lista.
            </p>
          </div>
        ) : (
          <div className="order-grid">
            {visible.map((order) => {
              const active = selected?.id === order.id;
              return (
                <button
                  key={order.id}
                  type="button"
                  className={`order-card status-${order.status} ${
                    active ? 'is-selected' : ''
                  }`}
                  onClick={() => setSelected(order)}
                >
                  <div className="order-card-top">
                    <strong className="order-protocol">{order.protocol}</strong>
                    <span className={`order-badge status-${order.status}`}>
                      {order.statusLabel}
                    </span>
                  </div>
                  <div className="order-card-title">{order.customerName}</div>
                  <div className="order-card-plan">
                    <span>{order.currentPlanName || 'Plano atual'}</span>
                    <span aria-hidden>→</span>
                    <strong>{order.requestedPlanName}</strong>
                  </div>
                  <div className="order-card-meta">
                    <span>{formatWhen(order.createdAt)}</span>
                    <span>{formatMoney(order.monthlyPrice)}/mês</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="order-detail">
        {selected ? (
          <>
            <div className="section-head">
              <div>
                <p className="kicker">Protocolo</p>
                <h2>{selected.protocol}</h2>
              </div>
              <span className={`order-badge status-${selected.status}`}>
                {selected.statusLabel}
              </span>
            </div>

            <div className="detail-block">
              <h3>Cliente</h3>
              <div className="detail-rows">
                <div>
                  <Icon name="user" />
                  <div>
                    <strong>{selected.customerName}</strong>
                    <span>{selected.customerDocument || '—'}</span>
                  </div>
                </div>
                <div>
                  <Icon name="phone" />
                  <div>
                    <strong>{selected.customerPhone || '—'}</strong>
                    <span>Telefone</span>
                  </div>
                </div>
                <div>
                  <Icon name="mail" />
                  <div>
                    <strong>{selected.customerEmail || '—'}</strong>
                    <span>E-mail</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-block">
              <h3>Upgrade</h3>
              <div className="upgrade-compare">
                <div>
                  <span>De</span>
                  <strong>{selected.currentPlanName || '—'}</strong>
                  <em>
                    {selected.currentSpeedMbps
                      ? `${selected.currentSpeedMbps} Mbps`
                      : '—'}
                  </em>
                </div>
                <div className="upgrade-arrow">→</div>
                <div className="is-target">
                  <span>Para</span>
                  <strong>{selected.requestedPlanName}</strong>
                  <em>
                    {selected.requestedSpeedMbps
                      ? `${selected.requestedSpeedMbps} Mbps`
                      : '—'}{' '}
                    · {formatMoney(selected.monthlyPrice)}/mês
                  </em>
                </div>
              </div>
            </div>

            <div className="detail-block">
              <h3>Referências</h3>
              <dl className="detail-dl">
                <div>
                  <dt>Login PPPoE</dt>
                  <dd>{selected.customerLogin || '—'}</dd>
                </div>
                <div>
                  <dt>Contrato</dt>
                  <dd>{selected.contractId || '—'}</dd>
                </div>
                <div>
                  <dt>Sale ID</dt>
                  <dd>{selected.saleId || '—'}</dd>
                </div>
                <div>
                  <dt>Criada em</dt>
                  <dd>{formatWhen(selected.createdAt)}</dd>
                </div>
              </dl>
              {selected.notes ? (
                <p className="detail-notes">{selected.notes}</p>
              ) : null}
            </div>

            <div className="detail-block">
              <h3>Atualizar status</h3>
              <div className="status-actions">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`status-pill ${
                      selected.status === option.value ? 'is-on' : ''
                    }`}
                    disabled={busyId === selected.id}
                    onClick={() => void changeStatus(selected, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-danger-soft"
              type="button"
              disabled={busyId === selected.id}
              onClick={() => void remove(selected)}
            >
              <Icon name="trash" />
              Remover ordem
            </button>
          </>
        ) : (
          <div className="empty compact">
            <div className="empty-icon">
              <Icon name="inbox" />
            </div>
            <h3>Selecione uma ordem</h3>
            <p>Veja cliente, plano desejado e atualize o andamento.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
