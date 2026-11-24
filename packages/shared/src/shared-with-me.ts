import type { GrantResourceType, Permission } from './permissions.js';
import type { FileSummaryResponse } from './storage.js';

/**
 * Um verbo concedido, com o **seu próprio** vencimento (design.md D5).
 *
 * A concessão é por verbo — uma linha de `grants` por `(pessoa, recurso,
 * verbo)` —, e conceder vários verbos numa só operação dá a todos o mesmo
 * prazo. Mas `permissoes-granulares` permite reconceder um subconjunto com
 * prazo diferente, e um "vencimento do item" teria então de escolher entre
 * mentir (apresentar o mais próximo como se tudo vencesse junto) ou omitir. O
 * par é lossless, e a tela apresenta o prazo junto do verbo a que ele pertence.
 */
export interface SharedPermissionResponse {
  permission: Permission;
  /** Nulo = permanente, mesma convenção de `GrantResponse.expiresAt`. */
  expiresAt: string | null;
}

/**
 * Um recurso alcançado por **concessão recebida** (US 4.4, capability
 * `compartilhados-comigo`).
 *
 * Um item por **recurso**, não por concessão: `view` e `download` sobre o
 * mesmo arquivo são duas linhas em `grants` e um item aqui, porque o que a
 * pessoa procura é o documento, não a linha de concessão.
 */
export interface SharedWithMeItemResponse {
  resourceType: GrantResourceType;
  /** Id do recurso — da pasta ou do arquivo, conforme `resourceType`. */
  id: string;
  /** Nome da pasta ou do arquivo, para a lista ser uniforme nos dois casos. */
  name: string;
  /**
   * Nome da pasta que **contém** o item; `null` = raiz da unidade.
   *
   * Deliberadamente **não** é a trilha (design.md D7): sem herança, o recurso
   * concedido está frequentemente sob pastas que a pessoa não alcança, e
   * nomeá-las revelaria estrutura fora do seu alcance.
   */
  folderName: string | null;
  /** Verbos vigentes da pessoa sobre este recurso, com o prazo de cada um. */
  permissions: SharedPermissionResponse[];
  /**
   * Instante da concessão mais recente deste item, em ISO 8601 — é por ele que
   * a lista é ordenada, do mais recente para o mais antigo.
   */
  sharedAt: string;
  /**
   * Resumo do arquivo quando `resourceType` é `file`; `null` para pasta.
   *
   * Reusa `FileSummaryResponse` — o mesmo contrato da listagem de pasta, da
   * busca e dos recentes — por dois motivos: a linha nasce com tipo, código e
   * situação do controle documental, e é **exatamente** a propriedade que o
   * `PreviewModal` consome, de modo que abrir o arquivo a partir da lista não
   * exige nenhuma conversão.
   */
  file: FileSummaryResponse | null;
  /**
   * Unidade de origem quando o item chega por **compartilhamento entre
   * unidades** (change `compartilhamento-entre-unidades`, design.md D12);
   * `null` (ou ausente, numa API anterior) nos itens da própria unidade.
   */
  originUnit?: { id: string; name: string } | null;
}

/**
 * `GET /grants/received` — o que foi compartilhado comigo.
 *
 * Sem paginação: o tamanho da lista é ditado pelo que a administração concedeu
 * nominalmente àquela pessoa (design.md, Non-Goals). Paginação e filtros são
 * aditivos e não alteram nenhum requisito da capability.
 */
export interface SharedWithMeResponse {
  items: SharedWithMeItemResponse[];
}
