/**
 * Ativos da marca (change `identidade-isetes-e-menu-compacto`, design.md D3;
 * ativos do ISEG pela change `sync-upstream-identidade-iseg`, design.md D3 e
 * D4).
 *
 * Os ativos são **derivados** das artes do cliente por
 * `docs/images/iseg/derivar_marca.py` — não se editam à mão. Fundo
 * transparente: nenhuma variante tem moldura própria.
 *
 * A logo e o símbolo **negativos** (sigla e texto institucional em branco,
 * degradê turquesa → laranja preservado) só vão sobre os fundos escuros da
 * marca — o degradê da navegação e o campo escuro do login
 * (`identidade-visual`, "Logomarca oficial é exibida na tela de login e no
 * shell expandido"). Sobre fundo claro vai o símbolo **colorido**
 * (`simboloSobreClaro`): o negativo ali teria a sigla branca sobre claro.
 *
 * O caminho e o **nome acessível** de cada variante vivem juntos aqui: a logo
 * tem "ISEG" e "INSTITUTO DE SOLUÇÕES ESTRATÉGICAS EM GESTÃO" escritos — se o
 * ativo mudar, o `alt` muda no mesmo lugar, em vez de mentir em outro arquivo.
 */
export const ATIVOS_DA_MARCA = {
  /** 319×144 servidos; exibida até 72 px de altura (login) — 2×. */
  logo: {
    src: '/iseg-logo-negativa.png',
    proporcao: 319 / 144,
    nome: 'ISEG — Instituto de Soluções Estratégicas em Gestão',
  },
  /** 400×400 servidos; navegação colapsada e marca d'água da navegação (fundo escuro). */
  simbolo: { src: '/iseg-simbolo-negativo.png', proporcao: 400 / 400, nome: 'PapelHub' },
  /** 400×400 servidos; marca d'água da área principal (fundo claro), até 560 px de altura. */
  simboloSobreClaro: { src: '/iseg-simbolo-cor.png', proporcao: 400 / 400, nome: 'PapelHub' },
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
