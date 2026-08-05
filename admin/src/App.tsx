import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';

import {
  clearToken,
  createBanner,
  deleteBanner,
  getToken,
  listBanners,
  login,
  toggleBanner,
  updateBanner,
  uploadImage,
  type Banner,
  type BannerInput,
} from './api';
import { OrdersPanel } from './OrdersPanel';
import { MobilePlansPanel } from './MobilePlansPanel';

const emptyForm: BannerInput = {
  title: '',
  subtitle: '',
  ctaLabel: '',
  linkUrl: '',
  imageUrl: '',
  theme: 'navy',
  active: true,
  showCta: false,
  imageOnly: true,
  order: 1,
};

const LINK_PRESETS = [
  { group: 'Abas do app', label: 'Início', value: '/' },
  { group: 'Abas do app', label: 'Plano', value: '/plano' },
  { group: 'Abas do app', label: 'Faturas', value: '/faturas' },
  { group: 'Abas do app', label: 'Suporte', value: '/suporte' },
  { group: 'Abas do app', label: 'Mais', value: '/mais' },
  { group: 'Telas', label: 'Telefonia móvel', value: '/telefonia' },
  { group: 'Telas', label: 'Wi-Fi', value: '/wifi' },
  { group: 'Telas', label: 'Desbloqueio', value: '/desbloqueio' },
  { group: 'Telas', label: 'Extrato', value: '/extrato' },
  { group: 'Telas', label: 'Documentos', value: '/documentos' },
  { group: 'Telas', label: 'Perfil', value: '/perfil' },
  { group: 'Telas', label: 'Notificações', value: '/notificacoes' },
  { group: 'Telas', label: 'Novo chamado', value: '/suporte/novo' },
];

const LINK_GROUPS = ['Abas do app', 'Telas'] as const;

type FilterKey = 'all' | 'active' | 'hidden';
type AdminView = 'banners' | 'orders' | 'mobile';

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    plus: 'M12 5v14M5 12h14',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff:
      'M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a18.6 18.6 0 0 1-2.16 3.19M1 1l22 22M14.12 14.12a3 3 0 0 1-4.24-4.24',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    chevronUp: 'M18 15l-6-6-6 6',
    chevronDown: 'M6 9l6 6 6-6',
    check: 'M20 6L9 17l-5-5',
    image: 'M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6',
    spark: 'M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2z',
    inbox:
      'M22 12h-6l-2 3h-4l-2-3H2M4 12l2-8h12l2 8v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z',
    phone:
      'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.3a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.8-1.2a2 2 0 0 1 2.1-.4c.7.3 1.5.5 2.3.6a2 2 0 0 1 1.7 2z',
    home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z',
    gauge: 'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.5-2a8.5 8.5 0 1 0-16.4 3.2',
    card: 'M2 7h20v10H2zM2 10h20',
    headset: 'M3 12a9 9 0 0 1 18 0v5a3 3 0 0 1-3 3h-1v-6h4M3 14h4v6H6a3 3 0 0 1-3-3v-3z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    wifi: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01',
    unlock: 'M7 11V8a5 5 0 0 1 9.9-1M5 11h14v10H5z',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
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
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}

