import { readFileSync } from 'node:fs';
import { Storage } from '@google-cloud/storage';
import type { StoragePort, SignedUrlResult } from '../ports/storage-port.js';
import { config } from '../config.js';

interface SignerKeyFile {
  client_email: string;
  private_key: string;
}

function loadSignerCredentials(): { client_email: string; private_key: string } | undefined {
  if (!config.storageSignerKeyPath) return undefined;
  const raw = readFileSync(config.storageSignerKeyPath, 'utf-8');
  const key = JSON.parse(raw) as SignerKeyFile;
  return { client_email: key.client_email, private_key: key.private_key };
}

/**
 * Implementação única do StoragePort sobre o SDK oficial do GCS. Em dev,
 * aponta `apiEndpoint` para o fake-gcs-server local; em prod, usa o GCS
 * real (Application Default Credentials do Cloud Run). A assinatura v4 é
 * feita localmente pelo SDK a partir da chave do signer — não depende de
 * chamada de rede — por isso funciona idêntica nos dois ambientes.
 */
export class GcsStoragePort implements StoragePort {
  readonly bucketName: string;
  private readonly storage: Storage;

  constructor() {
    this.bucketName = config.storageBucket;
    const isEmulated = config.storageDriver === 'fake-gcs';

    this.storage = new Storage({
      projectId: config.gcpProjectId,
      ...(isEmulated && config.storageEmulatorHost
        ? { apiEndpoint: config.storageEmulatorHost }
        : {}),
      ...(loadSignerCredentials() ? { credentials: loadSignerCredentials() } : {}),
    });
  }

  buildObjectPath(unitId: string, ownerId: string, objectId: string): string {
    return `${unitId}/${ownerId}/${objectId}`;
  }

  async getViewUrl(objectPath: string): Promise<SignedUrlResult> {
    return this.sign(objectPath, 'read', config.signedUrlViewTtlSeconds, 'inline');
  }

  async getDownloadUrl(objectPath: string, downloadFileName: string): Promise<SignedUrlResult> {
    return this.sign(
      objectPath,
      'read',
      config.signedUrlDownloadTtlSeconds,
      `attachment; filename="${downloadFileName.replace(/"/g, '')}"`,
    );
  }

  async getUploadUrl(objectPath: string, contentType: string): Promise<SignedUrlResult> {
    // `action: 'write'` (PUT direto) em vez de `'resumable'`: o fake-gcs-server
    // usado em dev não implementa corretamente a iniciação de sessão
    // resumível por URL assinada v4 no estilo de caminho (perde o nome do
    // objeto), embora suporte PUT simples com o mesmo esquema de assinatura
    // sem problemas — validado manualmente contra bytes reais. GCS real
    // aceita PUT simples normalmente; upload em pedaços/retomável fica como
    // otimização de UX para uma mudança de feature futura, não desta
    // fundação — o contrato do endpoint (uma URL, um PUT) não muda.
    // Prazo **próprio** do envio (change corrige-defeitos-envio-lote,
    // design.md D3) — antes reusava `signedUrlDownloadTtlSeconds` por
    // conveniência, não por decisão.
    return this.sign(objectPath, 'write', config.signedUrlUploadTtlSeconds, undefined, contentType);
  }

  async deleteObject(objectPath: string): Promise<void> {
    await this.storage.bucket(this.bucketName).file(objectPath).delete({ ignoreNotFound: true });
  }

  async statObject(objectPath: string): Promise<{ sizeBytes: number } | null> {
    const file = this.storage.bucket(this.bucketName).file(objectPath);
    try {
      const [metadata] = await file.getMetadata();
      return { sizeBytes: Number(metadata.size ?? 0) };
    } catch (err) {
      // Objeto ausente (404) = upload nunca concluído → null. Outros erros
      // (rede/permissão) sobem, para o backfill não promover por engano.
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }

  async assertObjectNotPubliclyReadable(objectPath: string): Promise<boolean> {
    const file = this.storage.bucket(this.bucketName).file(objectPath);
    try {
      const [metadata] = await file.getMetadata();
      const acl = (metadata as { acl?: Array<{ entity?: string }> }).acl ?? [];
      const isPublic = acl.some((entry) => entry.entity === 'allUsers');
      return !isPublic;
    } catch {
      return true;
    }
  }

  private async sign(
    objectPath: string,
    action: 'read' | 'write' | 'resumable',
    ttlSeconds: number,
    responseDisposition?: string,
    contentType?: string,
  ): Promise<SignedUrlResult> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const file = this.storage.bucket(this.bucketName).file(objectPath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action,
      expires: expiresAt,
      ...(responseDisposition ? { responseDisposition } : {}),
      ...(contentType ? { contentType } : {}),
    });
    return { url, expiresAt };
  }
}
