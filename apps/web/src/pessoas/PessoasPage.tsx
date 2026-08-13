import { useState } from 'react';
import { App, Button, Popconfirm, Result, Space, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import type { PersonResponse } from '@gdoc/shared';
import { PersonStatus } from '@gdoc/shared';
import { UserRole } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useUnits } from '../unidades/queries';
import { ROLE_LABEL, PessoaFormModal } from './PessoaFormModal';
import { SenhaGeradaModal } from './SenhaGeradaModal';
import { useResetPersonPassword, useUpdatePerson, useUsers } from './queries';

const STATUS_LABEL: Record<PersonStatus, string> = {
  [PersonStatus.ACTIVE]: 'Ativa',
  [PersonStatus.DISABLED]: 'Inativa',
};

/**
 * Visibilidade da ação "Redefinir senha" (US 1.4, cenários 1/2; design.md
 * (troca-de-senha) D5) — espelha o alcance imposto no servidor, mas é UX, não
 * defesa: o servidor permanece o único guardião, a SPA não infere permissão a
 * partir da presença da ação.
 */
function canOfferResetAction(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === UserRole.GLOBAL_ADMIN) return false;
  if (actorRole === UserRole.GLOBAL_ADMIN) return true;
  return actorRole === UserRole.UNIT_ADMIN && targetRole === UserRole.COLLABORATOR;
}

/**
 * Gestão de pessoas pela administração (US 1.1, `web-pessoas`, design.md
 * D1). Substitui o `PlaceholderPage` de `/admin/pessoas` — a guarda de rota
 * `[unit_admin, global_admin]` já existe (Fatia 1 D6).
 */
export function PessoasPage() {
  const { message } = App.useApp();
  const { identity } = useSession();
  const { data, isLoading, isError } = useUsers();
  const updatePerson = useUpdatePerson();
  const resetPersonPassword = useResetPersonPassword();
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // gestao-de-unidades (web-pessoas): a coluna de unidade (nome, não UUID) é
  // resolvida via `GET /units`, que é exclusivo do global_admin (403 para
  // unit_admin). Por isso a coluna e a consulta só existem para o global_admin
  // — que é justamente quem lista pessoas de mais de uma unidade.
  const isGlobalAdmin = identity?.role === UserRole.GLOBAL_ADMIN;
  const { data: units } = useUnits({ enabled: isGlobalAdmin });
  const unitNameById = new Map((units ?? []).map((unit) => [unit.id, unit.name]));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonResponse | null>(null);

  function openCreate() {
    setEditingPerson(null);
    setModalOpen(true);
  }

  function openEdit(person: PersonResponse) {
    setEditingPerson(person);
    setModalOpen(true);
  }

  // design.md D6: 403 (RLS escondeu a linha, ou trava de papel violada por
  // pedido forjado) exibe aviso neutro, sem distinguir os subcasos.
  async function handleToggleStatus(person: PersonResponse) {
    const status =
      person.status === PersonStatus.ACTIVE ? PersonStatus.DISABLED : PersonStatus.ACTIVE;
    try {
      await updatePerson.mutateAsync({ id: person.id, body: { status } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        message.error('Permissão insuficiente para executar esta ação.');
        return;
      }
      message.error('Não foi possível concluir a ação. Tente novamente.');
    }
  }

  // design.md D6: 403 (papel do alvo fora do alcance, ou RLS escondendo
  // pessoa de outra unidade) exibe o mesmo aviso neutro das demais operações
  // de pessoas, sem distinguir subcasos.
  async function handleResetPassword(person: PersonResponse) {
    try {
      const result = await resetPersonPassword.mutateAsync(person.id);
      setGeneratedPassword(result.generatedPassword);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        message.error('Permissão insuficiente para executar esta ação.');
        return;
      }
      message.error('Não foi possível concluir a ação. Tente novamente.');
    }
  }

  const columns: ColumnsType<PersonResponse> = [
    { title: 'Nome', key: 'name', render: (_, person) => person.fullName ?? person.email },
    { title: 'E-mail', key: 'email', dataIndex: 'email' },
    { title: 'Função', key: 'jobTitle', render: (_, person) => person.jobTitle ?? '—' },
    ...(isGlobalAdmin
      ? [
          {
            title: 'Unidade',
            key: 'unit',
            render: (_: unknown, person: PersonResponse) => unitNameById.get(person.unitId) ?? '—',
          },
        ]
      : []),
    {
      title: 'Papel',
      key: 'role',
      render: (_, person) => <Tag>{ROLE_LABEL[person.role]}</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, person) => (
        <Tag color={person.status === PersonStatus.ACTIVE ? 'green' : 'default'}>
          {STATUS_LABEL[person.status]}
        </Tag>
      ),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, person) => {
        // design.md D5: na própria linha, sem ação de desativar — evita o
        // administrador cortar o próprio acesso.
        const isSelf = person.id === identity?.id;
        const isActive = person.status === PersonStatus.ACTIVE;
        const canReset = identity !== null && canOfferResetAction(identity.role, person.role);
        return (
          <Space>
            <Button size="small" onClick={() => openEdit(person)}>
              Editar
            </Button>
            {!(isSelf && isActive) && (
              <Popconfirm
                title={isActive ? 'Desativar pessoa' : 'Ativar pessoa'}
                description={
                  isActive
                    ? 'A pessoa perde acesso ao login; os arquivos e a auditoria são preservados.'
                    : 'A pessoa volta a poder fazer login.'
                }
                okText={isActive ? 'Sim, desativar' : 'Sim, ativar'}
                cancelText="Cancelar"
                onConfirm={() => handleToggleStatus(person)}
              >
                <Button size="small" danger={isActive}>
                  {isActive ? 'Desativar' : 'Ativar'}
                </Button>
              </Popconfirm>
            )}
            {canReset && (
              <Popconfirm
                title="Redefinir senha"
                description="Uma nova senha é gerada e exibida uma única vez; a senha atual da pessoa deixa de funcionar."
                okText="Sim, redefinir"
                cancelText="Cancelar"
                onConfirm={() => handleResetPassword(person)}
              >
                <Button size="small">Redefinir senha</Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError) {
    return (
      <Result
        status="error"
        title="Não foi possível carregar as pessoas"
        subTitle="Verifique sua conexão e tente novamente."
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nova pessoa
        </Button>
      </div>
      <Table<PersonResponse>
        rowKey="id"
        columns={columns}
        dataSource={data ?? []}
        scroll={{ x: 'max-content' }}
      />
      <PessoaFormModal
        target={editingPerson ?? undefined}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <SenhaGeradaModal
        generatedPassword={generatedPassword}
        onClose={() => setGeneratedPassword(null)}
      />
    </div>
  );
}
