import { useState } from 'react';
import { App, Button, Input, Popconfirm, Result, Space, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { IconeNovo } from '../app/icons';
import type { PersonResponse } from '@gdoc/shared';
import { PersonStatus } from '@gdoc/shared';
import { UserRole } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useUnits } from '../unidades/queries';
import { PessoaFormModal } from './PessoaFormModal';
import { SetoresDrawer } from '../setores/SetoresDrawer';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
import { ROLE_LABEL } from '../shell/role-label';
import { ACOMPANHAMENTO_LABEL } from '../shell/acompanhamento-label';
import { SenhaGeradaModal } from './SenhaGeradaModal';
import { useResetPersonPassword, useUpdatePerson, useUsers } from './queries';
import { filtrarPessoas, normalizarBusca } from './filtro-pessoas';

const STATUS_LABEL: Record<PersonStatus, string> = {
  [PersonStatus.ACTIVE]: 'Ativo',
  [PersonStatus.DISABLED]: 'Inativo',
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
  // Manutenção da lista de setores (change `funcao-e-setor-na-identidade`,
  // design.md D9): painel desta página, sem item de navegação próprio.
  const [setoresOpen, setSetoresOpen] = useState(false);
  // Busca de colaborador (change `busca-de-colaboradores`, design.md D1–D3):
  // recorte no cliente do que `GET /users` já entregou; mudar o termo volta à
  // primeira página, para não ficar numa página que deixou de existir.
  const [termoBusca, setTermoBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

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
    { title: 'Setor', key: 'sector', render: (_, person) => person.sectorName ?? '—' },
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
      render: (_, person) => <RotuloDeEstado>{ROLE_LABEL[person.role]}</RotuloDeEstado>,
    },
    {
      // Acompanhamento de leituras (change `gestor-de-acompanhamento`): rótulo
      // de origem única; quem não acompanha fica com a ausência explícita.
      title: 'Acompanhamento',
      key: 'readingOversight',
      render: (_, person) =>
        person.readingOversight ? (
          <RotuloDeEstado>{ACOMPANHAMENTO_LABEL[person.readingOversight]}</RotuloDeEstado>
        ) : (
          '—'
        ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, person) => (
        <RotuloDeEstado tom={person.status === PersonStatus.ACTIVE ? 'positivo' : 'neutro'}>
          {STATUS_LABEL[person.status]}
        </RotuloDeEstado>
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
                title={isActive ? 'Desativar colaborador' : 'Ativar colaborador'}
                description={
                  isActive
                    ? 'O colaborador perde acesso ao login; os arquivos e a auditoria são preservados.'
                    : 'O colaborador volta a poder fazer login.'
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
                description="Uma nova senha é gerada e exibida uma única vez; a senha atual do colaborador deixa de funcionar."
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
        title="Não foi possível carregar os colaboradores"
        subTitle="Verifique sua conexão e tente novamente."
      />
    );
  }

  const buscando = normalizarBusca(termoBusca) !== '';
  const pessoasFiltradas = filtrarPessoas(
    data ?? [],
    termoBusca,
    isGlobalAdmin ? (unitId) => unitNameById.get(unitId) : undefined,
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Input.Search
          allowClear
          aria-label="Buscar colaborador"
          placeholder="Buscar por nome, e-mail, função ou setor"
          value={termoBusca}
          onChange={(event) => {
            setTermoBusca(event.target.value);
            setPaginaAtual(1);
          }}
          style={{ flex: '1 1 280px', maxWidth: 420 }}
        />
        <Space wrap>
          <Button onClick={() => setSetoresOpen(true)}>Setores</Button>
          <Button type="primary" icon={<IconeNovo />} onClick={openCreate}>
            Novo colaborador
          </Button>
        </Space>
      </div>
      <Table<PersonResponse>
        rowKey="id"
        columns={columns}
        dataSource={pessoasFiltradas}
        scroll={{ x: 'max-content' }}
        pagination={{ current: paginaAtual, onChange: (pagina) => setPaginaAtual(pagina) }}
        locale={buscando ? { emptyText: 'Nenhum colaborador encontrado' } : undefined}
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
      <SetoresDrawer open={setoresOpen} onClose={() => setSetoresOpen(false)} />
    </div>
  );
}
