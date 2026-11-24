import { Card, Col, Empty, Result, Row, Space, Spin, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { FolderListItemResponse } from '@gdoc/shared';
import { IconeIniciarTour, IconePasta } from '../app/icons';
import {
  ALTURA_MINIMA_ACIONAMENTO,
  CLASSE_GRADE_ATALHOS,
  paleta,
  tonsDeAtalho,
  tonsDeEstado,
} from '../app/theme';
import { useSession } from '../auth/session-context';
import { funcaoExibida, nomeExibido, saudacao, setorExibido } from '../shell/identidade';
import { NOME_ACESSIVEL_MANUAL } from '../shell/manual';
import { useFolderContents } from '../navegacao/queries';
import { atalhosDoPapel, type Atalho } from './atalhos';
import { textoDaContagemDeDocumentos, tomDaPasta } from './cartao-de-pasta';
import { textoDeNovos, useNewDocumentsCount } from './queries';
import { TabelaDeRecentes } from './TabelaDeRecentes';
import { TourGuiado } from '../tour/TourGuiado';
import { CartaoDeLeituras } from '../leitura/CartaoDeLeituras';
import { CartaoDeAvisos } from '../leitura/CartaoDeAvisos';
import { DESTINO_PEDIDO_DE_TOUR } from '../tour/pedido-de-tour';

/**
 * Estilo do link que **envolve** o cartão (design.md D1/D3 do change
 * `cartoes-de-atalho-acionaveis`).
 *
 * `display: block` para o link assumir a caixa do cartão — um `<a>` inline
 * deixaria de fora justamente a área que esta change existe para tornar
 * acionável. `color: inherit` e `textDecoration: none` porque, envolvendo o
 * cartão, o link herdaria cor e sublinhado para **todo** o conteúdo, pintando
 * de azul também a descrição secundária; a aparência de link fica no rótulo,
 * onde a informação está, e a cor vem do token. `height: 100%` para os
 * cartões de uma mesma linha terem a mesma altura.
 */
const ESTILO_DO_LINK_DE_CARTAO = {
  display: 'block',
  height: '100%',
  color: 'inherit',
  textDecoration: 'none',
} as const;

/**
 * Título de cartão que quebra linha em vez de truncar: em 375 px o link à
 * direita ("Ver histórico completo") deixa pouco espaço, e o padrão do design
 * system corta o título com reticências — título cortado foi exatamente o que
 * a fatia A2 eliminou do menu.
 */
const ESTILOS_DE_CARTAO_COM_LINK = { title: { whiteSpace: 'normal' } } as const;

/**
 * Convite ao tour em **cápsula** azul-clara com ícone de play
 * (`docs/demanda_cliente_3.md`, item 8; change `marca-dagua-e-inicio-rodada-3`,
 * design.md D5). Continua link, com o mesmo destino e o texto como nome
 * acessível; o ícone é `aria-hidden` (módulo único de ícones). `azulLink`
 * sobre o fundo informativo mede 7,05:1 (`contraste.test.ts`); a altura mínima
 * é o piso de acionamento, e o anel de foco é o `a:focus-visible` global.
 */
const ESTILO_DO_CONVITE_AO_TOUR = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: ALTURA_MINIMA_ACIONAMENTO,
  padding: '0 16px',
  borderRadius: 999,
  background: tonsDeEstado.informativo.fundo,
  border: `1px solid ${tonsDeEstado.informativo.borda}`,
  color: paleta.azulLink,
  fontWeight: 600,
  textDecoration: 'none',
} as const;

/** Linhas de recentes na tela inicial (demanda nº 2, seção 1.3). */
const LINHAS_DE_RECENTES_NO_INICIO = 5;

/**
 * Cartão de atalho: ícone colorido, título e descrição (demanda nº 2, seção
 * 1.3). O cartão **inteiro** é o link (design.md D1 de
 * `cartoes-de-atalho-acionaveis`), e o nome acessível é o rótulo (D2) — a
 * descrição segue sendo texto do cartão, não parte do nome do destino. O do
 * manual sai da aplicação, e o nome acessível anuncia isso com o mesmo texto
 * do menu (change `conteudo-da-tela-inicio`, design.md D4).
 */
