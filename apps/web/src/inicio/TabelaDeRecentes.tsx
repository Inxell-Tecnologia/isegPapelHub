import { useState } from 'react';
import { Button, Empty, Result, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FileSummaryResponse, RecentDocumentResponse } from '@gdoc/shared';
import { EtiquetaDeSituacao } from '../app/EtiquetaDeSituacao';
import { RotuloDeTipoDocumental } from '../app/RotuloDeTipoDocumental';
import { useSession } from '../auth/session-context';
import { AUSENTE, formatarRevisao, tituloDoDocumento } from '../shell/document-control-labels';
import { formatDate } from '../navegacao/format';
import { PreviewModal } from '../visualizacao/PreviewModal';
import { useRecentDocuments } from './queries';

/**
 * Lista de documentos alterados recentemente (US 11.2), consumida tanto pela
 * tela inicial quanto pelo destino "Recentes" da navegação — uma origem só,
 * para as duas não divergirem no que apresentam.
 *
 * Colunas da demanda nº 2, seção 1.3 (change `conteudo-da-tela-inicio`,
 * design.md D7): Tipo, Documento (nome com o código abaixo), Unidade,
 * Revisão, Situação e Atualizado. A unidade vem da **identidade**, não do DTO:
 * pelo isolamento por unidade (D1 do cliente) toda linha é da unidade de quem
 * consulta, e um campo por linha seria dado redundante.
 *
 * A ordenação é a que o **servidor** devolveu (alteração mais recente
 * primeiro): a tela não reordena, porque o instante é derivado da auditoria e
 * do `created_at` no próprio `SELECT`. `limite` só **corta** a lista — a tela
 * inicial mostra cinco, o destino Recentes mostra o recorte inteiro.
 *
 * A ausência de alterações é **informada**, nunca uma tabela vazia sem
 * explicação (US 11.2, cenário 4).
 */
export function TabelaDeRecentes({ limite }: { limite?: number }) {
  const { identity } = useSession();
  const { data, isLoading, isError } = useRecentDocuments();
  const [previewingFile, setPreviewingFile] = useState<FileSummaryResponse | null>(null);

  const columns: ColumnsType<RecentDocumentResponse> = [
    {
      title: 'Tipo',
      key: 'documentType',
      // A cor é redundância da sigla, nunca substituta (US 10.1 cenário 2).
      render: (_, doc) =>
        doc.documentType ? <RotuloDeTipoDocumental tipo={doc.documentType} /> : AUSENTE,
    },
    {
      title: 'Documento',
      key: 'name',
      render: (_, doc) => (
        <div>
          {/* Título limpo em destaque (demanda nº 3, item 12; design.md D9 de
              `marca-dagua-e-inicio-rodada-3`): sem extensão e sem o prefixo
              igual ao código. O nome íntegro do arquivo fica no nome acessível
              e na dica — nada se perde. */}
          <Button
            type="link"
            title={doc.fileName}
            aria-label={doc.fileName}
            style={{
              padding: 0,
              height: 'auto',
              fontWeight: 600,
              whiteSpace: 'normal',
              textAlign: 'start',
            }}
            onClick={() => setPreviewingFile(doc)}
          >
            {tituloDoDocumento(doc.fileName, doc.documentCode)}
          </Button>
          {doc.documentCode && (
            <div>
              <Typography.Text type="secondary">{doc.documentCode}</Typography.Text>
            </div>
          )}
        </div>
      ),
    },
    { title: 'Unidade', key: 'unit', render: () => identity?.unitName ?? AUSENTE },
    {
      title: 'Revisão',
      key: 'documentRevision',
      render: (_, doc) => formatarRevisao(doc.documentRevision),
    },
    {
      title: 'Situação',
      key: 'documentStatus',
      render: (_, doc) => <EtiquetaDeSituacao file={doc} />,
    },
    { title: 'Atualizado', key: 'changedAt', render: (_, doc) => formatDate(doc.changedAt) },
  ];

  if (isLoading) return <Spin style={{ display: 'block', margin: '24px auto' }} />;

  if (isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar os documentos recentes"
        subTitle="Verifique sua conexão e tente novamente."
      />
    );
  }

  const documentos = data?.documents ?? [];

  return (
    <>
      <Table<RecentDocumentResponse>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={limite === undefined ? documentos : documentos.slice(0, limite)}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: <Empty description="Nenhuma alteração recente nos seus documentos" />,
        }}
      />
      <PreviewModal file={previewingFile} onClose={() => setPreviewingFile(null)} />
    </>
  );
}
