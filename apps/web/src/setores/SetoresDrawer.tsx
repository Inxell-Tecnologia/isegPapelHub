import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  Space,
  Typography,
} from 'antd';
import { UserRole } from '@gdoc/shared';
import type { SectorResponse } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useUnits } from '../unidades/queries';
import { useCreateSector, useDeleteSector, useRenameSector, useSectors } from './queries';

/**
 * Manutenção da lista de setores de uma unidade (change
 * `funcao-e-setor-na-identidade`, capability `web-pessoas`, requisito
 * "Manutenção da lista de setores alcançável pela gestão de pessoas";
 * design.md D9).
 *
 * **Por que um painel na página de colaboradores, e não tela com item de
 * menu.** O menu acabou de ser redesenhado na fatia A2 e já tem quatro itens
 * esperando as suas fatias; um item de topo para uma lista administrativa
 * pouco visitada seria ruído. Dentro da gestão de **unidades** também não
 * serve: aquela tela é exclusiva do `global_admin`, e a resposta 2b do cliente
 * põe a pessoa de referência de cada unidade como administradora dela — que é
 * justamente quem precisa manter os setores da sua. Setor classifica pessoas,
 * então a manutenção fica onde quem cadastra já está.
 *
 * **A lista fechada precisa ser mantível desde o primeiro dia.** Sem cadastrar
 * e renomear aqui, um setor novo não teria como entrar e a padronização da
 * grafia pedida na resposta 6a não teria como ser feita — e a lista fechada
 * seria uma regressão diante do texto livre que ela substitui.
 *
 * A SPA não é a linha de defesa: todo alcance é recusado pelo servidor, e aqui
 * só se apresenta a recusa.
 */
