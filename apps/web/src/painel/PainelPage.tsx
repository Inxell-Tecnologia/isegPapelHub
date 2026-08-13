import { Button, Card, Col, Progress, Result, Row, Spin, Statistic } from 'antd';
import type { ProgressProps } from 'antd';
import type { FileCategory } from '@gdoc/shared';
import { FileCategory as FileCategoryEnum } from '@gdoc/shared';
import { ApiError } from '../lib/api-client';
import { formatFileSize } from '../navegacao/format';
import { GraficoBarras } from './GraficoBarras';
import { useDashboard } from './queries';

/** Rótulo pt-BR por categoria, na ordem fixa de apresentação (design.md D3). */
const CATEGORY_LABEL: Record<FileCategory, string> = {
  [FileCategoryEnum.IMAGE]: 'Imagens',
  [FileCategoryEnum.VIDEO]: 'Vídeos',
  [FileCategoryEnum.AUDIO]: 'Áudios',
  [FileCategoryEnum.PDF]: 'PDFs',
  [FileCategoryEnum.OFFICE]: 'Documentos de escritório',
  [FileCategoryEnum.TEXT]: 'Texto',
  [FileCategoryEnum.OTHER]: 'Outros',
};

const CATEGORY_ORDER = Object.values(FileCategoryEnum) as FileCategory[];

const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

/** `YYYY-MM` → rótulo curto pt-BR "mmm/aa" (design.md D3), sem depender de locale global de `dayjs`. */
function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  return `${MONTH_LABELS[Number(monthNum) - 1]}/${year!.slice(2)}`;
}

/** Urgência por cor (design.md D2): normal < 80% ≤ active < 95% ≤ exception. */
function progressStatus(pct: number): ProgressProps['status'] {
  if (pct >= 0.95) return 'exception';
  if (pct >= 0.8) return 'active';
  return 'normal';
}

/**
 * Painel gerencial (US 8.2 cenário 1, `web-painel`). Substitui o
 * `PlaceholderPage` de `/admin/painel` — a guarda de rota
 * `[unit_admin, global_admin]` já existe (Fatia 1 D6). Só apresenta o que
 * `GET /dashboard` retornou, no alcance que o servidor impôs.
 */
export function PainelPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard();

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError) {
    // design.md D5: 403 é o servidor negando alcance ao painel — aviso
    // neutro, sem número algum; demais erros permitem nova tentativa.
    if (error instanceof ApiError && error.status === 403) {
      return (
        <Result
          status="403"
          title="Sem permissão"
          subTitle="Você não tem permissão para acessar o painel."
        />
      );
    }
    return (
      <Result
        status="error"
        title="Não foi possível carregar o painel"
        subTitle="Verifique sua conexão e tente novamente."
        extra={
          <Button type="primary" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        }
      />
    );
  }

  if (!data) return null;

  const filesByTypeCounts = new Map(data.filesByType.map((entry) => [entry.category, entry.count]));
  const filesByTypeItems = CATEGORY_ORDER.map((category) => ({
    label: CATEGORY_LABEL[category],
    value: filesByTypeCounts.get(category) ?? 0,
  }));

  const uploadsByMonthItems = data.uploadsByMonth.map((entry) => ({
    label: formatMonthLabel(entry.month),
    value: entry.count,
  }));

  const { storage } = data;
  const usedPct = storage.capacityBytes > 0 ? storage.usedBytes / storage.capacityBytes : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* design.md D7 (`web-responsividade`): 4 colunas fixas de span=6 dão
          cartões de ~85px em 360px, ilegíveis — `xs`/`sm` do próprio grid do
          design system (mesmos tokens do limiar único) reagrupam em 2x2 antes
          de chegar a 4-a-fio a partir de `md`. */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Total de arquivos" value={data.cards.totalFiles} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Total de pessoas" value={data.cards.totalPeople} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="Espaço utilizado" value={formatFileSize(data.cards.usedBytes)} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="Cota utilizada"
              value={data.cards.quotaUsedPct * 100}
              precision={1}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Card title="Arquivos por tipo">
        <GraficoBarras items={filesByTypeItems} />
      </Card>

      <Card title="Envios por mês">
        <GraficoBarras items={uploadsByMonthItems} />
      </Card>

      <Card title="Espaço utilizado × disponível">
        <Progress percent={Number((usedPct * 100).toFixed(1))} status={progressStatus(usedPct)} />
        <p>
          {formatFileSize(storage.usedBytes)} usados de {formatFileSize(storage.capacityBytes)} —{' '}
          {formatFileSize(storage.availableBytes)} disponíveis
        </p>
      </Card>
    </div>
  );
}
