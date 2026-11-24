import { useState } from 'react';
import { App, Button, Empty, Result, Space, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { GrantResourceType, Permission } from '@gdoc/shared';
import type { FavoriteItemResponse, FileSummaryResponse } from '@gdoc/shared';
import {
  IconeArquivo,
  IconeBaixarVarios,
  IconeFavorito,
  IconePasta,
  IconeVisualizar,
} from '../app/icons';
import { formatDate } from '../navegacao/format';
import { PreviewModal } from '../visualizacao/PreviewModal';
import { useDownloadFile } from '../visualizacao/useDownloadFile';
import { mensagemDeFalhaAoFavoritar } from './acao-de-favorito';
import { useFavorites, useToggleFavorite } from './queries';

/** `true` quando o servidor devolveu o verbo — nunca derivado do papel. */
function tem(item: FavoriteItemResponse, permission: Permission): boolean {
  return item.permissions.includes(permission);
}

/**
 * Destino "Favoritos" (US 2.5, capability `favoritos`).
 *
 * Mesma forma de `CompartilhadosPage` (design.md D8) — a listagem plana fixada
 * pela A5: localização é a pasta que contém o item, arquivo abre na
 * visualização, pasta abre no explorador e as ações são só as dos verbos que o
 * servidor devolveu. Sem as colunas de verbos e de prazo, que aqui não
 * existem, e com "Remover dos favoritos" em cada item.
 *
 * Favorito não é permissão: o que perdeu o alcance simplesmente não vem na
 * resposta, sem erro (design.md D3).
 */
export function FavoritosPage() {
  const { message } = App.useApp();
  const { data, isLoading, isError } = useFavorites();
  const alternar = useToggleFavorite();
  const [arquivoEmPreview, setArquivoEmPreview] = useState<FileSummaryResponse | null>(null);
  const { download, isPending: baixando } = useDownloadFile();

  async function remover(item: FavoriteItemResponse) {
    try {
      await alternar.mutateAsync({
        resourceType: item.resourceType,
        resourceId: item.id,
        favorite: false,
      });
    } catch (err) {
      message.error(mensagemDeFalhaAoFavoritar(err));
    }
  }

  const columns: ColumnsType<FavoriteItemResponse> = [
    {
      title: 'Tipo',
      key: 'resourceType',
      width: 120,
      render: (_, item) =>
        item.resourceType === GrantResourceType.FOLDER ? (
          <Space size={4}>
            <IconePasta /> Pasta
          </Space>
        ) : (
          <Space size={4}>
            <IconeArquivo /> Arquivo
          </Space>
        ),
    },
    {
      title: 'Nome',
      key: 'name',
      render: (_, item) =>
        item.resourceType === GrantResourceType.FOLDER ? (
          <Link to={`/pastas/${item.id}`}>{item.name}</Link>
        ) : (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => setArquivoEmPreview(item.file)}
          >
            {item.name}
          </Button>
        ),
    },
    {
      title: 'Onde está',
      key: 'folderName',
      // Só a pasta que contém o item, nunca a cadeia (mesma regra da A5).
      render: (_, item) =>
        item.folderName ?? <Typography.Text type="secondary">Raiz da unidade</Typography.Text>,
    },
    {
      title: 'Marcado em',
      key: 'favoritedAt',
      width: 160,
      render: (_, item) => formatDate(item.favoritedAt),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, item) => (
        <Space wrap>
          {item.resourceType === GrantResourceType.FOLDER ? (
            <Link to={`/pastas/${item.id}`}>
              <Button size="small" icon={<IconePasta />}>
                Abrir
              </Button>
            </Link>
          ) : (
            <Button
              size="small"
              icon={<IconeVisualizar />}
              onClick={() => setArquivoEmPreview(item.file)}
            >
              Visualizar
            </Button>
          )}
          {item.resourceType === GrantResourceType.FILE && tem(item, Permission.DOWNLOAD) && (
            <Button
              size="small"
              icon={<IconeBaixarVarios />}
              loading={baixando}
              onClick={() => download(item.id)}
            >
              Baixar
            </Button>
          )}
          <Button
            size="small"
            icon={<IconeFavorito />}
            loading={alternar.isPending}
            onClick={() => remover(item)}
          >
            Remover dos favoritos
          </Button>
        </Space>
      ),
    },
  ];

  if (isLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />;

  if (isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar os seus favoritos"
        subTitle="Tente novamente em instantes."
      />
    );
  }

  const itens = data?.items ?? [];

  return (
    <div>
      <Typography.Title level={3}>Favoritos</Typography.Title>
      <Typography.Paragraph type="secondary">
        As pastas e os arquivos que você marcou, para chegar a eles sem percorrer as pastas.
      </Typography.Paragraph>

      {itens.length === 0 ? (
        // Orienta como marcar, em vez da tabela vazia do design system.
        <Empty
          description={
            <span>
              Você ainda não tem favoritos. Em <Link to="/pastas">Documentos</Link>, use a ação
              “Favoritar” de uma pasta ou de um arquivo para trazê-lo para cá.
            </span>
          }
        />
      ) : (
        <Table
          rowKey={(item) => `${item.resourceType}:${item.id}`}
          dataSource={itens}
          columns={columns}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}

      <PreviewModal file={arquivoEmPreview} onClose={() => setArquivoEmPreview(null)} />
    </div>
  );
}
