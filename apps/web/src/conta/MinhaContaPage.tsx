import { useState } from 'react';
import { App, Button, Card, Descriptions, Form, Input, Spin, Typography } from 'antd';
import { PASSWORD_MIN_LENGTH } from '@gdoc/shared';
import type { ChangePasswordRequest } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { ROLE_LABEL } from '../shell/role-label';
import { useChangePassword, useMyProfile } from './queries';

interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
}

/**
 * "Minha conta" (US 1.3, `web-minha-conta`, design.md D6): dados cadastrais
 * somente leitura de `GET /auth/profile` + formulário de troca da própria
 * senha. Acessível a qualquer papel autenticado — não é item de
 * administração, e os dados cadastrais não têm campo editável (a edição
 * permanece atribuição da administração).
 */
export function MinhaContaPage() {
  const { message } = App.useApp();
  const { data: profile, isLoading, isError } = useMyProfile();
  const changePassword = useChangePassword();
  const [form] = Form.useForm<ChangePasswordFormValues>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(values: ChangePasswordFormValues) {
    setSubmitting(true);
    try {
      await changePassword.mutateAsync(values satisfies ChangePasswordRequest);
      message.success('Senha alterada com sucesso.');
      form.resetFields();
    } catch (err) {
      // US 1.3, cenário 3; design.md D9: causa específica, sem confundir com
      // a mensagem genérica do login — quem chama já está autenticado.
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message === 'current password is incorrect'
      ) {
        form.setFields([{ name: 'currentPassword', errors: ['Senha atual incorreta'] }]);
        return;
      }
      if (err instanceof ApiError && err.status === 400) {
        form.setFields([
          {
            name: 'newPassword',
            errors: [`A nova senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`],
          },
        ]);
        return;
      }
      if (err instanceof ApiError && err.status === 401) {
        return; // sessão encerrada — o tratamento central de 401 já leva ao login
      }
      message.error('Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError || !profile) {
    return (
      <Typography.Text type="danger">Não foi possível carregar os dados da conta.</Typography.Text>
    );
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <Typography.Title level={3}>Minha conta</Typography.Title>

      <Card title="Dados cadastrais" style={{ marginBottom: 24 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Nome">{profile.fullName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="E-mail">{profile.email}</Descriptions.Item>
          <Descriptions.Item label="Unidade">{profile.unitName}</Descriptions.Item>
          <Descriptions.Item label="Papel">{ROLE_LABEL[profile.role]}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Alterar senha">
        <Form<ChangePasswordFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={submitting}
        >
          <Form.Item
            name="currentPassword"
            label="Senha atual"
            rules={[{ required: true, message: 'Informe a senha atual' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Nova senha"
            rules={[
              { required: true, message: 'Informe a nova senha' },
              {
                min: PASSWORD_MIN_LENGTH,
                message: `A nova senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`,
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Alterar senha
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
