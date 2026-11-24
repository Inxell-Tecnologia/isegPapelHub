import { Space, Typography } from 'antd';
import { TabelaDeRecentes } from './TabelaDeRecentes';

/**
 * Destino "Recentes" da navegação (change `shell-e-inicio`, tasks 4.1) — e o
 * "Ver histórico completo" da tela inicial (change `conteudo-da-tela-inicio`,
 * design.md D7): o recorte inteiro do servidor, sem o corte de cinco linhas.
 *
 * Deliberadamente sem paginação nem filtros (design.md, Non-Goals): é o mesmo
 * recorte curto da tela inicial, numa tela própria para quem chega pelo menu.
 * Quem precisa procurar usa a busca — é para isso que ela está no cabeçalho.
 */
export function RecentesPage() {
  return (
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Documentos recentes
        </Typography.Title>
        <Typography.Text type="secondary">
          Os documentos ao seu alcance publicados, substituídos, renomeados ou movidos mais
          recentemente — um recorte dos últimos dias, não o acervo inteiro.
        </Typography.Text>
      </div>
      <TabelaDeRecentes />
    </Space>
  );
}
