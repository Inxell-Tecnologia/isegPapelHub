import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { DOCUMENT_TYPES, DocumentType, type DocumentType as DocumentTypeValue } from '@gdoc/shared';
import { DOCUMENT_TYPE_ACRONYM, DOCUMENT_TYPE_LABEL } from '../shell/document-control-labels';
import {
  aplicarATodas,
  codigosEmConflito,
  contarDesfecho,
  editarLinha,
  faltantesDaLinha,
  linhaEnviavel,
  type LinhaDeCadastro,
  type ValoresDeAplicacao,
} from './cadastro-em-lote';
import { formatarBytes } from './slicing';

/**
 * Tabela de cadastro do envio em lote — uma linha por arquivo (demanda 2.1 e
 * 2.2; capability `web-upload`).
 *
 * É a **confirmação** do envio, não uma etapa a mais: apresenta a quantidade e
 * o volume que o painel "Confirmar envio" já apresentava, agora com o cadastro
 * de cada arquivo (design.md D1). Vem sempre **depois** do veredito de espaço —
 * preencher cinquenta linhas para então descobrir que a seleção não cabe joga
 * fora trabalho manual, que é incomparavelmente mais caro que o tempo de uma
 * consulta de cota.
 *
 * O estado por linha vive no componente pai como um vetor simples, e **não**
 * como um `Form` do Ant por arquivo: cinco mil arquivos seriam cinco mil
 * formulários e vinte e cinco mil `Form.Item` (design.md D2). A validação é a
 * função pura de `cadastro-em-lote.ts`, e a renderização se limita à janela
 * visível da tabela virtualizada.
 */

const TYPE_OPTIONS = DOCUMENT_TYPES.map((tipo) => ({
  value: tipo,
  label: `${DOCUMENT_TYPE_ACRONYM[tipo]} — ${DOCUMENT_TYPE_LABEL[tipo]}`,
}));

/** Altura do corpo da tabela. Fixa porque a virtualização a exige. */
const ALTURA_DO_CORPO = 460;

const ROTULO_FALTANTE: Record<string, string> = {
  titulo: 'título',
  documentType: 'tipo',
  documentCode: 'código',
  documentRevision: 'revisão',
  responsibleSector: 'responsável',
  nextReviewAt: 'próxima revisão',
};

/** Fundo âmbar da célula cujo valor é **sugestão** (design.md D4). */
const FUNDO_SUGERIDO = 'rgba(250, 173, 20, 0.12)';

function estiloSugerido(linha: LinhaDeCadastro, campo: 'documentType' | 'documentCode') {
  return linha.sugeridos.has(campo) ? { background: FUNDO_SUGERIDO } : undefined;
}

/**
 * Marca textual de sugestão, abaixo do campo. **Não é redundância da cor**: é a
 * informação em si.
 *
 * O fundo âmbar funciona no `Input` do código, mas no `Select` do tipo o
 * `.ant-select-selector` do Ant pinta o próprio fundo por cima — e, mesmo onde
 * aparece, cor sozinha não carrega informação, regra que `controle-documental`
 * já fixou para a sigla do tipo ("a sigla nunca depende da cor para ser
 * compreendida"). Uma sugestão errada precisa ser legível como sugestão por
 * quem não distingue as cores.
 */
function MarcaDeSugestao({
  linha,
  campo,
}: {
  linha: LinhaDeCadastro;
  campo: 'documentType' | 'documentCode';
}) {
  if (!linha.sugeridos.has(campo)) return null;
  return (
    <Typography.Text type="warning" style={{ fontSize: 12 }}>
      sugerido pelo nome do arquivo
    </Typography.Text>
  );
}

export interface TabelaDeCadastroProps {
  linhas: LinhaDeCadastro[];
  onChange: (linhas: LinhaDeCadastro[]) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  enviando?: boolean;
}

