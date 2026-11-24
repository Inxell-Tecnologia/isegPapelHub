import { describe, expect, it } from 'vitest';
import { textoDaContagemDeDocumentos, tomDaPasta } from '../inicio/cartao-de-pasta';
import { tonsDeAtalho } from '../app/theme';

/**
 * Change `contagem-de-documentos-nas-pastas`, design.md D5 (`tela-inicial`,
 * "Cartão de pasta apresenta ícone colorido e o número de documentos").
 */
describe('Cartão de pasta (contagem-de-documentos-nas-pastas)', () => {
  it('texto da contagem: nenhum, singular, plural com milhar pt-BR', () => {
    expect(textoDaContagemDeDocumentos(0)).toBe('Nenhum documento');
    expect(textoDaContagemDeDocumentos(1)).toBe('1 documento');
    expect(textoDaContagemDeDocumentos(12)).toBe('12 documentos');
    expect(textoDaContagemDeDocumentos(1234)).toBe('1.234 documentos');
  });

  it('contagem desconhecida não vira zero', () => {
    expect(textoDaContagemDeDocumentos(undefined)).toBeNull();
  });

  it('tom estável por id, sempre um dos tons com contraste apurado', () => {
    const ids = ['folder-1', 'folder-2', '0b6c2f1e-9a1d-4c55-8a3e-7f0b0c1d2e3f', ''];
    for (const id of ids) {
      expect(tomDaPasta(id)).toBe(tomDaPasta(id));
      expect(Object.keys(tonsDeAtalho)).toContain(tomDaPasta(id));
    }
  });

  it('pastas diferentes podem ter tons diferentes', () => {
    const tons = new Set(['a', 'b', 'c', 'd'].map(tomDaPasta));
    expect(tons.size).toBe(4);
  });
});
