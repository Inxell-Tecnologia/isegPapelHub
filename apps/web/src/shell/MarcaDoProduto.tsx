import { paleta, TAMANHO_MINIMO_TEXTO, FAMILIA_TITULO } from '../app/theme';
import { ATIVOS_DA_MARCA, BrandMark } from './BrandMark';

/** Largura da logo na marca expandida — medida da demanda nº 2, seção 1.1. */
const LARGURA_DA_LOGO = 150;

/**
 * Marca do shell expandido: logo do Instituto SETES e, logo abaixo, o nome do
 * produto e o descritor em texto (`docs/demanda_cliente_3.md`, item 1;
 * capability `identidade-visual`).
 *
 * **Nome acessível** (design.md D3): a logo tem "INSTITUTO SETES" escrito —
 * é informação, então é anunciada pelo nome da organização; o nome do
 * **produto** é anunciado uma única vez, pelo texto "PapelHub".
 *
 * **Sem a linha da identificação do cliente.** Com a logo da organização no
 * topo, "SETES" em texto logo abaixo seria repetição, e custaria 18 px que o
 * orçamento de altura da navegação não tem (design.md D1). A identificação
 * continua no título do documento e na tela de login.
 */
export function MarcaDoProduto() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <BrandMark
        variante="logo"
        height={Math.round(LARGURA_DA_LOGO / ATIVOS_DA_MARCA.logo.proporcao)}
        informativa
      />
      <div
        style={{
          color: paleta.textoSobreEscuro,
          fontSize: TAMANHO_MINIMO_TEXTO,
          lineHeight: '18px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: paleta.branco, fontFamily: FAMILIA_TITULO, fontWeight: 600 }}>
          PapelHub
        </span>
        {/* Descritor: constante do produto, não varia por implantação. O
            separador é decorativo e não é anunciado. */}
        <span aria-hidden> · </span>
        <span>Gestão de Documentos</span>
      </div>
    </div>
  );
}