export function TabelaDeCadastro({
  linhas,
  onChange,
  onConfirmar,
  onCancelar,
  enviando = false,
}: TabelaDeCadastroProps) {
  const [aplicacao, setAplicacao] = useState<ValoresDeAplicacao>({});

  const conflitos = useMemo(() => codigosEmConflito(linhas), [linhas]);
  const desfecho = useMemo(() => contarDesfecho(linhas), [linhas]);
  const semTitulo = useMemo(() => linhas.filter((l) => !linhaEnviavel(l)).length, [linhas]);
  const bytes = useMemo(() => linhas.reduce((t, l) => t + l.file.size, 0), [linhas]);

  function editar<C extends keyof LinhaDeCadastro>(
    uid: string,
    campo: C,
    valor: LinhaDeCadastro[C],
  ) {
    onChange(linhas.map((l) => (l.uid === uid ? editarLinha(l, campo, valor) : l)));
  }

  const colunas = [
    {
      title: 'Situação',
      dataIndex: 'uid',
      width: 132,
      render: (_: unknown, linha: LinhaDeCadastro) => {
        const faltantes = faltantesDaLinha(linha);
        if (faltantes.length === 0) {
          return <Tag color="success">Completa</Tag>;
        }
        const nomes = faltantes.map((c) => ROTULO_FALTANTE[c] ?? c).join(', ');
        return (
          <Tooltip title={`Falta: ${nomes}`}>
            <Tag color="warning">Incompleta</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Tipo',
      dataIndex: 'documentType',
      width: 240,
      render: (_: unknown, linha: LinhaDeCadastro) => (
        <>
          <Select
            aria-label={`Tipo de ${linha.titulo}`}
            style={{ width: '100%', ...estiloSugerido(linha, 'documentType') }}
            options={TYPE_OPTIONS}
            placeholder="Selecione"
            allowClear
            value={linha.documentType ?? undefined}
            onChange={(valor: DocumentTypeValue | undefined) =>
              editar(linha.uid, 'documentType', valor ?? null)
            }
          />
          <MarcaDeSugestao linha={linha} campo="documentType" />
        </>
      ),
    },
    {
      title: 'Código',
      dataIndex: 'documentCode',
      width: 190,
      render: (_: unknown, linha: LinhaDeCadastro) => {
        const emConflito = conflitos.has(linha.uid);
        const geral = linha.documentType === DocumentType.GENERAL_FILE;
        return (
          <>
            <Tooltip title={emConflito ? 'Código repetido neste envio' : undefined}>
              <Input
                aria-label={`Código de ${linha.titulo}`}
                maxLength={60}
                disabled={geral}
                status={emConflito ? 'error' : undefined}
                style={estiloSugerido(linha, 'documentCode')}
                value={linha.documentCode ?? ''}
                onChange={(e) => editar(linha.uid, 'documentCode', e.target.value)}
              />
            </Tooltip>
            <MarcaDeSugestao linha={linha} campo="documentCode" />
          </>
        );
      },
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      width: 260,
      render: (_: unknown, linha: LinhaDeCadastro) => (
        <Input
          aria-label={`Título de ${linha.file.name}`}
          maxLength={200}
          status={linha.titulo.trim().length === 0 ? 'error' : undefined}
          value={linha.titulo}
          onChange={(e) => editar(linha.uid, 'titulo', e.target.value)}
        />
      ),
    },
    {
      title: 'Revisão',
      dataIndex: 'documentRevision',
      width: 120,
      render: (_: unknown, linha: LinhaDeCadastro) => (
        <InputNumber
          aria-label={`Revisão de ${linha.titulo}`}
          min={0}
          max={9999}
          precision={0}
          style={{ width: '100%' }}
          disabled={linha.documentType === DocumentType.GENERAL_FILE}
          value={linha.documentRevision ?? null}
          onChange={(valor) => editar(linha.uid, 'documentRevision', valor ?? null)}
        />
      ),
    },
    {
      title: 'Responsável',
      dataIndex: 'responsibleSector',
      width: 190,
      render: (_: unknown, linha: LinhaDeCadastro) => (
        <Input
          aria-label={`Responsável de ${linha.titulo}`}
          maxLength={120}
          value={linha.responsibleSector ?? ''}
          onChange={(e) => editar(linha.uid, 'responsibleSector', e.target.value)}
        />
      ),
    },
    {
      title: 'Próxima revisão',
      dataIndex: 'nextReviewAt',
      width: 180,
      render: (_: unknown, linha: LinhaDeCadastro) => (
        <DatePicker
          aria-label={`Próxima revisão de ${linha.titulo}`}
          style={{ width: '100%' }}
          format="DD/MM/YYYY"
          disabled={linha.documentType === DocumentType.GENERAL_FILE}
          value={linha.nextReviewAt ? dayjs(linha.nextReviewAt) : null}
          onChange={(data) =>
            editar(linha.uid, 'nextReviewAt', data ? data.format('YYYY-MM-DD') : null)
          }
        />
      ),
    },
  ];

  const larguraTotal = colunas.reduce((t, c) => t + c.width, 0);
  const impedido = conflitos.size > 0 || semTitulo > 0;

  return (
    <Card
      title="Dados dos documentos"
      style={{ marginTop: 16 }}
      styles={{ body: { paddingTop: 12 } }}
    >
      <Space direction="vertical" size={12} style={{ display: 'flex' }}>
        <Typography.Text>
          {linhas.length} arquivo(s), {formatarBytes(bytes)}. Cada arquivo tem os seus próprios
          dados.
        </Typography.Text>

        {/* "Aplicar a todos" (demanda 2.1 item 5; design.md D5): quatro campos,
            **sem** Código, e por acionamento explícito — aplicar enquanto a
            pessoa digita faria o preenchimento de uma linha alterar outras. */}
        <Card size="small" title="Aplicar a todos" data-testid="aplicar-a-todos">
          <Space wrap align="end" size={8}>
            <Select
              aria-label="Tipo para todos"
              style={{ width: 220 }}
              options={TYPE_OPTIONS}
              placeholder="Tipo"
              allowClear
              value={aplicacao.documentType ?? undefined}
              onChange={(valor: DocumentTypeValue | undefined) =>
                setAplicacao((a) => ({ ...a, documentType: valor ?? null }))
              }
            />
            <InputNumber
              aria-label="Revisão para todos"
              placeholder="Revisão"
              min={0}
              max={9999}
              precision={0}
              value={aplicacao.documentRevision ?? null}
              onChange={(valor) => setAplicacao((a) => ({ ...a, documentRevision: valor ?? null }))}
            />
            <Input
              aria-label="Responsável para todos"
              placeholder="Responsável"
              maxLength={120}
              style={{ width: 180 }}
              value={aplicacao.responsibleSector ?? ''}
              onChange={(e) => setAplicacao((a) => ({ ...a, responsibleSector: e.target.value }))}
            />
            <DatePicker
              aria-label="Próxima revisão para todos"
              placeholder="Próxima revisão"
              format="DD/MM/YYYY"
              value={aplicacao.nextReviewAt ? dayjs(aplicacao.nextReviewAt) : null}
              onChange={(data) =>
                setAplicacao((a) => ({
                  ...a,
                  nextReviewAt: data ? data.format('YYYY-MM-DD') : null,
                }))
              }
            />
            <Button onClick={() => onChange(aplicarATodas(linhas, aplicacao))}>
              Aplicar a todos
            </Button>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
            O código é individual de cada documento e não é aplicado a todos. Cada linha pode ser
            alterada depois.
          </Typography.Paragraph>
        </Card>

        {conflitos.size > 0 && (
          <Alert
            type="error"
            showIcon
            message="Código repetido neste envio"
            description={`${conflitos.size} arquivo(s) declaram um código já usado por outro arquivo deste mesmo envio. O código é único na sua unidade — ajuste os marcados antes de publicar.`}
          />
        )}

        {semTitulo > 0 && (
          <Alert
            type="error"
            showIcon
            message="Título obrigatório"
            description={`${semTitulo} arquivo(s) estão sem título. O título é o nome com que o arquivo é gravado.`}
          />
        )}

        {/* A tabela rola **dentro do próprio contêiner** (`web-responsividade`:
            nenhuma tela produz rolagem horizontal do documento), e é
            virtualizada para que uma seleção de milhares de arquivos não
            renderize uma linha por arquivo (design.md D2).

            `scroll.x` é **sempre** a largura somada das colunas, e não só na
            forma estreita: a tabela virtual precisa dos dois eixos declarados
            para dimensionar o corpo, e deixar `x` indefinido acima do ponto de
            ruptura era depender de um comportamento não contratado. Verificado
            em 1600, 1280, 1100, 1000, 820 e 420 px: o documento não rola na
            horizontal em nenhuma delas, e a última coluna continua alcançável e
            editável — a rolagem acontece dentro do corpo da tabela. */}
        <Table<LinhaDeCadastro>
          virtual
          size="small"
          rowKey="uid"
          dataSource={linhas}
          columns={colunas}
          pagination={false}
          scroll={{ x: larguraTotal, y: ALTURA_DO_CORPO }}
          data-testid="tabela-de-cadastro"
        />

        {/* design.md D6: "Publicar completos" **não** descarta as incompletas —
            a demanda manda salvá-las como pendentes. Um rótulo que não diga
            isso mente sobre o efeito, e a pessoa descobriria pelo sino. */}
        <Alert
          type="info"
          showIcon
          message={`${desfecho.publicam} arquivo(s) serão publicados; ${desfecho.pendentes} ficarão Pendentes de cadastro.`}
          description="Arquivo Pendente de cadastro fica na pasta e não aparece para os leitores nem na busca até o cadastro ser completado — e ocupa o seu espaço como qualquer outro."
        />

        <Space wrap>
          <Button type="primary" disabled={impedido} loading={enviando} onClick={onConfirmar}>
            Publicar completos ({desfecho.publicam}) e enviar {desfecho.pendentes} como pendente(s)
          </Button>
          <Button onClick={onCancelar}>Cancelar</Button>
        </Space>
      </Space>
    </Card>
  );
}
