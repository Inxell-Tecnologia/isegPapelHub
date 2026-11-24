import { useEffect } from 'react';
import { Alert, App, Form, Input, InputNumber, Modal, Select, Switch, Typography } from 'antd';
import type { PersonResponse } from '@gdoc/shared';
import { READING_OVERSIGHTS, ReadingOversight, UserRole } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { ACOMPANHAMENTO_LABEL, SEM_ACOMPANHAMENTO } from '../shell/acompanhamento-label';
import { useSession } from '../auth/session-context';
import { ROLE_LABEL } from '../shell/role-label';
import { useUnits } from '../unidades/queries';
import { useSectors } from '../setores/queries';
import { useCreatePerson, useUpdatePerson } from './queries';
import { formatFileSize } from '../navegacao/format';

/**
 * Fator de conversão da cota (change `cota-por-usuario`, design.md D7): o
 * contrato da API é em **bytes**, como todo o domínio de armazenamento; GB
 * existe só na borda, para quem digita. Mesma base 1024 do `formatFileSize`,
 * para que o valor digitado e o volume exibido ao lado falem a mesma língua.
 */
const BYTES_POR_GB = 1024 * 1024 * 1024;

interface PessoaFormModalProps {
  /** `undefined` ⇒ modo criar; presente ⇒ modo editar, pré-preenchido (design.md D3). */
  target: PersonResponse | undefined;
  open: boolean;
  onClose: () => void;
}

/** Valor do `Select` para "não acompanha" — o `Select` não guarda `null`. */
const NAO_ACOMPANHA = 'nenhum';

interface PessoaFormValues {
  fullName: string;
  email: string;
  password?: string;
  unitId?: string;
  phone?: string;
  jobTitle?: string;
  /** `undefined` ⇒ sem setor; na edição, envia `null` para remover o vínculo. */
  sectorId?: string;
  notes?: string;
  role: UserRole;
  /** Alcance do acompanhamento de leituras; `NAO_ACOMPANHA` ⇒ `null`. */
  readingOversight?: ReadingOversight | typeof NAO_ACOMPANHA;
  /** `true` ⇒ a pessoa segue o padrão da plataforma (envia `null`). */
  quotaSeguePadrao?: boolean;
  /** Exceção nominal em GB; convertida para bytes no envio. */
  storageQuotaGb?: number | null;
}

const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.COLLABORATOR]: 0,
  [UserRole.UNIT_ADMIN]: 1,
  [UserRole.GLOBAL_ADMIN]: 2,
};

