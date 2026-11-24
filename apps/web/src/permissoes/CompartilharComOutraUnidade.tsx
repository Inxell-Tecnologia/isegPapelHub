import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Popconfirm,
  Radio,
  Select,
  Space,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import type { CrossUnitGrantResponse, CrossUnitPermission } from '@gdoc/shared';
import { GrantResourceType, Permission } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { RotuloDeEstado } from '../app/RotuloDeEstado';
import { formatDate } from '../navegacao/format';
import {
  useCreateCrossUnitGrant,
  useCrossUnitDestinations,
  useCrossUnitGrants,
  useCrossUnitRecipients,
  useRevokeCrossUnitGrant,
} from './queries';

interface Props {
  resourceType: GrantResourceType;
  resourceId: string;
  open: boolean;
}

interface FormValues {
  subjectUnitId?: string;
  alcance: 'unidade' | 'colaboradores';
  subjectUserIds?: string[];
  permissions: CrossUnitPermission[];
  expiresAt?: Dayjs | null;
}

/** Só leitura entre unidades (decisão 5 da proposal): visualizar e baixar. */
const VERB_LABEL: Record<CrossUnitPermission, string> = {
  [Permission.VIEW]: 'Visualizar',
  [Permission.DOWNLOAD]: 'Baixar',
};

const VERB_OPTIONS = (Object.keys(VERB_LABEL) as CrossUnitPermission[]).map((value) => ({
  value,
  label: VERB_LABEL[value],
}));

const ERROR_MESSAGE: Record<string, string> = {
  cross_unit_destination_not_allowed:
    'Este destino não é permitido. O compartilhamento entre unidades sempre envolve a SEDE.',
  grant_subjects_limit_exceeded:
    'Muitos colaboradores selecionados. Reduza a seleção e tente novamente.',
};

function expiryLabel(grant: CrossUnitGrantResponse): string {
  if (!grant.expiresAt) return 'Permanente';
  return grant.expired
    ? `Expirado em ${formatDate(grant.expiresAt)}`
    : `Até ${formatDate(grant.expiresAt)}`;
}

function destinoLabel(grant: CrossUnitGrantResponse): string {
  const unidade = grant.subjectUnitName ?? 'Unidade';
  if (!grant.subjectUserId) return `${unidade} (unidade inteira)`;
  return `${grant.subjectUserName ?? 'Colaborador'} — ${unidade}`;
}

/**
 * Seção "Compartilhar com outra unidade" do modal de permissões (PRD US 5.2,
 * spec `web-permissoes`, design.md D5/D7/D8). Os destinos vêm do servidor —
 * as demais unidades, se esta é a SEDE; só a SEDE, nos outros casos —, e a SPA
 * não infere regra alguma: o servidor revalida tudo.
 */
