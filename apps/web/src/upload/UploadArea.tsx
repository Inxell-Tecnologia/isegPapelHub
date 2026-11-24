import { useRef, useState } from 'react';
import { Alert, App, Button, Form, Input, List, Progress, Space, Typography, Upload } from 'antd';
import {
  IconeArrastarSoltar,
  IconeEnviar,
  IconeEnviarPasta,
  IconeTentarNovamente,
} from '../app/icons';
import type {
  BatchUploadItemRequest,
  BatchUploadUrlRequest,
  DocumentControlInput,
  StorageQuotaResponse,
} from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useNarrowMode } from '../app/responsive';
import {
  DocumentControlFormItems,
  toDocumentControlInput,
  type DocumentControlFormValues,
} from '../navegacao/DocumentControlFormItems';
import { descreverRecusaDeControle } from '../navegacao/document-control-errors';
import {
  controleDaLinha,
  linhaDeArquivo,
  linhaEnviavel,
  nomeDoArquivo,
  type LinhaDeCadastro,
} from './cadastro-em-lote';
import { TabelaDeCadastro } from './TabelaDeCadastro';
import { putObject } from './put-object';
import { deriveRelativePath } from './relative-path';
import {
  fetchStorageQuota,
  useInvalidateFolderContents,
  useRequestUploadUrl,
  useRequestUploadUrls,
} from './queries';
import {
  fatiarEnvio,
  formatarBytes,
  somarBytes,
  subconjuntoQueCabe,
  type SelectedFile,
} from './slicing';

const QUOTA_ERROR = 'quota exceeded';
const BATCH_LIMIT_ERROR = 'upload_batch_limit_exceeded';
/** Recusa **por item** do lote: código em conflito com o acervo ou com o próprio lote. */
const CODE_CONFLICT_ERROR = 'document_code_conflict';

/**
 * Transferências simultâneas (change `corrige-defeitos-envio-lote`,
 * design.md D4). O GCS fala HTTP/2, que multiplexa — **não** existe o teto
 * implícito de ~6 conexões por host do HTTP/1.1, então sem esta fila N PUTs
 * viram N streams disputando a mesma banda: todos rastejam juntos, nenhum
 * conclui cedo, e uma interrupção deixa N arquivos pela metade em vez de
 * alguns concluídos. Quatro é o suficiente para cobrir latência de handshake
 * e a variação de tamanho entre itens, mantendo alta a taxa de conclusão.
 */
const UPLOAD_CONCURRENCY = 4;

/**
 * Margem de vigência da URL assinada (design.md D5). O item pode esperar na
 * fila antes do PUT começar, e uma URL que vence no meio da transferência
 * falha igual a uma vencida antes dela.
 */
const URL_EXPIRY_MARGIN_MS = 60_000;

/**
 * A partir de quantas falhas consecutivas de PUT a URL é renovada mesmo
 * quando o relógio do cliente a julga vigente (design.md D5): o relógio do
 * navegador decide uma otimização — poupar uma requisição —, nunca a
 * correção.
 */
const FAILURES_BEFORE_FORCED_RENEWAL = 2;

/**
 * Tamanho do bloco da apuração da seleção (change
 * `envio-multiplas-pastas-com-prechecagem`, design.md D3). Contar e somar
 * `File.size` não lê bytes, mas percorrer milhares de entradas prende a
 * thread — e a aba precisa continuar respondendo ao "Cancelar" que a spec
 * exige. Entre blocos o controle volta ao navegador.
 */
const ANALYSIS_CHUNK = 500;

/** Mensagem da recusa de envio de pasta por dispositivo (design.md D5, `web-responsividade`)
 * — `webkitdirectory` não existe em Safari iOS nem em Chrome Android; texto distinguível
 * da recusa por permissão insuficiente. */
const UPLOAD_FOLDER_DEVICE_REFUSAL =
  'Enviar pasta não está disponível neste dispositivo. Use um computador.';

/**
 * Frase obrigatória da recusa por espaço (design.md D4). Sem ela a recusa
 * induz exatamente o erro que o manual ensinava — excluir 2 GB, tentar de
 * novo e falhar de forma idêntica —, porque a exclusão move para a lixeira
 * sem devolver cota até o expurgo por retenção. Uma recusa que induz ação
 * inútil é pior que uma recusa muda. O prazo não é fixado aqui: ele é da
 * implantação, e o manual (página de limites) é quem o publica.
 */
const AVISO_EXCLUSAO_NAO_LIBERA =
  'Excluir arquivos não libera espaço de imediato: o que está na lixeira continua ocupando ' +
  'cota até o expurgo automático, ao fim do prazo de retenção da lixeira.';

interface FailedItem {
  uid: string;
  file: File;
  fileName: string;
  relativePath?: string;
  error: string;
  /** Presente enquanto a URL assinada segue válida (design.md D4) — mantida mesmo após falha de PUT, para o repetir reusar. */
  uploadUrl?: string;
  /** Prazo da URL acima, devolvido pela API — base da renovação no retry (design.md D5). */
  expiresAt?: string;
  /** Falhas consecutivas de PUT deste item; zerado ao obter URL nova (design.md D5). */
  putFailures: number;
  /**
   * Dados de controle, só no envio de **um** documento (Épico 10): o retry
   * precisa deles para repedir a URL pela rota de publicação, que os exige. O
   * servidor retoma a própria linha `pending` do mesmo código, então repetir
   * não vira documento duplicado nem recusa por código em uso.
   */
  controle?: DocumentControlInput;
  /**
   * `true` só na publicação de **um** documento, que repete pela rota unitária.
   * Item de lote também carrega `controle` desde a tabela de cadastro, e
   * repetir um item de lote pela rota unitária o transformaria em publicação de
   * documento novo — com a exigência de conjunto completo que o lote não tem.
   */
  unitario?: boolean;
}

