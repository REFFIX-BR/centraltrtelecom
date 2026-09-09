import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  listPushHistory,
  listPushTokens,
  sendPush,
  type PushHistoryItem,
  type PushToken,
} from './api';

const PUSH_SCREENS = [
  { group: 'Abas do app', label: 'Início', href: '/(tabs)' },
  { group: 'Abas do app', label: 'Plano', href: '/(tabs)/plano' },
  { group: 'Abas do app', label: 'Faturas', href: '/(tabs)/faturas' },
  { group: 'Abas do app', label: 'Suporte', href: '/(tabs)/suporte' },
  { group: 'Abas do app', label: 'Mais', href: '/(tabs)/mais' },
  { group: 'Telas', label: 'Telefonia móvel', href: '/telefonia' },
  { group: 'Telas', label: 'Wi-Fi', href: '/wifi' },
  { group: 'Telas', label: 'Desbloqueio', href: '/desbloqueio' },
  { group: 'Telas', label: 'Extrato', href: '/extrato' },
  { group: 'Telas', label: 'Documentos', href: '/documentos' },
  { group: 'Telas', label: 'Perfil', href: '/perfil' },
  { group: 'Telas', label: 'Notificações', href: '/notificacoes' },
  { group: 'Telas', label: 'Novo chamado', href: '/suporte/novo' },
] as const;

const GROUPS = ['Abas do app', 'Telas'] as const;

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

function screenLabel(href: string) {
  return PUSH_SCREENS.find((item) => item.href === href)?.label || href;
}

function firstNameFrom(name: string) {
  return name.trim().split(/\s+/)[0] || 'cliente';
}

function personalizePreview(template: string, token?: PushToken | null) {
  const name = token?.name?.trim() || 'Lucas Silva';
  const first = firstNameFrom(name);
  const login = token?.login || '20241537';
  return String(template || '')
    .replaceAll('{{nome}}', name)
    .replaceAll('{nome}', name)
    .replaceAll('{{primeiroNome}}', first)
    .replaceAll('{primeiroNome}', first)
    .replaceAll('{{login}}', login)
    .replaceAll('{login}', login);
}

type Props = {
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
  onCounts?: (counts: { total: number }) => void;
};

