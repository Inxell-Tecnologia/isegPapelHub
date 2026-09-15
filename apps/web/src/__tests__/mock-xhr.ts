import { vi } from 'vitest';

type XhrRouteEntry = { status: number } | { networkError: true };

type XhrRouteTable = Record<string, XhrRouteEntry>;

/**
 * Substitui `global.XMLHttpRequest` por um stub controlado por tabela
 * `url -> desfecho`, para exercitar `upload/put-object.ts` sem tráfego real
 * (`web-upload`, tasks 5.1). Emite um evento de progresso (50%) antes do
 * desfecho, para exercitar `xhr.upload.onprogress`.
 */
export function mockXhr(table: XhrRouteTable): void {
  class FakeXMLHttpRequest {
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    private url = '';

    open(_method: string, url: string): void {
      this.url = url;
    }

    setRequestHeader(): void {}

    send(): void {
      const entry = table[this.url];
      queueMicrotask(() => {
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        } as ProgressEvent);
        queueMicrotask(() => {
          if (!entry || 'networkError' in entry) {
            this.onerror?.();
            return;
          }
          this.status = entry.status;
          this.onload?.();
        });
      });
    }
  }

  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
}

/** Controle de um XHR que só conclui quando o teste mandar. */
export interface ControllableXhr {
  /** Quantos PUTs estão em voo agora (enviados e ainda não concluídos). */
  inFlight(): number;
  /** Quantos PUTs já foram iniciados desde o começo do teste. */
  started(): number;
  /** URLs iniciadas, na ordem. */
  startedUrls(): string[];
  /** Conclui o PUT mais antigo em voo com sucesso. */
  succeedOldest(): void;
  /** Conclui o PUT mais antigo em voo com falha de rede. */
  failOldest(): void;
}

/**
 * Variante de `mockXhr` que **não** conclui sozinha: cada PUT fica em voo até
 * o teste mandar concluir. É o que permite observar a fila de concorrência
 * (change `corrige-defeitos-envio-lote`, design.md D4) — com o mock que
 * resolve em microtask, uma vaga é liberada antes da próxima ser ocupada e
 * nunca se vê mais de um item em voo.
 */
export function mockControllableXhr(): ControllableXhr {
  interface Pending {
    url: string;
    onload: (() => void) | null;
    onerror: (() => void) | null;
    setStatus: (status: number) => void;
  }

  const pending: Pending[] = [];
  const urls: string[] = [];

  class ControllableXMLHttpRequest {
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 0;
    private url = '';

    open(_method: string, url: string): void {
      this.url = url;
    }

    setRequestHeader(): void {}

    send(): void {
      urls.push(this.url);
      pending.push({
        url: this.url,
        onload: null,
        onerror: null,
        setStatus: (status) => {
          this.status = status;
        },
      });
      // Os handlers são atribuídos por `put-object.ts` antes do `send`, mas
      // guardamos as referências no momento do envio para não depender disso.
      pending[pending.length - 1]!.onload = () => this.onload?.();
      pending[pending.length - 1]!.onerror = () => this.onerror?.();
    }
  }

  vi.stubGlobal('XMLHttpRequest', ControllableXMLHttpRequest);

  return {
    inFlight: () => pending.length,
    started: () => urls.length,
    startedUrls: () => [...urls],
    succeedOldest: () => {
      const next = pending.shift();
      if (!next) throw new Error('nenhum PUT em voo para concluir');
      next.setStatus(200);
      next.onload?.();
    },
    failOldest: () => {
      const next = pending.shift();
      if (!next) throw new Error('nenhum PUT em voo para falhar');
      next.onerror?.();
    },
  };
}
