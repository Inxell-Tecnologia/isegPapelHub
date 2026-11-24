import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Spin,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { READING_DEFAULT_DUE_DAYS, UserRole } from '@gdoc/shared';
import type { FileSummaryResponse, ReadingAudience, ReadingIneligibleReason } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { ROLE_LABEL } from '../shell/role-label';
import { formatarRevisao } from '../shell/document-control-labels';
import { formatDate } from '../navegacao/format';
import {
  useAudienceOptions,
  useAudiencePreview,
  useCreateReadingCampaign,
  useReadingFileState,
} from './queries';

interface Valores {
  wholeUnit: boolean;
  sectorIds: string[];
  roles: UserRole[];
  userIds: string[];
  dueDate: Dayjs;
  message?: string;
}

const MOTIVO: Record<ReadingIneligibleReason, string> = {
  not_controlled:
    'Só documentos controlados (com tipo, código e revisão) podem ser leitura obrigatória. Arquivo geral e arquivo pendente de cadastro não podem.',
  not_in_force:
    'Só documento em vigor pode ser leitura obrigatória. Este está em revisão, vencido ou obsoleto.',
  not_previewable:
    'Só documento que abre no visualizador pode ser leitura obrigatória — quem lê precisa abri-lo aqui para confirmar a ciência.',
};

/** Perfis oferecidos no público: os papéis de quem trabalha na unidade. */
const PERFIS = [UserRole.COLLABORATOR, UserRole.UNIT_ADMIN];

function audienceDe(v: Partial<Valores>): ReadingAudience {
  return {
    wholeUnit: v.wholeUnit === true,
    sectorIds: v.sectorIds ?? [],
    roles: v.roles ?? [],
    userIds: v.userIds ?? [],
  };
}

/**
 * Marcar documento como leitura obrigatória (US 12.2, change
 * `leitura-obrigatoria`; demanda nº 2, seção 3.2, etapa 1).
 *
 * Quem decide se a pessoa pode marcar, se o documento é elegível e quantas
 * pessoas o público alcança é **o servidor**: o formulário só apresenta o
 * veredito e a prévia. Revisão anterior marcada e a vigente não: o público vem
 * preenchido com o anterior (design.md D9).
 */