/** Item admitido na fila de transferência (design.md D4). */
interface QueuedTransfer {
  uid: string;
  uploadUrl: string;
  file: File;
  fileName: string;
  relativePath?: string;
  expiresAt?: string;
  /** Presente só na publicação de um documento (Épico 10) — ver `FailedItem.controle`. */
  controle?: DocumentControlInput;
  unitario?: boolean;
}

/**
 * Fases do envio (change `envio-multiplas-pastas-com-prechecagem`). O
 * veredito acontece **antes** de qualquer transferência (D3): analisar →
 * consultar espaço → decidir.
 */
type Fase =
  | { tipo: 'ocioso' }
  | { tipo: 'analisando' }
  | {
      tipo: 'veredito';
      cabe: boolean;
      selecao: SelectedFile[];
      espaco: StorageQuotaResponse;
      /** Subconjunto enviável quando não cabe (D4); igual à seleção quando cabe. */
      cabem: SelectedFile[];
      deFora: SelectedFile[];
    }
  /**
   * Cadastro por arquivo (demanda 2.1; design.md D1). Entra **entre** o
   * veredito de espaço e o envio: é a confirmação, com a tabela no lugar do
   * painel "Confirmar envio".
   */
  | { tipo: 'cadastro'; linhas: LinhaDeCadastro[] }
  | { tipo: 'enviando' }
  | { tipo: 'concluido' }
  | { tipo: 'pausado'; espaco: StorageQuotaResponse; naoEnviados: number };

interface Progresso {
  bytesTotais: number;
  bytesEnviados: number;
  totalArquivos: number;
  concluidos: number;
  arquivoCorrente?: string;
  iniciadoEm: number;
}

const PROGRESSO_ZERADO: Progresso = {
  bytesTotais: 0,
  bytesEnviados: 0,
  totalArquivos: 0,
  concluidos: 0,
  iniciadoEm: 0,
};

interface UploadAreaProps {
  /** Pasta corrente do explorador; `null` = raiz da unidade (design.md D9). */
  destinationFolderId: string | null;
}

/**
 * Arquivo pronto para enviar: a seleção, mais o que a tabela de cadastro
 * acrescentou (change `tabela-de-cadastro-no-envio-em-lote`).
 *
 * `fileName` só está presente quando o título foi editado — é o nome com que
 * gravar, já com a extensão original reanexada (design.md D3). `controle` são
 * os dados de controle **daquele** item: ausente ou incompleto não recusa, faz
 * o arquivo nascer pendente de cadastro.
 */
interface ItemDeEnvio extends SelectedFile {
  fileName?: string;
  controle?: DocumentControlInput;
}

/** A linha da tabela já é um `ItemDeEnvio`: carrega arquivo, nome e controle. */
function itemDaLinha(linha: LinhaDeCadastro): ItemDeEnvio {
  return {
    file: linha.file,
    relativePath: linha.relativePath,
    fileName: nomeDoArquivo(linha),
    controle: controleDaLinha(linha),
  };
}

function toBatchItem(item: ItemDeEnvio): BatchUploadItemRequest {
  return {
    fileName: item.fileName ?? item.file.name,
    contentType: item.file.type || 'application/octet-stream',
    declaredSizeBytes: item.file.size,
    relativePath: item.relativePath,
    documentControl: item.controle,
  };
}

function displayName(item: Pick<FailedItem, 'fileName' | 'relativePath'>): string {
  return item.relativePath ? `${item.relativePath}/${item.fileName}` : item.fileName;
}

function describeError(error: string | undefined): string {
  if (error === QUOTA_ERROR) return 'Cota de armazenamento atingida.';
  if (error === 'invalid item') return 'Arquivo inválido.';
  // Recusa por item do lote (design.md D7): o código conflita com o acervo da
  // unidade ou com outro arquivo do mesmo envio. Repetir sem mudar o código
  // falharia igual, então a mensagem diz o que corrigir.
  if (error === CODE_CONFLICT_ERROR) {
    return 'Código já usado por outro documento desta unidade ou por outro arquivo deste envio.';
  }
  if (error === 'general_file_rejects_control_fields') {
    return 'Arquivo geral não aceita código, revisão nem data de próxima revisão.';
  }
  return 'Falha no envio.';
}

/**
 * Vigência da URL assinada pelo relógio do cliente (design.md D5). Sem
 * `expiresAt` a resposta é "não confiável" — item vindo de antes deste
 * conserto, ou resposta sem o campo —, e o retry pede URL nova: mais barato
 * que repetir um PUT que já se sabe condenado.
 */
function urlStillFresh(item: Pick<FailedItem, 'uploadUrl' | 'expiresAt'>): boolean {
  if (!item.uploadUrl || !item.expiresAt) return false;
  const restante = new Date(item.expiresAt).getTime() - Date.now();
  return Number.isFinite(restante) && restante > URL_EXPIRY_MARGIN_MS;
}

/**
 * `true` quando a operação é a publicação de **um** documento, e portanto
 * exige os dados de controle (Épico 10, design.md D7): exatamente um arquivo,
 * e não vindo de uma pasta.
 *
 * `relativePath` é o que distingue as duas coisas: uma pasta com um único
 * arquivo dentro continua sendo **uma pasta** — a spec dispensa os dados
 * "quando o envio abrange vários arquivos ou uma pasta", e a hierarquia que o
 * item carrega é a prova de que ele veio de uma.
 */
function ehPublicacaoDeUmDocumento(selecao: SelectedFile[]): boolean {
  return selecao.length === 1 && !selecao[0]!.relativePath;
}

/** Devolve o controle ao navegador entre blocos da apuração (design.md D3). */
function cederControle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Estimativa de duração restante (Open Question do design, resolvida aqui):
 * medida **durante** o envio, a partir da taxa real, e nunca na confirmação.
 * Estimar de saída com uma taxa suposta mente no primeiro minuto, que é
 * justamente quando a pessoa está decidindo se espera — a confirmação mostra
 * o que é fato (quantidade e volume) e cala sobre o que ainda não é.
 */
