import {
  DocumentType,
  requiredFieldsForType,
  type DocumentControlInput,
  type DocumentType as DocumentTypeValue,
} from '@gdoc/shared';

/**
 * Regras **puras** da tabela de cadastro do envio em lote (demanda 2.1 e 2.2;
 * design.md D2/D3/D4/D7 do change `tabela-de-cadastro-no-envio-em-lote`).
 *
 * Vivem fora do componente de propósito: a tabela precisa responder "esta linha
 * está completa?" e "há código repetido?" para **milhares** de linhas sem
 * instanciar formulário nenhum (design.md D2), e essas respostas são funções de
 * dado, não de árvore de componentes.
 */

/**
 * Uma linha da tabela: o arquivo, o título editável e os dados de controle.
 *
 * `titulo` existe separado porque mapeia para `file_name` — não é campo novo
 * (design.md D8 do change `arquivo-geral-e-pendente-de-cadastro`), é o nome com
 * que o arquivo será gravado. O que a pessoa edita é o nome **sem extensão**; a
 * extensão original é reanexada em `nomeDoArquivo` (design.md D3).
 */
export interface LinhaDeCadastro {
  /** Identidade estável da linha, independente de ordenação ou filtro. */
  uid: string;
  file: File;
  relativePath?: string;
  /** Nome sem extensão, pré-preenchido com o do arquivo e editável. */
  titulo: string;
  documentType?: DocumentTypeValue | null;
  documentCode?: string | null;
  documentRevision?: number | null;
  responsibleSector?: string | null;
  /** `YYYY-MM-DD`, como o contrato espera. */
  nextReviewAt?: string | null;
  /**
   * Campos cujo valor veio de **sugestão** pelo nome do arquivo e ainda não
   * foram confirmados pela pessoa (design.md D4). Sugestão errada não pode ter
   * a mesma aparência de decisão deliberada.
   */
  sugeridos: ReadonlySet<keyof DocumentControlInput>;
}

/**
 * Siglas reconhecidas no **nome do arquivo**, mapeadas para o tipo.
 *
 * A tabela 2.2 da demanda lista as siglas como o cliente as escreve — `POL/NOR`,
 * `FOR/CHK`, `TC`, `CI` —, nem todas apresentadas na interface
 * (`DOCUMENT_TYPE_ACRONYM`: `POL`, `FOR`, `TC`, `COM`). Um reconhecedor que só
 * aceitasse as da interface falharia justamente em `CHK-NSP-002` e
 * `CI-NSP-003`, que são os nomes que o acervo do cliente traz (design.md D4).
 * `FRM` foi a sigla do formulário na interface até o retorno do cliente sobre a
 * demanda nº 3 e continua reconhecida para arquivos já nomeados com ela; o mesmo
 * vale para `TCO`, sigla anterior do termo de consentimento. `CHK`
 * sugere Checklist, tipo próprio desde o change `tipo-checklist` (design.md D4).
 *
 * Fica na SPA, e não no contrato compartilhado, porque sigla de nome de arquivo
 * é convenção de quem nomeia: a API nunca a vê — recebe o valor do enum.
 */
const SIGLA_PARA_TIPO: Readonly<Record<string, DocumentTypeValue>> = {
  PRT: DocumentType.PROTOCOL,
  POP: DocumentType.PROCEDURE,
  POL: DocumentType.POLICY,
  NOR: DocumentType.POLICY,
  FOR: DocumentType.FORM,
  CHK: DocumentType.CHECKLIST,
  FRM: DocumentType.FORM,
  FLX: DocumentType.FLOWCHART,
  MAN: DocumentType.MANUAL,
  TC: DocumentType.CONSENT_TERM,
  TCO: DocumentType.CONSENT_TERM,
  CI: DocumentType.INTERNAL_NOTICE,
  COM: DocumentType.INTERNAL_NOTICE,
  ARQ: DocumentType.GENERAL_FILE,
};

/**
 * `SIGLA-AREA-Nº` no começo do nome: três grupos separados por hífen, o último
 * numérico. O que vem **depois** do número é descrição livre e não entra no
 * código (`PRT-NSP-001_Identificacao.pdf` → `PRT-NSP-001`).
 */
const PADRAO_DE_NOME = /^([A-Za-z]{2,4})-([A-Za-z0-9]{1,10})-(\d{1,6})/;

export interface SugestaoDeNome {
  documentType: DocumentTypeValue;
  documentCode: string;
}

/**
 * Tipo e código sugeridos pelo nome do arquivo, ou `null` quando o nome não
 * segue o padrão — caso em que a linha nasce sem sugestão alguma, nunca com um
 * palpite (design.md D10).
 *
 * O código preserva a **caixa como escrita**: é identidade do documento, e a
 * unicidade no servidor já é insensível a caixa (índice por `lower(...)`).
 */
