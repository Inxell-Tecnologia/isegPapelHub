import { Button, Typography } from 'antd';
import { ReadingStatus } from '@gdoc/shared';
import type { FileSummaryResponse } from '@gdoc/shared';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
import { formatarDataDeRevisao, formatarRevisao } from '../shell/document-control-labels';
import type { MinhaLeitura } from './queries';

/**
 * Peças de apresentação de uma leitura, comuns às abas e ao cartão do Início
 * (change `superficies-de-pendencia`) — as duas superfícies descrevem a mesma
 * leitura com as mesmas palavras.
 */

/** "PRT-NSP-001 - Higienização das mãos · Rev. 02" — como na declaração de ciência. */
export function documentoDaLeitura(leitura: MinhaLeitura): string {
  return `${leitura.documentCode} - ${leitura.documentTitle} · ${formatarRevisao(
    leitura.documentRevision,
  )}`;
}

/** Prazo do dia, sem fuso (`YYYY-MM-DD` → `dd/mm/aaaa`). */
export function prazoDaLeitura(leitura: MinhaLeitura): string {
  return formatarDataDeRevisao(leitura.dueDate);
}

/**
 * Situação apurada pelo servidor, só traduzida aqui. "Atrasada" em tom
 * negativo (design.md D2): continua aberta, e o texto — não só a cor — diz
 * isso.
 */
export function RotuloDaLeitura({ leitura }: { leitura: Pick<MinhaLeitura, 'status'> }) {
  switch (leitura.status) {
    case ReadingStatus.LATE:
      return <RotuloDeEstado tom="negativo">Atrasada</RotuloDeEstado>;
    case ReadingStatus.PENDING:
      return <RotuloDeEstado tom="informativo">Pendente</RotuloDeEstado>;
    case ReadingStatus.DONE:
      return <RotuloDeEstado tom="positivo">Concluída</RotuloDeEstado>;
    default:
      return <RotuloDeEstado>Encerrada</RotuloDeEstado>;
  }
}

/**
 * "Ler e confirmar ciência" (design.md D3): **abre** o documento no
 * visualizador, onde a confirmação acontece depois que ele carrega — o atalho
 * não confirma nada por si. Sem arquivo na resposta (a pessoa perdeu o
 * alcance), não há acionador: acionador que conduz a recusa é o que
 * `tela-inicial` proíbe.
 */
export function BotaoLerEConfirmar({
  leitura,
  onAbrir,
  size,
}: {
  leitura: MinhaLeitura;
  onAbrir: (file: FileSummaryResponse) => void;
  size?: 'small' | 'middle';
}) {
  const arquivo = leitura.file;
  if (!arquivo) return <Typography.Text type="secondary">Documento indisponível</Typography.Text>;
  return (
    <Button
      type="primary"
      size={size}
      aria-label={`Ler e confirmar ciência: ${leitura.documentCode} - ${leitura.documentTitle}`}
      onClick={() => onAbrir(arquivo)}
    >
      Ler e confirmar ciência
    </Button>
  );
}
