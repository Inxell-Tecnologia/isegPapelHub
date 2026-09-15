import { App, Button, Modal, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

interface SenhaGeradaModalProps {
  /** `null` ⇒ modal fechado. O valor só existe no estado do chamador — descartado ao fechar (design.md D7). */
  generatedPassword: string | null;
  onClose: () => void;
}

/**
 * Exibição única da senha gerada pela redefinição administrativa (US 1.4,
 * cenário 1; design.md (troca-de-senha) D7). Sem `queryKey` nem qualquer
 * outra persistência: o valor vive só enquanto este modal está aberto, e
 * `onClose` descarta o estado no componente pai — reabrir a tela ou recarregar
 * a página nunca recupera a senha.
 */
export function SenhaGeradaModal({ generatedPassword, onClose }: SenhaGeradaModalProps) {
  const { message } = App.useApp();

  async function handleCopy() {
    if (!generatedPassword) return;
    await navigator.clipboard.writeText(generatedPassword);
    message.success('Senha copiada.');
  }

  return (
    <Modal
      title="Senha gerada"
      open={generatedPassword !== null}
      onCancel={onClose}
      onOk={onClose}
      okText="Concluir"
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnClose
    >
      <Typography.Paragraph type="warning">
        Esta senha não será exibida novamente. Copie-a e repasse ao colaborador por um canal seguro.
      </Typography.Paragraph>
      <Typography.Text code style={{ fontSize: 16 }}>
        {generatedPassword}
      </Typography.Text>
      <div style={{ marginTop: 12 }}>
        <Button icon={<CopyOutlined />} onClick={handleCopy}>
          Copiar
        </Button>
      </div>
    </Modal>
  );
}
