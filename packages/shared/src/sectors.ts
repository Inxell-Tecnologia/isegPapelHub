/**
 * Setor — entidade **por unidade** (change `funcao-e-setor-na-identidade`,
 * capability `setores`). Substitui `users.work_area`, que era texto livre.
 *
 * A troca não é cosmética: setor passa a ser **critério de público** da leitura
 * obrigatória e recorte do relatório (demanda nº 2, seções 3.2 e 3.5;
 * `docs/respostas_a1_funcao_e_setor.txt`, respostas 5a e 6a). Texto livre não
 * serve de critério — "Governança", "governanca" e "Gov." são três setores para
 * o sistema, e quem estiver escrito de um jeito fica de fora do envio feito
 * pelo outro.
 */

export interface SectorResponse {
  id: string;
  unitId: string;
  name: string;
  createdAt: string;
  /**
   * Quantas pessoas apontam para este setor — é o que permite à interface
   * explicar *por que* a remoção foi recusada antes de tentá-la, em vez de
   * apresentar a recusa como falha genérica (design.md D9).
   */
  peopleCount: number;
}

export interface CreateSectorRequest {
  name: string;
  /**
   * Unidade de destino. Honrado **apenas** para `global_admin`; para
   * `unit_admin` o servidor força a própria unidade do contexto, pelo mesmo
   * motivo que o faz no cadastro de pessoa (design.md D8 — a unidade vem do
   * contexto relido por requisição, nunca do cliente).
   */
  unitId?: string;
}

export interface UpdateSectorRequest {
  name: string;
}

/**
 * Nome já usado na unidade — a unicidade ignora caixa e espaços nas
 * extremidades (design.md D3), então "CME" e "cme " colidem.
 */
export interface SectorNameInUseResponse {
  error: 'sector_name_in_use';
}

/**
 * Remoção recusada porque ainda há pessoa vinculada. Nenhuma remoção
 * desvincula pessoas em silêncio (capability `setores`).
 */
export interface SectorHasPeopleResponse {
  error: 'sector_has_people';
  /** Quantas pessoas impedem a remoção, para a interface nomear o impedimento. */
  peopleCount: number;
}