export function sugerirPeloNome(fileName: string): SugestaoDeNome | null {
  const casamento = PADRAO_DE_NOME.exec(fileName);
  if (!casamento) return null;
  const [codigo, sigla] = [casamento[0]!, casamento[1]!.toUpperCase()];
  const documentType = SIGLA_PARA_TIPO[sigla];
  if (!documentType) return null;
  return { documentType, documentCode: codigo };
}

/** Nome sem a extensão, e a extensão (com o ponto) — `''` quando não há. */
export function separarExtensao(fileName: string): { base: string; extensao: string } {
  const ponto = fileName.lastIndexOf('.');
  // Ponto inicial é nome oculto, não extensão (`.gitignore`).
  if (ponto <= 0) return { base: fileName, extensao: '' };
  return { base: fileName.slice(0, ponto), extensao: fileName.slice(ponto) };
}

/**
 * Nome com que o arquivo será gravado: o título editado **com a extensão
 * original reanexada** (design.md D3). Nome e conteúdo discordantes produzem
 * download com extensão errada e pré-visualização incoerente, e nada no
 * servidor impede isso — a rota de lote só exige `fileName` não vazio.
 *
 * Se a pessoa já digitou a extensão no título, não é duplicada.
 */
export function nomeDoArquivo(linha: LinhaDeCadastro): string {
  const { extensao } = separarExtensao(linha.file.name);
  const titulo = linha.titulo.trim();
  if (!extensao) return titulo;
  if (titulo.toLowerCase().endsWith(extensao.toLowerCase())) return titulo;
  return `${titulo}${extensao}`;
}

/** Linha nova a partir do arquivo selecionado, já com título e sugestão. */
export function linhaDeArquivo(uid: string, file: File, relativePath?: string): LinhaDeCadastro {
  const { base } = separarExtensao(file.name);
  const sugestao = sugerirPeloNome(file.name);
  if (!sugestao) {
    return { uid, file, relativePath, titulo: base, sugeridos: new Set() };
  }
  return {
    uid,
    file,
    relativePath,
    titulo: base,
    documentType: sugestao.documentType,
    documentCode: sugestao.documentCode,
    sugeridos: new Set<keyof DocumentControlInput>(['documentType', 'documentCode']),
  };
}

/** Campos de controle da linha, no formato do contrato. */
export function controleDaLinha(linha: LinhaDeCadastro): DocumentControlInput {
  const controle: DocumentControlInput = {};
  if (linha.documentType != null) controle.documentType = linha.documentType;
  if (linha.documentCode != null && linha.documentCode !== '') {
    controle.documentCode = linha.documentCode;
  }
  if (linha.documentRevision != null) controle.documentRevision = linha.documentRevision;
  if (linha.responsibleSector != null && linha.responsibleSector !== '') {
    controle.responsibleSector = linha.responsibleSector;
  }
  if (linha.nextReviewAt != null && linha.nextReviewAt !== '') {
    controle.nextReviewAt = linha.nextReviewAt;
  }
  return controle;
}

/**
 * O que falta para a linha estar completa, derivado de `requiredFieldsForType`
 * — a **mesma** constante que o servidor consulta (design.md D9). Manter uma
 * segunda lista aqui foi o que deixou o formulário em quatro campos enquanto o
 * servidor passou a exigir cinco.
 *
 * `'titulo'` entra à parte porque não é dado de controle e **não** tem
 * pendência de cadastro que o cubra: `file_name` é `NOT NULL` e todo envio o
 * carrega (design.md D3). Linha sem título não é incompleta — é inenviável.
 */
export type CampoFaltante = keyof DocumentControlInput | 'titulo';

export function faltantesDaLinha(linha: LinhaDeCadastro): CampoFaltante[] {
  const faltantes: CampoFaltante[] = [];
  if (linha.titulo.trim().length === 0) faltantes.push('titulo');
  const controle = controleDaLinha(linha);
  for (const campo of requiredFieldsForType(linha.documentType ?? null)) {
    const valor = controle[campo];
    if (valor === undefined || valor === null || valor === '') faltantes.push(campo);
  }
  return faltantes;
}

/** Linha completa é a que não tem campo faltante — Arquivo geral só pede título. */
export function linhaCompleta(linha: LinhaDeCadastro): boolean {
  return faltantesDaLinha(linha).length === 0;
}

/** Linha enviável: pode estar incompleta (nasce pendente), mas precisa de título. */
export function linhaEnviavel(linha: LinhaDeCadastro): boolean {
  return linha.titulo.trim().length > 0;
}

/**
 * Chave de comparação de código, igual à do índice único
 * (`lower(trim(...))`): comparar de outro jeito criaria pares que a tabela
 * aceita e o servidor recusa (design.md D7).
 */
