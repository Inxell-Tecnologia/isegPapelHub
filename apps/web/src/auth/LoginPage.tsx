import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Navigate, useNavigate } from 'react-router-dom';
import type { LoginRequest } from '@gdoc/shared';
import { useSession } from './session-context';
import { ApiError } from '../lib/api-client';
import { BrandMark } from '../shell/BrandMark';

// Amostrada pixel a pixel de docs/images/logo_papel_hub.jpg: o pixel de maior
// componente azul relativo da arte (design.md D1). Contraste com branco:
// 10,8:1 (luminância relativa 0,047) — acima do mínimo AAA de 7:1 (design.md,
// "Riscos e verificação").
export const LOGIN_BACKGROUND_COLOR = '#063c7c';

export function LoginPage() {
  const { status, login, publicConfig } = useSession();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // design.md D4: o overscroll elástico (iOS) revela a cor do elemento raiz
    // do documento, não a do container do login, mesmo com este medindo
    // certo. Pinta o elemento raiz só enquanto a rota de login está montada e
    // restaura ao sair, para não vazar a cor para as telas do shell.
    const root = document.documentElement;
    const previousBackground = root.style.backgroundColor;
    root.style.backgroundColor = LOGIN_BACKGROUND_COLOR;
    return () => {
      root.style.backgroundColor = previousBackground;
    };
  }, []);

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(values: LoginRequest) {
    setSubmitting(true);
    try {
      await login(values);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // US 1.2 cenário 3: aviso específico, nunca confundido com a mensagem genérica.
        message.error('Esta conta está desativada. Procure a administração.');
      } else if (err instanceof ApiError && err.status === 401) {
        // US 1.2 cenário 2: mensagem genérica — não revela e-mail vs. senha.
        message.error('E-mail ou senha inválidos.');
      } else {
        message.error('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        backgroundColor: LOGIN_BACKGROUND_COLOR,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 360 }}>
        {/* Cabeçalho: logomarca + título + identificação do cliente + subtítulo. A
            logomarca e a identificação do cliente ficam FORA do heading para não
            poluir seu nome acessível (a US 1.2 e os testes exigem "PapelHub" puro —
            design.md D7). */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <BrandMark height={64} />
        </div>
        <Typography.Title level={3} style={{ textAlign: 'center', marginTop: 0, marginBottom: 4 }}>
          PapelHub
        </Typography.Title>
        {publicConfig.clientName && (
          <Typography.Text
            type="secondary"
            style={{ display: 'block', textAlign: 'center', marginBottom: 4 }}
          >
            {publicConfig.clientName}
          </Typography.Text>
        )}
        <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 24 }}>
          Acesse sua conta
        </Typography.Paragraph>
        <Form<LoginRequest> layout="vertical" onFinish={handleSubmit} disabled={submitting}>
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email' }]}>
            <Input
              prefix={<MailOutlined />}
              placeholder="seu.email@exemplo.com"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true }]}>
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Entrar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
