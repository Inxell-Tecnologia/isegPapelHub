import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Typography } from 'antd';
import { Navigate, useNavigate } from 'react-router-dom';
import type { LoginRequest } from '@gdoc/shared';
import { useSession } from './session-context';
import { ApiError } from '../lib/api-client';
import { IconeEmail, IconeSenha } from '../app/icons';
import { useNarrowMode } from '../app/responsive';
import { RAIO_SUPERFICIE, TAMANHO_MINIMO_TEXTO, paleta } from '../app/theme';
import { BrandMark } from '../shell/BrandMark';

/**
 * Cor de marca da tela de login (change `identidade-visual-isetes`,
 * design.md D4): vem da **paleta da identidade** — não é mais amostrada da
 * arte da logomarca, como na versão anterior. Mede 15,76:1 contra branco,
 * acima do mínimo AAA de 7:1 que a spec exige, e o par é apurado por
 * cálculo em `__tests__/contraste.test.ts`, nunca por inspeção visual.
 */
export const LOGIN_BACKGROUND_COLOR = paleta.marinhoEscuro;

/**
 * Proposta de valor apresentada ao lado do cartão de acesso (requisito "Tela
 * de login apresenta a proposta de valor do produto"): constante de
 * apresentação, versionada com o código. **Não varia por pessoa** — a tela é
 * anterior ao login e não conhece quem acessa — nem por implantação, que é o
 * que `clientName` e `supportContact` cobrem.
 */
const PROPOSTA_DE_VALOR =
  'O repositório de documentos da sua instituição: um lugar só para guardar, ' +
  'encontrar e compartilhar arquivos, com permissão controlada por quem administra.';

const BENEFICIOS = [
  'Seus documentos organizados em pastas, com busca por nome, tipo e data.',
  'Acesso concedido por pessoa e por pasta, com prazo quando necessário.',
  'Histórico de quem visualizou, baixou e alterou cada arquivo.',
];

