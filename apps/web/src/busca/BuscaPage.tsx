import { useEffect, useState } from 'react';
import { Button, DatePicker, Empty, Input, Result, Select, Space, Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { IconeBaixarVarios, IconeBuscar, IconeLimparFiltros, IconeVisualizar } from '../app/icons';
import type { Dayjs } from 'dayjs';
import type { FileCategory, FileSummaryResponse, SearchFilesQuery } from '@gdoc/shared';
import { UserRole, fileCategory } from '@gdoc/shared';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/session-context';
import { useNarrowMode } from '../app/responsive';
import { PreviewModal } from '../visualizacao/PreviewModal';
import { useDownloadFile } from '../visualizacao/useDownloadFile';
import { formatDate, formatFileSize } from '../navegacao/format';
import { useAuthorOptions, useSearchFiles } from './queries';

const { RangePicker } = DatePicker;

/** Rótulo pt-BR por categoria de tipo (design.md D4) — fonte única é o enum `FileCategory` de `@gdoc/shared`. */
const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  pdf: 'PDF',
  office: 'Documento de escritório',
  text: 'Texto',
  other: 'Outros',
};

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as FileCategory[]).map((value) => ({
  value,
  label: CATEGORY_LABEL[value],
}));

interface FilterState {
  q: string;
  type: FileCategory | undefined;
  author: string | undefined;
  dateRange: [Dayjs, Dayjs] | null;
}

const EMPTY_FILTERS: FilterState = { q: '', type: undefined, author: undefined, dateRange: null };

/** Converte o estado dos controles para a query de `GET /files/search` (design.md D3/D4). */
function toSearchQuery(filters: FilterState): SearchFilesQuery {
  const [from, to] = filters.dateRange ?? [undefined, undefined];
  return {
    q: filters.q || undefined,
    type: filters.type,
    author: filters.author,
    dateFrom: from?.format('YYYY-MM-DD'),
    dateTo: to?.format('YYYY-MM-DD'),
  };
}

/** Critério ativo: nome não vazio (após trim) ou algum outro filtro definido (design.md D2). */
function hasActiveCriteria(filters: FilterState): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.type !== undefined ||
    filters.author !== undefined ||
    filters.dateRange !== null
  );
}

/**
 * Página de busca transversal (US 9.1, `web-busca`): nome + filtros
 * combináveis sobre `GET /files/search`, acionada explicitamente pelo botão
 * "Buscar" ou Enter — "estado inicial permitido" = nada consultado ainda
 * (design.md D1/D2/D3).
 */
