import { describe, expect, it } from 'vitest';
import { UPLOAD_SLICE_MAX_ITEMS_DEFAULT } from '@gdoc/shared';
import {
  fatiarEnvio,
  formatarBytes,
  somarBytes,
  subconjuntoQueCabe,
  type SelectedFile,
} from '../upload/slicing';

const MEGA = 1024 * 1024;

/** `File.size` é metadado; forjá-lo exercita os tetos sem alocar bytes. */
function item(nome: string, tamanho: number, relativePath?: string): SelectedFile {
  const file = new File(['x'], nome, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: tamanho, configurable: true });
  return { file, relativePath };
}

describe('Fatiamento do envio (design.md D5)', () => {
  it('fecha a fatia pelo teto de itens quando os arquivos são pequenos', () => {
    const selecao = Array.from({ length: 450 }, (_, i) => item(`f${i}.txt`, 1024));
    const fatias = fatiarEnvio(selecao);

    expect(fatias.map((f) => f.length)).toEqual([
      UPLOAD_SLICE_MAX_ITEMS_DEFAULT,
      UPLOAD_SLICE_MAX_ITEMS_DEFAULT,
      50,
    ]);
  });

  it('fecha a fatia pelo teto de BYTES antes do de itens, quando os arquivos são pesados', () => {
    // 10 arquivos de 120 MB: 4 por fatia (480 MB), porque o quinto passaria
    // dos 500 MB — muito antes dos 200 itens.
    const selecao = Array.from({ length: 10 }, (_, i) => item(`pesado${i}.bin`, 120 * MEGA));
    const fatias = fatiarEnvio(selecao);

    expect(fatias.map((f) => f.length)).toEqual([4, 4, 2]);
    for (const fatia of fatias) {
      expect(somarBytes(fatia)).toBeLessThanOrEqual(500 * MEGA);
      expect(fatia.length).toBeLessThan(UPLOAD_SLICE_MAX_ITEMS_DEFAULT);
    }
  });

  it('arquivo maior que o teto de bytes vira uma fatia só dele, sem ser recusado', () => {
    // Recusar seria inventar um limite que o servidor não impõe: quem decide
    // se ele cabe é a cota.
    const selecao = [
      item('pequeno.txt', 1024),
      item('gigante.bin', 900 * MEGA),
      item('outro.txt', 1024),
    ];
    const fatias = fatiarEnvio(selecao);

    expect(fatias.map((f) => f.map((s) => s.file.name))).toEqual([
      ['pequeno.txt'],
      ['gigante.bin'],
      ['outro.txt'],
    ]);
  });

  it('seleção vazia não produz fatia alguma', () => {
    expect(fatiarEnvio([])).toEqual([]);
  });
});

describe('Subconjunto que cabe (design.md D4)', () => {
  it('leva o prefixo da ordem de travessia e devolve o resto identificado', () => {
    const selecao = [
      item('a.bin', 100 * MEGA),
      item('b.bin', 100 * MEGA),
      item('c.bin', 100 * MEGA),
    ];

    const { cabem, deFora } = subconjuntoQueCabe(selecao, 250 * MEGA);

    expect(cabem.map((s) => s.file.name)).toEqual(['a.bin', 'b.bin']);
    expect(deFora.map((s) => s.file.name)).toEqual(['c.bin']);
  });

  it('nenhum arquivo é partido: um item maior que o disponível fica inteiro de fora', () => {
    const selecao = [item('grande.bin', 300 * MEGA), item('cabe.txt', 1024)];

    const { cabem, deFora } = subconjuntoQueCabe(selecao, 100 * MEGA);

    // O critério é prefixo: o corte é no primeiro que não cabe, e o que vem
    // depois dele não é "garimpado" — previsibilidade acima de aproveitamento.
    expect(cabem).toEqual([]);
    expect(deFora.map((s) => s.file.name)).toEqual(['grande.bin', 'cabe.txt']);
  });

  it('sem espaço disponível, nada cabe', () => {
    const { cabem, deFora } = subconjuntoQueCabe([item('a.txt', 1)], 0);
    expect(cabem).toEqual([]);
    expect(deFora).toHaveLength(1);
  });
});

describe('Formatação de volume', () => {
  it('escala a unidade e mostra uma casa a partir de KB', () => {
    expect(formatarBytes(0)).toBe('0 B');
    expect(formatarBytes(512)).toBe('512 B');
    expect(formatarBytes(1536)).toBe('1.5 KB');
    expect(formatarBytes(3 * 1024 * 1024 * 1024)).toBe('3.0 GB');
  });
});
