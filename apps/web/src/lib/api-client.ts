/**
 * Erro de API tipado pelo status HTTP — permite ao chamador distinguir
 * 401/403/etc. `details` carrega o corpo JSON completo da resposta de erro
 * (design.md D5 de `download-pasta-zip`): a recusa por limite do manifesto
 * de download de pasta devolve campos extras (`limit`, `found`, `allowed`)
 * que `message` sozinho não preserva.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registrado pelo `SessionProvider` (design.md D4): um único ponto de
 * tratamento para 401 — cobre sessão expirada e conta desativada, já que o
 * servidor revalida status a cada requisição. Limpa a sessão do cliente e
 * navega a `/login`, qualquer que seja a chamada que disparou o 401.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /**
   * Cancela a requisição em voo (design.md `download-pasta-zip`, task 4.3):
   * sem isso, o StrictMode do React 18 — que remonta todo `useEffect` uma
   * vez em dev — dispara a chamada duas vezes antes que a primeira possa ser
   * interrompida, dobrando efeitos irreversíveis do lado do servidor (URLs
   * assinadas emitidas, eventos de auditoria gravados) para um único clique.
   */
  signal?: AbortSignal;
}

/**
 * Respostas em que a infraestrutura — não a aplicação — recusou a
 * requisição por falta de capacidade momentânea. O Cloud Run devolve `429`
 * (com o corpo em texto puro `Rate exceeded.`, do Google Front End, que
 * nunca chega a ser um JSON nosso) quando não há instância livre, e `503`
 * durante um arranque a frio. Ambas passam sozinhas em segundos.
 */
const TRANSIENT_STATUSES = new Set([429, 503]);

/** Espera antes de cada nova tentativa. Duas tentativas extras, curtas o
 *  bastante para o usuário não perceber e poucas o bastante para não
 *  empilhar carga em cima de um serviço que já está sem capacidade. */
const RETRY_DELAYS_MS = [300, 900];

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';

  // Só GET é retentado: é a única forma sem efeito colateral no servidor.
  // Um `POST /files` retentado duplicaria o item; um `POST /auth/login`
  // gastaria outra verificação argon2 — o retry entraria como carga extra
  // exatamente onde falta capacidade.
  const maxAttempts = method === 'GET' ? RETRY_DELAYS_MS.length + 1 : 1;
  let res!: Response;

  for (let attempt = 0; ; attempt += 1) {
    res = await fetch(path, {
      method,
      credentials: 'include',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (!TRANSIENT_STATUSES.has(res.status) || attempt >= maxAttempts - 1) break;
    await delay(RETRY_DELAYS_MS[attempt]!, options.signal);
  }

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'not authenticated');
  }

  if (!res.ok) {
    // Corpo não-JSON (o `Rate exceeded.` do front end é `text/plain`) cai no
    // `catch` e vira um código nosso, estável, em vez de `unknown_error`:
    // é o que permite à tela distinguir "sem capacidade agora" de um erro
    // de verdade.
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    const fallback = TRANSIENT_STATUSES.has(res.status) ? 'service_unavailable' : 'unknown_error';
    throw new ApiError(res.status, payload.error ?? fallback, payload);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/** Cliente HTTP fino: sempre `credentials: 'include'` (cookie de sessão same-origin, design.md D1). */
export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'POST', body, signal }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};
