import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { CANONICAL_MANUAL_URL, resolveManualUrl } from '../config.js';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Resolução do endereço do manual (change corrige-alcance-do-manual,
 * design.md D1, D2, D5) — a duplicação entre a constante da aplicação e
 * `docs/manual/mkdocs.yml` é deliberada (design.md D1: a imagem da API não
 * carrega `docs/`, e derivar em build colidiria com o allowlist docs-only
 * do deploy.yml); este teste é o mecanismo que a impede de divergir em
 * silêncio.
 */
describe('Endereço canônico do manual (config.ts, corrige-alcance-do-manual)', () => {
  it('é igual ao site_url declarado em docs/manual/mkdocs.yml', () => {
    const mkdocsYml = readFileSync(join(REPO_ROOT, 'docs/manual/mkdocs.yml'), 'utf-8');
    const match = mkdocsYml.match(/^site_url:\s*(\S+)\s*$/m);
    expect(match).not.toBeNull();
    expect(CANONICAL_MANUAL_URL).toBe(match![1]);
  });
});

// design.md D5: a resolução é exercida como função pura, com entradas
// explícitas, e não através do singleton `config` (que já leu
// `process.env` no carregamento do módulo — testá-lo não teria detectado a
// falha original, porque o valor injetado era o próprio valor comparado).
describe('resolveManualUrl (design.md D2, D5)', () => {
  it('variável ausente (undefined) resolve para o endereço canônico', () => {
    expect(resolveManualUrl(undefined)).toBe(CANONICAL_MANUAL_URL);
  });

  it('variável declarada vazia resolve para o endereço canônico', () => {
    expect(resolveManualUrl('')).toBe(CANONICAL_MANUAL_URL);
  });

  it('variável preenchida resolve para o valor configurado', () => {
    const custom = 'https://manual.example.org/gdoc/';
    expect(resolveManualUrl(custom)).toBe(custom);
  });
});
