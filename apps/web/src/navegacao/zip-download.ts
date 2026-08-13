import { downloadZip } from 'client-zip';
import type { FolderDownloadManifestEntry } from '@gdoc/shared';

export interface ZipDownloadProgress {
  completedFiles: number;
  totalFiles: number;
  downloadedBytes: number;
  totalBytes: number;
  currentFileName: string | null;
}

export interface BuildFolderZipOptions {
  onProgress?: (progress: ZipDownloadProgress) => void;
  signal?: AbortSignal;
}

/** Encaixa um contador de bytes no meio do `ReadableStream` de resposta, sem bufferizar. */
function countingStream(
  stream: ReadableStream<Uint8Array>,
  onChunk: (length: number) => void,
): ReadableStream<Uint8Array> {
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        onChunk(chunk.byteLength);
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Monta o `.zip` em streaming a partir do manifesto (design.md D1, task
 * 4.2): cada arquivo é buscado direto da URL assinada e alimentado ao
 * compactador um de cada vez — nunca todos os arquivos de entrada
 * simultaneamente em memória. O teto de 50 MB (design.md D5) garante que o
 * `.zip` final montado em memória para o `Blob` de saída permanece pequeno.
 * `signal` cancela tanto a busca em andamento quanto as pendentes (task 4.3).
 */
export async function buildFolderZip(
  entries: FolderDownloadManifestEntry[],
  totalBytes: number,
  { onProgress, signal }: BuildFolderZipOptions = {},
): Promise<Blob> {
  let downloadedBytes = 0;
  let completedFiles = 0;

  function reportProgress(currentFileName: string | null) {
    onProgress?.({
      completedFiles,
      totalFiles: entries.length,
      downloadedBytes,
      totalBytes,
      currentFileName,
    });
  }

  async function* files() {
    for (const entry of entries) {
      if (signal?.aborted) throw new DOMException('Download cancelado', 'AbortError');

      reportProgress(entry.fileName);
      const response = await fetch(entry.url, { signal });
      if (!response.ok || !response.body) {
        throw new Error(`Falha ao baixar ${entry.fileName}`);
      }

      const counted = countingStream(response.body, (length) => {
        downloadedBytes += length;
        reportProgress(entry.fileName);
      });

      yield { input: counted, name: entry.relativePath, size: entry.sizeBytes };
      completedFiles += 1;
      reportProgress(entry.fileName);
    }
  }

  const zipResponse = downloadZip(files());
  return zipResponse.blob();
}

/**
 * Dispara o download de um `Blob` gerado no cliente (design.md D1) — sem URL
 * de servidor a navegar. Motivo técnico da recusa por dispositivo em tela
 * estreita (design.md D5 do change `responsividade-mobile-tablet`): mesmo
 * com o `.zip` montado em streaming acima, este passo materializa o `Blob`
 * **inteiro** em memória antes de disparar o download, e o Safari iOS tem
 * histórico irregular com `download` em URLs de blob (abre inline em vez de
 * salvar). A recusa acontece em `ExplorerPage` antes de chegar aqui — esta
 * implementação do modo largo **não muda**.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