function estimarRestante(progresso: Progresso): string | null {
  const decorrido = Date.now() - progresso.iniciadoEm;
  if (decorrido < 5_000 || progresso.bytesEnviados <= 0) return null;
  const restanteBytes = progresso.bytesTotais - progresso.bytesEnviados;
  if (restanteBytes <= 0) return null;
  const segundos = Math.round(restanteBytes / (progresso.bytesEnviados / (decorrido / 1000)));
  if (segundos < 60) return `~${segundos} s restantes`;
  return `~${Math.round(segundos / 60)} min restantes`;
}

/**
 * Envio de múltiplos arquivos/pastas a partir do explorador (US 3.1, US 3.2,
 * RF #6/#13 — `web-upload`). Três gatilhos de seleção: os dois botões e a
 * área de soltar, esta última a **única** interação da plataforma capaz de
 * entregar várias pastas de uma vez (design.md D1).
 *
 * A postura do fluxo é decidir **antes** de começar: a seleção é apurada
 * localmente, confrontada com o espaço consultado ao servidor, e só então o
 * envio começa — fatiado (D5), com progresso macro em bytes (D6) e pausa
 * legível se o espaço acabar no meio (D7).
 */
export function UploadArea({ destinationFolderId }: UploadAreaProps) {
  const { message, notification } = App.useApp();
  const isNarrow = useNarrowMode();
  const requestUploadUrls = useRequestUploadUrls();
  const requestUploadUrl = useRequestUploadUrl();
  const invalidate = useInvalidateFolderContents();
  const [formDeControle] = Form.useForm<DocumentControlFormValues>();

  const [fase, setFase] = useState<Fase>({ tipo: 'ocioso' });
  const [progresso, setProgresso] = useState<Progresso>(PROGRESSO_ZERADO);
  const [falhas, setFalhas] = useState<FailedItem[]>([]);
  const [falhasVisiveis, setFalhasVisiveis] = useState(false);

  const falhasRef = useRef<FailedItem[]>([]);
  falhasRef.current = falhas;
  const nextUidRef = useRef(0);
  /** Cancelamento da análise (design.md D3) — lido no fim de cada bloco. */
  const analiseCanceladaRef = useRef(false);
  /** Bytes já transferidos por item em voo, para o progresso macro (design.md D6). */
  const carregadosRef = useRef<Map<string, number>>(new Map());
  const bytesEnviadosRef = useRef(0);

  function nextUid(): string {
    nextUidRef.current += 1;
    return `upload-${nextUidRef.current}`;
  }

  function registrarFalha(item: FailedItem) {
    setFalhas((prev) => [...prev, item]);
  }

  function atualizarFalha(uid: string, patch: Partial<FailedItem>) {
    setFalhas((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  }

  function removerFalha(uid: string) {
    setFalhas((prev) => prev.filter((it) => it.uid !== uid));
  }

  function notifyBatchLimit(found: number, allowed: number) {
    // Rede de segurança (design.md D5): com o envio fatiado abaixo do teto
    // por requisição, esta recusa deixou de ser alcançável por uso normal —
    // a SPA não a antecipa mais. Se ainda assim o servidor a devolver (teto
    // apertado por implantação), a mensagem é a por **quantidade**, nunca a
    // genérica que convida a repetir a mesma operação.
    notification.warning({
      message: 'Seleção acima do limite por envio',
      description: `Você selecionou ${found} arquivos e o limite é ${allowed} por envio. Envie em partes.`,
    });
  }

  // design.md D7 de `web-upload`: destino inválido/sem permissão derruba o
  // lote inteiro, sem iniciar transferência alguma. 401 segue tratado
  // centralmente pelo apiClient.
  function handleDestinationError(err: unknown) {
    const details =
      err instanceof ApiError ? (err.details as Record<string, unknown> | null) : null;
    if (details?.error === BATCH_LIMIT_ERROR) {
      notifyBatchLimit(Number(details.found), Number(details.allowed));
      return;
    }
    if (err instanceof ApiError && err.status === 403) {
      message.error('Permissão insuficiente para enviar arquivos neste destino.');
      return;
    }
    if (err instanceof ApiError && err.status === 404) {
      message.error('Pasta de destino não encontrada.');
      return;
    }
    message.error('Não foi possível solicitar o envio. Tente novamente.');
  }

  // Fila de transferência (design.md D4). Vive em refs, não em estado: a
  // vaga liberada precisa ser ocupada no próprio callback do XHR, sem
  // esperar um ciclo de render.
  const queueRef = useRef<QueuedTransfer[]>([]);
  const activeRef = useRef(0);
  /** Abastecedor da fatia seguinte; `null` fora de um envio (design.md D5). */
  const abastecerRef = useRef<(() => void) | null>(null);
  /** Verificação de término do envio; `null` fora de um envio. */
  const verificarFimRef = useRef<(() => void) | null>(null);

  function enqueueTransfers(transfers: QueuedTransfer[]) {
    queueRef.current.push(...transfers);
    pumpQueue();
  }

  function pumpQueue() {
    while (activeRef.current < UPLOAD_CONCURRENCY && queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      activeRef.current += 1;
      startTransfer(next);
    }
  }

  /** Libera a vaga e puxa o próximo — por sucesso **ou** por falha (design.md D4). */
  function releaseSlot() {
    activeRef.current = Math.max(0, activeRef.current - 1);
    pumpQueue();
    // A fatia seguinte é buscada assim que a fila afrouxa, **enquanto** os
    // últimos itens desta ainda transferem (design.md D5): esperar a fila
    // secar para só então pedir URLs deixaria a banda ociosa a cada
    // fronteira de fatia.
    abastecerRef.current?.();
    verificarFimRef.current?.();
  }

  /** Bytes transferidos deste item, acumulados no total macro (design.md D6). */
  function registrarBytes(uid: string, carregados: number) {
    const anterior = carregadosRef.current.get(uid) ?? 0;
    if (carregados <= anterior) return;
    carregadosRef.current.set(uid, carregados);
    bytesEnviadosRef.current += carregados - anterior;
    const total = bytesEnviadosRef.current;
    setProgresso((prev) => ({ ...prev, bytesEnviados: total }));
  }

  function startTransfer(transfer: QueuedTransfer) {
    const { uid, uploadUrl, file, fileName, relativePath, expiresAt, controle, unitario } =
      transfer;
    setProgresso((prev) => ({ ...prev, arquivoCorrente: displayName({ fileName, relativePath }) }));
    putObject(uploadUrl, file, {
      onProgress: (percent) => registrarBytes(uid, Math.round((file.size * percent) / 100)),
      onSuccess: () => {
        // design.md D6 de `web-upload`: sucesso = PUT 2xx; invalida a
        // listagem, sem esperar `active` — a mensagem diz "enviado", não
        // "disponível".
        registrarBytes(uid, file.size);
        setProgresso((prev) => ({ ...prev, concluidos: prev.concluidos + 1 }));
        removerFalha(uid);
        invalidate();
        releaseSlot();
      },
      onError: () => {
        // A contagem alimenta a renovação forçada de D5: se o relógio disse
        // "vigente" e o PUT falhou duas vezes, o relógio não é confiável.
        const anterior = falhasRef.current.find((it) => it.uid === uid);
        // O item deixa de contar bytes: o que subiu dele não vale nada.
        const carregados = carregadosRef.current.get(uid) ?? 0;
        carregadosRef.current.set(uid, 0);
        bytesEnviadosRef.current -= carregados;
        const total = bytesEnviadosRef.current;
        setProgresso((prev) => ({ ...prev, bytesEnviados: total }));
        if (anterior) {
          atualizarFalha(uid, {
            error: 'put failed',
            putFailures: anterior.putFailures + 1,
            uploadUrl,
            expiresAt,
          });
        } else {
          registrarFalha({
            uid,
            file,
            fileName,
            relativePath,
            error: 'put failed',
            putFailures: 1,
            uploadUrl,
            expiresAt,
            controle,
            unitario,
          });
        }
        releaseSlot();
      },
    });
  }

  /**
   * Apuração local da seleção (design.md D3): quantidade e soma de
   * `File.size`, sem ler conteúdo. Percorre em blocos, cedendo o controle
   * entre eles, para a aba continuar respondendo ao cancelamento.
   */
  async function analisarSelecao(files: File[]): Promise<SelectedFile[] | null> {
    const selecionados: SelectedFile[] = [];
    for (let i = 0; i < files.length; i += ANALYSIS_CHUNK) {
      for (const file of files.slice(i, i + ANALYSIS_CHUNK)) {
        selecionados.push({ file, relativePath: deriveRelativePath(file) });
      }
      await cederControle();
      if (analiseCanceladaRef.current) return null;
    }
    return selecionados;
  }

  /**
   * Seleção recebida por qualquer dos três gatilhos. Nenhuma requisição é
   * emitida antes da apuração terminar (design.md D3) — a consulta de espaço
   * vem **depois** dela, para o retrato ser o mais recente possível.
   */
  async function receberSelecao(files: File[]) {
    if (files.length === 0) {
      setFase({ tipo: 'ocioso' });
      return;
    }
    analiseCanceladaRef.current = false;
    setFase({ tipo: 'analisando' });

    const selecao = await analisarSelecao(files);
    if (!selecao) {
      setFase({ tipo: 'ocioso' });
      return;
    }

    let espaco: StorageQuotaResponse;
    try {
      espaco = await fetchStorageQuota();
    } catch {
      message.error('Não foi possível verificar o espaço disponível. Tente novamente.');
      setFase({ tipo: 'ocioso' });
      return;
    }
    if (analiseCanceladaRef.current) {
      setFase({ tipo: 'ocioso' });
      return;
    }

    const total = somarBytes(selecao);
    const cabe = total <= espaco.availableBytes;
    const { cabem, deFora } = cabe
      ? { cabem: selecao, deFora: [] as SelectedFile[] }
      : subconjuntoQueCabe(selecao, espaco.availableBytes);

    // A tabela de cadastro é a confirmação do envio de vários arquivos
    // (design.md D1): o veredito de espaço vem **antes** dela, para ninguém
    // preencher cinquenta linhas e só então ouvir que a seleção não cabe.
    if (cabe && !ehPublicacaoDeUmDocumento(selecao)) {
      abrirCadastro(selecao);
      return;
    }

    setFase({ tipo: 'veredito', cabe, selecao, espaco, cabem, deFora });
  }

  /** Abre a tabela com uma linha por arquivo, já com título e sugestão (design.md D4). */
  function abrirCadastro(selecao: SelectedFile[]) {
    const linhas = selecao.map((item) => linhaDeArquivo(nextUid(), item.file, item.relativePath));
    setFase({ tipo: 'cadastro', linhas });
  }

  /**
   * Envia **todas** as linhas — completas e incompletas — na mesma operação
   * (design.md D6). O servidor decide por item quem publica e quem nasce
   * pendente; a linha sem título é a única que não vai, por não haver pendência
   * de cadastro que cubra a falta do nome do arquivo (design.md D3).
   */
  function publicarCadastro(linhas: LinhaDeCadastro[]) {
    iniciarEnvio(linhas.filter(linhaEnviavel).map(itemDaLinha));
  }

  /**
   * Pede as URLs de uma fatia e a devolve pronta para a fila. Um item
   * recusado por cota aqui é o caso raro de D7 — o espaço mudou depois do
   * retrato —, e quem o trata é o produtor.
   */
  async function pedirUrlsDaFatia(
    fatia: ItemDeEnvio[],
  ): Promise<{ transfers: QueuedTransfer[]; recusadosPorCota: number } | null> {
    const body: BatchUploadUrlRequest = {
      destinationFolderId: destinationFolderId ?? undefined,
      items: fatia.map((item) => toBatchItem(item)),
    };

    let response;
    try {
      response = await requestUploadUrls.mutateAsync(body);
    } catch (err) {
      handleDestinationError(err);
      return null;
    }

    const transfers: QueuedTransfer[] = [];
    let recusadosPorCota = 0;
    fatia.forEach((item, index) => {
      const { file, relativePath, controle } = item;
      const fileName = item.fileName ?? file.name;
      const result = response!.results[index];
      const uid = nextUid();
      if (result?.ok) {
        transfers.push({
          uid,
          uploadUrl: result.uploadUrl,
          file,
          fileName,
          relativePath,
          expiresAt: result.expiresAt,
          controle,
        });
        return;
      }
      const error = result?.error ?? 'invalid item';
      if (error === QUOTA_ERROR) recusadosPorCota += 1;
      registrarFalha({
        uid,
        file,
        fileName,
        relativePath,
        error,
        putFailures: 0,
        // Preserva o cadastro da linha recusada: corrigir o código e repetir
        // não pode exigir reinformar tudo (design.md D7).
        controle,
      });
    });

    return { transfers, recusadosPorCota };
  }

  /**
   * Envio fatiado (design.md D5). As URLs de cada fatia são pedidas pouco
   * antes de usá-las, nunca todas no início: o corpo da requisição fica
   * pequeno e cada URL recebe o prazo cheio. A divisão é invisível ao
   * usuário — o progresso é um só, do conjunto.
   */
  function iniciarEnvio(selecionados: ItemDeEnvio[]) {
    const fatias = fatiarEnvio(selecionados);
    const bytesTotais = somarBytes(selecionados);

    carregadosRef.current = new Map();
    bytesEnviadosRef.current = 0;
    setProgresso({
      bytesTotais,
      bytesEnviados: 0,
      totalArquivos: selecionados.length,
      concluidos: 0,
      iniciadoEm: Date.now(),
    });
    setFalhas([]);
    setFalhasVisiveis(false);
    setFase({ tipo: 'enviando' });

    let proxima = 0;
    let buscando = false;
    /** `cota` = pausa de D7; `erro` = recusa do lote inteiro (destino/permissão). */
    let parar: 'nao' | 'cota' | 'erro' = 'nao';

    /**
     * O envio acabou quando não há fatia por pedir, nada em voo e nada na
     * fila. Na pausa por cota o painel de D7 já está na tela e é ele que
     * fica — sair dele seria apagar o veredito que a pessoa precisa ler.
     */
    function verificarFim() {
      if (buscando) return;
      if (parar === 'nao' && proxima < fatias.length) return;
      if (activeRef.current > 0 || queueRef.current.length > 0) return;
      abastecerRef.current = null;
      verificarFimRef.current = null;
      // A pausa por cota já pôs o painel de D7 na tela, e a recusa do lote
      // inteiro já comunicou o erro — nos dois casos sair para o resumo de
      // conclusão apagaria o veredito que a pessoa precisa ler.
      if (parar !== 'nao') return;
      setFase({ tipo: 'concluido' });
    }

    async function abastecer() {
      if (buscando || parar !== 'nao' || proxima >= fatias.length) return;
      // Só busca quando a fila afrouxa: enquanto houver trabalho suficiente
      // enfileirado, pedir URLs adiantado só encurtaria o prazo delas.
      if (queueRef.current.length >= UPLOAD_CONCURRENCY) return;
      buscando = true;
      const fatia = fatias[proxima]!;
      proxima += 1;
      const resultado = await pedirUrlsDaFatia(fatia);
      buscando = false;

      if (!resultado) {
        // Recusa do lote inteiro (destino/permissão): não há o que
        // prosseguir; o erro já foi comunicado.
        parar = 'erro';
        verificarFim();
        return;
      }

      enqueueTransfers(resultado.transfers);

      if (resultado.recusadosPorCota > 0) {
        // design.md D7: o espaço acabou depois do retrato. Não se prossegue
        // para as fatias seguintes — insistir só produziria uma sequência de
        // recusas e uma árvore parcial imprevisível.
        parar = 'cota';
        const naoEnviados =
          resultado.recusadosPorCota +
          fatias.slice(proxima).reduce((soma, restante) => soma + restante.length, 0);
        void apresentarPausa(naoEnviados);
        return;
      }

      void abastecer();
      verificarFim();
    }

    abastecerRef.current = () => void abastecer();
    verificarFimRef.current = verificarFim;
    void abastecer();
  }

  /**
   * Publicação de **um** documento (Épico 10, US 10.5): a operação carrega
   * exatamente um arquivo, então os dados de controle são exigidos e a
   * requisição vai pela rota de publicação, não pela do lote.
   *
   * A URL é pedida **antes** de trocar de fase, de propósito: uma recusa por
   * código em uso ou por dado faltante devolve a pessoa ao formulário com o
   * que ela digitou, em vez de a jogar num envio que já se sabe inviável.
   */
  async function iniciarEnvioDeUmDocumento(
    selecionado: SelectedFile,
    controle: DocumentControlInput,
  ) {
    const { file } = selecionado;
    let resposta;
    try {
      resposta = await requestUploadUrl.mutateAsync({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        declaredSizeBytes: file.size,
        folderId: destinationFolderId ?? undefined,
        documentControl: controle,
      });
    } catch (err) {
      // Código em uso, dado faltante e permissão insuficiente são avisos
      // distintos (web-upload: "indicando o que corrigir").
      message.error(descreverRecusaDeControle(err));
      return;
    }

    carregadosRef.current = new Map();
    bytesEnviadosRef.current = 0;
    setProgresso({
      bytesTotais: file.size,
      bytesEnviados: 0,
      totalArquivos: 1,
      concluidos: 0,
      iniciadoEm: Date.now(),
    });
    setFalhas([]);
    setFalhasVisiveis(false);
    setFase({ tipo: 'enviando' });

    verificarFimRef.current = () => {
      if (activeRef.current > 0 || queueRef.current.length > 0) return;
      verificarFimRef.current = null;
      setFase({ tipo: 'concluido' });
    };

    enqueueTransfers([
      {
        uid: nextUid(),
        uploadUrl: resposta.uploadUrl,
        file,
        fileName: file.name,
        expiresAt: resposta.expiresAt,
        controle,
        unitario: true,
      },
    ]);
  }

  /** Reapresenta o painel detalhado com o espaço **recém-consultado** (design.md D7). */
  async function apresentarPausa(naoEnviados: number) {
    try {
      const espaco = await fetchStorageQuota();
      setFase({ tipo: 'pausado', espaco, naoEnviados });
    } catch {
      message.error('O envio foi interrompido por falta de espaço.');
      setFase({ tipo: 'ocioso' });
    }
  }

  // design.md D4 de `web-upload`: item sem URL válida (recusado pelo
  // servidor) refaz uma chamada de lote de 1 para reconquistar a folga de
  // cota; item que só falhou no PUT reusa a URL já obtida — **enquanto ela
  // estiver vigente** (design.md D5), com renovação forçada após falhas
  // consecutivas, quando o relógio do navegador se mostra não confiável.
  async function retryItem(uid: string) {
    const item = falhasRef.current.find((it) => it.uid === uid);
    if (!item) return;

    const forcarRenovacao = item.putFailures >= FAILURES_BEFORE_FORCED_RENEWAL;
    if (item.uploadUrl && urlStillFresh(item) && !forcarRenovacao) {
      enqueueTransfers([
        {
          uid,
          uploadUrl: item.uploadUrl,
          file: item.file,
          fileName: item.fileName,
          relativePath: item.relativePath,
          expiresAt: item.expiresAt,
          controle: item.controle,
        },
      ]);
      return;
    }

    // Documento publicado pela rota unitária renova a URL pela mesma rota,
    // com os mesmos dados de controle (Épico 10): o servidor reconhece o
    // próprio envio pendente daquele código e o retoma, em vez de recusar
    // por código em uso ou criar um documento duplicado.
    if (item.unitario && item.controle) {
      try {
        const resposta = await requestUploadUrl.mutateAsync({
          fileName: item.fileName,
          contentType: item.file.type || 'application/octet-stream',
          declaredSizeBytes: item.file.size,
          folderId: destinationFolderId ?? undefined,
          documentControl: item.controle,
        });
        atualizarFalha(uid, {
          uploadUrl: resposta.uploadUrl,
          expiresAt: resposta.expiresAt,
          putFailures: 0,
        });
        enqueueTransfers([
          {
            uid,
            uploadUrl: resposta.uploadUrl,
            file: item.file,
            fileName: item.fileName,
            expiresAt: resposta.expiresAt,
            controle: item.controle,
            unitario: true,
          },
        ]);
      } catch (err) {
        message.error(descreverRecusaDeControle(err));
      }
      return;
    }

    try {
      const response = await requestUploadUrls.mutateAsync({
        destinationFolderId: destinationFolderId ?? undefined,
        items: [
          toBatchItem({
            file: item.file,
            relativePath: item.relativePath,
            fileName: item.fileName,
            controle: item.controle,
          }),
        ],
      });
      const result = response.results[0];
      if (result?.ok) {
        // URL nova zera a contagem: o histórico de falhas era da URL antiga.
        atualizarFalha(uid, {
          uploadUrl: result.uploadUrl,
          expiresAt: result.expiresAt,
          putFailures: 0,
        });
        enqueueTransfers([
          {
            uid,
            uploadUrl: result.uploadUrl,
            file: item.file,
            fileName: item.fileName,
            relativePath: item.relativePath,
            expiresAt: result.expiresAt,
            controle: item.controle,
          },
        ]);
      } else {
        atualizarFalha(uid, { error: result?.error ?? 'invalid item' });
      }
    } catch (err) {
      handleDestinationError(err);
    }
  }

  // design.md D3 de `web-upload`: `fileList` de `beforeUpload` é a seleção
  // inteira desta operação — o fluxo dispara uma única vez, no primeiro
  // arquivo, e todo `beforeUpload` retorna `false` (o envio real é feito por
  // `iniciarEnvio`/`putObject`). Vale igual para a seleção por botão e para a
  // que chega do `drop`, já achatada pela travessia do rc-upload (D1).
  function handleBeforeUpload(file: File, fileList: File[]): boolean {
    if (file === fileList[0]) {
      void receberSelecao(fileList);
    }
    return false;
  }

  function cancelarAnalise() {
    analiseCanceladaRef.current = true;
    setFase({ tipo: 'ocioso' });
  }

  const emAndamento = fase.tipo === 'enviando';
  // Na pausa por cota o progresso continua à vista: os itens em voo quando a
  // fatia foi recusada terminam, e o que já subiu permanece enviado (D7).
  const mostrarProgresso = emAndamento || fase.tipo === 'pausado' || fase.tipo === 'concluido';
  const percentual =
    progresso.bytesTotais > 0
      ? Math.min(100, Math.round((progresso.bytesEnviados / progresso.bytesTotais) * 100))
      : 0;
  const restante = emAndamento ? estimarRestante(progresso) : null;

  function painelDeEspaco(espaco: StorageQuotaResponse, titulo: string, descricaoExtra?: string) {
    const ativos = Math.max(0, espaco.usedBytes - espaco.trashedBytes);
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginTop: 16, maxWidth: 560 }}
        message={titulo}
        description={
          <Space direction="vertical" size={4}>
            {descricaoExtra ? <Typography.Text>{descricaoExtra}</Typography.Text> : null}
            <Typography.Text>
              Espaço disponível: {formatarBytes(espaco.availableBytes)} de{' '}
              {formatarBytes(espaco.quotaBytes)}.
            </Typography.Text>
            {/* design.md D4: a decomposição é o que torna a recusa acionável
                — sem ela a pessoa não sabe onde o espaço está preso. */}
            <Typography.Text type="secondary">
              Seu espaço: {formatarBytes(ativos)} em arquivos ativos,{' '}
              {formatarBytes(espaco.trashedBytes)} na lixeira e {formatarBytes(espaco.pendingBytes)}{' '}
              em envios pendentes.
            </Typography.Text>
            <Typography.Text type="secondary">{AVISO_EXCLUSAO_NAO_LIBERA}</Typography.Text>
          </Space>
        }
      />
    );
  }

  return (
    <div>
      <Space wrap>
        <Upload
          multiple
          showUploadList={false}
          beforeUpload={handleBeforeUpload}
          disabled={emAndamento}
        >
          <Button icon={<IconeEnviar />} disabled={emAndamento}>
            Enviar arquivos
          </Button>
        </Upload>
        {/* design.md D5 (`web-responsividade`): `webkitdirectory` não existe em
            Safari iOS nem em Chrome Android — abaixo do limiar o botão
            permanece visível e recusa no acionamento, em vez de abrir um
            seletor de pasta que a plataforma não suporta. O `<Upload>`
            permanece montado nos dois modos (identidade estável do
            componente); a recusa intercepta o clique com
            `stopPropagation`, antes que o `rc-upload` abra o seletor. */}
        <Upload
          directory
          multiple
          showUploadList={false}
          beforeUpload={handleBeforeUpload}
          disabled={emAndamento}
        >
          <Button
            icon={<IconeEnviarPasta />}
            disabled={emAndamento}
            onClick={(e) => {
              if (isNarrow) {
                e.stopPropagation();
                message.error(UPLOAD_FOLDER_DEVICE_REFUSAL);
              }
            }}
          >
            Enviar pasta
          </Button>
        </Upload>
      </Space>

      {/* design.md D1: arrastar e soltar é a **única** interação da
          plataforma que entrega N pastas de uma vez — `webkitdirectory` e
          `showDirectoryPicker()` abrem seletor de pasta única em todos os
          navegadores. Os botões acima permanecem porque `drop` não é
          acionável por teclado. Em celular/tablet a área não é montada: ao
          contrário do botão, que recusa no acionamento, uma área de soltar
          não tem acionamento a recusar — exibi-la num aparelho de toque
          anunciaria uma interação que a plataforma não tem
          (`web-responsividade`). `openFileDialogOnClick={false}` mantém o
          clique com os botões, cujo comportamento é explícito. */}
      {!isNarrow && !emAndamento && (
        <Upload.Dragger
          directory
          multiple
          showUploadList={false}
          openFileDialogOnClick={false}
          beforeUpload={handleBeforeUpload}
          onDrop={() => {
            // A travessia do `drop` é do rc-upload e leva segundos em
            // seleções grandes; o estado de análise precisa aparecer já
            // (design.md D3), antes de `beforeUpload`.
            analiseCanceladaRef.current = false;
            setFase({ tipo: 'analisando' });
          }}
          style={{ marginTop: 16, maxWidth: 560 }}
        >
          <p className="ant-upload-drag-icon">
            <IconeArrastarSoltar />
          </p>
          <p className="ant-upload-text">Arraste pastas e arquivos para cá</p>
          <p className="ant-upload-hint">
            Várias pastas de uma vez, com a hierarquia preservada. O espaço é verificado antes de
            começar.
          </p>
        </Upload.Dragger>
      )}

      {fase.tipo === 'analisando' && (
        <Space style={{ marginTop: 16 }}>
          <Typography.Text>Analisando seleção…</Typography.Text>
          <Button size="small" onClick={cancelarAnalise}>
            Cancelar
          </Button>
        </Space>
      )}

      {/* Épico 10, design.md D7: a exigência dos dados de controle liga quando
          a operação carrega **exatamente um** arquivo, e desliga quando
          carrega vários ou uma pasta. A consequência é explícita no aceite:
          arrastar um arquivo pede quatro campos; arrastar dois não pede nada.
          Ligar pela contagem mantém um caminho só — o explorador tem uma
          única área de soltar, e a pessoa não escolhe um comando antes de
          arrastar. */}
      {fase.tipo === 'veredito' && fase.cabe && ehPublicacaoDeUmDocumento(fase.selecao) && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16, maxWidth: 560 }}
          message="Dados do documento"
          description={
            <Space direction="vertical" size={8} style={{ display: 'flex' }}>
              <Typography.Text>
                {fase.selecao[0]!.file.name} — {formatarBytes(somarBytes(fase.selecao))}.
              </Typography.Text>
              <Form
                form={formDeControle}
                layout="vertical"
                requiredMark={false}
                onFinish={(values: DocumentControlFormValues) =>
                  void iniciarEnvioDeUmDocumento(fase.selecao[0]!, toDocumentControlInput(values))
                }
              >
                <DocumentControlFormItems obrigatorios />
                <Space>
                  <Button type="primary" htmlType="submit" loading={requestUploadUrl.isPending}>
                    Publicar documento
                  </Button>
                  <Button onClick={() => setFase({ tipo: 'ocioso' })}>Cancelar</Button>
                </Space>
              </Form>
            </Space>
          }
        />
      )}

      {/* Demanda 2.1; design.md D1. A tabela **é** a confirmação do envio de
          vários arquivos: traz a quantidade e o volume que o painel anterior
          trazia, agora com o cadastro por arquivo. Um envio pode durar dezenas
          de minutos, então começar sem confirmação explícita continua fora de
          questão. */}
      {fase.tipo === 'cadastro' && (
        <TabelaDeCadastro
          linhas={fase.linhas}
          onChange={(linhas) => setFase({ tipo: 'cadastro', linhas })}
          onConfirmar={() => publicarCadastro(fase.linhas)}
          onCancelar={() => setFase({ tipo: 'ocioso' })}
          enviando={requestUploadUrls.isPending}
        />
      )}

      {fase.tipo === 'veredito' && !fase.cabe && (
        <>
          {painelDeEspaco(
            fase.espaco,
            'A seleção não cabe no seu espaço disponível',
            `Seleção de ${fase.selecao.length} arquivo(s), ${formatarBytes(
              somarBytes(fase.selecao),
            )} — faltam ${formatarBytes(somarBytes(fase.selecao) - fase.espaco.availableBytes)}.`,
          )}
          <Space style={{ marginTop: 8 }} wrap>
            {fase.cabem.length > 0 && (
              <Button
                type="primary"
                onClick={() =>
                  // Cadastrar linha que não será enviada é trabalho perdido por
                  // construção: a tabela recebe só o subconjunto que cabe.
                  ehPublicacaoDeUmDocumento(fase.cabem)
                    ? iniciarEnvio(fase.cabem)
                    : abrirCadastro(fase.cabem)
                }
              >
                Enviar só o que cabe ({fase.cabem.length} de {fase.selecao.length})
              </Button>
            )}
            <Button onClick={() => setFase({ tipo: 'ocioso' })}>Cancelar</Button>
            {fase.deFora.length > 0 && (
              <Typography.Text type="secondary">
                Ficam de fora {fase.deFora.length} arquivo(s),{' '}
                {formatarBytes(somarBytes(fase.deFora))}.
              </Typography.Text>
            )}
          </Space>
        </>
      )}

      {fase.tipo === 'pausado' && (
        <>
          {painelDeEspaco(
            fase.espaco,
            'Envio incompleto: o espaço acabou durante a transferência',
            `${fase.naoEnviados} arquivo(s) não foram enviados. Os que já subiram permanecem enviados.`,
          )}
          <Space style={{ marginTop: 8 }}>
            <Button onClick={() => setFase({ tipo: 'ocioso' })}>Entendi</Button>
          </Space>
        </>
      )}

      {/* design.md D6: um progresso **do conjunto**, medido em bytes. Por
          contagem de arquivos a barra andaria quatorze vezes mais rápido num
          docx de 180 KB que num PDF escaneado de 2,6 MB — aos trancos, e com
          qualquer estimativa derivada dela virando ficção. A barra macro
          também elimina as N linhas que travariam a aba num envio de
          milhares de arquivos. */}
      {mostrarProgresso && (
        <div style={{ marginTop: 16, maxWidth: 560 }}>
          <Progress
            percent={percentual}
            status={
              fase.tipo === 'concluido' && falhas.length === 0
                ? 'success'
                : emAndamento
                  ? 'active'
                  : 'normal'
            }
          />
          <Typography.Text type="secondary">
            {progresso.concluidos} de {progresso.totalArquivos} arquivo(s) —{' '}
            {formatarBytes(progresso.bytesEnviados)} de {formatarBytes(progresso.bytesTotais)}
            {restante ? ` — ${restante}` : ''}
          </Typography.Text>
          {emAndamento && progresso.arquivoCorrente && (
            <div>
              <Typography.Text type="secondary" ellipsis>
                Enviando: {progresso.arquivoCorrente}
              </Typography.Text>
            </div>
          )}
        </div>
      )}

      {fase.tipo === 'concluido' && (
        <Typography.Text type="success" style={{ display: 'block', marginTop: 8 }}>
          Envio concluído.
        </Typography.Text>
      )}

      {/* As falhas colapsam num contador com detalhe sob demanda (design.md
          D6): é o único lugar onde uma lista por item ainda faz sentido,
          porque é curta por natureza — e é onde o detalhe é acionável. */}
      {falhas.length > 0 && (
        <div style={{ marginTop: 16, maxWidth: 560 }}>
          <Space>
            <Typography.Text type="danger">
              {falhas.length} arquivo(s) com falha no envio.
            </Typography.Text>
            <Button size="small" onClick={() => setFalhasVisiveis((visivel) => !visivel)}>
              {falhasVisiveis ? 'Ocultar falhas' : 'Ver falhas'}
            </Button>
          </Space>
          {falhasVisiveis && (
            <List
              size="small"
              style={{ marginTop: 8 }}
              dataSource={falhas}
              renderItem={(item) => (
                <List.Item
                  key={item.uid}
                  actions={[
                    <Button
                      key="retry"
                      size="small"
                      icon={<IconeTentarNovamente />}
                      onClick={() => retryItem(item.uid)}
                    >
                      Repetir
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={displayName(item)}
                    description={
                      <Space direction="vertical" size={4} style={{ display: 'flex' }}>
                        <Typography.Text type="danger">{describeError(item.error)}</Typography.Text>
                        {/* design.md D7: perder o cadastro da linha junto com a
                            recusa é o desfecho que faz a pessoa desistir da
                            tabela. Só o código precisa mudar; o resto do
                            cadastro continua em `item.controle`. */}
                        {item.error === CODE_CONFLICT_ERROR && (
                          <Input
                            size="small"
                            aria-label={`Novo código de ${item.fileName}`}
                            placeholder="Novo código"
                            maxLength={60}
                            defaultValue={item.controle?.documentCode ?? ''}
                            onChange={(e) =>
                              atualizarFalha(item.uid, {
                                controle: { ...item.controle, documentCode: e.target.value },
                              })
                            }
                          />
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}
