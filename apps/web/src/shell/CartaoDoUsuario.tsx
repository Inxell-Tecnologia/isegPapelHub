import { Avatar, Button, Tooltip } from 'antd';
import { Link } from 'react-router-dom';
import type { AuthenticatedIdentity } from '@gdoc/shared';
import { IconeConta, IconeSair } from '../app/icons';
import { ALTURA_MINIMA_ACIONAMENTO, paleta, TAMANHO_MINIMO_TEXTO } from '../app/theme';
import { funcaoExibida, iniciaisDoNome, nomeExibido, setorExibido } from './identidade';

/**
 * Identidade no **rodapé da navegação** (demanda do cliente nº 2, seção 1.1;
 * capability `web-shell-e-auth`, requisito "Identidade no rodapé da navegação
 * apresenta nome, papel e unidade"; change `menu-lateral-e-barra-superior`,
 * design.md D6).
 *
 * Origem única consumida pela coluna lateral **e** pelo painel sobreposto: o
 * requisito exige que os dois modos sejam alimentados do mesmo lugar, e uma
 * segunda composição divergiria em silêncio.
 *
 * **Corpo do cartão é link para "Minha conta"; Sair é botão irmão, fora do
 * link.** A demanda pede o cartão "+ botão Sair" visível e o requisito vigente
 * exige "Minha conta" alcançável por qualquer papel, inclusive
 * `collaborator` — resolver com menu suspenso manteria as duas ações
 * escondidas atrás de um clique, que é justamente o que esta fatia tira do
 * topo. Aninhar o botão dentro do link produziria alvo ambíguo para teclado e
 * para leitor de tela.
 *
 * **A identidade é o nome, nunca o identificador interno nem fragmento dele**
 * (requisito "A identidade apresentada é o nome, não o identificador"). Conta
 * sem nome recorre ao ícone genérico e ao papel.
 *
 * **O "perfil" aqui é a função do cadastro** (`funcaoExibida`), com o rótulo
 * do papel de acesso só quando não há função — a decisão D2 do plano, fechada
 * pela resposta 1a do cliente: *"para quem usa o sistema, o cargo é o que faz
 * sentido; 'Colaborador' ou 'Gestor' é coisa interna do sistema"*.
 *
 * **O setor fica no texto íntegro, não na linha visível** (change
 * `funcao-e-setor-na-identidade`, design.md D7). O cartão compacto tem uma
 * linha para a função e outra para a unidade (change
 * `identidade-isetes-e-menu-compacto`, design.md D5), e uma terceira não cabe
 * no orçamento de altura da navegação. A demanda pede o setor na linha abaixo
 * da saudação (seção 1.3), e é lá que ele aparece.
 */

/** Linha secundária do cartão: uma linha, com corte por reticência. */
const ESTILO_LINHA_SECUNDARIA = {
  display: 'block',
  color: paleta.textoSobreEscuro,
  fontSize: TAMANHO_MINIMO_TEXTO,
  lineHeight: '18px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

export function CartaoDoUsuario({
  identity,
  collapsed,
  onLogout,
}: {
  identity: AuthenticatedIdentity;
  collapsed: boolean;
  onLogout: () => void;
}) {
  const nome = nomeExibido(identity);
  const funcao = funcaoExibida(identity);
  const setor = setorExibido(identity);
  // Texto íntegro para quem aponta ou usa leitor de tela — é ele que preserva
  // o dado quando o nome é mais longo que a largura do cartão, e é por ele que
  // o setor segue alcançável sem disputar a largura da linha visível.
  const resumo = [nome ?? funcao, funcao, setor, identity.unitName]
    .filter((parte): parte is string => parte !== null)
    .join(' — ');

  const avatar =
    nome === null ? (
      <Avatar
        size={32}
        icon={<IconeConta />}
        style={{ background: paleta.azulAvatar, color: paleta.texto, flexShrink: 0 }}
      />
    ) : (
      // Iniciais em `texto`, nunca em branco: o par branco × azulAvatar mede
      // 1,54:1 (theme.ts, design.md D7), e o `Avatar` escreve em branco por
      // padrão — sem fixar a cor aqui, o piso de 4,5:1 cairia.
      <Avatar
        size={32}
        style={{
          background: paleta.azulAvatar,
          color: paleta.texto,
          fontWeight: 600,
          // Sem isto o flex do cartão encolhe o avatar e as iniciais somem.
          flexShrink: 0,
        }}
      >
        {iniciaisDoNome(nome)}
      </Avatar>
    );

  if (collapsed) {
    // Colapsado: só o avatar, com os três dados no nome acessível. O
    // identificador interno não aparece em nenhum estado.
    return (
      <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
        <Tooltip title={resumo} placement="right">
          <Link to="/minha-conta" aria-label={`Minha conta — ${resumo}`}>
            {avatar}
          </Link>
        </Tooltip>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '10px 8px 10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        borderTop: `1px solid ${paleta.textoSobreEscuro}33`,
      }}
    >
      <Link
        to="/minha-conta"
        title={resumo}
        aria-label={`Minha conta — ${resumo}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          minWidth: 0,
          color: 'inherit',
        }}
      >
        {avatar}
        {/* `minWidth: 0` nos dois níveis é o que permite o truncamento
            funcionar dentro do flex: sem ele o texto empurra a largura da
            coluna em vez de encurtar. */}
        <span style={{ minWidth: 0, display: 'block' }}>
          <span
            style={{
              display: 'block',
              color: paleta.branco,
              fontWeight: 600,
              lineHeight: '20px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {nome ?? funcao}
          </span>
          {/* Função e unidade em **linhas próprias**, uma linha cada (change
              `identidade-isetes-e-menu-compacto`, design.md D5). Juntas, com
              corte em duas linhas, a função longa do caso real — "Gerente de
              Governança e Performance Corporativa" — empurrava a unidade para
              dentro da reticência, e o requisito exige a unidade visível.
              Separadas, a unidade nunca disputa espaço com a função; o texto
              íntegro de ambas segue no `title` e no nome acessível. */}
          <span style={ESTILO_LINHA_SECUNDARIA}>{funcao}</span>
          <span style={ESTILO_LINHA_SECUNDARIA}>{identity.unitName}</span>
        </span>
      </Link>
      {/* Sair **compacto**, ao lado da identidade (`docs/demanda_cliente_3.md`,
          item 4; design.md D5): só ícone, mas com nome acessível, dica e os
          44 px de alvo do design system. Irmão do link, nunca dentro dele —
          controle acionável dentro de link é alvo ambíguo para teclado. */}
      <Tooltip title="Sair" placement="top">
        <Button
          type="text"
          onClick={onLogout}
          aria-label="Sair"
          icon={<IconeSair style={{ fontSize: 18 }} />}
          style={{
            color: paleta.branco,
            width: ALTURA_MINIMA_ACIONAMENTO,
            height: ALTURA_MINIMA_ACIONAMENTO,
            flexShrink: 0,
          }}
        />
      </Tooltip>
    </div>
  );
}
