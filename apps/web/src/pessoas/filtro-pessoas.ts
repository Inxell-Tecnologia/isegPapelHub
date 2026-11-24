import type { PersonResponse } from '@gdoc/shared';

/**
 * Normalização do texto da busca de colaboradores (change
 * `busca-de-colaboradores`, design.md D2): sem acentos, sem distinção de
 * maiúsculas e sem espaços nas pontas — "João" e "joao" casam.
 */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

/**
 * Recorte da listagem de pessoas pelo termo digitado (design.md D1/D2): filtra
 * no cliente o que `GET /users` já entregou — nunca amplia o alcance, que
 * segue decidido no servidor. Casa por trecho em nome, e-mail, função/cargo,
 * setor e, quando `nomeDaUnidade` é informado (só o global_admin vê a coluna),
 * no nome da unidade. Termo vazio devolve a lista intacta.
 */
export function filtrarPessoas(
  pessoas: readonly PersonResponse[],
  termo: string,
  nomeDaUnidade?: (unitId: string) => string | undefined,
): PersonResponse[] {
  const alvo = normalizarBusca(termo);
  if (alvo === '') return [...pessoas];
  return pessoas.filter((pessoa) => {
    const campos = [
      pessoa.fullName,
      pessoa.email,
      pessoa.jobTitle,
      pessoa.sectorName,
      nomeDaUnidade?.(pessoa.unitId),
    ];
    return campos.some((campo) => campo != null && normalizarBusca(campo).includes(alvo));
  });
}
