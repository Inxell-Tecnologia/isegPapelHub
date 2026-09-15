import { useMemo } from 'react';
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Empty,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import type { GrantResponse, GrantSubjectsLimitExceededResponse } from '@gdoc/shared';
import { GrantResourceType, Permission } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { useSession } from '../auth/session-context';
import { useAuthorOptions } from '../busca/queries';
import { formatDate } from '../navegacao/format';
import { useCreateGrant, useGrants, useRevokeGrant } from './queries';

interface PermissoesModalProps {
  resourceType: GrantResourceType;
  resourceId: string;
  resourceName: string;
  open: boolean;
  onClose: () => void;
}

interface GrantFormValues {
  subjectUserIds: string[];
  permissions: Permission[];
  expiresAt?: Dayjs | null;
}

function isGrantSubjectsLimitExceeded(
  details: unknown,
): details is GrantSubjectsLimitExceededResponse {
  return (
    typeof details === 'object' &&
    details !== null &&
    (details as { error?: unknown }).error === 'grant_subjects_limit_exceeded'
  );
}

/**
 * Rótulo pt-BR por verbo (design.md D6) — fonte única é o enum `Permission`
 * de `@gdoc/shared`. Exportado para reuso pela central de notificações
 * (change `expiracao-permissoes`), que também precisa nomear verbos.
 */
export const VERB_LABEL: Record<Permission, string> = {
  [Permission.VIEW]: 'Visualizar',
  [Permission.DOWNLOAD]: 'Baixar',
  [Permission.UPLOAD]: 'Enviar',
  [Permission.RENAME]: 'Renomear',
  [Permission.DELETE]: 'Excluir',
};

const VERB_OPTIONS = Object.values(Permission).map((permission) => ({
  value: permission,
  label: VERB_LABEL[permission],
}));

/** Rótulo do prazo de uma concessão (change `expiracao-permissoes`, design.md D2). */
function expiryLabel(grant: GrantResponse): string {
  if (!grant.expiresAt) return 'Permanente';
  return grant.expired
    ? `Expirada em ${formatDate(grant.expiresAt)}`
    : `Até ${formatDate(grant.expiresAt)}`;
}

/**
 * Diálogo de gestão de permissões de um recurso (US 4.1, `web-permissoes`,
 * design.md D1). Ponto de entrada é a ação "Permissões" por-linha do
 * explorador — não existe tela global, pois `GET /grants` é sempre por
 * recurso.
 */
