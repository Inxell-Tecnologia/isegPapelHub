import { useState } from 'react';
import { Button, Empty, Result, Space, Spin, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';
import { GrantResourceType, Permission } from '@gdoc/shared';
import type { FileSummaryResponse, SharedWithMeItemResponse } from '@gdoc/shared';
import { IconeArquivo, IconeBaixarVarios, IconePasta, IconeVisualizar } from '../app/icons';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
import { formatDate } from '../navegacao/format';
import { VERB_LABEL } from '../permissoes/PermissoesModal';
import { PreviewModal } from '../visualizacao/PreviewModal';
import { useDownloadFile } from '../visualizacao/useDownloadFile';
import { useSharedWithMe } from './queries';

/** `true` quando o item carrega o verbo — a origem é a resposta do servidor, nunca o papel. */
function tem(item: SharedWithMeItemResponse, permission: Permission): boolean {
  return item.permissions.some((p) => p.permission === permission);
}

/**
 * Rótulo de um verbo com o **seu próprio** prazo (design.md D5).
 *
 * O prazo acompanha o verbo a que pertence, e não o item: conceder vários
 * verbos numa só operação dá a todos o mesmo prazo, mas reconceder um
 * subconjunto com prazo diferente é permitido — e um prazo "do item" teria de
 * escolher entre mentir e omitir.
 */
function rotuloDoVerbo(permission: Permission, expiresAt: string | null): string {
  const nome = VERB_LABEL[permission];
  return expiresAt === null ? nome : `${nome} (até ${formatDate(expiresAt)})`;
}

/**
 * Destino "Compartilhados comigo" (US 4.4, capability
 * `compartilhados-comigo`).
 *
 * A lista existe porque a concessão granular **não tem herança**: o recurso
 * liberado pode estar em qualquer profundidade de uma árvore cujas pastas
 * intermediárias a pessoa não abre, e nesse caso ele não aparece em lugar
 * nenhum da navegação.
 *
 * Nada aqui decide permissão. Os verbos vêm na resposta e as ações oferecidas
 * são exatamente as que eles cobrem — a SPA não antecipa veredito, mesmo
 * padrão do botão de envio da barra superior.
 */
export function CompartilhadosPage() {
  const { data, isLoading, isError } = useSharedWithMe();
  const [arquivoEmPreview, setArquivoEmPreview] = useState<FileSummaryResponse | null>(null);
  const { download, isPending: baixando } = useDownloadFile();

  const columns: ColumnsType<SharedWithMeItemResponse> = [
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
      render: (_, item) => {
        // Pasta abre o explorador dela; arquivo abre o visualizador, sem
        // percorrer a árvore (requisito "Acionar um item alcança o recurso
        // sem percorrer a árvore"). Sem o verbo `view`, o nome não é
        // acionável: um acionador que conduzisse a recusa é o que
        // `tela-inicial` proíbe.
        if (!tem(item, Permission.VIEW)) return item.name;

        if (item.resourceType === GrantResourceType.FOLDER) {
          return <Link to={`/pastas/${item.id}`}>{item.name}</Link>;
        }
        return (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => setArquivoEmPreview(item.file)}
          >
            {item.name}
          </Button>
        );
      },
    },
    {
      title: 'Onde está',
      key: 'folderName',
      // Só a pasta que contém o item (design.md D7): sem herança, o recurso
      // concedido está frequentemente sob pastas que a pessoa não alcança, e
      // nomear a cadeia revelaria estrutura fora do seu alcance.
      // Item compartilhado por outra unidade (change
      // `compartilhamento-entre-unidades`, design.md D12): a pasta que o
      // contém está fora do compartilhamento e não é nomeada — o que o
      // identifica é a unidade de origem.
      render: (_, item) =>
        item.originUnit ? (
          <RotuloDeEstado tom="neutro">da unidade {item.originUnit.name}</RotuloDeEstado>
        ) : (
          (item.folderName ?? <Typography.Text type="secondary">Raiz da unidade</Typography.Text>)
        ),
    },
    {
      title: 'O que você pode fazer',
      key: 'permissions',
      render: (_, item) => (
        <Space size={[4, 4]} wrap>
          {item.permissions.map((p) => (
            <Tag key={p.permission}>{rotuloDoVerbo(p.permission, p.expiresAt)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Compartilhado em',
      key: 'sharedAt',
      width: 160,
      render: (_, item) => formatDate(item.sharedAt),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, item) => (
        <Space>
          {item.resourceType === GrantResourceType.FOLDER
            ? tem(item, Permission.VIEW) && (
                <Link to={`/pastas/${item.id}`}>
                  <Button size="small" icon={<IconePasta />}>
                    Abrir
                  </Button>
                </Link>
              )
            : tem(item, Permission.VIEW) && (
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
        </Space>
      ),
    },
  ];

  if (isLoading) return <Spin style={{ display: 'block', margin: '48px auto' }} />;

  if (isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar o que foi compartilhado com você"
        subTitle="Tente novamente em instantes."
      />
    );
  }

  const itens = data?.items ?? [];

  return (
    <div>
      <Typography.Title level={3}>Compartilhados comigo</Typography.Title>
      <Typography.Paragraph type="secondary">
        Pastas e arquivos de outras pessoas a que você tem acesso, com o que pode fazer em cada um.
      </Typography.Paragraph>

      {itens.length === 0 ? (
        // Orienta em vez de apresentar a tabela vazia do design system — mesmo
        // tratamento que `web-navegacao` exige da pasta sem conteúdo. Nenhuma
        // ação é oferecida aqui: conceder é ato da administração, e esta tela
        // é de quem recebe.
        <Empty
          description={
            <span>
              Nada foi compartilhado com você ainda. Pastas e arquivos liberados pela administração
              da sua unidade aparecem aqui.
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
