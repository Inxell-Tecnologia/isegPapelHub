import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthenticatedIdentity, LoginRequest, PublicConfigResponse } from '@gdoc/shared';
import { apiClient, setUnauthorizedHandler } from '../lib/api-client';
import { authenticatedIdentitySchema, publicConfigResponseSchema } from '../lib/schemas';

type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

// Fallback quando `GET /auth/public-config` falha ou ainda não resolveu
// (design.md D7/D9): sem identificação de cliente, título só com o nome.
const DEFAULT_PUBLIC_CONFIG: PublicConfigResponse = { appName: 'PapelHub', clientName: '' };

interface SessionContextValue {
  status: SessionStatus;
  identity: AuthenticatedIdentity | null;
  publicConfig: PublicConfigResponse;
  /** Lança `ApiError` (401) em credenciais inválidas — a página de login trata a mensagem genérica. */
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Fonte de verdade do cliente para a sessão (design.md D3): o token é
 * `HttpOnly` — nunca lido pelo JS — então o estado de autenticação é sempre
 * derivado de `GET /auth/me` no bootstrap ou da resposta do login/logout.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [identity, setIdentity] = useState<AuthenticatedIdentity | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfigResponse>(DEFAULT_PUBLIC_CONFIG);

  useEffect(() => {
    let cancelled = false;

    // `GET /auth/public-config` busca em paralelo ao `GET /auth/me`, sob o
    // mesmo gate `status: 'loading'` (design.md D7): o 401 do `/auth/me` sem
    // sessão é absorvido aqui, não pelo handler de 401 (registrado só depois
    // do bootstrap) — senão a árvore liberaria antes da identidade visual
    // resolver, e a tela de login flashearia sem o subtítulo por um instante.
    let resolvedIdentity: AuthenticatedIdentity | null = null;
    let resolvedStatus: SessionStatus = 'anonymous';
    let resolvedPublicConfig = DEFAULT_PUBLIC_CONFIG;

    const identityPromise = apiClient
      .get<AuthenticatedIdentity>('/auth/me')
      .then((raw) => {
        resolvedIdentity = authenticatedIdentitySchema.parse(raw);
        resolvedStatus = 'authenticated';
      })
      .catch(() => {
        // sem sessão (401) ou erro de rede: ambos caem em "anonymous" (default acima).
      });

    // Falha (rede, 5xx) não bloqueia o bootstrap nem o login — trata-se como
    // "sem identificação de cliente" (design.md D7).
    const publicConfigPromise = apiClient
      .get<PublicConfigResponse>('/auth/public-config')
      .then((raw) => {
        resolvedPublicConfig = publicConfigResponseSchema.parse(raw);
      })
      .catch(() => {});

    Promise.allSettled([identityPromise, publicConfigPromise]).then(() => {
      if (cancelled) return;
      setIdentity(resolvedIdentity);
      setPublicConfig(resolvedPublicConfig);
      setStatus(resolvedStatus);

      // Título do documento composto em runtime (design.md D9): um único
      // ponto, logo após o bootstrap resolver. Sem `clientName`, o estático
      // de `index.html` (só o nome) permanece.
      document.title = resolvedPublicConfig.clientName
        ? `${resolvedPublicConfig.appName} - ${resolvedPublicConfig.clientName}`
        : resolvedPublicConfig.appName;

      // A partir daqui, 401 de qualquer chamada autenticada encerra a sessão
      // no cliente imediatamente (design.md D4) — cobre sessão expirada e
      // conta desativada, já que o servidor revalida status a cada requisição.
      setUnauthorizedHandler(() => {
        if (cancelled) return;
        setIdentity(null);
        setStatus('anonymous');
      });
    });

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      identity,
      publicConfig,
      async login(credentials) {
        const raw = await apiClient.post<AuthenticatedIdentity>('/auth/login', credentials);
        setIdentity(authenticatedIdentitySchema.parse(raw));
        setStatus('authenticated');
      },
      async logout() {
        await apiClient.post('/auth/logout');
        setIdentity(null);
        setStatus('anonymous');
      },
    }),
    [status, identity, publicConfig],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de <SessionProvider>');
  return ctx;
}