export function CompartilharComOutraUnidade({ resourceType, resourceId, open }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [destinoEscolhido, setDestinoEscolhido] = useState<string | undefined>();
  const alcance = Form.useWatch('alcance', form) ?? 'unidade';

  const destinos = useCrossUnitDestinations(open);
  const compartilhamentos = useCrossUnitGrants(resourceType, resourceId, open);
  const destinatarios = useCrossUnitRecipients(
    alcance === 'colaboradores' ? destinoEscolhido : undefined,
  );
  const criar = useCreateCrossUnitGrant(resourceType, resourceId);
  const revogar = useRevokeCrossUnitGrant(resourceType, resourceId);

  function tratarErro(err: unknown) {
    if (err instanceof ApiError && ERROR_MESSAGE[err.message]) {
      message.error(ERROR_MESSAGE[err.message]);
      return;
    }
    message.error('Não foi possível concluir o compartilhamento entre unidades.');
  }

  async function compartilhar(values: FormValues) {
    try {
      await criar.mutateAsync({
        resourceType,
        resourceId,
        subjectUnitId: values.subjectUnitId!,
        subjectUserIds: values.alcance === 'colaboradores' ? (values.subjectUserIds ?? []) : [],
        permissions: values.permissions,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      });
      form.resetFields();
      setDestinoEscolhido(undefined);
      message.success('Compartilhamento entre unidades registrado.');
    } catch (err) {
      tratarErro(err);
    }
  }

  async function revogarCompartilhamento(id: string) {
    try {
      await revogar.mutateAsync(id);
    } catch (err) {
      tratarErro(err);
    }
  }

  const semSede = destinos.data && !destinos.data.headquartersDefined;
  const lista = compartilhamentos.data?.grants ?? [];

  return (
    <section aria-label="Compartilhar com outra unidade">
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Somente para visualizar e baixar. O compartilhamento entre unidades sempre envolve a SEDE.
      </Typography.Paragraph>

      {resourceType === GrantResourceType.FOLDER && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Todo o conteúdo da pasta será compartilhado"
          description="Ao compartilhar esta pasta com outra unidade, todo o conteúdo atual e futuro dela — arquivos e subpastas, inclusive o que for guardado aqui depois — fica visível para o destino."
        />
      )}

      {semSede ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Nenhuma unidade está marcada como SEDE"
          description="O compartilhamento entre unidades depende da SEDE. Peça ao Administrador Global para marcá-la na tela de Unidades."
        />
      ) : (
        <Form<FormValues>
          form={form}
          layout="vertical"
          initialValues={{ alcance: 'unidade', permissions: [Permission.VIEW] }}
          onFinish={compartilhar}
        >
          <Form.Item
            name="subjectUnitId"
            label="Unidade de destino"
            rules={[{ required: true, message: 'Selecione a unidade de destino' }]}
          >
            <Select
              placeholder="Selecione a unidade"
              loading={destinos.isLoading}
              options={(destinos.data?.destinations ?? []).map((destino) => ({
                value: destino.id,
                label: destino.isHeadquarters ? `${destino.name} (SEDE)` : destino.name,
              }))}
              onChange={(value: string) => {
                setDestinoEscolhido(value);
                form.setFieldValue('subjectUserIds', []);
              }}
            />
          </Form.Item>
          <Form.Item name="alcance" label="Para quem">
            <Radio.Group>
              <Radio value="unidade">Unidade inteira</Radio>
              <Radio value="colaboradores">Colaboradores selecionados</Radio>
            </Radio.Group>
          </Form.Item>
          {alcance === 'colaboradores' && (
            <Form.Item
              name="subjectUserIds"
              label="Colaboradores da unidade de destino"
              rules={[
                {
                  required: true,
                  type: 'array',
                  min: 1,
                  message: 'Selecione ao menos um colaborador',
                },
              ]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                disabled={!destinoEscolhido}
                loading={destinatarios.isLoading}
                placeholder={
                  destinoEscolhido
                    ? 'Selecione um ou mais colaboradores'
                    : 'Escolha a unidade primeiro'
                }
                options={(destinatarios.data?.recipients ?? []).map((colaborador) => ({
                  value: colaborador.id,
                  label: [
                    colaborador.fullName ?? 'Sem nome',
                    colaborador.jobTitle,
                    colaborador.sectorName,
                  ]
                    .filter(Boolean)
                    .join(' — '),
                }))}
              />
            </Form.Item>
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
          <Form.Item name="expiresAt" label="Prazo de expiração (opcional)">
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(date) => date.isBefore(new Date(), 'day')}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={criar.isPending}>
              Compartilhar
            </Button>
          </Form.Item>
        </Form>
      )}

      <h4>Compartilhamentos com outras unidades</h4>
      {lista.length === 0 ? (
        <Empty description="Nenhum compartilhamento com outra unidade" />
      ) : (
        lista.map((grant) => (
          <Space key={grant.id} wrap style={{ marginBottom: 8 }}>
            <strong>{destinoLabel(grant)}</strong>
            <RotuloDeEstado>{VERB_LABEL[grant.permission]}</RotuloDeEstado>
            <RotuloDeEstado
              tom={grant.expired ? 'negativo' : grant.expiresAt ? 'alerta' : 'neutro'}
            >
              {expiryLabel(grant)}
            </RotuloDeEstado>
            <Popconfirm
              title="Revogar compartilhamento"
              description={`Remover "${VERB_LABEL[grant.permission]}" de ${destinoLabel(grant)}?`}
              okText="Sim, revogar"
              cancelText="Cancelar"
              onConfirm={() => revogarCompartilhamento(grant.id)}
            >
              <Button size="small" danger>
                Revogar
              </Button>
            </Popconfirm>
          </Space>
        ))
      )}
    </section>
  );
}
