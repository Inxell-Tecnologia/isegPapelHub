import { UPLOAD_SLICE_MAX_BYTES_DEFAULT, UPLOAD_SLICE_MAX_ITEMS_DEFAULT } from '@gdoc/shared';

/** Arquivo da seleção já com o caminho relativo derivado (design.md D1). */
export interface SelectedFile {
  file: File;
  relativePath?: string;
}

/**
 * Divide o envio em fatias limitadas por **quantidade de itens e por volume**,
 * fechando pelo que for atingido primeiro (design.md D5). Os dois se revezam:
 * no perfil misto de documentos de escritório (1,1 MB por arquivo) uma fatia
 * de 200 itens pesa ~219 MB e o **item** manda; o teto de bytes só acorda em
 * acervos de escaneados pesados, e é o que impede uma fatia de vencer o prazo
 * da URL antes de terminar. Nenhum dos dois isoladamente serve.
 *
 * Um arquivo sozinho maior que o teto de bytes vira uma fatia só dele: recusar
 * seria inventar um limite que o servidor não impõe — quem decide se ele cabe é
 * a cota.
 */
export function fatiarEnvio(
  selecionados: SelectedFile[],
  maxItems: number = UPLOAD_SLICE_MAX_ITEMS_DEFAULT,
  maxBytes: number = UPLOAD_SLICE_MAX_BYTES_DEFAULT,
): SelectedFile[][] {
  const fatias: SelectedFile[][] = [];
  let atual: SelectedFile[] = [];
  let bytesDaFatia = 0;

  for (const selecionado of selecionados) {
    const tamanho = selecionado.file.size;
    const estouraItens = atual.length >= maxItems;
    const estouraBytes = atual.length > 0 && bytesDaFatia + tamanho > maxBytes;
    if (estouraItens || estouraBytes) {
      fatias.push(atual);
      atual = [];
      bytesDaFatia = 0;
    }
    atual.push(selecionado);
    bytesDaFatia += tamanho;
  }

  if (atual.length > 0) fatias.push(atual);
  return fatias;
}

/** Soma dos tamanhos declarados — `File.size` é metadado, não lê byte algum (design.md D3). */
export function somarBytes(selecionados: SelectedFile[]): number {
  return selecionados.reduce((total, item) => total + item.file.size, 0);
}

/**
 * Prefixo da seleção que cabe no espaço disponível, para a saída "enviar só o
 * que cabe" da recusa (design.md D4).
 *
 * **Critério: prefixo da ordem de travessia** (Open Question do design,
 * resolvida aqui). A alternativa — preencher priorizando pastas inteiras —
 * é mais agradável e menos previsível: o usuário não consegue antecipar o
 * resultado, e o que ficou de fora deixa de ter relação com a ordem que ele vê.
 * O prefixo pode partir uma subpasta ao meio, e o preço disso é pago pela
 * interface, que declara exatamente quantos arquivos e quanto volume ficaram
 * de fora. Nenhum arquivo é partido — a unidade é sempre o arquivo inteiro.
 */
export function subconjuntoQueCabe(
  selecionados: SelectedFile[],
  disponivelBytes: number,
): { cabem: SelectedFile[]; deFora: SelectedFile[] } {
  const cabem: SelectedFile[] = [];
  let acumulado = 0;
  let indice = 0;

  for (; indice < selecionados.length; indice += 1) {
    const proximo = selecionados[indice]!;
    if (acumulado + proximo.file.size > disponivelBytes) break;
    cabem.push(proximo);
    acumulado += proximo.file.size;
  }

  return { cabem, deFora: selecionados.slice(indice) };
}

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Volume legível para o painel de espaço — uma casa decimal a partir de KB. */
export function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let valor = bytes;
  let unidade = 0;
  while (valor >= 1024 && unidade < UNIDADES.length - 1) {
    valor /= 1024;
    unidade += 1;
  }
  return `${unidade === 0 ? valor : valor.toFixed(1)} ${UNIDADES[unidade]}`;
}
