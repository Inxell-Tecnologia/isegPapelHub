import type { UserRole } from './roles.js';

export interface LoginRequest {
  email: string;
  password: string;
}

/** Identidade da sessão corrente — devolvida por login e por `GET /auth/me`. */
export interface AuthenticatedIdentity {
  id: string;
  unitId: string;
  role: UserRole;
}

/**
 * Tamanho mínimo de senha (change `troca-de-senha`, design.md D8) — única
 * fonte da regra, para a mensagem exibida na SPA e a validação da API nunca
 * divergirem. Vale no cadastro, na troca e na geração do reset; não é
 * aplicada retroativamente a senhas já armazenadas.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Corpo de `POST /auth/password` (US 1.3) — troca da própria senha. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Resposta de `POST /users/:id/password` (US 1.4) — a senha gerada trafega
 * em texto claro **exclusivamente** nesta resposta (design.md D7).
 */
export interface ResetPasswordResponse {
  generatedPassword: string;
}

/** Resposta de `GET /auth/profile` (US 1.3, cenário 5) — somente leitura. */
export interface MyProfileResponse {
  fullName: string | null;
  email: string;
  unitName: string;
  role: UserRole;
}

/**
 * Resposta de `GET /auth/public-config` (change `rebranding-doc7-setes`,
 * design.md D4; `manualUrl` acrescentado pela change
 * `acesso-ao-manual-no-shell`, design.md D3) — configuração pública de
 * apresentação da implantação, anônima por natureza (a tela de login é
 * pré-autenticação). Contrato travado a uma **allowlist nominal**: os três
 * campos abaixo, nenhum outro valor de configuração. Acrescentar um quarto
 * campo exige modificar o requisito de `identidade-visual`, não é extensão
 * natural do contrato.
 */
export interface PublicConfigResponse {
  appName: string;
  clientName: string;
  /** Endereço do manual do usuário publicado (capability `documentacao-usuario`); vazio = sem acesso apresentado. */
  manualUrl: string;
}