export function BuscaPage() {
  const { identity } = useSession();
  const isNarrow = useNarrowMode();
  const isAdmin =
    identity?.role === UserRole.UNIT_ADMIN || identity?.role === UserRole.GLOBAL_ADMIN;

  // Termo vindo do campo do cabeçalho (change `shell-e-inicio`, design.md D5):
  // quem aciona a busca de outra tela chega aqui com `?q=…`, e o termo já vem
  // **aplicado** — sem redigitar. O acionamento continua explícito: o que
  // dispara a consulta é a navegação, não cada tecla digitada no cabeçalho.
  const [searchParams] = useSearchParams();
  const termoDaUrl = searchParams.get('q') ?? '';

  const [filters, setFilters] = useState<FilterState>(
    termoDaUrl === '' ? EMPTY_FILTERS : { ...EMPTY_FILTERS, q: termoDaUrl },
  );
  const [submitted, setSubmitted] = useState<SearchFilesQuery | undefined>(
    termoDaUrl === '' ? undefined : toSearchQuery({ ...EMPTY_FILTERS, q: termoDaUrl }),
  );
  const canSearch = hasActiveCriteria(filters);

  // Acionar o cabeçalho **já estando** na tela de busca só troca a query
  // string: o componente não remonta, então o estado inicial acima não
  // reavaliaria. Os filtros já escolhidos são preservados — só o termo muda.
  useEffect(() => {
    if (termoDaUrl === '') return;
    setFilters((prev) => ({ ...prev, q: termoDaUrl }));
    setSubmitted((prev) => ({ ...prev, q: termoDaUrl }));
  }, [termoDaUrl]);

  const handleSearch = () => {
    if (!canSearch) return;
    setSubmitted(toSearchQuery(filters));
  };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    setSubmitted(undefined);
  };

  const { data, isLoading, isError } = useSearchFiles(submitted);
  const authorOptions = useAuthorOptions(identity?.role);
  const [previewingFile, setPreviewingFile] = useState<FileSummaryResponse | null>(null);
  const { download, isPending: downloading } = useDownloadFile();

  const columns: ColumnsType<FileSummaryResponse> = [
    {
      title: 'Tipo',
      key: 'type',
      width: 160,
      render: (_, file) => CATEGORY_LABEL[fileCategory(file.contentType)],
    },
    {
      title: 'Nome',
      key: 'name',
      render: (_, file) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => setPreviewingFile(file)}
        >
          {file.fileName}
        </Button>
      ),
    },
    { title: 'Tamanho', key: 'size', render: (_, file) => formatFileSize(file.sizeBytes) },
    { title: 'Data', key: 'createdAt', render: (_, file) => formatDate(file.createdAt) },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, file) => (
        <Space>
          <Button size="small" icon={<IconeVisualizar />} onClick={() => setPreviewingFile(file)}>
            Visualizar
          </Button>
          <Button
            size="small"
            icon={<IconeBaixarVarios />}
            loading={downloading}
            onClick={() => download(file.id)}
          >
            Baixar
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* design.md D7 (`web-responsividade`): larguras fixas somadas estourariam
          360px — abaixo do limiar, cada filtro ocupa a largura útil da linha
          do `Space wrap`, que já degrada sem quebrar. */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          // Quem chega **sem** termo veio buscar — o atalho "Buscar documento"
          // da tela inicial conduz ao campo, não a uma tela onde ele ainda
          // precise ser localizado (change `conteudo-da-tela-inicio`,
          // design.md D6). Com termo no endereço a busca já executou, e o foco
          // no campo atrapalharia quem vai ler os resultados.
          autoFocus={termoDaUrl === ''}
          allowClear
          placeholder="Buscar por nome"
          style={{ width: isNarrow ? '100%' : 240 }}
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          onSearch={handleSearch}
        />
        <Select
          allowClear
          placeholder="Tipo"
          style={{ width: isNarrow ? '100%' : 200 }}
          options={CATEGORY_OPTIONS}
          value={filters.type}
          onChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}
        />
        <RangePicker
          style={{ width: isNarrow ? '100%' : undefined }}
          value={filters.dateRange}
          onChange={(range) =>
            setFilters((prev) => ({ ...prev, dateRange: range as [Dayjs, Dayjs] | null }))
          }
        />
        {isAdmin && (
          <Select
            allowClear
            showSearch
            placeholder="Autor"
            style={{ width: isNarrow ? '100%' : 200 }}
            loading={authorOptions.isLoading}
            options={authorOptions.data ?? []}
            optionFilterProp="label"
            value={filters.author}
            onChange={(value) => setFilters((prev) => ({ ...prev, author: value }))}
          />
        )}
        <Button type="primary" icon={<IconeBuscar />} disabled={!canSearch} onClick={handleSearch}>
          Buscar
        </Button>
        <Button icon={<IconeLimparFiltros />} onClick={handleClear}>
          Limpar filtros
        </Button>
      </Space>

      {submitted === undefined && <Empty description="Informe ao menos um critério para buscar" />}

      {submitted !== undefined && isLoading && (
        <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />
      )}

      {submitted !== undefined && isError && (
        <Result
          status="error"
          title="Não foi possível carregar os resultados"
          subTitle="Verifique sua conexão e tente novamente."
        />
      )}

      {submitted !== undefined && !isLoading && !isError && data && (
        <Table<FileSummaryResponse>
          rowKey="id"
          columns={columns}
          dataSource={data.files}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: <Empty description="Nenhum resultado" /> }}
        />
      )}

      <PreviewModal file={previewingFile} onClose={() => setPreviewingFile(null)} />
    </div>
  );
}
