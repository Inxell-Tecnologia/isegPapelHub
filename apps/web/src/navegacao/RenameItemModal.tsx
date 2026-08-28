import { useEffect } from 'react';
import { Form, Input, Modal } from 'antd';

interface RenameFormValues {
  itemName: string;
}

export interface RenamingItem {
  id: string;
  name: string;
  kind: 'file' | 'folder';
}

interface RenameItemModalProps {
  item: RenamingItem | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

/**
 * `PATCH /files/:id` e `PATCH /folders/:id` (US 2.2/US 2.3, design.md D7 de
 * `mover-e-renomear-itens`): um único modal para os dois recursos, sem
 * duplicar a validação de nome — o título muda conforme `item.kind`.
 */
export function RenameItemModal({ item, submitting, onCancel, onSubmit }: RenameItemModalProps) {
  const [form] = Form.useForm<RenameFormValues>();

  useEffect(() => {
    if (item) form.setFieldsValue({ itemName: item.name });
  }, [item, form]);

  return (
    <Modal
      title={item?.kind === 'folder' ? 'Renomear pasta' : 'Renomear arquivo'}
      open={item !== null}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Renomear"
      cancelText="Cancelar"
      destroyOnClose
    >
      <Form<RenameFormValues>
        form={form}
        layout="vertical"
        onFinish={(values) => onSubmit(values.itemName)}
      >
        <Form.Item
          name="itemName"
          label="Nome"
          rules={[{ required: true, message: 'Informe um nome' }]}
        >
          <Input autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
