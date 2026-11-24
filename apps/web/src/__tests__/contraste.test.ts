import { describe, expect, it } from 'vitest';
import {
  PISO_CONTRASTE_AAA,
  PISO_CONTRASTE_CONTROLE,
  PISO_CONTRASTE_TEXTO,
  atendeAoPiso,
  luminanciaRelativa,
  razaoDeContraste,
} from '../app/contrast';
import {
  ALTURA_MINIMA_ACIONAMENTO,
  ESTILO_GLOBAL,
  TAMANHO_MINIMO_TEXTO,
  paleta,
  theme,
  tonsDeAtalho,
  tonsDeEstado,
  tonsDeTipoDocumental,
} from '../app/theme';
import { DOCUMENT_TYPES } from '@gdoc/shared';
import { LOGIN_BACKGROUND_COLOR } from '../auth/LoginPage';
import {
  COR_MAIS_CLARA_DO_SIMBOLO,
  OPACIDADE_MARCA_DAGUA_NAVEGACAO,
} from '../shell/MarcaDaguaDaNavegacao';
import {
  COR_MAIS_ESCURA_DO_SIMBOLO,
  OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL,
} from '../shell/MarcaDaguaDaAreaPrincipal';

describe('Razão de contraste (sistema-de-design, apuração por cálculo)', () => {
  it('é 21:1 entre preto e branco e 1:1 entre a cor e ela mesma', () => {
    expect(razaoDeContraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(razaoDeContraste(paleta.verdeMarca, paleta.verdeMarca)).toBeCloseTo(1, 10);
  });

  it('é simétrica — a ordem dos argumentos não altera o veredito', () => {
    expect(razaoDeContraste(paleta.texto, paleta.superficie)).toBeCloseTo(
      razaoDeContraste(paleta.superficie, paleta.texto),
      10,
    );
  });

  it('aceita a forma curta de três dígitos e recusa hexadecimal inválido', () => {
    expect(razaoDeContraste('#fff', '#ffffff')).toBeCloseTo(1, 10);
    expect(() => razaoDeContraste('verde', '#ffffff')).toThrow(/inválida/);
  });

  it('calcula a luminância relativa do branco e do preto conforme o WCAG', () => {
    expect(luminanciaRelativa('#ffffff')).toBeCloseTo(1, 10);
    expect(luminanciaRelativa('#000000')).toBeCloseTo(0, 10);
  });

  // Tabela da decisão D2/D3 do design.md desta change, verificada valor a
  // valor: se um token mudar, é aqui que a mudança aparece antes de chegar à
  // tela.
  it.each([
    ['branco sobre o verde de ação', paleta.branco, paleta.verdeAcao, 5.37],
    ['branco sobre o verde da marca', paleta.branco, paleta.verdeMarca, 2.21],
    ['texto sobre o verde da marca', paleta.texto, paleta.verdeMarca, 7.77],
    ['branco sobre o topo do degradê', paleta.branco, paleta.marinhoEscuro, 15.76],
    ['branco sobre a base do degradê', paleta.branco, paleta.marinhoClaro, 8.16],
    ['texto sobre a superfície', paleta.texto, paleta.superficie, 15.92],
    ['texto de apoio sobre a superfície', paleta.textoApoio, paleta.superficie, 5.85],
    ['link sobre branco', paleta.azulLink, paleta.branco, 8.06],
    [
      'texto de apoio sobre o topo do degradê',
      paleta.textoSobreEscuro,
      paleta.marinhoEscuro,
      10.58,
    ],
    ['texto de apoio sobre a base do degradê', paleta.textoSobreEscuro, paleta.marinhoClaro, 5.48],
    ['borda de controle sobre branco', paleta.bordaControle, paleta.branco, 3.57],
    ['borda de controle sobre a superfície', paleta.bordaControle, paleta.superficie, 3.31],
    ['borda decorativa sobre branco', paleta.bordaDecorativa, paleta.branco, 1.27],
    // Avatar de identidade (change `menu-lateral-e-barra-superior`, design.md D7)
    ['iniciais escuras sobre o avatar', paleta.texto, paleta.azulAvatar, 11.12],
    ['branco sobre o avatar — par RECUSADO', paleta.branco, paleta.azulAvatar, 1.54],
    ['avatar sobre a base do degradê', paleta.azulAvatar, paleta.marinhoClaro, 5.29],
  ])('%s mede %s:1, como apurado no design', (_nome, a, b, esperado) => {
    expect(razaoDeContraste(a as string, b as string)).toBeCloseTo(esperado as number, 2);
  });
});

describe('Piso de acessibilidade dos tokens (sistema-de-design)', () => {
  // Pares de texto normatizados: todos têm de alcançar 4,5:1. Acrescentar
  // uma cor de texto aos tokens sem acrescentá-la aqui deixa o piso sem
  // guarda — por isso a lista é parte do contrato, não conveniência do teste.
  it.each([
    ['rótulo do botão principal', paleta.branco, paleta.verdeAcao],
    ['rótulo do item de navegação ativo', paleta.texto, paleta.verdeMarca],
    ['rótulo sobre o topo do degradê', paleta.branco, paleta.marinhoEscuro],
    ['rótulo sobre a base do degradê', paleta.branco, paleta.marinhoClaro],
    ['texto corrente sobre a superfície', paleta.texto, paleta.superficie],
    ['texto corrente sobre o cartão', paleta.texto, paleta.branco],
    ['texto de apoio sobre a superfície', paleta.textoApoio, paleta.superficie],
    ['texto de apoio sobre o cartão', paleta.textoApoio, paleta.branco],
    ['link sobre o cartão', paleta.azulLink, paleta.branco],
    ['link sobre a superfície', paleta.azulLink, paleta.superficie],
    ['identificação do cliente no topo do degradê', paleta.textoSobreEscuro, paleta.marinhoEscuro],
    ['identificação do cliente na base do degradê', paleta.textoSobreEscuro, paleta.marinhoClaro],
    ['iniciais do avatar de identidade', paleta.texto, paleta.azulAvatar],
  ])('%s atende ao mínimo de 4,5:1', (_nome, texto, fundo) => {
    expect(atendeAoPiso(texto as string, fundo as string, PISO_CONTRASTE_TEXTO)).toBe(true);
  });

  /**
   * O requisito "Superfície de avatar carrega texto escuro" não se contenta
   * com "o par adotado passa": ele **nomeia** o par recusado. O `Avatar` do
   * design system escreve em branco por padrão, de modo que adotar a cor sem
   * fixar a das iniciais entregaria 1,54:1 — é a mesma armadilha que o guia do
   * cliente já trouxe no verde da marca, e travá-la aqui é o que impede alguém
   * de "simplificar" o estilo do avatar mais tarde.
   */
  it('o branco é recusado por cálculo como texto do avatar (design.md D7)', () => {
    expect(atendeAoPiso(paleta.branco, paleta.azulAvatar, PISO_CONTRASTE_TEXTO)).toBe(false);
    expect(atendeAoPiso(paleta.texto, paleta.azulAvatar, PISO_CONTRASTE_TEXTO)).toBe(true);
  });

  it('a superfície do avatar se distingue do fundo da navegação (piso de 3:1)', () => {
    expect(atendeAoPiso(paleta.azulAvatar, paleta.marinhoClaro, PISO_CONTRASTE_CONTROLE)).toBe(
      true,
    );
    expect(atendeAoPiso(paleta.azulAvatar, paleta.marinhoEscuro, PISO_CONTRASTE_CONTROLE)).toBe(
      true,
    );
  });

  it('a borda de controle atende ao mínimo de 3:1 nas duas superfícies (design.md D3)', () => {
    expect(atendeAoPiso(paleta.bordaControle, paleta.branco, PISO_CONTRASTE_CONTROLE)).toBe(true);
    expect(atendeAoPiso(paleta.bordaControle, paleta.superficie, PISO_CONTRASTE_CONTROLE)).toBe(
      true,
    );
  });

  it('o fundo da tela de login atende ao nível AAA com branco (identidade-visual)', () => {
    expect(atendeAoPiso(LOGIN_BACKGROUND_COLOR, paleta.branco, PISO_CONTRASTE_AAA)).toBe(true);
  });

  // Reprovação deliberada: o desenho de referência do cliente pinta o item
  // ativo com rótulo **branco** sobre o verde da marca. Este caso registra
  // por que a implementação divergiu (design.md D2) — se alguém "corrigir" a
  // cor do rótulo para branco, o par passa a reprovar aqui.
  it('o verde da marca reprova como fundo de texto branco, e por isso não o recebe', () => {
    expect(atendeAoPiso(paleta.branco, paleta.verdeMarca, PISO_CONTRASTE_TEXTO)).toBe(false);
    expect(theme.components?.Menu?.darkItemSelectedColor).toBe(paleta.texto);
    expect(theme.components?.Menu?.darkItemSelectedBg).toBe(paleta.verdeMarca);
  });

  /**
   * Rótulo de grupo da navegação (change `menu-lateral-e-barra-superior`,
   * design.md D2). O padrão do design system para o título de grupo no menu
   * escuro é um branco translúcido — da mesma natureza do branco a 65% que
   * esta base de código já teve de substituir por reprovar no piso. O token
   * explícito é o que mantém o rótulo acima de 4,5:1 nos dois extremos do
   * degradê; sem este caso, voltar ao padrão passaria sem ruído.
   */
  it('o rótulo de grupo da navegação usa o tom opaco, acima do piso nos dois extremos', () => {
    expect(theme.components?.Menu?.darkGroupTitleColor).toBe(paleta.textoSobreEscuro);
    expect(atendeAoPiso(paleta.textoSobreEscuro, paleta.marinhoEscuro, PISO_CONTRASTE_TEXTO)).toBe(
      true,
    );
    expect(atendeAoPiso(paleta.textoSobreEscuro, paleta.marinhoClaro, PISO_CONTRASTE_TEXTO)).toBe(
      true,
    );
  });

  /**
   * "Itens compactos" da demanda nº 2 (seção 1.1) **não** autoriza descer do
   * piso de acionamento: compactar é reduzir folga, nunca o alvo de toque
   * (design.md D8). A altura do item é declarada no piso em vez de derivada de
   * `controlHeightLG`, que o design system calcula como `controlHeight` × 1,25.
   */
  it('a altura do item de navegação é declarada no piso de acionamento, não derivada', () => {
    expect(theme.components?.Menu?.itemHeight).toBe(ALTURA_MINIMA_ACIONAMENTO);
    expect(theme.token?.controlHeight).toBe(ALTURA_MINIMA_ACIONAMENTO);
  });

  // A borda decorativa é clara de propósito (1,27:1) — não carrega
  // informação. O que a spec proíbe é usá-la como contorno de controle.
  it('a borda decorativa não é promovida a contorno de controle', () => {
    expect(atendeAoPiso(paleta.bordaDecorativa, paleta.branco, PISO_CONTRASTE_CONTROLE)).toBe(
      false,
    );
    expect(theme.token?.colorBorder).toBe(paleta.bordaControle);
    expect(theme.token?.colorBorderSecondary).toBe(paleta.bordaDecorativa);
  });

  // Os presets de cor do design system reprovam aqui — verde 3,37:1 e
  // laranja 3,34:1 —, e é por isso que os rótulos de estado passaram a tons
  // próprios (tasks 7.1). Este caso é o que impede um retorno silencioso aos
  // presets.
  it.each(Object.entries(tonsDeEstado))(
    'o tom de estado "%s" atende ao mínimo de 4,5:1 sobre o próprio fundo',
    (_nome, tom) => {
      expect(atendeAoPiso(tom.texto, tom.fundo, PISO_CONTRASTE_TEXTO)).toBe(true);
    },
  );

  // Épico 10: os tons de tipo documental entram no mesmo regime dos tons de
  // estado — a sigla é texto sobre o fundo do tipo, logo é par de **texto** e
  // tem piso de 4,5:1. Acrescentar um tipo sem acrescentá-lo aqui deixa o
  // piso sem guarda, que é justamente o que esta tabela existe para impedir.
  it.each(Object.entries(tonsDeTipoDocumental))(
    'o tom do tipo documental "%s" atende ao mínimo de 4,5:1 sobre o próprio fundo',
    (_nome, tom) => {
      expect(atendeAoPiso(tom.texto, tom.fundo, PISO_CONTRASTE_TEXTO)).toBe(true);
    },
  );

  it('há um tom por tipo documental — nenhum tipo fica sem cor, nenhuma cor sobra', () => {
    expect(Object.keys(tonsDeTipoDocumental).sort()).toEqual([...DOCUMENT_TYPES].sort());
  });

  // A borda do rótulo de estado é **decorativa**: o rótulo não é controle, e
  // quem carrega a informação é o texto, apurado acima. O piso de 3:1 da
  // decisão D3 vale para o contorno que identifica um **controle** — campo,
  // caixa de seleção —, não para a moldura de um chip.

  // Anel de foco (ESTILO_GLOBAL): indicador não textual, piso de 3:1 contra
  // a superfície adjacente. Nenhuma cor única alcança o piso sobre o claro e
  // sobre o escuro ao mesmo tempo — por isso são duas, uma por superfície.
  it('o anel de foco é distinguível em ambas as superfícies', () => {
    expect(atendeAoPiso(paleta.azulLink, paleta.branco, PISO_CONTRASTE_CONTROLE)).toBe(true);
    expect(atendeAoPiso(paleta.azulLink, paleta.superficie, PISO_CONTRASTE_CONTROLE)).toBe(true);
    expect(atendeAoPiso(paleta.verdeMarca, paleta.marinhoEscuro, PISO_CONTRASTE_CONTROLE)).toBe(
      true,
    );
    expect(atendeAoPiso(paleta.verdeMarca, paleta.marinhoClaro, PISO_CONTRASTE_CONTROLE)).toBe(
      true,
    );
  });

  it('a folha global declara o anel de foco para link, que o design system deixa sem', () => {
    expect(ESTILO_GLOBAL).toContain('a:focus-visible');
    expect(ESTILO_GLOBAL).toContain(paleta.azulLink);
    expect(ESTILO_GLOBAL).toContain(paleta.verdeMarca);
  });

  it('a folha global eleva o alvo de toque da caixa de seleção ao piso', () => {
    expect(ESTILO_GLOBAL).toContain(`min-height: ${ALTURA_MINIMA_ACIONAMENTO}px`);
  });

  it('o botão principal usa o verde de ação, não o verde da marca', () => {
    expect(theme.token?.colorPrimary).toBe(paleta.verdeAcao);
  });

  it('nenhum tamanho de texto dos tokens fica abaixo do piso legível', () => {
    expect(TAMANHO_MINIMO_TEXTO).toBeGreaterThanOrEqual(13);
    expect(theme.token?.fontSizeSM).toBe(TAMANHO_MINIMO_TEXTO);
    expect(theme.token?.fontSize).toBeGreaterThanOrEqual(TAMANHO_MINIMO_TEXTO);
  });

  it('a área de acionamento dos controles respeita o piso de 44px, inclusive no tamanho pequeno', () => {
    expect(ALTURA_MINIMA_ACIONAMENTO).toBeGreaterThanOrEqual(44);
    expect(theme.token?.controlHeight).toBeGreaterThanOrEqual(ALTURA_MINIMA_ACIONAMENTO);
    expect(theme.token?.controlHeightSM).toBeGreaterThanOrEqual(ALTURA_MINIMA_ACIONAMENTO);
  });
});

/**
 * Mistura `frente` sobre `fundo` com a opacidade dada, canal a canal — é a
 * cor que o texto vê quando passa sobre a marca d'água.
 */
function misturar(frente: string, fundo: string, opacidade: number): string {
  const canais = (cor: string) => [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
  const [f, b] = [canais(frente), canais(fundo)];
  return (
    '#' +
    f
      .map((v, i) => Math.round(v * opacidade + (b[i] ?? 0) * (1 - opacidade)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

describe("Marca d'água da navegação (identidade-isetes-e-menu-compacto, design.md D6)", () => {
  // Pior caso: o pixel mais luminoso do símbolo sobre a base do degradê, que é
  // o trecho mais claro da coluna, contra o texto mais fraco da navegação.
  const fundoSobAMarca = (opacidade: number) =>
    misturar(COR_MAIS_CLARA_DO_SIMBOLO, paleta.marinhoClaro, opacidade);

  it('na opacidade adotada, o texto da navegação mantém o piso de 4,5:1', () => {
    const fundo = fundoSobAMarca(OPACIDADE_MARCA_DAGUA_NAVEGACAO);
    expect(atendeAoPiso(paleta.textoSobreEscuro, fundo, PISO_CONTRASTE_TEXTO)).toBe(true);
    expect(atendeAoPiso(paleta.branco, fundo, PISO_CONTRASTE_TEXTO)).toBe(true);
  });

  it('os 14% da demanda nº 2 reprovariam o piso — o teto não é arbitrário', () => {
    expect(atendeAoPiso(paleta.textoSobreEscuro, fundoSobAMarca(0.14), PISO_CONTRASTE_TEXTO)).toBe(
      false,
    );
  });
});

describe('Orçamento de altura da navegação (identidade-isetes-e-menu-compacto, design.md D1)', () => {
  it('compacta a folga entre itens, nunca o alvo de 44 px', () => {
    const menu = theme.components?.Menu;
    expect(menu?.itemHeight).toBe(ALTURA_MINIMA_ACIONAMENTO);
    expect(menu?.itemMarginBlock).toBe(0);
  });
});

describe("Marca d'água da área principal (marca-dagua-e-inicio-rodada-3, design.md D1)", () => {
  // Fundo claro: o símbolo **escurece** o fundo, então o pior caso é o pixel
  // mais escuro do símbolo sobre a superfície, contra os textos que aparecem
  // direto sobre ela.
  const fundoSobAMarca = (opacidade: number) =>
    misturar(COR_MAIS_ESCURA_DO_SIMBOLO, paleta.superficie, opacidade);
  const textos = [paleta.textoApoio, paleta.texto, paleta.azulLink, paleta.verdeAcao];

  it('é a opacidade pedida pelo cliente (6%)', () => {
    expect(OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL).toBe(0.06);
  });

  it('na opacidade adotada, todo texto sobre o fundo mantém o piso de 4,5:1', () => {
    const fundo = fundoSobAMarca(OPACIDADE_MARCA_DAGUA_AREA_PRINCIPAL);
    for (const texto of textos) {
      expect(atendeAoPiso(texto, fundo, PISO_CONTRASTE_TEXTO)).toBe(true);
    }
  });

  it('a 10% o verde de ação reprovaria — o teto não é arbitrário', () => {
    expect(atendeAoPiso(paleta.verdeAcao, fundoSobAMarca(0.1), PISO_CONTRASTE_TEXTO)).toBe(false);
  });
});

describe('Tokens da rodada 3 (marca-dagua-e-inicio-rodada-3, design.md D3, D5 e D7)', () => {
  it('o número branco sobre o vermelho do sino atende ao piso; o padrão do design system não', () => {
    expect(atendeAoPiso(paleta.branco, paleta.vermelhoIndicador, PISO_CONTRASTE_TEXTO)).toBe(true);
    expect(atendeAoPiso(paleta.branco, '#FF4D4F', PISO_CONTRASTE_TEXTO)).toBe(false);
  });

  it('cada ícone de atalho se distingue do seu quadrado tingido (elemento gráfico, 3:1)', () => {
    for (const { icone, fundo } of Object.values(tonsDeAtalho)) {
      expect(atendeAoPiso(icone, fundo, PISO_CONTRASTE_CONTROLE)).toBe(true);
    }
  });

  it('o texto do convite ao tour atende ao piso sobre o fundo azul-claro', () => {
    expect(
      atendeAoPiso(paleta.azulLink, tonsDeEstado.informativo.fundo, PISO_CONTRASTE_TEXTO),
    ).toBe(true);
  });
});