export function LoginPage() {
  const { status, login, publicConfig } = useSession();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const isNarrow = useNarrowMode();

  useEffect(() => {
    // design.md D4: o overscroll elástico (iOS) revela a cor do elemento raiz
    // do documento, não a do container do login, mesmo com este medindo
    // certo. Pinta o elemento raiz só enquanto a rota de login está montada e
    // restaura ao sair, para não vazar a cor para as telas do shell.
    //
    // A composição em dois campos **não** muda quem pinta a raiz (design.md
    // D4 desta change): ela continua recebendo a cor de marca, e os dois
    // campos são painéis desenhados por cima. Pintar a raiz com a superfície
    // clara do lado direito faria a rolagem elástica revelar claro por baixo
    // do painel escuro — exatamente a "faixa de outra cor" que o requisito
    // "Fundo da tela de login cobre a área visível integralmente" proíbe.
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
      } else if (err instanceof ApiError && (err.status === 429 || err.status === 503)) {
        // Recusa por falta de capacidade do Cloud Run (`Rate exceeded.`), não
        // por credencial: o login é POST e não é retentado pelo api-client
        // (retry gastaria outra verificação argon2 onde já falta capacidade),
        // então a orientação de tentar de novo precisa vir do texto.
        message.error('Serviço momentaneamente indisponível. Tente novamente em alguns instantes.');
      } else {
        message.error('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Campo de apresentação: a logomarca vive **aqui**, no campo escuro, e não
  // mais sobre o cartão claro (requisito "Logomarca permanece contida em
  // campo escuro"). Em tela estreita os campos empilham, e este vem primeiro
  // — enxuto o bastante para não empurrar o cartão de acesso fora da área
  // visível (requisito "Composição da tela de login empilha em tela
  // estreita").
  const painelDeApresentacao = (
    <div
      style={{
        flex: isNarrow ? 'none' : '1 1 0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 16,
        maxWidth: isNarrow ? 420 : 520,
        color: paleta.branco,
      }}
    >
      <div style={{ display: 'flex', justifyContent: isNarrow ? 'center' : 'flex-start' }}>
        {/* Logo branca do Instituto SETES, **decorativa**: o heading logo
            abaixo é o nome acessível, e a identificação do cliente segue em
            texto — o requisito "Identificação do cliente não contamina o nome
            acessível do título" exige que o nome acessível do heading seja
            exatamente o da aplicação. Sem moldura: o ativo é transparente e
            este campo já é escuro (change `identidade-isetes-e-menu-compacto`,
            design.md D3). */}
        <BrandMark variante="logo" height={isNarrow ? 56 : 72} />
      </div>
      {/* O nome da aplicação continua sendo o **cabeçalho** da tela
          (requisito "Tela de login apresenta o nome da aplicação"), agora no
          campo escuro em vez de sobre o cartão. A identificação do cliente
          permanece **abaixo** dele, em elemento distinto. */}
      <Typography.Title
        level={1}
        style={{
          color: paleta.branco,
          marginTop: 0,
          marginBottom: 0,
          fontSize: isNarrow ? 32 : 44,
          textAlign: isNarrow ? 'center' : 'left',
        }}
      >
        PapelHub
      </Typography.Title>
      {publicConfig.clientName && (
        <Typography.Text
          style={{
            color: paleta.textoSobreEscuro,
            fontSize: TAMANHO_MINIMO_TEXTO,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            textAlign: isNarrow ? 'center' : 'left',
          }}
        >
          {publicConfig.clientName}
        </Typography.Text>
      )}
      {!isNarrow && (
        <>
          <Typography.Paragraph
            style={{ color: paleta.branco, fontSize: 16, marginBottom: 0, lineHeight: 1.6 }}
          >
            {PROPOSTA_DE_VALOR}
          </Typography.Paragraph>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
            {BENEFICIOS.map((beneficio) => (
              <li key={beneficio} style={{ color: paleta.textoSobreEscuro, lineHeight: 1.5 }}>
                {beneficio}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isNarrow ? 24 : 64,
        flexDirection: isNarrow ? 'column' : 'row',
        flexWrap: 'wrap',
        padding: isNarrow ? '32px 16px' : '24px 48px',
        backgroundColor: LOGIN_BACKGROUND_COLOR,
      }}
    >
      {painelDeApresentacao}
      {/* Cartão de acesso: claro sobre a composição escura, fluido com teto —
          sem largura fixa que estoure em 375px. */}
      <Card
        style={{
          width: '100%',
          maxWidth: 360,
          flex: 'none',
          borderRadius: RAIO_SUPERFICIE,
        }}
      >
        {/* O cartão não repete o nome da aplicação em heading: há um só
            cabeçalho na tela, no campo de apresentação, e o nome acessível
            dele tem de permanecer exatamente "PapelHub". */}
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 24 }}>
          Acesse sua conta
        </Typography.Paragraph>
        <Form<LoginRequest> layout="vertical" onFinish={handleSubmit} disabled={submitting}>
          <Form.Item name="email" label="E-mail" rules={[{ required: true, type: 'email' }]}>
            <Input
              prefix={<IconeEmail />}
              placeholder="seu.email@exemplo.com"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item name="password" label="Senha" rules={[{ required: true }]}>
            <Input.Password
              prefix={<IconeSenha />}
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
        {/* Orientação a quem não consegue entrar (requisito "Quem não consegue
            entrar recebe caminho que funciona"): é por este contato que a
            redefinição de senha efetivamente ocorre — não há auto-atendimento,
            e a tela não finge que há. Omitido **por completo** quando a
            implantação não o configura, sem espaço reservado.

            Texto puro, não `mailto:` (design.md D8): o valor é livre e a
            implantação pode preferir ramal ou formulário interno. */}
        {publicConfig.supportContact && (
          <Typography.Paragraph
            type="secondary"
            style={{ marginTop: 24, marginBottom: 0, fontSize: TAMANHO_MINIMO_TEXTO }}
          >
            Não consegue entrar? Fale com o suporte: {publicConfig.supportContact}
          </Typography.Paragraph>
        )}
      </Card>
    </div>
  );
}
