/**
 * Passos do tour guiado (change `tour-guiado`, design.md D2), na ordem em que
 * são apresentados. Cada um aponta o elemento marcado com
 * `data-tour="<alvo>"`; o tour é montado **na hora de começar**, e passo cujo
 * alvo não está na tela é omitido — é assim que o tour só aponta o que a
 * pessoa vê, sem regra de papel duplicada aqui.
 *
 * Texto curto de propósito: nove passos de uma ou duas frases cabem nos "2
 * minutos" que o convite promete.
 */
export interface PassoDoTour {
  alvo: string;
  titulo: string;
  descricao: string;
}

export const PASSOS_DO_TOUR: readonly PassoDoTour[] = [
  {
    alvo: 'navegacao',
    titulo: 'Menu',
    descricao:
      'Daqui você chega a Documentos, Recentes, Favoritos, Compartilhados comigo e Lixeira — e, se administra a unidade, às telas de administração.',
  },
  {
    alvo: 'busca',
    titulo: 'Busca',
    descricao:
      'Procure um documento pelo nome ou pelo código, de qualquer tela. Os resultados mostram só o que você pode abrir.',
  },
  {
    alvo: 'enviar',
    titulo: 'Enviar documento',
    descricao: 'Publique arquivos ou uma pasta inteira, com os dados de cada documento.',
  },
  {
    alvo: 'avisos',
    titulo: 'Avisos',
    descricao:
      'O sino mostra quantos avisos você ainda não leu: acessos recebidos ou a vencer e arquivos pendentes de cadastro.',
  },
  {
    alvo: 'atalhos',
    titulo: 'Atalhos',
    descricao: 'As ações do dia a dia a um clique: enviar, criar pasta, buscar e o manual.',
  },
  {
    alvo: 'pastas',
    titulo: 'Pastas da unidade',
    descricao: 'As pastas principais da sua unidade que você pode abrir.',
  },
  {
    alvo: 'recentes',
    titulo: 'Documentos recentes',
    descricao:
      'O que foi publicado ou alterado por último, com tipo, revisão e situação. Clique no nome para visualizar.',
  },
  {
    alvo: 'coluna-direita',
    titulo: 'Leitura obrigatória e avisos',
    descricao:
      'Aqui vão aparecer os documentos que você precisa ler e confirmar, com o prazo de cada um.',
  },
  {
    alvo: 'ajuda',
    titulo: 'Ajuda',
    descricao:
      'O manual do usuário abre numa nova aba. O tour pode ser refeito pelo menu, em AJUDA.',
  },
];

/** Seletor do alvo de um passo. */
export function seletorDoAlvo(alvo: string): string {
  return `[data-tour="${alvo}"]`;
}
