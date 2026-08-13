import { useEffect } from 'react';
import { Button, Empty, Image, Modal, Result, Spin, Typography } from 'antd';
import type { FileSummaryResponse } from '@gdoc/shared';
import { FileCategory, fileCategory } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useNarrowMode } from '../app/responsive';
import { useViewUrl } from './queries';
import { useDownloadFile } from './useDownloadFile';

interface PreviewModalProps {
  file: FileSummaryResponse | null;
  onClose: () => void;
}

/**
 * Modal de preview (US 9.2, design.md D1/D2/D3): ao abrir, chama `view-url`
 * uma vez e ramifica pela união discriminada da resposta. Fechar/reabrir
 * dispara nova chamada — sem cache de URL assinada.
 */
export function PreviewModal({ file, onClose }: PreviewModalProps) {
  const viewUrl = useViewUrl();
  const { download, isPending: downloading } = useDownloadFile();
  const isNarrow = useNarrowMode();

  const fileId = file?.id ?? null;
  useEffect(() => {
    if (fileId) {
      viewUrl.mutate(fileId);
    }
    // Efeito amarrado só ao id do arquivo (design.md D3): a mutation em si é
    // estável entre renders, incluí-la disparia loop de refetch indevido.
  }, [fileId]);

  return (
    <Modal
      title={file?.fileName}
      open={file !== null}
      onCancel={onClose}
      footer={null}
      // design.md D6 (`responsividade-mobile-tablet`): abaixo do limiar,
      // visualizar é o ato central do uso móvel — o preview aproveita a
      // largura útil da tela em vez do `width={800}` fixo do modo largo.
      width={isNarrow ? '100%' : 800}
      style={isNarrow ? { top: 8, paddingBottom: 0 } : undefined}
      styles={
        isNarrow ? { body: { maxHeight: 'calc(100dvh - 140px)', overflow: 'auto' } } : undefined
      }
      destroyOnHidden
    >
      {file && renderBody()}
    </Modal>
  );

  function renderBody() {
    if (viewUrl.isPending || viewUrl.isIdle) {
      return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
    }

    if (viewUrl.isError) {
      // design.md D6: 403 bloqueia sem renderizar conteúdo — mesmo padrão
      // `handlePermissionError` da Fatia 2.
      if (viewUrl.error instanceof ApiError && viewUrl.error.status === 403) {
        return (
          <Result
            status="403"
            title="Permissão insuficiente"
            subTitle="Você não tem permissão para visualizar este arquivo."
          />
        );
      }
      return (
        <Result
          status="error"
          title="Não foi possível carregar a pré-visualização"
          subTitle="Verifique sua conexão e tente novamente."
        />
      );
    }

    const data = viewUrl.data;
    if (!data) return null;

    if (data.previewAvailable) {
      return renderPreview(data.url, file!);
    }

    // US 9.2 cenário 2 / design.md D5: mensagem de indisponibilidade, com
    // download só quando o servidor sinaliza a permissão.
    return (
      <Empty description="Pré-visualização indisponível">
        {data.download.available && (
          <Button type="primary" loading={downloading} onClick={() => download(file!.id)}>
            Baixar
          </Button>
        )}
      </Empty>
    );
  }
}

/** Elemento por categoria de MIME (design.md D2) — `pdf`/`text` no visualizador nativo do browser. */
function renderPreview(url: string, file: FileSummaryResponse) {
  const category = fileCategory(file.contentType);
  switch (category) {
    case FileCategory.IMAGE:
      return <Image src={url} alt={file.fileName} style={{ maxWidth: '100%' }} />;
    case FileCategory.VIDEO:
      return <video src={url} controls style={{ width: '100%' }} />;
    case FileCategory.AUDIO:
      return <audio src={url} controls style={{ width: '100%' }} />;
    default:
      // design.md D6: `70vh` reproduz o problema de barra de endereço
      // retrátil já tratado em `fundo-marca-tela-login` — `dvh` acompanha a
      // área efetivamente visível. Nem todo navegador móvel renderiza PDF
      // inline num `iframe`; o link abaixo garante uma saída explicável em
      // vez de um retângulo em branco sem explicação, independente disso.
      return (
        <div>
          <iframe
            src={url}
            title={file.fileName}
            style={{ width: '100%', height: '70dvh', border: 'none' }}
          />
          <Typography.Paragraph style={{ marginTop: 8, textAlign: 'center' }}>
            Não conseguiu visualizar aqui?{' '}
            <Typography.Link href={url} target="_blank" rel="noopener noreferrer">
              Abrir em nova aba
            </Typography.Link>
          </Typography.Paragraph>
        </div>
      );
  }
}
