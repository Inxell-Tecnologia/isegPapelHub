import { ReadingStatus } from '@gdoc/shared';
import type { OversightCampaignResponse, OversightPersonResponse } from '@gdoc/shared';
import { formatarDataDeRevisao, formatarRevisao } from '../shell/document-control-labels';
import { paleta } from '../app/theme';

/** `#RRGGBB` → `[r, g, b]`, o formato de cor do jsPDF. */
function corRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Relatório de acompanhamento exportável (change `acompanhamento-de-leituras`,
 * design.md D6). A **montagem** é pura e testável; Excel e PDF saem no
 * navegador, com as bibliotecas carregadas só no clique — a API não monta
 * artefato, como no `.zip` de pasta.
 */

export const ROTULO_DA_SITUACAO: Record<ReadingStatus, string> = {
  [ReadingStatus.PENDING]: 'Pendente',
  [ReadingStatus.LATE]: 'Atrasada',
  [ReadingStatus.DONE]: 'Concluída',
  [ReadingStatus.CLOSED]: 'Encerrada',
};

export interface FiltrosDoRelatorio {
  unidade: string | null;
  setor: string | null;
  situacao: ReadingStatus | null;
}

/** Rótulo do setor ausente — o mesmo na tela, no filtro e no arquivo. */
export const SEM_SETOR = 'Sem setor';

export function setorDaPessoa(p: OversightPersonResponse): string {
  return p.sectorName ?? SEM_SETOR;
}

/** Filtros por unidade, setor e situação (design.md D5), sobre a lista já recortada. */
export function filtrarPessoas(
  pessoas: OversightPersonResponse[],
  f: FiltrosDoRelatorio,
): OversightPersonResponse[] {
  return pessoas.filter(
    (p) =>
      (f.unidade === null || p.unitName === f.unidade) &&
      (f.setor === null || setorDaPessoa(p) === f.setor) &&
      (f.situacao === null || p.status === f.situacao),
  );
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function documentoDaMarcacao(c: OversightCampaignResponse): string {
  return `${c.documentCode} - ${c.documentTitle} · ${formatarRevisao(c.documentRevision)}`;
}

export interface RelatorioMontado {
  nomeDoArquivo: string;
  titulo: string;
  /** Pares rótulo/valor do cabeçalho: documento, unidade, prazo, filtros, números. */
  cabecalho: [string, string][];
  colunas: string[];
  linhas: string[][];
}

/** Conteúdo comum ao Excel e ao PDF: só o que está filtrado na tela. */
export function montarRelatorio(
  campanha: OversightCampaignResponse,
  pessoas: OversightPersonResponse[],
  filtros: FiltrosDoRelatorio,
): RelatorioMontado {
  const aplicados =
    [
      filtros.unidade && `Unidade: ${filtros.unidade}`,
      filtros.setor && `Setor: ${filtros.setor}`,
      filtros.situacao && `Situação: ${ROTULO_DA_SITUACAO[filtros.situacao]}`,
    ]
      .filter(Boolean)
      .join('; ') || 'Nenhum';
  return {
    nomeDoArquivo: `acompanhamento-${campanha.documentCode}-rev${String(
      campanha.documentRevision,
    ).padStart(2, '0')}`,
    titulo: `Acompanhamento de leitura obrigatória — ${documentoDaMarcacao(campanha)}`,
    cabecalho: [
      ['Documento', documentoDaMarcacao(campanha)],
      ['Unidade da marcação', campanha.unitName],
      ['Prazo', formatarDataDeRevisao(campanha.dueDate)],
      ['Situação da marcação', campanha.inProgress ? 'Em curso' : 'Encerrada'],
      [
        'Alcance',
        campanha.scope === 'sector'
          ? `Sua equipe (setor ${campanha.scopeSectorName ?? '—'})`
          : 'Público inteiro',
      ],
      ['Filtros', aplicados],
      ['Público', String(campanha.total)],
      ['Confirmados', String(campanha.done)],
      ['Pendentes', String(campanha.pending)],
      ['Atrasados', String(campanha.late)],
      ['Encerradas', String(campanha.closed)],
      ['Adesão', campanha.adherence === null ? '—' : `${campanha.adherence}%`],
      ['Pessoas listadas', String(pessoas.length)],
    ],
    colunas: ['Nome', 'Unidade', 'Setor', 'Situação', 'Prazo', 'Ciência em'],
    linhas: pessoas.map((p) => [
      p.name,
      p.unitName,
      setorDaPessoa(p),
      ROTULO_DA_SITUACAO[p.status],
      formatarDataDeRevisao(p.dueDate),
      p.acknowledgedAt ? formatarDataHora(p.acknowledgedAt) : '—',
    ]),
  };
}

export async function exportarExcel(r: RelatorioMontado): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const negrito = (value: string) => ({ value, fontWeight: 'bold' as const });
  const dados = [
    [negrito(r.titulo)],
    [],
    ...r.cabecalho.map(([rotulo, valor]) => [negrito(rotulo), valor]),
    [],
    r.colunas.map(negrito),
    ...r.linhas,
  ];
  await writeXlsxFile(dados).toFile(`${r.nomeDoArquivo}.xlsx`);
}

export async function exportarPdf(r: RelatorioMontado): Promise<void> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(13);
  doc.text(r.titulo, 14, 16);
  autoTable(doc, {
    startY: 22,
    body: r.cabecalho,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
  });
  autoTable(doc, {
    head: [r.colunas],
    body: r.linhas,
    styles: { fontSize: 9 },
    // Cor da marca a partir do token, não por literal (`sistema-de-design`).
    headStyles: { fillColor: corRgb(paleta.verdeAcao) },
  });
  doc.save(`${r.nomeDoArquivo}.pdf`);
}