/**
 * `Modal` + `Form` de criar/editar pessoa (US 1.1, `web-pessoas`, design.md
 * D3). Cadastro chama `POST /users` (com senha inicial); edição chama
 * `PATCH /users/:id` (sem senha; o e-mail é editável desde o change
 * `edicao-email-pessoa`).
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

  // Cota individual é exclusiva do `global_admin` (design.md D3) e só na
  // edição — a concessão pressupõe a pessoa já existente e o consumo dela à
  // vista. Para `unit_admin` o campo **não aparece**: nem desabilitado, que
  // sugeriria uma permissão inexistente. A trava aqui é espelho do servidor,
  // que recusa a requisição inteira com 403; nunca a linha de defesa.
  const podeEditarCota = isEdit && identity?.role === UserRole.GLOBAL_ADMIN;
  const seguePadrao = Form.useWatch('quotaSeguePadrao', form);
  const cotaGbDigitada = Form.useWatch('storageQuotaGb', form);
  const cotaAbaixoDoUso =
    podeEditarCota &&
    !seguePadrao &&
    typeof cotaGbDigitada === 'number' &&
    cotaGbDigitada * BYTES_POR_GB < (target?.storageUsedBytes ?? 0);
  const { data: units } = useUnits({ onlyActive: true, enabled: showUnitSelector });

  // Troca de e-mail (change `edicao-email-pessoa`, design.md D6): o e-mail é o
  // login, e o sistema não avisa a pessoa — o aviso existe para que o
  // administrador comunique a troca. Só aparece quando o valor difere do atual.
  const emailDigitado = Form.useWatch('email', form);
  const emailAlterado =
    isEdit && typeof emailDigitado === 'string' && emailDigitado !== target.email;

  // Unidade de **destino** do cadastro, que é quem define a lista de setores
  // oferecida (change `funcao-e-setor-na-identidade`, capability
  // `web-pessoas`):
  //
  // - editando, é a unidade da pessoa editada — inclusive quando um
  //   `global_admin` edita alguém de outra unidade;
  // - cadastrando como `global_admin`, é a unidade escolhida no formulário;
  // - cadastrando como `unit_admin`, é a própria (o servidor força, e aqui
  //   `undefined` faz a consulta usar a unidade do contexto).
  const unidadeNoFormulario = Form.useWatch('unitId', form);
  const unidadeDeDestino = isEdit
    ? target.unitId
    : showUnitSelector
      ? unidadeNoFormulario
      : undefined;
  const unidadePropria = unidadeDeDestino === undefined || unidadeDeDestino === identity?.unitId;
  const { data: setores } = useSectors({
    unitId: unidadePropria ? undefined : unidadeDeDestino,
    // Sem unidade escolhida ainda, não há lista a pedir — e a consulta
    // pouparia um 403 previsível.
    enabled: isEdit || !showUnitSelector || Boolean(unidadeNoFormulario),
  });

  // Trocar a unidade repõe a lista e **descarta** a escolha anterior: sem
  // isso, o formulário enviaria setor de outra unidade e o servidor recusaria
  // a requisição inteira (capability `gestao-pessoas`, fail-closed).
  useEffect(() => {
    if (isEdit || !showUnitSelector) return;
    form.setFieldValue('sectorId', undefined);
  }, [unidadeNoFormulario, form, isEdit, showUnitSelector]);

  const opcoesDeSetor = (setores ?? []).map((setor) => ({
    value: setor.id,
    label: setor.name,
  }));

  useEffect(() => {
    if (!open) return;
    if (target) {
      form.setFieldsValue({
        fullName: target.fullName ?? '',
        email: target.email,
        phone: target.phone ?? undefined,
        jobTitle: target.jobTitle ?? undefined,
        sectorId: target.sectorId ?? undefined,
        notes: target.notes ?? undefined,
        role: target.role,
        readingOversight: target.readingOversight ?? NAO_ACOMPANHA,
        quotaSeguePadrao: target.storageQuotaBytes === null,
        storageQuotaGb:
          target.storageQuotaBytes === null ? undefined : target.storageQuotaBytes / BYTES_POR_GB,
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

  // Acompanhamento de leituras (change `gestor-de-acompanhamento`). A opção
  // "todas as unidades" só é oferecida ao administrador global (design.md D3)
  // — ou exibida, desabilitada, quando já é o valor da pessoa editada. O campo
  // fica travado na própria conta (D4) e, para quem não é global, na pessoa
  // que tem "todas as unidades": nesses casos ele nem é enviado, porque o
  // servidor recusaria a requisição inteira.
  const ehGlobal = identity?.role === UserRole.GLOBAL_ADMIN;
  const alvoTemTodasAsUnidades = target?.readingOversight === ReadingOversight.ALL_UNITS;
  const acompanhamentoTravado = isSelf || (alvoTemTodasAsUnidades && !ehGlobal);
  const opcoesDeAcompanhamento = [
    { value: NAO_ACOMPANHA, label: SEM_ACOMPANHAMENTO },
    ...READING_OVERSIGHTS.filter(
      (alcance) => alcance !== ReadingOversight.ALL_UNITS || ehGlobal || alvoTemTodasAsUnidades,
    ).map((alcance) => ({ value: alcance, label: ACOMPANHAMENTO_LABEL[alcance] })),
  ];
  const acompanhamentoEnviado = (values: PessoaFormValues) =>
    !values.readingOversight || values.readingOversight === NAO_ACOMPANHA
      ? null
      : values.readingOversight;

  async function handleSubmit(values: PessoaFormValues) {
    try {
      if (target) {
        await updatePerson.mutateAsync({
          id: target.id,
          body: {
            fullName: values.fullName,
            // Só vai no corpo se mudou (design.md D6): não sobrescreve uma
            // troca concorrente com o valor que o formulário carregou.
            ...(values.email !== target.email ? { email: values.email } : {}),
            phone: values.phone || undefined,
            jobTitle: values.jobTitle || undefined,
            // `null` (não `undefined`) quando a escolha foi limpa: é o que
            // **remove** o vínculo. Omitir preservaria o setor vigente, e a
            // pessoa ficaria presa ao setor antigo sem nenhum aviso.
            sectorId: values.sectorId ?? null,
            notes: values.notes || undefined,
            role: values.role,
            ...(acompanhamentoTravado ? {} : { readingOversight: acompanhamentoEnviado(values) }),
            // Só o `global_admin` manda o campo. Quem não pode concedê-lo o
            // omite por completo: enviar o valor vigente "sem querer" faria o
            // servidor recusar a requisição inteira (design.md D3).
            ...(podeEditarCota
              ? {
                  storageQuotaBytes: values.quotaSeguePadrao
                    ? null
                    : Math.round((values.storageQuotaGb ?? 0) * BYTES_POR_GB),
                }
              : {}),
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
          sectorId: values.sectorId || undefined,
          notes: values.notes || undefined,
          role: values.role,
          readingOversight: acompanhamentoEnviado(values),
        });
      }
      onClose();
    } catch (err) {
      // 409 `invalid_sector`: o setor escolhido não é da unidade de destino —
      // na prática, lista obsoleta depois de a unidade mudar. Sinaliza no
      // campo de setor, não como falha genérica.
      // 409 `reading_oversight_requires_sector` (design.md D2): gestor do setor
      // sem setor. Explicado no próprio campo, sem perder o preenchimento.
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.message === 'reading_oversight_requires_sector'
      ) {
        form.setFields([
          {
            name: 'readingOversight',
            errors: ['Gestor do setor precisa de um setor: escolha o setor da pessoa acima.'],
          },
        ]);
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.message === 'invalid_sector') {
        form.setFields([{ name: 'sectorId', errors: ['Setor indisponível; escolha outro'] }]);
        return;
      }
      // gestao-de-unidades D7: 409 "unit is disabled" (unidade desativada
      // escolhida) sinaliza no seletor de unidade, não no e-mail.
      if (err instanceof ApiError && err.status === 409 && err.message === 'unit is disabled') {
        form.setFields([{ name: 'unitId', errors: ['Unidade desativada; escolha outra'] }]);
        return;
      }
      // design.md D6: 409 (e-mail já em uso) sinaliza no campo, mantendo o
      // modal aberto com o restante preenchido — não é uma falha genérica.
      // Vale no cadastro e, desde o change `edicao-email-pessoa`, na edição;
      // casa pela mensagem para não engolir um 409 de outra natureza.
      if (err instanceof ApiError && err.status === 409 && err.message === 'email already in use') {
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
          rules={[{ required: true, type: 'email', message: 'Informe um e-mail válido' }]}
          extra={
            emailAlterado
              ? 'A pessoa passará a entrar com este novo e-mail, com a mesma senha. O sistema não a avisa: comunique a troca.'
              : undefined
          }
        >
          <Input autoComplete="off" />
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
        {/* Lista **fechada**, não digitação livre (resposta 5a do cliente):
            setor passa a escolher o público da leitura obrigatória, e grafia
            divergente deixaria gente fora do envio. `allowClear` é o que
            permite deixar a pessoa sem setor — estado válido, e o único
            possível enquanto a lista oficial de cada unidade não chega. */}
        <Form.Item
          name="sectorId"
          label="Setor"
          extra={
            opcoesDeSetor.length === 0
              ? 'Nenhum setor cadastrado nesta unidade ainda. Use "Setores" na página de colaboradores.'
              : undefined
          }
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Sem setor"
            options={opcoesDeSetor}
          />
        </Form.Item>
        <Form.Item name="notes" label="Observação">
          <Input.TextArea rows={2} />
        </Form.Item>
        {podeEditarCota && (
          <>
            <Form.Item
              name="quotaSeguePadrao"
              label="Cota de armazenamento"
              valuePropName="checked"
              extra="Desligue para conceder uma cota individual a esta pessoa."
            >
              <Switch checkedChildren="Padrão da plataforma" unCheckedChildren="Cota individual" />
            </Form.Item>
            {!seguePadrao && (
              <Form.Item
                name="storageQuotaGb"
                label="Cota individual (GB)"
                rules={[{ required: true, message: 'Informe a cota em GB' }]}
              >
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            )}
            <Typography.Paragraph type="secondary" style={{ marginTop: -12 }}>
              Em uso hoje: {formatFileSize(target?.storageUsedBytes ?? 0)}.
            </Typography.Paragraph>
            {/* design.md D5: rebaixar abaixo do consumo é permitido — congelar
                uma conta de propósito é uso legítimo —, mas nunca deve ser
                acidental. O aviso informa; não impede a confirmação. */}
            {cotaAbaixoDoUso && (
              <Alert
                type="warning"
                showIcon
                message="Cota menor que o espaço já utilizado"
                description="Esta pessoa ficará impedida de enviar novos arquivos até liberar espaço, e só conseguirá substituir uma versão quando a própria troca couber na cota. Excluir não libera de imediato: os arquivos continuam ocupando cota na lixeira até o expurgo."
              />
            )}
          </>
        )}
        <Form.Item
          name="role"
          label="Papel"
          rules={[{ required: true, message: 'Selecione um papel' }]}
        >
          <Select options={roleOptions} />
        </Form.Item>
        <Form.Item
          name="readingOversight"
          label="Acompanhamento de leituras"
          initialValue={NAO_ACOMPANHA}
          extra={
            isSelf
              ? 'Você não altera o seu próprio acompanhamento.'
              : 'Quem acompanha vê quem leu e quem não leu os documentos de leitura obrigatória. Não dá acesso a arquivos nem a esta tela.'
          }
        >
          <Select options={opcoesDeAcompanhamento} disabled={acompanhamentoTravado} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
