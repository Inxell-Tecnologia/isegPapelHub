import { describe, expect, it } from 'vitest';
import { PersonStatus, UserRole } from '@gdoc/shared';
import type { PersonResponse } from '@gdoc/shared';
import { filtrarPessoas, normalizarBusca } from '../pessoas/filtro-pessoas';

function person(overrides: Partial<PersonResponse> & { id: string }): PersonResponse {
  return {
    unitId: 'unit-1',
    fullName: null,
    email: `${overrides.id}@example.com`,
    phone: null,
    jobTitle: null,
    sectorId: null,
    sectorName: null,
    notes: null,
    role: UserRole.COLLABORATOR,
    status: PersonStatus.ACTIVE,
    createdAt: '2026-01-01T00:00:00.000Z',
    storageUsedBytes: 0,
    storageQuotaBytes: null,
    ...overrides,
  };
}

const joao = person({
  id: 'joao',
  fullName: 'João Pereira',
  jobTitle: 'Analista de Qualidade',
  sectorName: 'Farmácia',
  unitId: 'unit-a',
});
const maria = person({ id: 'maria', fullName: 'Maria Souza', email: 'msouza@example.com' });
const semNome = person({ id: 'sem-nome' });
const todos = [joao, maria, semNome];
const ids = (lista: PersonResponse[]) => lista.map((p) => p.id);

describe('filtro de colaboradores (change busca-de-colaboradores, design.md D2)', () => {
  it('normaliza acento, caixa e espaços nas pontas', () => {
    expect(normalizarBusca('  ÉÇÃo Joaõ ')).toBe('ecao joao');
  });

  it('termo vazio ou só espaços devolve a lista intacta', () => {
    expect(ids(filtrarPessoas(todos, ''))).toEqual(['joao', 'maria', 'sem-nome']);
    expect(ids(filtrarPessoas(todos, '   '))).toEqual(['joao', 'maria', 'sem-nome']);
  });

  it('casa por trecho do nome, ignorando acento e caixa', () => {
    expect(ids(filtrarPessoas(todos, 'JOAO'))).toEqual(['joao']);
    expect(ids(filtrarPessoas(todos, 'pereira'))).toEqual(['joao']);
  });

  it('casa por e-mail, função/cargo e setor; campos nulos não quebram', () => {
    expect(ids(filtrarPessoas(todos, 'msouza'))).toEqual(['maria']);
    expect(ids(filtrarPessoas(todos, 'qualidade'))).toEqual(['joao']);
    expect(ids(filtrarPessoas(todos, 'farmacia'))).toEqual(['joao']);
    expect(ids(filtrarPessoas(todos, 'sem-nome@'))).toEqual(['sem-nome']);
  });

  it('nome da unidade só é pesquisado quando a função é informada', () => {
    const nomeDaUnidade = (id: string) => (id === 'unit-a' ? 'Unidade Itabuna' : undefined);
    expect(ids(filtrarPessoas(todos, 'itabuna'))).toEqual([]);
    expect(ids(filtrarPessoas(todos, 'itabuna', nomeDaUnidade))).toEqual(['joao']);
  });

  it('sem correspondência devolve lista vazia', () => {
    expect(filtrarPessoas(todos, 'inexistente')).toEqual([]);
  });
});