export function MarcarLeituraModal({
  file,
  onClose,
}: {
  file: FileSummaryResponse | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Valores>();
  const fileId = file?.id ?? null;
  const estado = useReadingFileState(fileId);
  const podeFormular =
    !!estado.data?.canMark && !estado.data.ineligibleReason && !estado.data.current;
  const opcoes = useAudienceOptions(fileId, podeFormular);
  const previa = useAudiencePreview();
  const criar = useCreateReadingCampaign();
  const [contagem, setContagem] = useState<number | null>(null);

  const anterior = estado.data?.previous ?? null;

  useEffect(() => {
    if (!podeFormular) return;
    form.setFieldsValue({
      wholeUnit: anterior?.audience.wholeUnit ?? false,
      sectorIds: anterior?.audience.sectorIds ?? [],
      roles: anterior?.audience.roles ?? [],
      userIds: anterior?.audience.userIds ?? [],
      dueDate: dayjs().add(READING_DEFAULT_DUE_DAYS, 'day'),
      message: undefined,
    });
    atualizarPrevia(form.getFieldsValue());
    // Reinicia o formulário só quando muda o que ele apresenta (elegível, ou
    // outra marcação anterior) — não a cada render.
  }, [podeFormular, anterior?.id]);

  function atualizarPrevia(v: Partial<Valores>) {
    if (!fileId) return;
    const audience = audienceDe(v);
    if (
      !audience.wholeUnit &&
      !audience.sectorIds.length &&
      !audience.roles.length &&
      !audience.userIds.length
    ) {
      setContagem(0);
      return;
    }
    previa.mutate(
      { fileId, audience },
      {
        onSuccess: (r) => setContagem(r.count),
        onError: () => setContagem(null),
      },
    );
  }

  const opcoesDePessoa = useMemo(
    () =>
      (opcoes.data?.people ?? []).map((p) => ({
        value: p.id,
        label: p.sectorName ? `${p.name} (${p.sectorName})` : p.name,
      })),
    [opcoes.data],
  );

  async function confirmar(v: Valores) {
    if (!fileId) return;
    try {
      await criar.mutateAsync({
        fileId,
        audience: audienceDe(v),
        dueDate: v.dueDate.format('YYYY-MM-DD'),
        message: v.message?.trim() || undefined,
      });
      message.success('Leitura obrigatória marcada.');
      onClose();
    } catch (err) {
      const codigo = err instanceof ApiError ? err.message : '';
      const textos: Record<string, string> = {
        already_marked: 'Esta revisão já foi marcada como leitura obrigatória.',
        not_eligible: 'O documento não pode mais ser marcado como leitura obrigatória.',
        invalid_audience:
          'Algum setor ou pessoa escolhido não está mais disponível. Revise o público.',
        empty_audience: 'Escolha ao menos um grupo ou pessoa para o público.',
        invalid_due_date: 'O prazo não pode ser uma data passada.',
      };
      message.error(textos[codigo] ?? 'Não foi possível marcar a leitura obrigatória.');
    }
  }

  function corpo() {
    if (estado.isLoading) return <Spin style={{ display: 'block', margin: '32px auto' }} />;
    if (estado.isError || !estado.data) {
      return (
        <Result
          status="error"
          title="Não foi possível carregar a leitura obrigatória deste documento"
        />
      );
    }
    const e = estado.data;
    if (!e.canMark) {
      return (
        <Result
          status="403"
          title="Sem permissão"
          subTitle="Só quem pode editar os dados de controle do documento marca leitura obrigatória."
        />
      );
    }
    if (e.ineligibleReason) {
      return <Alert type="info" showIcon message={MOTIVO[e.ineligibleReason]} />;
    }
    if (e.current) {
      return (
        <Alert
          type="success"
          showIcon
          message={`A ${formatarRevisao(e.current.documentRevision)} já é leitura obrigatória.`}
          description={`Marcada em ${formatDate(e.current.createdAt)}, com prazo até ${dayjs(
            e.current.dueDate,
          ).format('DD/MM/YYYY')}, para ${e.current.assignedCount} pessoa(s).`}
        />
      );
    }
    return (
      <Form
        form={form}
        layout="vertical"
        onFinish={confirmar}
        onValuesChange={(_, todos) => atualizarPrevia(todos)}
      >
        {anterior && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={`A revisão mudou: a ${formatarRevisao(
              anterior.documentRevision,
            )} teve leitura obrigatória.`}
            description="O público anterior já está preenchido. Confirme para pedir nova ciência da revisão vigente a essas pessoas."
          />
        )}
        <Typography.Paragraph type="secondary">
          Público: combine quantos grupos quiser — entra quem estiver em qualquer um deles.
        </Typography.Paragraph>
        <Form.Item name="wholeUnit" valuePropName="checked">
          <Checkbox>Toda a unidade</Checkbox>
        </Form.Item>
        <Form.Item name="sectorIds" label="Setores">
          <Select
            mode="multiple"
            allowClear
            optionFilterProp="label"
            placeholder="Nenhum setor"
            options={(opcoes.data?.sectors ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
        </Form.Item>
        <Form.Item name="roles" label="Perfis">
          <Select
            mode="multiple"
            allowClear
            placeholder="Nenhum perfil"
            options={PERFIS.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </Form.Item>
        <Form.Item name="userIds" label="Pessoas">
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Nenhuma pessoa"
            options={opcoesDePessoa}
          />
        </Form.Item>
        <Form.Item
          name="dueDate"
          label="Prazo"
          rules={[{ required: true, message: 'Informe o prazo' }]}
          extra={`Padrão: ${READING_DEFAULT_DUE_DAYS} dias.`}
        >
          <DatePicker
            format="DD/MM/YYYY"
            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item name="message" label="Mensagem (opcional)">
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
        <Alert
          type={contagem ? 'info' : 'warning'}
          showIcon
          message={
            contagem === null
              ? 'Calculando quantas pessoas serão incluídas…'
              : contagem === 0
                ? 'Nenhuma pessoa será incluída. Escolha ao menos um grupo ou pessoa.'
                : `${contagem} pessoa(s) serão incluídas.`
          }
        />
      </Form>
    );
  }

  return (
    <Modal
      open={file !== null}
      title={`Leitura obrigatória — ${file?.documentCode ?? file?.fileName ?? ''}`}
      onCancel={onClose}
      okText="Marcar leitura obrigatória"
      cancelText="Cancelar"
      onOk={() => form.submit()}
      okButtonProps={{
        disabled: !podeFormular || !contagem,
        loading: criar.isPending,
        style: podeFormular ? undefined : { display: 'none' },
      }}
      destroyOnHidden
    >
      {corpo()}
    </Modal>
  );
}