export function PushPanel({ onError, onSuccess, onCounts }: Props) {
  const [tokens, setTokens] = useState<PushToken[]>([]);
  const [history, setHistory] = useState<PushHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState('/(tabs)/faturas');
  const [document, setDocument] = useState('');
  const [selectedToken, setSelectedToken] = useState('');
  const [audience, setAudience] = useState<'all' | 'document' | 'device'>('all');

  async function load() {
    setLoading(true);
    try {
      const [nextTokens, nextHistory] = await Promise.all([
        listPushTokens(),
        listPushHistory(),
      ]);
      setTokens(nextTokens);
      setHistory(nextHistory);
      onCounts?.({ total: nextTokens.length });
      onError(null);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Falha ao carregar push.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDevice = tokens.find((item) => item.token === selectedToken);
  const openLabel = screenLabel(route);
  const docDigits = document.replace(/\D/g, '');

  const matchedRecipients = useMemo(() => {
    if (audience === 'all') return tokens;
    if (audience === 'device') {
      return selectedToken
        ? tokens.filter((item) => item.token === selectedToken)
        : [];
    }
    if (!docDigits) return [];
    return tokens.filter((item) => item.document === docDigits);
  }, [audience, docDigits, selectedToken, tokens]);

  const previewToken =
    matchedRecipients[0] || selectedDevice || tokens[0] || null;

  const previewTitle = personalizePreview(
    title.trim() || 'Título da notificação',
    previewToken
  );
  const previewBody = personalizePreview(
    body.trim() || 'A mensagem aparece aqui no celular do assinante.',
    previewToken
  );

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    matchedRecipients.length > 0 &&
    (audience !== 'document' || docDigits.length >= 11) &&
    (audience !== 'device' || Boolean(selectedToken));

  const blockHint = useMemo(() => {
    if (tokens.length === 0) {
      return 'Nenhum aparelho registrado neste servidor. O app da Play Store grava o token em produção (centralapi.trtelecom.net), não no localhost.';
    }
    if (audience === 'document' && !docDigits) {
      return 'Informe o CPF/CNPJ do cliente para localizar o aparelho.';
    }
    if (audience === 'document' && matchedRecipients.length === 0) {
      return `Nenhum aparelho encontrado para o CPF ${docDigits}. Peça ao cliente abrir o app (versão da loja) e fazer login.`;
    }
    if (audience === 'device' && !selectedToken) {
      return 'Escolha um aparelho na lista ao lado.';
    }
    return null;
  }, [audience, docDigits, matchedRecipients.length, selectedToken, tokens.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) {
      onError(blockHint || 'Preencha os campos e escolha um destino válido.');
      return;
    }

    setSending(true);
    onError(null);
    try {
      const result = await sendPush({
        title: title.trim(),
        body: body.trim(),
        route,
        sendToAll: audience === 'all',
        document: audience === 'document' ? document : undefined,
        token: audience === 'device' ? selectedToken : undefined,
      });
      setHistory((current) => [result, ...current]);
      onSuccess(
        `Enviado para ${result.delivered} de ${result.recipients} aparelho(s). Ao tocar, abre ${openLabel}.`
      );
      setTitle('');
      setBody('');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Falha ao enviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="push-layout">
      <section className="push-hero">
        <div className="push-hero-copy">
          <p className="push-kicker">Expo Push</p>
          <h2>Avisos no celular do assinante</h2>
          <p>
            Monte a mensagem, escolha a tela de destino e envie para todos ou
            para um CPF específico.
          </p>
        </div>
        <div className="push-stats">
          <div className="push-stat">
            <strong>{tokens.length}</strong>
            <span>Aparelhos</span>
          </div>
          <div className="push-stat">
            <strong>{matchedRecipients.length}</strong>
            <span>Neste envio</span>
          </div>
          <div className="push-stat">
            <strong>{history.length}</strong>
            <span>Envios recentes</span>
          </div>
        </div>
      </section>

      {tokens.length === 0 ? (
        <div className="push-banner">
          <div className="push-banner-icon" aria-hidden>
            !
          </div>
          <div>
            <strong>Sem aparelhos neste ambiente</strong>
            <p>
              Você está no painel local. Tokens só aparecem depois que o app
              registra em <code>/api/push/register</code> neste mesmo servidor.
              Na loja, isso acontece em{' '}
              <code>https://centralapi.trtelecom.net</code> — use o painel de
              produção para avisar clientes reais.
            </p>
          </div>
        </div>
      ) : null}

      <div className="push-grid">
        <section className="push-card push-composer">
          <div className="push-card-head">
            <div>
              <h3>Nova notificação</h3>
              <p>
                {matchedRecipients.length} destino(s) · abre{' '}
                <strong>{openLabel}</strong>
              </p>
            </div>
          </div>

          <form className="push-form" onSubmit={handleSubmit}>
            <div className="push-audience" role="group" aria-label="Destino">
              {(
                [
                  ['all', 'Todos'],
                  ['document', 'Por CPF'],
                  ['device', 'Um aparelho'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`push-audience-btn ${
                    audience === value ? 'is-on' : ''
                  }`}
                  onClick={() => setAudience(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {audience === 'document' ? (
              <label className="field">
                CPF ou CNPJ
                <input
                  value={document}
                  onChange={(event) => setDocument(event.target.value)}
                  placeholder="Somente números"
                  inputMode="numeric"
                />
              </label>
            ) : null}

            {audience === 'device' && selectedDevice ? (
              <div className="push-selected-device">
                <strong>
                  {selectedDevice.name || selectedDevice.login || 'Aparelho'}
                </strong>
                <span>
                  {selectedDevice.document || 'sem CPF'} ·{' '}
                  {selectedDevice.platform || 'app'}
                </span>
              </div>
            ) : null}

            <label className="field">
              Título
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Olá, {primeiroNome} — fatura disponível"
                required
              />
            </label>

            <label className="field">
              Mensagem
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Toque para pagar ou ver o detalhe no app."
                rows={4}
                required
              />
              <small>
                Use {'{primeiroNome}'}, {'{nome}'} ou {'{login}'}
              </small>
            </label>

            <label className="field">
              Ao tocar, abrir
              <select
                value={route}
                onChange={(event) => setRoute(event.target.value)}
              >
                {GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {PUSH_SCREENS.filter((item) => item.group === group).map(
                      (item) => (
                        <option key={item.href} value={item.href}>
                          {item.label}
                        </option>
                      )
                    )}
                  </optgroup>
                ))}
              </select>
            </label>

            {blockHint ? (
              <div className="push-hint">{blockHint}</div>
            ) : (
              <div className="push-hint is-ok">
                Pronto para enviar a {matchedRecipients.length} aparelho(s).
              </div>
            )}

            <button
              className="btn btn-primary push-submit"
              type="submit"
              disabled={sending || !canSend}
            >
              {sending ? 'Enviando…' : `Enviar · abre ${openLabel}`}
            </button>
          </form>
        </section>

        <aside className="push-side">
          <section className="push-card push-preview-card">
            <div className="push-card-head">
              <div>
                <h3>Prévia no celular</h3>
                <p>Como o aviso aparece na tela</p>
              </div>
            </div>
            <div className="push-phone">
              <div className="push-phone-notch" />
              <div className="push-phone-screen">
                <div className="push-toast">
                  <div className="push-toast-top">
                    <span className="push-toast-app">TR Telecom</span>
                    <span>agora</span>
                  </div>
                  <strong>{previewTitle}</strong>
                  <p>{previewBody}</p>
                  <em>Abre · {openLabel}</em>
                </div>
              </div>
            </div>
          </section>

          <section className="push-card">
            <div className="push-card-head">
              <div>
                <h3>Aparelhos ({tokens.length})</h3>
                <p>Clique para mirar um cliente</p>
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => void load()}
              >
                Atualizar
              </button>
            </div>

            {loading ? (
              <p className="muted">Carregando…</p>
            ) : tokens.length === 0 ? (
              <div className="push-empty">
                <strong>Lista vazia</strong>
                <p>
                  Depois do login no app (build da loja ou apontando para este
                  servidor), o token aparece aqui.
                </p>
              </div>
            ) : (
              <div className="push-device-list">
                {tokens.map((item) => {
                  const active =
                    selectedToken === item.token && audience === 'device';
                  return (
                    <button
                      key={item.token}
                      type="button"
                      className={`push-device ${active ? 'is-on' : ''}`}
                      onClick={() => {
                        setSelectedToken(item.token);
                        setAudience('device');
                        setDocument(item.document);
                      }}
                    >
                      <span className="push-device-avatar">
                        {(item.name || item.login || '?').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="push-device-body">
                        <strong>
                          {item.name || item.login || 'Assinante'}
                        </strong>
                        <span>
                          {item.document || 'sem documento'} ·{' '}
                          {item.login || 'sem login'}
                        </span>
                        <small>
                          {item.platform || 'app'} · {formatWhen(item.updatedAt)}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="push-card">
            <div className="push-card-head">
              <div>
                <h3>Envios recentes</h3>
                <p>Últimos disparos deste painel</p>
              </div>
            </div>
            {history.length === 0 ? (
              <div className="push-empty">
                <strong>Nenhum envio ainda</strong>
                <p>Os disparos deste servidor aparecem nesta lista.</p>
              </div>
            ) : (
              <div className="push-history">
                {history.map((item) => (
                  <article key={item.id} className="push-history-item">
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <small>
                      {formatWhen(item.createdAt)} · {item.delivered}/
                      {item.recipients} · {screenLabel(item.route)}
                      {item.sendToAll
                        ? ' · todos'
                        : item.document
                          ? ` · ${item.document}`
                          : ''}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