function CartaoDeAtalho({ atalho }: { atalho: Atalho }) {
  const Icone = atalho.icone;
  const tom = tonsDeAtalho[atalho.tom];
  const conteudo = (
    <Card size="small" hoverable style={{ height: '100%' }}>
      {/* Ícone **acima** do texto, como no mockup da demanda nº 3 (item 6):
          ao lado, ele tirava 56 px da linha e a descrição quebrava em 1366 px
          (design.md D3 de `marca-dagua-e-inicio-rodada-3`). */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 8,
          // Quadrado tingido do próprio tom do ícone — decorativo; o ícone é
          // `aria-hidden` e a informação está no rótulo.
          background: tom.fundo,
          color: tom.icone,
          marginBottom: 12,
        }}
      >
        <Icone style={{ fontSize: 20 }} />
      </span>
      <div>
        <Typography.Text strong style={{ color: paleta.azulLink }}>
          {atalho.rotulo}
        </Typography.Text>
      </div>
      <div>
        <Typography.Text type="secondary">{atalho.descricao}</Typography.Text>
      </div>
    </Card>
  );

  if (atalho.externo) {
    return (
      <a
        href={atalho.destino}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={NOME_ACESSIVEL_MANUAL}
        style={ESTILO_DO_LINK_DE_CARTAO}
      >
        {conteudo}
      </a>
    );
  }
  return (
    <Link to={atalho.destino} aria-label={atalho.rotulo} style={ESTILO_DO_LINK_DE_CARTAO}>
      {conteudo}
    </Link>
  );
}

/**
 * Cartão de pasta de "Pastas da unidade" (change
 * `contagem-de-documentos-nas-pastas`, design.md D5; demanda nº 3, item 7):
 * ícone em quadrado tingido do tom estável da pasta, nome e, embaixo, a
 * contagem de documentos **informada pelo servidor** — a tela não calcula
 * nada. O nome acessível do link continua sendo o nome da pasta (`aria-label`),
 * e a contagem entra como descrição (`aria-describedby`): a lista de links do
 * leitor de tela segue "Geral", "Governança", e o número é anunciado em
 * seguida.
 */