export function PermissoesModal({
  resourceType,
  resourceId,
  resourceName,
  open,
  onClose,
}: PermissoesModalProps) {
  const { message } = App.useApp();
  const { identity } = useSession();
  const [form] = Form.useForm<GrantFormValues>();
  const selectedSubjectIds = Form.useWatch('subjectUserIds', form) ?? [];

  const { data: grantsData } = useGrants(resourceType, resourceId, open);
  const authorOptions = useAuthorOptions(identity?.role);
  const createGrant = useCreateGrant(resourceType, resourceId);
  const revokeGrant = useRevokeGrant(resourceType, resourceId);

  // design.md D4: nome vem do mapa id→nome de `GET /users`; sem correspondência
  // (ou falha da chamada) cai no próprio UUID como rótulo — degradação suave.
  const personNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of authorOptions.data ?? []) {
      map.set(option.value, option.label);
    }
    return map;
  }, [authorOptions.data]);

  const grantsByPerson = useMemo(() => {
    const map = new Map<string, GrantResponse[]>();
    for (const grant of grantsData?.grants ?? []) {
      const list = map.get(grant.subjectUserId) ?? [];
      list.push(grant);
      map.set(grant.subjectUserId, list);
    }
    return map;
  }, [grantsData]);

  // design.md D6: reconceder faz o prazo informado prevalecer — sem
  // oferecer o campo em branco como se fosse neutro, quem concede precisa
  // ver o que cada colaborador selecionado já tem antes de decidir deixar em
  // branco. Colaborador selecionado sem concessão prévia não gera bloco.
  const selectedSubjectsWithGrants = selectedSubjectIds
    .map((subjectId) => ({ subjectId, grants: grantsByPerson.get(subjectId) ?? [] }))
    .filter(({ grants }) => grants.length > 0);

  // design.md D6: teto excedido tem aviso próprio; demais recusas mantêm a
  // mensagem neutra que não distingue 403 de 404 (fail-closed do servidor).
  function handleMutationError(err: unknown) {
    if (err instanceof ApiError) {
      if (isGrantSubjectsLimitExceeded(err.details)) {
        message.error('Muitos colaboradores selecionados. Reduza a seleção e tente novamente.');
        return;
      }
      message.error('Não foi possível concluir a operação de permissões.');
      return;
    }
    message.error('Não foi possível concluir a operação. Tente novamente.');
  }

  async function handleGrant(values: GrantFormValues) {
    try {
      await createGrant.mutateAsync({
        subjectUserIds: values.subjectUserIds,
        resourceType,
        resourceId,
        permissions: values.permissions,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      });
      form.resetFields();
    } catch (err) {
      handleMutationError(err);
    }
  }

  async function handleRevoke(grantId: string) {
    try {
      await revokeGrant.mutateAsync(grantId);
    } catch (err) {
      handleMutationError(err);
    }
  }

  return (
    <Modal
      title={`Permissões — ${resourceName}`}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Fechar</Button>}
      destroyOnClose
      width={640}
    >
      {resourceType === GrantResourceType.FOLDER && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Concessão vale só para esta pasta"
          description="Conceder um verbo aqui libera apenas a própria pasta — não propaga acesso aos arquivos e subpastas internos, que exigem concessão própria."
        />
      )}

      <Form<GrantFormValues> form={form} layout="vertical" onFinish={handleGrant}>
        <Form.Item
          name="subjectUserIds"
          label="Colaborador(es)"
          rules={[
            { required: true, type: 'array', min: 1, message: 'Selecione ao menos um colaborador' },
          ]}
        >
          <Select
            mode="multiple"
            showSearch
            placeholder="Selecione um ou mais colaboradores"
            loading={authorOptions.isLoading}
            disabled={authorOptions.isError}
            options={authorOptions.data ?? []}
            optionFilterProp="label"
            maxTagCount="responsive"
          />
        </Form.Item>
        {authorOptions.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="Não foi possível carregar a lista de colaboradores. Concessão indisponível no momento."
          />
        )}
        <Form.Item
          name="permissions"
          label="Verbos"
          rules={[
            { required: true, type: 'array', min: 1, message: 'Selecione ao menos um verbo' },
          ]}
        >
          <Checkbox.Group options={VERB_OPTIONS} />
        </Form.Item>
        {selectedSubjectsWithGrants.map(({ subjectId, grants }) => (
          <Typography.Paragraph
            key={subjectId}
            type="secondary"
            style={{ fontSize: 12, marginTop: -8 }}
          >
            Prazo atual de {personNameById.get(subjectId) ?? subjectId} neste recurso:{' '}
            {grants
              .map((grant) => `${VERB_LABEL[grant.permission]} (${expiryLabel(grant)})`)
              .join(', ')}
            .
          </Typography.Paragraph>
        ))}
        <Form.Item
          name="expiresAt"
          label="Prazo de expiração (opcional)"
          extra="Em branco = concessão permanente. Reconceder em branco um verbo que tinha prazo o torna permanente; reconceder com novo prazo o substitui."
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD/MM/YYYY"
            disabledDate={(date) => date.isBefore(new Date(), 'day')}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={createGrant.isPending}>
            Conceder
          </Button>
        </Form.Item>
      </Form>

      <Divider />

      <h4>Concessões</h4>
      <div>
        {grantsByPerson.size === 0 ? (
          <Empty description="Nenhuma concessão" />
        ) : (
          Array.from(grantsByPerson.entries()).map(([subjectUserId, grants]) => (
            <div key={subjectUserId} style={{ marginBottom: 12 }}>
              <strong>{personNameById.get(subjectUserId) ?? subjectUserId}</strong>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {grants.map((grant) => (
                  <Space key={grant.id}>
                    <Tag>{VERB_LABEL[grant.permission]}</Tag>
                    <Tag color={grant.expired ? 'red' : grant.expiresAt ? 'orange' : 'default'}>
                      {expiryLabel(grant)}
                    </Tag>
                    <Popconfirm
                      title="Revogar permissão"
                      description={`Remover "${VERB_LABEL[grant.permission]}" deste colaborador sobre este recurso?`}
                      okText="Sim, revogar"
                      cancelText="Cancelar"
                      onConfirm={() => handleRevoke(grant.id)}
                    >
                      <Button size="small" danger>
                        Revogar
                      </Button>
                    </Popconfirm>
                  </Space>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
