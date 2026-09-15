import { useRef, useState } from 'react';
import { Alert, App, Button, List, Progress, Space, Typography, Upload } from 'antd';
import {
  FolderOpenOutlined,
  InboxOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type {
  BatchUploadItemRequest,
  BatchUploadUrlRequest,
  StorageQuotaResponse,
} from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useNarrowMode } from '../app/responsive';
import { putObject } from './put-object';
import { deriveRelativePath } from './relative-path';
import { fetchStorageQuota, useInvalidateFolderContents, useRequestUploadUrls } from './queries';
import {
  fatiarEnvio,
  formatarBytes,
  somarBytes,
  subconjuntoQueCabe,
  type SelectedFile,
} from './slicing';

const QUOTA_ERROR = 'quota exceeded';
const BATCH_LIMIT_ERROR = 'upload_batch_limit_exceeded';

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
}

/** Item admitido na fila de transferência (design.md D4). */
interface QueuedTransfer {
  uid: string;
  uploadUrl: string;
  file: File;
  fileName: string;
  relativePath?: string;
  expiresAt?: string;
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

function toBatchItem(file: File, relativePath: string | undefined): BatchUploadItemRequest {
  return {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    declaredSizeBytes: file.size,
    relativePath,
  };
}

function displayName(item: Pick<FailedItem, 'fileName' | 'relativePath'>): string {
  return item.relativePath ? `${item.relativePath}/${item.fileName}` : item.fileName;
}

function describeError(error: string | undefined): string {
  if (error === QUOTA_ERROR) return 'Cota de armazenamento atingida.';
  if (error === 'invalid item') return 'Arquivo inválido.';
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
  const invalidate = useInvalidateFolderContents();

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
    const { uid, uploadUrl, file, fileName, relativePath, expiresAt } = transfer;
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

    setFase({ tipo: 'veredito', cabe, selecao, espaco, cabem, deFora });
  }

  /**
   * Pede as URLs de uma fatia e a devolve pronta para a fila. Um item
   * recusado por cota aqui é o caso raro de D7 — o espaço mudou depois do
   * retrato —, e quem o trata é o produtor.
   */
  async function pedirUrlsDaFatia(
    fatia: SelectedFile[],
  ): Promise<{ transfers: QueuedTransfer[]; recusadosPorCota: number } | null> {
    const body: BatchUploadUrlRequest = {
      destinationFolderId: destinationFolderId ?? undefined,
      items: fatia.map(({ file, relativePath }) => toBatchItem(file, relativePath)),
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
    fatia.forEach(({ file, relativePath }, index) => {
      const result = response!.results[index];
      const uid = nextUid();
      if (result?.ok) {
        transfers.push({
          uid,
          uploadUrl: result.uploadUrl,
          file,
          fileName: file.name,
          relativePath,
          expiresAt: result.expiresAt,
        });
        return;
      }
      const error = result?.error ?? 'invalid item';
      if (error === QUOTA_ERROR) recusadosPorCota += 1;
      registrarFalha({
        uid,
        file,
        fileName: file.name,
        relativePath,
        error,
        putFailures: 0,
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
  function iniciarEnvio(selecionados: SelectedFile[]) {
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
        },
      ]);
      return;
    }

    try {
      const response = await requestUploadUrls.mutateAsync({
        destinationFolderId: destinationFolderId ?? undefined,
        items: [toBatchItem(item.file, item.relativePath)],
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
          <Button icon={<UploadOutlined />} disabled={emAndamento}>
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
            icon={<FolderOpenOutlined />}
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
            <InboxOutlined />
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

      {fase.tipo === 'veredito' && fase.cabe && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16, maxWidth: 560 }}
          message="Confirmar envio"
          description={
            <Space direction="vertical" size={8}>
              {/* Um envio pode durar dezenas de minutos: começar sem
                  confirmar é hostil. Quantidade e volume são fato; estimativa
                  de duração só depois que houver taxa medida. */}
              <Typography.Text>
                {fase.selecao.length} arquivo(s), {formatarBytes(somarBytes(fase.selecao))}.
              </Typography.Text>
              <Space>
                <Button type="primary" onClick={() => iniciarEnvio(fase.selecao)}>
                  Enviar
                </Button>
                <Button onClick={() => setFase({ tipo: 'ocioso' })}>Cancelar</Button>
              </Space>
            </Space>
          }
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
              <Button type="primary" onClick={() => iniciarEnvio(fase.cabem)}>
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
                      icon={<ReloadOutlined />}
                      onClick={() => retryItem(item.uid)}
                    >
                      Repetir
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={displayName(item)}
                    description={
                      <Typography.Text type="danger">{describeError(item.error)}</Typography.Text>
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