function chaveDeCodigo(codigo: string): string {
  return codigo.trim().toLowerCase();
}

/**
 * `uid`s das linhas que colidem em código **dentro da própria seleção**.
 *
 * Devolve **todas** as linhas de cada grupo em conflito, não só as repetições:
 * a recusa do servidor consegue apontar apenas a segunda, e é justamente por
 * isso que esta checagem existe aqui (design.md D7). Colisão com o **acervo**
 * não é apurada no cliente — continua sendo recusa do servidor, que chega antes
 * de qualquer byte transferir.
 */
export function codigosEmConflito(linhas: readonly LinhaDeCadastro[]): Set<string> {
  const porChave = new Map<string, string[]>();
  for (const linha of linhas) {
    const codigo = linha.documentCode;
    if (codigo == null || codigo.trim() === '') continue;
    const chave = chaveDeCodigo(codigo);
    const grupo = porChave.get(chave);
    if (grupo) grupo.push(linha.uid);
    else porChave.set(chave, [linha.uid]);
  }

  const conflitantes = new Set<string>();
  for (const grupo of porChave.values()) {
    if (grupo.length > 1) for (const uid of grupo) conflitantes.add(uid);
  }
  return conflitantes;
}

/** Campos que "Aplicar a todos" preenche — Código **nunca** entra (design.md D5). */
export interface ValoresDeAplicacao {
  documentType?: DocumentTypeValue | null;
  documentRevision?: number | null;
  responsibleSector?: string | null;
  nextReviewAt?: string | null;
}

/**
 * Aplica os valores comuns a **todas** as linhas, sobrescrevendo as já editadas
 * (design.md D5): "aplica no que ainda está vazio" produz resultado que depende
 * da ordem em que a pessoa trabalhou, e que ela não antecipa olhando a tela. A
 * demanda confirma a leitura — "cada linha pode ser alterada **depois**".
 *
 * Só os campos efetivamente informados na linha de aplicação são aplicados; um
 * campo em branco ali não apaga o que as linhas já têm. Um valor aplicado deixa
 * de ser sugestão — foi escolha da pessoa.
 */
export function aplicarATodas(
  linhas: readonly LinhaDeCadastro[],
  valores: ValoresDeAplicacao,
): LinhaDeCadastro[] {
  const informados = (Object.keys(valores) as (keyof ValoresDeAplicacao)[]).filter((campo) => {
    const valor = valores[campo];
    return valor !== undefined && valor !== null && valor !== '';
  });
  if (informados.length === 0) return [...linhas];

  return linhas.map((linha) => {
    const sugeridos = new Set(linha.sugeridos);
    for (const campo of informados) sugeridos.delete(campo as keyof DocumentControlInput);
    const aplicados = Object.fromEntries(informados.map((campo) => [campo, valores[campo]]));
    return aplicarCoerenciaDeTipo({ ...linha, ...aplicados, sugeridos });
  });
}

/**
 * Coerência do tipo **Arquivo geral** (design.md D8): ele declara não ter
 * código, revisão nem prazo, então os três campos ficam **vazios**, e não
 * apenas indisponíveis.
 *
 * Desabilitar sem limpar deixaria o valor no estado, e ele seguiria para o
 * servidor, que responde `general_file_rejects_control_fields` — recusa correta
 * e incompreensível, porque a pessoa não vê mais o campo que a causou.
 * `responsibleSector` permanece: `FIELDS_REJECTED_FOR_GENERAL_FILE` não o
 * inclui, de propósito.
 */
export function aplicarCoerenciaDeTipo(linha: LinhaDeCadastro): LinhaDeCadastro {
  if (linha.documentType !== DocumentType.GENERAL_FILE) return linha;
  const sugeridos = new Set(linha.sugeridos);
  sugeridos.delete('documentCode');
  return {
    ...linha,
    documentCode: null,
    documentRevision: null,
    nextReviewAt: null,
    sugeridos,
  };
}

/** Edita um campo da linha, tirando-o de "sugerido" e reaplicando a coerência do tipo. */
export function editarLinha<C extends keyof LinhaDeCadastro>(
  linha: LinhaDeCadastro,
  campo: C,
  valor: LinhaDeCadastro[C],
): LinhaDeCadastro {
  const sugeridos = new Set(linha.sugeridos);
  sugeridos.delete(campo as keyof DocumentControlInput);
  return aplicarCoerenciaDeTipo({ ...linha, [campo]: valor, sugeridos });
}

/** Contagem dos dois grupos, para a confirmação declarar o desfecho (design.md D6). */
export function contarDesfecho(linhas: readonly LinhaDeCadastro[]): {
  publicam: number;
  pendentes: number;
} {
  let publicam = 0;
  for (const linha of linhas) if (linhaCompleta(linha)) publicam += 1;
  return { publicam, pendentes: linhas.length - publicam };
}
