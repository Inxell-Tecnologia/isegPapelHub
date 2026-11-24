import type { AuthenticatedIdentity } from '@gdoc/shared';
import { ROLE_LABEL } from './role-label';

/**
 * Origem única da identidade **apresentada** (capability `web-shell-e-auth`,
 * requisito "Shell de layout com identidade e navegação"; change
 * `shell-e-inicio`).
 *
 * Existe porque o shell apresentava, como identidade da pessoa, os dois
 * primeiros caracteres do seu identificador interno — rótulos como "66 /
 * Colaborador". O requisito proíbe o identificador e qualquer fragmento dele
 * em todo o shell, e a regra de "o que mostrar quando não há nome" precisa
 * ser a mesma no cabeçalho e na tela inicial, senão uma das duas inventa um
 * tratamento próprio.
 */

/** Nome a apresentar, ou `null` quando a conta não tem nome cadastrado. */
export function nomeExibido(identity: AuthenticatedIdentity): string | null {
  const nome = identity.fullName.trim();
  return nome === '' ? null : nome;
}

/**
 * Iniciais do nome, para o avatar do cabeçalho — no máximo duas, do primeiro
 * e do último termo. Conta **sem** nome não tem iniciais: quem chama recorre
 * ao ícone genérico, nunca ao identificador (requisito "Conta sem nome
 * recorre a tratamento genérico").
 */
export function iniciaisDoNome(nome: string): string {
  const termos = nome.split(/\s+/).filter((t) => t.length > 0);
  if (termos.length === 0) return '';
  const primeira = termos[0]![0]!;
  const ultima = termos.length > 1 ? termos[termos.length - 1]![0]! : '';
  return `${primeira}${ultima}`.toUpperCase();
}

/** Primeiro termo do nome cadastrado — é por ele que a tela inicial saúda. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? '';
}

/**
 * Saudação do horário (change `conteudo-da-tela-inicio`, design.md D9): bom
 * dia de 5h a 11h59, boa tarde de 12h a 17h59, boa noite no resto — pelo
 * relógio de quem vê a tela. É cortesia, não regra: não há por que perguntar
 * ao servidor. O instante vem por parâmetro para o teste fixar o horário.
 */
export function saudacaoDoHorario(agora: Date = new Date()): string {
  const hora = agora.getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Saudação da tela inicial (US 11.1, cenário 1; demanda nº 2, seção 1.3): a do
 * horário com o **primeiro nome** quando existe, só a do horário quando não —
 * e em nenhum dos casos com o identificador interno.
 */
export function saudacao(nome: string | null, agora: Date = new Date()): string {
  const doHorario = saudacaoDoHorario(agora);
  return nome === null ? `${doHorario}!` : `${doHorario}, ${primeiroNome(nome)}!`;
}

/**
 * O que apresentar como "perfil" da pessoa: a **função** do cadastro
 * (`job_title`) quando preenchida, e o rótulo do **papel de acesso** quando
 * não (change `funcao-e-setor-na-identidade`, design.md D6;
 * `docs/respostas_a1_funcao_e_setor.txt`, resposta 1a).
 *
 * Origem **única** da recaída, consumida pelo cartão do rodapé e pela tela
 * inicial. Não é preferência de organização: `nomenclatura-interface` proíbe
 * que o rótulo do papel divirja entre telas, e esse mapa já esteve triplicado
 * uma vez. Duas recaídas implementadas em paralelo são o mesmo defeito com
 * outro nome.
 *
 * A função **não** é rótulo de papel e não altera permissão: é texto livre do
 * cadastro. Uma pessoa com função "Coordenadora" e papel `collaborator` continua
 * sendo colaboradora para toda decisão de autorização — que é do servidor.
 */
export function funcaoExibida(identity: AuthenticatedIdentity): string {
  const funcao = identity.jobTitle.trim();
  return funcao === '' ? ROLE_LABEL[identity.role] : funcao;
}

/**
 * Nome do setor, ou `null` quando a pessoa não tem setor — caso em que a
 * interface **omite** o termo, sem rótulo vazio nem espaço reservado
 * (capability `setores`).
 */
export function setorExibido(identity: AuthenticatedIdentity): string | null {
  const setor = identity.sectorName.trim();
  return setor === '' ? null : setor;
}