export function SetoresDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const { identity } = useSession();
  const [form] = Form.useForm<{ name: string }>();

  const isGlobalAdmin = identity?.role === UserRole.GLOBAL_ADMIN;
  const { data: units } = useUnits({ enabled: isGlobalAdmin && open });

  // `undefined` = a unidade do contexto, resolvida pelo servidor. Para o
  // `unit_admin` é sempre esse o caso: não há seletor, e pedir outra unidade
  // seria recusado com 403.
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<string | undefined>(undefined);
  const unidadeAlvo = isGlobalAdmin ? unidadeEscolhida : undefined;
  const unidadePropria = unidadeAlvo === undefined || unidadeAlvo === identity?.unitId;

  const { data: setores, isLoading } = useSectors({
    unitId: unidadePropria ? undefined : unidadeAlvo,
    enabled: open,
  });

  const criar = useCreateSector();
  const renomear = useRenameSector();
  const remover = useDeleteSector();

  const [renomeando, setRenomeando] = useState<SectorResponse | null>(null);
  const [nomeNovo, setNomeNovo] = useState('');

  useEffect(() => {
    // Só o estado **local** é reposto ao fechar. Chamar `form.resetFields()`
    // aqui avisaria que a instância de `useForm` não está conectada a nenhum
    // Form — e não há mesmo: `destroyOnHidden` descarta o conteúdo do painel,
    // de modo que a próxima abertura monta um formulário novo e vazio.
    if (!open) setRenomeando(null);
  }, [open]);

  function tratarRecusa(err: unknown, campo: 'cadastro' | 'renomeacao') {
    if (err instanceof ApiError && err.status === 409 && err.message === 'sector_name_in_use') {
      const aviso = 'Já existe um setor com esse nome nesta unidade.';
      if (campo === 'cadastro') {
        form.setFields([{ name: 'name', errors: [aviso] }]);
      } else {
        message.error(aviso);
      }
      return;
    }
    if (err instanceof ApiError && err.status === 403) {
      message.error('Permissão insuficiente para executar esta ação.');
      return;
    }
    message.error('Não foi possível concluir a ação. Tente novamente.');
  }

  async function handleCriar(values: { name: string }) {
    try {
      await criar.mutateAsync({
        name: values.name,
        // Só o `global_admin` envia unidade; para o `unit_admin` o servidor
        // resolve pelo contexto.
        unitId: isGlobalAdmin ? unidadeAlvo : undefined,
      });
      form.resetFields();
    } catch (err) {
      tratarRecusa(err, 'cadastro');
    }
  }

  async function handleRenomear(setor: SectorResponse) {
    try {
      await renomear.mutateAsync({ id: setor.id, body: { name: nomeNovo } });
      setRenomeando(null);
    } catch (err) {
      tratarRecusa(err, 'renomeacao');
    }
  }

  async function handleRemover(setor: SectorResponse) {
    try {
      await remover.mutateAsync(setor.id);
    } catch (err) {
      // `sector_has_people` é **impedimento nomeado**, não falha: a pessoa
      // precisa saber que há gente no setor para saber o que fazer a seguir
      // (remanejar, ou renomear em vez de remover).
      if (err instanceof ApiError && err.status === 409 && err.message === 'sector_has_people') {
        const quantas = (err.details as { peopleCount?: number } | undefined)?.peopleCount;
        message.warning(
          quantas === undefined
            ? 'Este setor ainda tem colaboradores vinculados; mova-os antes de removê-lo.'
            : `Este setor ainda tem ${quantas} colaborador(es) vinculado(s); mova-os antes de removê-lo.`,
        );
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        message.error('Permissão insuficiente para executar esta ação.');
        return;
      }
      message.error('Não foi possível concluir a ação. Tente novamente.');
    }
  }

  return (
    <Drawer title="Setores da unidade" open={open} onClose={onClose} width={420} destroyOnHidden>
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          O setor é escolhido de uma lista ao cadastrar um colaborador. Renomear padroniza a escrita
          sem desfazer nenhum vínculo.
        </Typography.Paragraph>

        {isGlobalAdmin && (
          <Select
            placeholder="Unidade (padrão: a sua)"
            allowClear
            style={{ width: '100%' }}
            value={unidadeEscolhida}
            onChange={(valor) => setUnidadeEscolhida(valor)}
            options={(units ?? []).map((unidade) => ({ value: unidade.id, label: unidade.name }))}
          />
        )}

        <Form form={form} layout="inline" onFinish={handleCriar} style={{ gap: 8 }}>
          <Form.Item
            name="name"
            rules={[{ required: true, message: 'Informe o nome do setor' }]}
            style={{ flex: 1, marginRight: 0 }}
          >
            <Input placeholder="Novo setor" aria-label="Nome do novo setor" />
          </Form.Item>
          <Form.Item style={{ marginRight: 0 }}>
            <Button type="primary" htmlType="submit" loading={criar.isPending}>
              Adicionar
            </Button>
          </Form.Item>
        </Form>

        <List
          loading={isLoading}
          locale={{ emptyText: 'Nenhum setor cadastrado nesta unidade.' }}
          dataSource={setores ?? []}
          rowKey="id"
          renderItem={(setor) =>
            renomeando?.id === setor.id ? (
              <List.Item>
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    value={nomeNovo}
                    autoFocus
                    aria-label={`Novo nome para ${setor.name}`}
                    onChange={(evento) => setNomeNovo(evento.target.value)}
                    onPressEnter={() => handleRenomear(setor)}
                  />
                  <Button type="primary" onClick={() => handleRenomear(setor)}>
                    Salvar
                  </Button>
                  <Button onClick={() => setRenomeando(null)}>Cancelar</Button>
                </Space.Compact>
              </List.Item>
            ) : (
              <List.Item
                actions={[
                  <Button
                    key="renomear"
                    size="small"
                    onClick={() => {
                      setRenomeando(setor);
                      setNomeNovo(setor.name);
                    }}
                  >
                    Renomear
                  </Button>,
                  <Popconfirm
                    key="remover"
                    title="Remover setor"
                    description="Só é possível remover setor sem colaboradores vinculados."
                    okText="Sim, remover"
                    cancelText="Cancelar"
                    onConfirm={() => handleRemover(setor)}
                  >
                    <Button size="small" danger>
                      Remover
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={setor.name}
                  description={
                    setor.peopleCount === 0
                      ? 'Nenhum colaborador'
                      : `${setor.peopleCount} colaborador(es)`
                  }
                />
              </List.Item>
            )
          }
        />
      </Space>
    </Drawer>
  );
}
