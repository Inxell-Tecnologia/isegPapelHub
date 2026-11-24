import { ConfigProvider } from 'antd';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNarrowMode } from '../app/responsive';
import { mockViewportWidth, NARROW_VIEWPORT, WIDE_VIEWPORT } from './viewport';

/**
 * Trava do requisito "A primeira composição já está na forma correta"
 * (`web-responsividade`, change `modo-estreito-no-primeiro-render`).
 *
 * As asserções são sobre a **sequência de renders**, não sobre o DOM final: o
 * DOM final já estava correto antes do change — era o primeiro render que saía
 * na forma larga —, e é justamente por isso que nenhum outro teste da suíte
 * pega esta regressão.
 */
function sonda() {
  const vereditos: boolean[] = [];

  function Sonda() {
    vereditos.push(useNarrowMode());
    return null;
  }

  function montar() {
    render(
      <ConfigProvider>
        <Sonda />
      </ConfigProvider>,
    );
    return vereditos;
  }

  return { montar };
}

describe('Veredito do modo estreito no primeiro render (web-responsividade)', () => {
  it('em tela estreita o primeiro render já responde estreito', () => {
    mockViewportWidth(NARROW_VIEWPORT);

    const vereditos = sonda().montar();

    expect(vereditos[0]).toBe(true);
  });

  it('em tela larga o primeiro render já responde largo', () => {
    mockViewportWidth(WIDE_VIEWPORT);

    const vereditos = sonda().montar();

    expect(vereditos[0]).toBe(false);
  });

  // design.md D4: a consulta derivada do token tem de concordar com o limiar do
  // design system nas duas bordas. Uma consulta divergente apareceria como
  // veredito que muda sozinho entre o primeiro render e os seguintes.
  it.each([
    { largura: 991, estreito: true },
    { largura: 992, estreito: false },
  ])(
    'na borda de $largura px o veredito é $estreito e não muda sozinho',
    ({ largura, estreito }) => {
      mockViewportWidth(largura);

      const vereditos = sonda().montar();

      expect(vereditos[0]).toBe(estreito);
      expect(new Set(vereditos)).toEqual(new Set([estreito]));
    },
  );

  // design.md D2: ambiente sem `matchMedia` degrada em desempenho, nunca em
  // funcionamento — responde a forma larga, como antes deste change.
  it('sem `matchMedia` no ambiente, responde a forma larga em vez de lançar', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    const vereditos = sonda().montar();

    expect(vereditos[0]).toBe(false);
  });
});
