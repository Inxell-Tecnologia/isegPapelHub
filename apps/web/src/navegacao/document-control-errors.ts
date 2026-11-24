import type { DocumentControlInput } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';

/**
 * Recusas do controle documental, traduzidas em avisos **distinguíveis entre
 * si** (web-upload: "apresentada de forma distinguível, indicando o que
 * corrigir"; web-navegacao: a recusa por código em uso não se confunde com a
 * recusa por dado faltante nem com a de permissão).
 *
 * Cinco recusas, cinco mensagens, e nenhuma delas é o "tente novamente"
 * genérico — repetir a mesma operação falharia de forma idêntica em todos os
 * casos. As duas últimas entraram com a tabela de cadastro: o conflito de
 * código **por item do lote** e o campo incompatível com o Arquivo geral
 * caíam, até aqui, no texto genérico (design.md D7/D8 do change
 * `tabela-de-cadastro-no-envio-em-lote`).
 */

const RotuloDoCampo: Record<keyof DocumentControlInput, string> = {
  documentType: 'tipo',
  documentCode: 'código',
  documentRevision: 'revisão',
  responsibleSector: 'setor responsável',
  nextReviewAt: 'data da próxima revisão',
  lifecycleState: 'situação declarada',
};

function detalhes(err: unknown): Record<string, unknown> | null {
  if (!(err instanceof ApiError)) return null;
  const details = err.details;
  return typeof details === 'object' && details !== null
    ? (details as Record<string, unknown>)
    : null;
}

export function erroDeCodigoEmUso(err: unknown): boolean {
  return detalhes(err)?.error === 'document_code_in_use';
}

export function descreverRecusaDeControle(err: unknown): string {
  const details = detalhes(err);

  if (details?.error === 'document_code_in_use') {
    const ocupante = details.occupiedBy as { fileName?: string } | undefined;
    return ocupante?.fileName
      ? `Código já em uso nesta unidade por "${ocupante.fileName}". Escolha outro código.`
      : 'Código já em uso por outro documento desta unidade. Escolha outro código.';
  }

  if (details?.error === 'document_control_required') {
    const faltantes = Array.isArray(details.missing)
      ? (details.missing as (keyof DocumentControlInput)[])
          .map((campo) => RotuloDoCampo[campo] ?? campo)
          .join(', ')
      : '';
    return faltantes
      ? `Faltam dados de controle: ${faltantes}.`
      : 'Informe os dados de controle do documento.';
  }

  if (details?.error === 'invalid_document_type') {
    return 'Tipo de documento não reconhecido.';
  }

  // Recusa **por item** do lote: o código conflita com o acervo da unidade ou
  // com outro arquivo do mesmo envio. Não carrega `occupiedBy` — o ocupante
  // pode ser um item do próprio lote, que ainda não existe.
  if (details?.error === 'document_code_conflict') {
    return 'Código já usado por outro documento desta unidade ou por outro arquivo deste envio. Escolha outro código.';
  }

  // US 10.8: o Arquivo geral declara não ter código nem prazo, então informá-los
  // é contradição. A mensagem nomeia o campo porque, escolhido o tipo, a pessoa
  // não vê mais o campo que causou a recusa.
  if (details?.error === 'general_file_rejects_control_fields') {
    const rejeitados = Array.isArray(details.rejected)
      ? (details.rejected as (keyof DocumentControlInput)[])
          .map((campo) => RotuloDoCampo[campo] ?? campo)
          .join(', ')
      : '';
    return rejeitados
      ? `Arquivo geral não aceita ${rejeitados}: esse tipo pede só o título.`
      : 'Arquivo geral não aceita código, revisão nem data de próxima revisão.';
  }

  if (err instanceof ApiError && err.status === 403) {
    return 'Permissão insuficiente para alterar os dados de controle deste documento.';
  }

  return 'Não foi possível concluir a ação. Tente novamente.';
}