function PreviewFrame({ banner }: { banner: BannerInput }) {
  return (
    <div className="preview-frame">
      <div className="preview-label">Prévia no app</div>
      <div className="preview-stage">
        {banner.imageUrl ? (
          <img src={banner.imageUrl} alt="" />
        ) : (
          <div className="preview-empty">
            <Icon name="image" />
            <strong>Sem imagem</strong>
            <span>Proporção ideal 2:1 · 1200×600</span>
          </div>
        )}
        {banner.imageUrl && banner.linkUrl ? (
          <div className="preview-link-pill">
            <Icon name="link" />
            <span>{banner.linkUrl}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [password, setPassword] = useState('');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState<BannerInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<AdminView>('mobile');
  const [orderCounts, setOrderCounts] = useState({ total: 0, open: 0 });
  const [mobileCounts, setMobileCounts] = useState({ total: 0, visible: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(
    () => [...banners].sort((a, b) => a.order - b.order),
    [banners]
  );

  const stats = useMemo(() => {
    const active = banners.filter((b) => b.active).length;
    return {
      total: banners.length,
      active,
      draft: banners.length - active,
    };
  }, [banners]);

  const filtered = useMemo(() => {
    if (filter === 'active') return sorted.filter((b) => b.active);
    if (filter === 'hidden') return sorted.filter((b) => !b.active);
    return sorted;
  }, [sorted, filter]);

  async function refresh() {
    setBanners(await listBanners());
  }

  useEffect(() => {
    if (!authed) return;
    refresh().catch((err: Error) => {
      setError(err.message);
      clearToken();
      setAuthed(false);
    });
  }, [authed]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2800);
    return () => window.clearTimeout(timer);
  }, [success]);

  function flash(message: string) {
    setError(null);
    setSuccess(message);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(password);
      setAuthed(true);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(banner: Banner) {
    setEditingId(banner.id);
    setError(null);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle,
      ctaLabel: '',
      linkUrl: banner.linkUrl,
      imageUrl: banner.imageUrl,
      theme: banner.theme,
      active: banner.active,
      showCta: false,
      imageOnly: true,
      order: banner.order,
    });
  }

  function resetForm() {
    setEditingId(null);
    setError(null);
    setForm({ ...emptyForm, order: banners.length + 1 });
  }

  async function handleImageUpload(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Envie apenas arquivos de imagem (PNG, JPG, WEBP ou GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImage(file);
      const imageUrl = uploaded.url || uploaded.path;
      if (!imageUrl) {
        throw new Error('Upload concluído, mas a URL da imagem não veio.');
      }
      setForm((prev) => ({ ...prev, imageUrl }));
      flash(
        uploaded.storage === 'minio'
          ? 'Imagem enviada ao MinIO.'
          : 'Imagem enviada.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void handleImageUpload(event.dataTransfer.files?.[0]);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!form.imageUrl.trim()) {
      setError('Envie uma imagem antes de salvar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        showCta: false,
        imageOnly: true,
        ctaLabel: '',
      };
      if (editingId) {
        await updateBanner(editingId, payload);
        flash('Card atualizado.');
      } else {
        await createBanner(payload);
        flash('Card publicado.');
      }
      await refresh();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(banner: Banner) {
    setBusyId(banner.id);
    try {
      await toggleBanner(banner.id);
      await refresh();
      flash(banner.active ? 'Card ocultado.' : 'Card na Home.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar status');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteBanner(deleteTarget.id);
      await refresh();
      if (editingId === deleteTarget.id) resetForm();
      flash('Card excluído.');
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setBusyId(null);
    }
  }

  async function moveBanner(banner: Banner, direction: -1 | 1) {
    const index = sorted.findIndex((item) => item.id === banner.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    setBusyId(banner.id);
    try {
      const base = {
        subtitle: '',
        ctaLabel: '',
        showCta: false,
        imageOnly: true,
        theme: banner.theme as BannerInput['theme'],
      };
      await updateBanner(banner.id, {
        ...base,
        title: banner.title,
        linkUrl: banner.linkUrl,
        imageUrl: banner.imageUrl,
        active: banner.active,
        theme: banner.theme,
        order: swapWith.order,
      });
      await updateBanner(swapWith.id, {
        ...base,
        title: swapWith.title,
        linkUrl: swapWith.linkUrl,
        imageUrl: swapWith.imageUrl,
        active: swapWith.active,
        theme: swapWith.theme,
        order: banner.order,
      });
      await refresh();
      if (editingId === banner.id) {
        setForm((prev) => ({ ...prev, order: swapWith.order }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reordenar');
    } finally {
      setBusyId(null);
    }
  }

  if (!authed) {
    return (
      <div className="login-page">
        <form className="login-box" onSubmit={handleLogin}>
          <div className="login-mark">TR</div>
          <p className="kicker">TR Telecom</p>
          <h1>Painel de propagandas</h1>
          <p className="login-copy">
            Publique os cards da Home do app. Só a imagem aparece para o
            assinante.
          </p>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Senha administrativa"
              autoFocus
            />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  const pageTitle =
    view === 'orders'
      ? 'Ordens de serviço'
      : view === 'mobile'
        ? 'Telefonia móvel'
        : 'Propagandas';

  const pageSubtitle =
    view === 'orders'
      ? 'Acompanhe upgrades e solicitações dos clientes'
      : view === 'mobile'
        ? 'Planos AltaRede liberados no app'
        : 'Cards do carrossel na Home do app';

  return (
    <div className="crm">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="nav-mark">TR</div>
          <div>
            <strong>TR Telecom</strong>
            <span>Central do Assinante</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Menu do painel">
          <p className="sidebar-label">Operação</p>
          <button
            type="button"
            className={`sidebar-link ${view === 'orders' ? 'is-on' : ''}`}
            onClick={() => setView('orders')}
          >
            <Icon name="inbox" />
            <span>Ordens de serviço</span>
            {orderCounts.open > 0 ? <em>{orderCounts.open}</em> : null}
          </button>
          <button
            type="button"
            className={`sidebar-link ${view === 'mobile' ? 'is-on' : ''}`}
            onClick={() => setView('mobile')}
          >
            <Icon name="phone" />
            <span>Telefonia móvel</span>
            {mobileCounts.visible > 0 ? <em>{mobileCounts.visible}</em> : null}
          </button>

          <p className="sidebar-label">Conteúdo</p>
          <button
            type="button"
            className={`sidebar-link ${view === 'banners' ? 'is-on' : ''}`}
            onClick={() => setView('banners')}
          >
            <Icon name="image" />
            <span>Propagandas</span>
            {stats.active > 0 ? <em>{stats.active}</em> : null}
          </button>
        </nav>

        <div className="sidebar-foot">
          <button
            className="btn btn-ghost sidebar-logout"
            type="button"
            onClick={() => {
              clearToken();
              setAuthed(false);
            }}
          >
            <Icon name="logout" />
            Sair do painel
          </button>
        </div>
      </aside>

      <div className="crm-main">
        <header className="topbar">
          <div className="topbar-copy">
            <p className="kicker">Painel administrativo</p>
            <h1>{pageTitle}</h1>
            <p className="topbar-sub">{pageSubtitle}</p>
          </div>

          <div className="topbar-stats">
            {view === 'orders' ? (
              <>
                <div className="top-stat is-live">
                  <span>Abertas</span>
                  <strong>{orderCounts.open}</strong>
                </div>
                <div className="top-stat">
                  <span>Total</span>
                  <strong>{orderCounts.total}</strong>
                </div>
              </>
            ) : view === 'mobile' ? (
              <>
                <div className="top-stat is-live">
                  <span>No app</span>
                  <strong>{mobileCounts.visible}</strong>
                </div>
                <div className="top-stat">
                  <span>Total</span>
                  <strong>{mobileCounts.total}</strong>
                </div>
              </>
            ) : (
              <>
                <div className="top-stat">
                  <span>Total</span>
                  <strong>{stats.total}</strong>
                </div>
                <div className="top-stat is-live">
                  <span>Na Home</span>
                  <strong>{stats.active}</strong>
                </div>
                <div className="top-stat">
                  <span>Ocultos</span>
                  <strong>{stats.draft}</strong>
                </div>
              </>
            )}
          </div>

          {view === 'banners' ? (
            <button className="btn btn-primary" type="button" onClick={resetForm}>
              <Icon name="plus" />
              Novo card
            </button>
          ) : null}
        </header>

        {(error || success) && (
          <div className={`alert ${error ? 'alert-error' : 'alert-ok'}`}>
            <Icon name={error ? 'close' : 'check'} />
            <span>{error || success}</span>
            <button
              type="button"
              className="alert-dismiss"
              onClick={() => {
                setError(null);
                setSuccess(null);
              }}
            >
              Fechar
            </button>
          </div>
        )}

        <div className="crm-content">
          {view === 'orders' ? (
            <OrdersPanel
              onError={setError}
              onSuccess={(message) => {
                if (message) flash(message);
                else setSuccess(null);
              }}
              onCounts={setOrderCounts}
            />
          ) : view === 'mobile' ? (
            <MobilePlansPanel
              onError={setError}
              onSuccess={(message) => {
                if (message) flash(message);
                else setSuccess(null);
              }}
              onCounts={setMobileCounts}
            />
          ) : (
            <main className="board">
              <section className="library">
                <div className="section-head">
                  <div>
                    <h2>Biblioteca</h2>
                    <p>Uma imagem por card · carrossel na Home</p>
                  </div>
                  <div className="filters">
                    {(
                      [
                        ['all', 'Todos', stats.total],
                        ['active', 'Home', stats.active],
                        ['hidden', 'Ocultos', stats.draft],
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
                </div>

                {filtered.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">
                      <Icon name="image" />
                    </div>
                    <h3>Nada por aqui</h3>
                    <p>
                      {filter === 'all'
                        ? 'Crie o primeiro card com uma imagem 2:1.'
                        : 'Nenhum card neste filtro.'}
                    </p>
                    {filter === 'all' ? (
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={resetForm}
                      >
                        <Icon name="plus" />
                        Criar card
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="card-grid">
                    {filtered.map((banner) => {
                      const index = sorted.findIndex((item) => item.id === banner.id);
                      const selected = editingId === banner.id;
                      return (
                        <article
                          key={banner.id}
                          className={`promo-card ${selected ? 'is-selected' : ''} ${
                            banner.active ? '' : 'is-dim'
                          }`}
                        >
                          <button
                            type="button"
                            className="promo-media"
                            onClick={() => startEdit(banner)}
                          >
                            {banner.imageUrl ? (
                              <img src={banner.imageUrl} alt="" />
                            ) : (
                              <span className="promo-media-empty">
                                <Icon name="image" />
                              </span>
                            )}
                            <span
                              className={`status-dot ${banner.active ? 'on' : 'off'}`}
                            >
                              {banner.active ? 'Home' : 'Oculto'}
                            </span>
                          </button>

                          <div className="promo-body">
                            <div className="promo-copy">
                              <h3>{banner.title}</h3>
                              <p>{banner.linkUrl || 'Sem link de destino'}</p>
                            </div>

                            <div className="promo-tools">
                              <div className="order-box">
                                <button
                                  type="button"
                                  className="icon-btn"
                                  disabled={index <= 0 || busyId === banner.id}
                                  onClick={() => moveBanner(banner, -1)}
                                  title="Subir"
                                >
                                  <Icon name="chevronUp" />
                                </button>
                                <span>{banner.order}</span>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  disabled={
                                    index >= sorted.length - 1 ||
                                    busyId === banner.id
                                  }
                                  onClick={() => moveBanner(banner, 1)}
                                  title="Descer"
                                >
                                  <Icon name="chevronDown" />
                                </button>
                              </div>

                              <div className="tool-row">
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => startEdit(banner)}
                                  title="Editar"
                                >
                                  <Icon name="edit" />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  disabled={busyId === banner.id}
                                  onClick={() => handleToggle(banner)}
                                  title={banner.active ? 'Ocultar' : 'Publicar'}
                                >
                                  <Icon name={banner.active ? 'eyeOff' : 'eye'} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn danger"
                                  onClick={() => setDeleteTarget(banner)}
                                  title="Excluir"
                                >
                                  <Icon name="trash" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <aside className="composer">
                <div className="section-head">
                  <div>
                    <h2>{editingId ? 'Editar card' : 'Novo card'}</h2>
                    <p>Passo a passo · só a foto vai para o app</p>
                  </div>
                  {editingId ? (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={resetForm}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>

                <PreviewFrame banner={form} />

                <form className="composer-form" onSubmit={handleSave}>
                  <div className="step">
                    <div className="step-index">1</div>
                    <div className="step-body">
                      <label className="field">
                        <span>Título interno</span>
                        <input
                          value={form.title}
                          onChange={(event) =>
                            setForm({ ...form, title: event.target.value })
                          }
                          placeholder="Ex.: Campanha Mesh"
                          required
                        />
                        <small>Só organização no painel</small>
                      </label>
                    </div>
                  </div>

                  <div className="step">
                    <div className="step-index">2</div>
                    <div className="step-body">
                      <span className="field-label">Imagem do card</span>
                      <div
                        className={`dropzone ${dragOver ? 'is-over' : ''} ${
                          form.imageUrl ? 'has-image' : ''
                        }`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          hidden
                          onChange={(event) =>
                            handleImageUpload(event.target.files?.[0] ?? null)
                          }
                        />
                        {form.imageUrl ? (
                          <>
                            <img src={form.imageUrl} alt="" />
                            <div>
                              <strong>
                                {uploading ? 'Enviando...' : 'Imagem pronta'}
                              </strong>
                              <span>Clique para trocar</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="drop-ico">
                              <Icon name="upload" />
                            </div>
                            <div>
                              <strong>
                                {uploading ? 'Enviando...' : 'Arraste a imagem'}
                              </strong>
                              <span>PNG, JPG, WEBP · até 5 MB · 2:1 · MinIO</span>
                            </div>
                          </>
                        )}
                      </div>
                      {form.imageUrl ? (
                        <button
                          className="btn btn-danger-soft"
                          type="button"
                          onClick={() => setForm({ ...form, imageUrl: '' })}
                        >
                          <Icon name="trash" />
                          Remover imagem
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="step">
                    <div className="step-index">3</div>
                    <div className="step-body">
                      <label className="field">
                        <span>Ao tocar, abrir</span>
                        <input
                          value={form.linkUrl}
                          onChange={(event) =>
                            setForm({ ...form, linkUrl: event.target.value })
                          }
                          placeholder="/plano ou https://..."
                        />
                      </label>
                      {LINK_GROUPS.map((group) => (
                        <div key={group} className="chip-group">
                          <span className="chip-group-label">{group}</span>
                          <div className="chips">
                            {LINK_PRESETS.filter((item) => item.group === group).map(
                              (preset) => (
                                <button
                                  key={preset.value}
                                  type="button"
                                  className={`chip ${
                                    form.linkUrl === preset.value ? 'is-on' : ''
                                  }`}
                                  onClick={() =>
                                    setForm({ ...form, linkUrl: preset.value })
                                  }
                                >
                                  {preset.label}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="step">
                    <div className="step-index">4</div>
                    <div className="step-body step-row">
                      <label className="field compact">
                        <span>Ordem</span>
                        <input
                          type="number"
                          min={1}
                          value={form.order}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              order: Number(event.target.value) || 1,
                            })
                          }
                        />
                      </label>

                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(event) =>
                            setForm({ ...form, active: event.target.checked })
                          }
                        />
                        <span className="switch-ui" />
                        <span>
                          <strong>Publicar na Home</strong>
                          <small>Aparece no carrossel</small>
                        </span>
                      </label>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary btn-block"
                    type="submit"
                    disabled={loading || uploading || !form.imageUrl.trim()}
                  >
                    {loading
                      ? 'Salvando...'
                      : editingId
                        ? 'Salvar alterações'
                        : 'Publicar card'}
                  </button>
                </form>
              </aside>
            </main>
          )}
        </div>

        {deleteTarget ? (
          <div className="modal-bg" role="presentation">
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-icon">
                <Icon name="trash" />
              </div>
              <h3>Excluir card?</h3>
              <p>
                “{deleteTarget.title}” sai do carrossel de forma permanente.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={busyId === deleteTarget.id}
                  onClick={() => void handleDelete()}
                >
                  {busyId === deleteTarget.id ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
