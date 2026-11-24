import { useEffect } from 'react';
import { DatePicker, Form, Input, InputNumber, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import {
  DOCUMENT_LIFECYCLE_STATES,
  DOCUMENT_TYPES,
  DocumentType as DocumentTypeEnum,
  requiredFieldsForType,
  type DocumentControlInput,
  type DocumentLifecycleState,
  type DocumentType,
} from '@gdoc/shared';
import {
  DOCUMENT_LIFECYCLE_LABEL,
  DOCUMENT_TYPE_ACRONYM,
  DOCUMENT_TYPE_LABEL,
} from '../shell/document-control-labels';

/**
 * Campos do formulário de dados de controle (Épico 10), compartilhados entre
 * o envio de **um** documento (`UploadArea`) e a edição posterior
 * (`DocumentControlModal`).
 *
 * Um componente só porque os dois lugares pedem os mesmos campos, com as
 * mesmas regras de preenchimento — duas cópias divergiriam na primeira
 * correção de rótulo. O que varia é a **obrigatoriedade**: no envio são
 * exigidos os campos que o **tipo** pede, antes de publicar; na edição nada é
 * exigido, porque editar serve justamente para completar aos poucos o cadastro
 * de um arquivo que entrou pendente.
 *
 * A exigência é derivada de `requiredFieldsForType` — a **mesma** constante
 * que o servidor consulta (design.md D9 do change
 * `tabela-de-cadastro-no-envio-em-lote`). Era uma lista escrita à mão aqui, e
 * foi assim que o formulário ficou exigindo quatro campos depois que o
 * servidor passou a exigir cinco.
 */
export interface DocumentControlFormValues {
  documentType?: DocumentType | null;
  documentCode?: string | null;
  documentRevision?: number | null;
  responsibleSector?: string | null;
  nextReviewAt?: Dayjs | null;
  lifecycleState?: DocumentLifecycleState | null;
}

/** Valores do formulário → corpo da API (`YYYY-MM-DD`, sem hora nem fuso). */
export function toDocumentControlInput(values: DocumentControlFormValues): DocumentControlInput {
  const input: DocumentControlInput = {};
  if ('documentType' in values) input.documentType = values.documentType ?? null;
  if ('documentCode' in values) input.documentCode = values.documentCode ?? null;
  if ('documentRevision' in values) input.documentRevision = values.documentRevision ?? null;
  if ('responsibleSector' in values) input.responsibleSector = values.responsibleSector ?? null;
  if ('nextReviewAt' in values) {
    input.nextReviewAt = values.nextReviewAt ? values.nextReviewAt.format('YYYY-MM-DD') : null;
  }
  if ('lifecycleState' in values) input.lifecycleState = values.lifecycleState ?? null;
  return input;
}

const TYPE_OPTIONS = DOCUMENT_TYPES.map((tipo) => ({
  value: tipo,
  label: `${DOCUMENT_TYPE_ACRONYM[tipo]} — ${DOCUMENT_TYPE_LABEL[tipo]}`,
}));

const LIFECYCLE_OPTIONS = DOCUMENT_LIFECYCLE_STATES.map((estado) => ({
  value: estado,
  label: DOCUMENT_LIFECYCLE_LABEL[estado],
}));

export function DocumentControlFormItems({
  obrigatorios,
  incluirEstado = false,
}: {
  /** Exige os campos que o tipo escolhido pede — o envio de um documento (US 10.5). */
  obrigatorios: boolean;
  /** Oferece o estado declarado (vigente/em revisão/obsoleto) — só na edição. */
  incluirEstado?: boolean;
}) {
  // O tipo escolhido decide o que mais é exigido, e o Arquivo geral **recusa**
  // código, revisão e próxima revisão (US 10.8): mantê-los habilitados
  // produziria uma recusa do servidor sobre campo que a pessoa preencheu de
  // boa-fé. Vazios e indisponíveis, como na tabela de cadastro (design.md D8).
  const form = Form.useFormInstance<DocumentControlFormValues>();
  const tipo = Form.useWatch<DocumentType | null | undefined>('documentType', form);
  const exigidos = new Set(requiredFieldsForType(tipo ?? null));
  const arquivoGeral = tipo === DocumentTypeEnum.GENERAL_FILE;

  // Esvaziar, e não apenas desabilitar: campo desabilitado continua submetendo
  // o seu valor, e o servidor responderia `general_file_rejects_control_fields`
  // sobre um campo que a pessoa não vê mais (design.md D8).
  useEffect(() => {
    if (!arquivoGeral) return;
    form.setFieldsValue({ documentCode: null, documentRevision: null, nextReviewAt: null });
  }, [arquivoGeral, form]);

  function regras(campo: keyof DocumentControlInput, mensagem: string) {
    return obrigatorios && exigidos.has(campo) ? [{ required: true, message: mensagem }] : [];
  }

  return (
    <>
      <Form.Item
        name="documentType"
        label="Tipo"
        rules={obrigatorios ? [{ required: true, message: 'Informe o tipo do documento' }] : []}
      >
        <Select options={TYPE_OPTIONS} placeholder="Selecione o tipo" allowClear={!obrigatorios} />
      </Form.Item>
      <Form.Item
        name="documentCode"
        label="Código"
        extra={
          arquivoGeral
            ? 'Arquivo geral não tem código: pede só o título.'
            : 'Único na sua unidade. Ex.: PRT-NSP-001.'
        }
        rules={regras('documentCode', 'Informe o código do documento')}
      >
        <Input maxLength={60} disabled={arquivoGeral} />
      </Form.Item>
      <Form.Item
        name="documentRevision"
        label="Revisão"
        extra="Número da revisão vigente; apresentado como Rev. 02."
        rules={regras('documentRevision', 'Informe a revisão')}
      >
        <InputNumber
          min={0}
          max={9999}
          precision={0}
          style={{ width: '100%' }}
          disabled={arquivoGeral}
        />
      </Form.Item>
      <Form.Item
        name="responsibleSector"
        label="Setor responsável"
        rules={regras('responsibleSector', 'Informe o setor ou a pessoa responsável')}
      >
        <Input maxLength={120} />
      </Form.Item>
      <Form.Item
        name="nextReviewAt"
        label="Próxima revisão"
        extra="A situação do documento é apurada pelo servidor a partir desta data."
        rules={regras('nextReviewAt', 'Informe a data da próxima revisão')}
      >
        <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabled={arquivoGeral} />
      </Form.Item>
      {incluirEstado && (
        <Form.Item
          name="lifecycleState"
          label="Situação declarada"
          extra="Em revisão e Obsoleto prevalecem sobre a data. Documento obsoleto deixa de aparecer para quem não é gestão da unidade."
        >
          <Select options={LIFECYCLE_OPTIONS} allowClear placeholder="Vigente" />
        </Form.Item>
      )}
    </>
  );
}
