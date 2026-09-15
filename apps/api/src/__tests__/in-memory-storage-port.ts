import type { StoragePort, SignedUrlResult } from '../ports/storage-port.js';
import { config } from '../config.js';

/** Test double do StoragePort — evita depender do fake-gcs-server nos testes unitários de permissão. */
export class InMemoryStoragePort implements StoragePort {
  readonly bucketName = 'test-bucket';
  calls: { method: string; objectPath: string }[] = [];
  private readonly deletedObjects = new Set<string>();
  private readonly objectSizes = new Map<string, number>();

  buildObjectPath(unitId: string, ownerId: string, objectId: string): string {
    return `${unitId}/${ownerId}/${objectId}`;
  }

  async getViewUrl(objectPath: string): Promise<SignedUrlResult> {
    this.calls.push({ method: 'view', objectPath });
    return {
      url: `https://storage.test/${objectPath}?view`,
      expiresAt: new Date(Date.now() + 300_000),
    };
  }

  async getDownloadUrl(objectPath: string): Promise<SignedUrlResult> {
    this.calls.push({ method: 'download', objectPath });
    return {
      url: `https://storage.test/${objectPath}?download`,
      expiresAt: new Date(Date.now() + 1_800_000),
    };
  }

  async getUploadUrl(objectPath: string): Promise<SignedUrlResult> {
    this.calls.push({ method: 'upload', objectPath });
    return {
      url: `https://storage.test/${objectPath}?upload`,
      // Espelha o prazo próprio de envio do adapter real (change
      // corrige-defeitos-envio-lote, design.md D3): o dublê não pode
      // reintroduzir o acoplamento ao TTL de download que o seam acabou de
      // desfazer, ou a paridade dev↔prod se perde justamente no ponto testado.
      expiresAt: new Date(Date.now() + config.signedUrlUploadTtlSeconds * 1000),
    };
  }

  async assertObjectNotPubliclyReadable(): Promise<boolean> {
    return true;
  }

  /** Idempotente (design.md D8): apagar de novo o mesmo path não lança. */
  async deleteObject(objectPath: string): Promise<void> {
    this.calls.push({ method: 'delete', objectPath });
    this.deletedObjects.add(objectPath);
  }

  wasDeleted(objectPath: string): boolean {
    return this.deletedObjects.has(objectPath);
  }

  /** Simula um objeto finalizado no bucket (existência + tamanho) para o backfill. */
  setObject(objectPath: string, sizeBytes: number): void {
    this.objectSizes.set(objectPath, sizeBytes);
  }

  async statObject(objectPath: string): Promise<{ sizeBytes: number } | null> {
    this.calls.push({ method: 'stat', objectPath });
    const size = this.objectSizes.get(objectPath);
    return size === undefined ? null : { sizeBytes: size };
  }
}
