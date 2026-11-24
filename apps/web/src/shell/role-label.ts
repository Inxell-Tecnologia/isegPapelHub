import { UserRole } from '@gdoc/shared';

/**
 * Origem única do rótulo de papel de acesso (capability
 * `nomenclatura-interface`, requisito "Rótulo do papel é idêntico em toda a
 * interface"; change `identidade-visual-isetes`, design.md D7).
 *
 * Antes daquela change o mapa estava **triplicado** — shell, perfil da
 * própria conta e cadastro de colaboradores tinham cópias independentes.
 * Trocar o rótulo de `unit_admin` em três lugares é exatamente o tipo de
 * mudança em que um deles fica para trás, e por isso o requisito proíbe a
 * divergência em vez de confiar na disciplina de quem edita. A troca seguinte
 * provou o ponto: foi uma linha.
 *
 * **"Administrador da unidade"** (change `rotulo-administrador-da-unidade`,
 * design.md D1; `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`, resposta
 * 5a). Até ali o rótulo era "Gestor", e a demanda nº 2 trouxe um segundo
 * "Gestor" — quem acompanha as leituras da equipe sem administrar a unidade.
 * O cliente resolveu a colisão dando a palavra ao papel novo; "Gestor" fica
 * **reservado** a ele e não nomeia nenhum papel deste mapa (D3).
 *
 * É decisão de nomenclatura: muda o **texto exibido**, nunca o papel. O
 * identificador interno (`unit_admin`), o esquema do banco e os contratos de
 * API permanecem inalterados.
 */
export const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.COLLABORATOR]: 'Colaborador',
  [UserRole.UNIT_ADMIN]: 'Administrador da unidade',
  [UserRole.GLOBAL_ADMIN]: 'Administrador global',
};
