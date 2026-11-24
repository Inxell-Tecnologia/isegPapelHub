import { ApiError } from '../lib/api-client';

/**
 * Mensagem da recusa de marcar (change `favoritos`, design.md D2/D4): o teto
 * tem motivo próprio, que orienta desmarcar; qualquer outra recusa é a de
 * recurso fora de alcance, que o servidor não distingue — e a tela também não.
 */
export function mensagemDeFalhaAoFavoritar(err: unknown): string {
  if (
    err instanceof ApiError &&
    err.status === 409 &&
    (err.details as { error?: unknown } | undefined)?.error === 'favorites_limit_exceeded'
  ) {
    const allowed = (err.details as { allowed?: number }).allowed;
    return `Você atingiu o limite de ${allowed ?? ''} favoritos. Remova algum para marcar outro.`;
  }
  return 'Não foi possível atualizar os favoritos. Tente novamente.';
}
