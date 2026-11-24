/**
 * Ativos da marca (change `identidade-isetes-e-menu-compacto`, design.md D3).
 *
 * A logo **branca** do Instituto SETES e o símbolo isolado têm fundo
 * transparente — a moldura escura que o ativo anterior exigia
 * (`logo-papelhub.jpg`, retrato e sem transparência) deixa de existir. Em
 * troca, a logo branca só é apresentada sobre os fundos escuros da marca: o
 * degradê da navegação e o campo escuro do login (`identidade-visual`,
 * "Logomarca oficial é exibida na tela de login e no shell expandido").
 *
 * O caminho e o **nome acessível** de cada variante vivem juntos aqui: a logo
 * tem "INSTITUTO SETES" escrito — se o ativo mudar, o `alt` muda no mesmo
 * lugar, em vez de mentir em outro arquivo.
 */
export const ATIVOS_DA_MARCA = {
  /** 300×128 servidos para 150×64 exibidos (2×). */
  logo: { src: '/isetes-logo-branca.png', proporcao: 300 / 128, nome: 'Instituto SETES' },
  /** 203×400 servidos; exibido até 200 px de altura (marca d'água). */
  simbolo: { src: '/isetes-simbolo.png', proporcao: 203 / 400, nome: 'PapelHub' },
} as const;

export type VarianteDaMarca = keyof typeof ATIVOS_DA_MARCA;

interface BrandMarkProps {
  variante: VarianteDaMarca;
  height: number;
  /**
   * `true`: a imagem carrega o nome acessível da variante (logo → organização,
   * no shell; símbolo → produto, no colapsado). Ausente: decorativa
   * (`alt=""`), como no login, onde o heading e a identificação do cliente já
   * estão em texto.
   */
  informativa?: boolean;
}

export function BrandMark({ variante, height, informativa = false }: BrandMarkProps) {
  const ativo = ATIVOS_DA_MARCA[variante];
  return (
    <img
      src={ativo.src}
      alt={informativa ? ativo.nome : ''}
      width={Math.round(height * ativo.proporcao)}
      height={height}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}
