import { useEffect } from 'react';
import { Alert, App, Form, Modal } from 'antd';
import dayjs from 'dayjs';
import type { FileSummaryResponse } from '@gdoc/shared';
import {
  DocumentControlFormItems,
  toDocumentControlInput,
  type DocumentControlFormValues,
} from './DocumentControlFormItems';
import { descreverRecusaDeControle } from './document-control-errors';
import { useUpdateDocumentControl } from './queries';

/**
 * Edição dos dados de controle de um documento já existente (US 10.5,
 * requisito "Dados de controle podem ser preenchidos ou corrigidos depois").
 *
 * É o caminho que impede o lote de virar dívida permanente: o que entrou sem
 * dados — o acervo anterior e tudo que vem por lote, por decisão explícita
 * (design.md D7) — recebe os dados aqui, sem reenviar o conteúdo e sem
 * avançar a revisão.
 */
export function DocumentControlModal({
  file,
  onClose,
}: {
  file: FileSummaryResponse | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<DocumentControlFormValues>();
  const { message } = App.useApp();
  const atualizar = useUpdateDocumentControl();

  useEffect(() => {
    if (!file) return;
    form.setFieldsValue({
      documentType: file.documentType,
      documentCode: file.documentCode,
      documentRevision: file.documentRevision,
      responsibleSector: file.responsibleSector,
      nextReviewAt: file.nextReviewAt ? dayjs(file.nextReviewAt) : null,
      lifecycleState: file.lifecycleState,
    });
  }, [file, form]);

  async function handleSubmit(values: DocumentControlFormValues) {
    if (!file) return;
    try {
      await atualizar.mutateAsync({ fileId: file.id, body: toDocumentControlInput(values) });
      message.success('Dados de controle atualizados.');
      onClose();
    } catch (err) {
      // Código em uso, dado inválido e permissão insuficiente chegam como
      // avisos distintos — e o modal fica aberto, com o que a pessoa digitou.
      message.error(descreverRecusaDeControle(err));
    }
  }

  return (
    <Modal
      open={file !== null}
      title={file ? `Dados de controle — ${file.fileName}` : 'Dados de controle'}
      okText="Salvar"
      cancelText="Cancelar"
      confirmLoading={atualizar.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Alterar estes dados não substitui o arquivo nem avança a revisão."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
        <DocumentControlFormItems obrigatorios={false} incluirEstado />
      </Form>
    </Modal>
  );
}
