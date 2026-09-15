import { useEffect } from 'react';
import { App, Form, Input, Modal, Select } from 'antd';
import type { PersonResponse } from '@gdoc/shared';
import { UserRole } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useUnits } from '../unidades/queries';
import { useCreatePerson, useUpdatePerson } from './queries';

interface PessoaFormModalProps {
  /** `undefined` ⇒ modo criar; presente ⇒ modo editar, pré-preenchido (design.md D3). */
  target: PersonResponse | undefined;
  open: boolean;
  onClose: () => void;
}

interface PessoaFormValues {
  fullName: string;
  email: string;
  password?: string;
  unitId?: string;
  phone?: string;
  jobTitle?: string;
  workArea?: string;
  notes?: string;
  role: UserRole;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.COLLABORATOR]: 'Colaborador',
  [UserRole.UNIT_ADMIN]: 'Administrador da unidade',
  [UserRole.GLOBAL_ADMIN]: 'Administrador global',
};

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.COLLABORATOR]: 0,
  [UserRole.UNIT_ADMIN]: 1,
  [UserRole.GLOBAL_ADMIN]: 2,
};

/**
 * `Modal` + `Form` de criar/editar pessoa (US 1.1, `web-pessoas`, design.md
 * D3). Cadastro chama `POST /users` (com senha inicial); edição chama
 * `PATCH /users/:id` (sem senha, e-mail somente-leitura).
 */
export function PessoaFormModal({ target, open, onClose }: PessoaFormModalProps) {
  const { message } = App.useApp();
  const { identity } = useSession();
  const [form] = Form.useForm<PessoaFormValues>();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();

  const isEdit = target !== undefined;
  // design.md D5: na própria linha, o seletor não oferece papel abaixo do
  // atual — evita que o administrador rebaixe a si mesmo.
  const isSelf = isEdit && target.id === identity?.id;

  // gestao-de-unidades D7: só o global_admin escolhe a unidade, e apenas no
  // cadastro (mover pessoa entre unidades está fora de escopo). O unit_admin
  // não vê seletor — o servidor força `ctx.unitId`. Só busca as unidades
  // quando o seletor será exibido, para não disparar um 403 no unit_admin.
  const showUnitSelector = !isEdit && identity?.role === UserRole.GLOBAL_ADMIN;
  const { data: units } = useUnits({ onlyActive: true, enabled: showUnitSelector });

  useEffect(() => {
    if (!open) return;
    if (target) {
      form.setFieldsValue({
        fullName: target.fullName ?? '',
        email: target.email,
        phone: target.phone ?? undefined,
        jobTitle: target.jobTitle ?? undefined,
        workArea: target.workArea ?? undefined,
        notes: target.notes ?? undefined,
        role: target.role,
      });
    } else {
      form.resetFields();
    }
  }, [open, target, form]);

  // design.md D4: unit_admin não vê a opção global_admin — o servidor recusa
  // criação/elevação a global_admin por unit_admin com 403 de qualquer forma.
  const roleOptions = (Object.values(UserRole) as UserRole[])
    .filter((role) => role !== UserRole.GLOBAL_ADMIN || identity?.role === UserRole.GLOBAL_ADMIN)
    .filter((role) => !isSelf || ROLE_RANK[role] >= ROLE_RANK[target!.role])
    .map((role) => ({ value: role, label: ROLE_LABEL[role] }));

  async function handleSubmit(values: PessoaFormValues) {
    try {
      if (target) {
        await updatePerson.mutateAsync({
          id: target.id,
          body: {
            fullName: values.fullName,
            phone: values.phone || undefined,
            jobTitle: values.jobTitle || undefined,
            workArea: values.workArea || undefined,
            notes: values.notes || undefined,
            role: values.role,
          },
        });
      } else {
        await createPerson.mutateAsync({
          fullName: values.fullName,
          email: values.email,
          password: values.password!,
          // gestao-de-unidades D7: só o global_admin envia unitId; para o
          // unit_admin o servidor força a própria unidade de qualquer forma.
          unitId: showUnitSelector ? values.unitId : undefined,
          phone: values.phone || undefined,
          jobTitle: values.jobTitle || undefined,
          workArea: values.workArea || undefined,
          notes: values.notes || undefined,
          role: values.role,
        });
      }
      onClose();
    } catch (err) {
      // gestao-de-unidades D7: 409 "unit is disabled" (unidade desativada
      // escolhida) sinaliza no seletor de unidade, não no e-mail.
      if (err instanceof ApiError && err.status === 409 && err.message === 'unit is disabled') {
        form.setFields([{ name: 'unitId', errors: ['Unidade desativada; escolha outra'] }]);
        return;
      }
      // design.md D6: 409 (e-mail já em uso) sinaliza no campo, mantendo o
      // modal aberto com o restante preenchido — não é uma falha genérica.
      if (err instanceof ApiError && err.status === 409) {
        form.setFields([{ name: 'email', errors: ['E-mail já está em uso'] }]);
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
    <Modal
      title={isEdit ? 'Editar colaborador' : 'Novo colaborador'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={createPerson.isPending || updatePerson.isPending}
      okText={isEdit ? 'Salvar' : 'Cadastrar'}
      cancelText="Cancelar"
      destroyOnClose
    >
      <Form<PessoaFormValues> form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="fullName"
          label="Nome"
          rules={[{ required: true, message: 'Informe um nome' }]}
        >
          <Input autoFocus />
        </Form.Item>
        <Form.Item
          name="email"
          label="E-mail"
          rules={
            isEdit ? [] : [{ required: true, type: 'email', message: 'Informe um e-mail válido' }]
          }
        >
          <Input disabled={isEdit} autoComplete="off" />
        </Form.Item>
        {!isEdit && (
          <Form.Item
            name="password"
            label="Senha inicial"
            rules={[{ required: true, message: 'Informe uma senha' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        )}
        {showUnitSelector && (
          <Form.Item
            name="unitId"
            label="Unidade"
            rules={[{ required: true, message: 'Selecione uma unidade' }]}
          >
            <Select
              placeholder="Selecione a unidade"
              options={(units ?? []).map((unit) => ({ value: unit.id, label: unit.name }))}
            />
          </Form.Item>
        )}
        <Form.Item name="phone" label="Telefone">
          <Input />
        </Form.Item>
        <Form.Item name="jobTitle" label="Função/cargo">
          <Input />
        </Form.Item>
        <Form.Item name="workArea" label="Área de trabalho">
          <Input />
        </Form.Item>
        <Form.Item name="notes" label="Observação">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          name="role"
          label="Papel"
          rules={[{ required: true, message: 'Selecione um papel' }]}
        >
          <Select options={roleOptions} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
