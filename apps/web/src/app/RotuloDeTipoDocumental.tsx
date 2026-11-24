import { Tag } from 'antd';
import type { DocumentType } from '@gdoc/shared';
import { DOCUMENT_TYPE_ACRONYM, DOCUMENT_TYPE_LABEL } from '../shell/document-control-labels';
import { tonsDeTipoDocumental } from './theme';

/**
 * Largura mínima da etiqueta: três maiúsculas em negrito com o preenchimento,
 * para as siglas ficarem alinhadas na coluna (demanda nº 3, item 11; change
 * `marca-dagua-e-inicio-rodada-3`, design.md D8).
 */
export const LARGURA_ROTULO_DE_TIPO = 48;

/**
 * Etiqueta do tipo documental (US 10.1): **sigla** em texto, com a cor do
 * tipo como redundância.
 *
 * A cor nunca é a única portadora da informação (cenário 2) — e o nome
 * completo do tipo vai no `title`, para quem precisa da palavra inteira sem
 * decorar siglas. Os tons vêm de `theme.ts`, com contraste apurado por
 * cálculo em `__tests__/contraste.test.ts`. Sigla em negrito e largura
 * mínima comum, para as etiquetas alinharem na coluna Tipo.
 */
export function RotuloDeTipoDocumental({ tipo }: { tipo: DocumentType }) {
  const { texto, fundo, borda } = tonsDeTipoDocumental[tipo];
  return (
    <Tag
      title={DOCUMENT_TYPE_LABEL[tipo]}
      style={{
        color: texto,
        background: fundo,
        borderColor: borda,
        marginInlineEnd: 0,
        minWidth: LARGURA_ROTULO_DE_TIPO,
        textAlign: 'center',
        fontWeight: 600,
      }}
    >
      {DOCUMENT_TYPE_ACRONYM[tipo]}
    </Tag>
  );
}