function CartaoDePasta({ pasta }: { pasta: FolderListItemResponse }) {
  const tom = tonsDeAtalho[tomDaPasta(pasta.id)];
  const contagem = textoDaContagemDeDocumentos(pasta.documentCount);
  const idDaContagem = `contagem-pasta-${pasta.id}`;
  return (
    <Link
      to={`/pastas/${pasta.id}`}
      aria-label={pasta.name}
      aria-describedby={contagem ? idDaContagem : undefined}
      style={ESTILO_DO_LINK_DE_CARTAO}
    >
      <Card size="small" hoverable style={{ height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 40px',
              width: 40,
              height: 40,
              borderRadius: 8,
              background: tom.fundo,
              color: tom.icone,
            }}
          >
            <IconePasta style={{ fontSize: 20 }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div>
              <Typography.Text strong style={{ color: paleta.azulLink }}>
                {pasta.name}
              </Typography.Text>
            </div>
            {contagem && (
              <div>
                <Typography.Text type="secondary" id={idDaContagem}>
                  {contagem}
                </Typography.Text>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

/**
 * Tela inicial (Épico 11, US 11.1/11.2, capability `tela-inicial`), na
 * composição da demanda nº 2, seção 1.3 (change `conteudo-da-tela-inicio`).
 *
 * Responde, sem clique, a "quem sou, onde estou, o que posso fazer e o que
 * mudou". As consultas da tela são **independentes e paralelas**: identidade
 * já resolvida na sessão, contagem de novos, pastas de primeiro nível e
 * alterações recentes. Cada área tem o seu próprio estado e aparece assim que
 * a sua resposta chega — uma consulta lenta ou com falha não bloqueia as
 * demais.
 *
 * Nada aqui decide permissão: as pastas, os documentos e a contagem são
 * exatamente os que a API devolveu.
 */
export function InicioPage() {
  const { identity, publicConfig } = useSession();
  // Pastas de **primeiro nível** da unidade: a raiz devolve só o que a
  // resolução de acesso do servidor liberou. São pastas, não unidades — cada
  // pessoa pertence a uma unidade só (resposta 1a do cliente,
  // `docs/respostas_d1_d3_d5_decisoes_estruturais.txt`).
  const pastas = useFolderContents(null);
  const novos = useNewDocumentsCount();

  if (!identity) return null;

  const atalhos = atalhosDoPapel(identity.role, publicConfig.manualUrl);

  // Função, setor e unidade sempre presentes, com ou sem nome cadastrado (US
  // 11.1 cenário 1): o identificador interno nunca aparece. A função do
  // cadastro no lugar do papel (change `funcao-e-setor-na-identidade`); setor
  // omitido quando não existe. A contagem de novos entra depois, só quando
  // chegou — carregando ou com falha, a linha continua inteira sem ela.
  const contexto = [funcaoExibida(identity), setorExibido(identity), identity.unitName]
    .filter((parte): parte is string => parte !== null)
    .join(' · ');

  return (
    <>
      <Space direction="vertical" size="large" style={{ display: 'flex' }}>
        {/* Duas faixas (change `marca-dagua-e-inicio-rodada-3`, design.md D2):
          saudação, convite e atalhos ocupam a **largura inteira** da área, como
          no mockup da demanda nº 3; a divisão entre conteúdo principal e coluna
          direita começa abaixo deles. */}
        <div>
          {/* Convite ao tour à direita da saudação, só para quem ainda não o fez
            (change `tour-guiado`, design.md D6) — refazer continua no menu, em
            AJUDA. Alinhado ao centro: a cápsula tem altura própria. */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px 16px',
            }}
          >
            <div>
              <Typography.Title level={3} style={{ marginBottom: 4 }}>
                {saudacao(nomeExibido(identity))}
              </Typography.Title>
              <Typography.Text type="secondary">
                {contexto}
                {novos.data && ` — ${textoDeNovos(novos.data)}`}
              </Typography.Text>
            </div>
            {!identity.tourCompleted && (
              <Link
                to={DESTINO_PEDIDO_DE_TOUR}
                data-convite-ao-tour=""
                style={ESTILO_DO_CONVITE_AO_TOUR}
              >
                <IconeIniciarTour style={{ fontSize: 18 }} />
                Primeira vez aqui? Faça o tour de 2 minutos
              </Link>
            )}
          </div>
        </div>

        {/* Cartões soltos, sem título de seção (demanda nº 2, seção 1.3). A grade
          decide as colunas pela largura **da própria área** (container query
          em `ESTILO_GLOBAL`), não da janela — quatro numa linha quando cabem
          (demanda nº 3, item 6; design.md D3). */}
        <div className={CLASSE_GRADE_ATALHOS} data-tour="atalhos">
          <div>
            {atalhos.map((atalho) => (
              <CartaoDeAtalho key={atalho.chave} atalho={atalho} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {/* Conteúdo principal e coluna direita sem media query (design.md D8 de
            `conteudo-da-tela-inicio`): lado a lado o espaço livre vai quase todo
            para o principal (999:1) e a coluna fica em ~340px; quando os dois
            não cabem, a coluna desce e ocupa a largura inteira. `minWidth: 0`
            deixa a tabela rolar dentro do próprio contêiner em vez de alargar a
            página. */}
          <div data-conteudo-principal="" style={{ flex: '999 1 480px', minWidth: 0 }}>
            <Space direction="vertical" size="large" style={{ display: 'flex' }}>
              <Card
                data-tour="pastas"
                title="Pastas da unidade"
                extra={<Link to="/pastas">Ver todas as pastas</Link>}
                styles={ESTILOS_DE_CARTAO_COM_LINK}
              >
                {pastas.isLoading && <Spin style={{ display: 'block', margin: '24px auto' }} />}
                {pastas.isError && (
                  <Result
                    status="error"
                    title="Não foi possível carregar as pastas"
                    subTitle="Verifique sua conexão e tente novamente."
                  />
                )}
                {!pastas.isLoading && !pastas.isError && pastas.data && (
                  <>
                    {pastas.data.folders.length === 0 ? (
                      // Ausência orientada, nunca área vazia sem explicação.
                      <Empty description="Nenhuma pasta disponível para você no momento" />
                    ) : (
                      <Row gutter={[16, 16]}>
                        {pastas.data.folders.map((pasta) => (
                          <Col key={pasta.id} xs={24} sm={12} lg={8}>
                            {/* Mesma forma dos atalhos: as áreas de cartão da tela
                            têm uma única regra de clique. */}
                            <CartaoDePasta pasta={pasta} />
                          </Col>
                        ))}
                      </Row>
                    )}
                  </>
                )}
              </Card>

              <Card
                data-tour="recentes"
                title="Documentos recentes"
                extra={<Link to="/recentes">Ver histórico completo</Link>}
                styles={ESTILOS_DE_CARTAO_COM_LINK}
              >
                <TabelaDeRecentes limite={LINHAS_DE_RECENTES_NO_INICIO} />
              </Card>
            </Space>
          </div>

          <aside
            aria-label="Leitura obrigatória e avisos"
            data-tour="coluna-direita"
            style={{ flex: '1 1 340px', minWidth: 0 }}
          >
            <Space direction="vertical" size="large" style={{ display: 'flex' }}>
              <CartaoDeLeituras />
              <CartaoDeAvisos />
            </Space>
          </aside>
        </div>
      </Space>
      <TourGuiado />
    </>
  );
}
