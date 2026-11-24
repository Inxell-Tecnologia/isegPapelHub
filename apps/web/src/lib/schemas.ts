import { z } from 'zod';
import type {
  AuditQueryResponse,
  AuthenticatedIdentity,
  BatchUploadItemResult,
  BatchUploadUrlResponse,
  CrossUnitDestinationListResponse,
  CrossUnitGrantListResponse,
  CrossUnitGrantResponse,
  CrossUnitRecipientListResponse,
  DashboardResponse,
  FileRestoreResponse,
  FileSummaryResponse,
  FolderContentsResponse,
  FolderDownloadManifestEntry,
  FolderDownloadManifestResponse,
  FolderResponse,
  GrantListResponse,
  GrantNotificationPayload,
  GrantResponse,
  MoveBatchItemResult,
  MoveBatchResponse,
  MyProfileResponse,
  NotificationListResponse,
  NotificationResponse,
  ReadingNotificationPayload,
  ReadingTeamOverdueNotificationPayload,
  PersonResponse,
  SectorResponse,
  PublicConfigResponse,
  RecentDocumentResponse,
  RecentDocumentsResponse,
  NewDocumentsCountResponse,
  FavoriteItemResponse,
  FavoritesResponse,
  ResetPasswordResponse,
  SearchFilesResponse,
  SharedPermissionResponse,
  SharedWithMeItemResponse,
  SharedWithMeResponse,
  SignedUrlResponse,
  StorageQuotaResponse,
  TrashListResponse,
  TrashPurgeResponse,
  UnitResponse,
  UnreadNotificationCountResponse,
  UploadUrlResponse,
  ViewUrlResponse,
} from '@gdoc/shared';
import {
  DocumentLifecycleState,
  DocumentStatus,
  DOCUMENT_TYPES,
  DocumentType,
  FileAccessAction,
  FileCategory,
  GrantResourceType,
  NotificationKind,
  Permission,
  PersonStatus,
  ReadingOversight,
  UnitStatus,
  UserRole,
} from '@gdoc/shared';

/**
 * Valida a fronteira com a API, espelhando `@gdoc/shared` (fonte única de
 * DTOs — design.md D5). `z.ZodType<T>` amarra o schema ao tipo compartilhado:
 * se o DTO mudar sem o schema acompanhar, o `tsc` acusa a divergência.
 */
/** Alcance do acompanhamento de leituras (change `gestor-de-acompanhamento`). */
const readingOversightSchema = z.enum([
  ReadingOversight.SECTOR,
  ReadingOversight.UNIT,
  ReadingOversight.ALL_UNITS,
]);

export const authenticatedIdentitySchema: z.ZodType<AuthenticatedIdentity> = z.object({
  id: z.string(),
  unitId: z.string(),
  role: z.enum([UserRole.COLLABORATOR, UserRole.UNIT_ADMIN, UserRole.GLOBAL_ADMIN]),
  // Nome e unidade (change `shell-e-inicio`, Migration Plan): `.catch('')`
  // pela mesma razão de `canUpload` — uma API mais antiga que a SPA não traz
  // os campos novos, e a sessão precisa continuar resolvendo. Vazio é o
  // mesmo valor que a API devolve para conta sem nome, e a interface já tem
  // tratamento genérico para ele: nunca se recorre ao identificador interno.
  fullName: z.string().catch(''),
  unitName: z.string().catch(''),
  // Função e setor (change `funcao-e-setor-na-identidade`), com o mesmo
  // `.catch('')`: vazio é o valor que a API devolve para cadastro sem o dado,
  // e a interface já sabe o que fazer com ele — recorrer ao rótulo do papel,
  // no caso da função, e omitir, no caso do setor.
  jobTitle: z.string().catch(''),
  sectorName: z.string().catch(''),
  // Change `tour-guiado`: uma API mais antiga não traz o campo nem sabe
  // registrá-lo, e o convite apareceria para sempre — ausência conta como
  // feito, para não insistir com quem não tem como dispensá-lo.
  tourCompleted: z.boolean().catch(true),
  // Change `gestor-de-acompanhamento`, design.md D6.
  readingOversight: readingOversightSchema.nullable().catch(null),
});

/** Espelha `FolderResponse` (design.md D8, `web-navegacao`). */
export const folderResponseSchema: z.ZodType<FolderResponse> = z.object({
  id: z.string(),
  unitId: z.string(),
  ownerId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  createdAt: z.string(),
});

/**
 * Espelha `FileSummaryResponse` (design.md D8, `web-navegacao`), já com os
 * dados de controle do Épico 10.
 *
 * Os campos novos usam `.catch(...)` pela mesma razão de
 * `FolderContentsResponse.canUpload`: uma API mais antiga que a SPA
 * simplesmente não traz controle documental, e a listagem precisa continuar
 * renderizando — sem eles, um `parse` estrito derrubaria a tela inteira por
 * causa de colunas acessórias. `documentStatus` ausente resolve para "sem
 * controle de revisão", que é a verdade quando o servidor não informou
 * situação alguma; `canEditControl` ausente resolve para `undefined`, que a
 * interface trata como "não oferecer a ação".
 */
export const fileSummaryResponseSchema: z.ZodType<FileSummaryResponse> = z.object({
  id: z.string(),
  ownerId: z.string(),
  folderId: z.string().nullable(),
  fileName: z.string(),
  contentType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  status: z.string(),
  createdAt: z.string(),
  /**
   * Aqui o conjunto fechado **é** da SPA: ela precisa de rótulo, sigla e cor
   * por tipo, e não tem o que apresentar para um tipo que não conhece.
   * `.catch(null)` resolve para "sem tipo", que é neutro — ausência explícita,
   * não afirmação errada.
   *
   * A lista vem de `DOCUMENT_TYPES` em vez de ser reescrita: enumerá-la à mão
   * foi o que fez o tipo Arquivo geral chegar a esta fronteira e ser
   * convertido em `null`, aparecendo como arquivo sem tipo.
   */
  documentType: z
    .enum(DOCUMENT_TYPES as readonly [DocumentType, ...DocumentType[]])
    .nullable()
    .catch(null),
  documentCode: z.string().nullable().catch(null),
  documentRevision: z.number().nullable().catch(null),
  responsibleSector: z.string().nullable().catch(null),
  nextReviewAt: z.string().nullable().catch(null),
  lifecycleState: z
    .enum([
      DocumentLifecycleState.CURRENT,
      DocumentLifecycleState.IN_REVIEW,
      DocumentLifecycleState.OBSOLETE,
    ])
    .nullable()
    .catch(null),
  /**
   * A situação é **apurada pelo servidor** e a SPA só a traduz — nunca a
   * recalcula (`web-navegacao`). Por isso a fronteira aceita qualquer texto em
   * lugar de um `enum` fechado: a autoridade sobre o conjunto de valores é do
   * servidor, não desta SPA.
   *
   * Era um `.enum([...]).catch(UNCONTROLLED)`, e o `.catch` **convertia** todo
   * valor não previsto em "Sem controle de revisão" — que não é um fallback
   * neutro, é uma afirmação: a de que o documento é acervo legítimo em
   * circulação. Com os estados que a US 10.9 e a US 10.8 acrescentaram, uma
   * SPA mais antiga que a API passaria a apresentar arquivo **pendente de
   * cadastro** exatamente assim. Quem decide o que é apresentável passa a ser
   * `rotuloDeSituacao`, num lugar só, e valor desconhecido resolve para
   * ausência explícita em vez de rótulo errado.
   *
   * O `.catch` permanece para o campo **ausente** (API anterior ao controle
   * documental), onde "Sem controle de revisão" é de fato a verdade.
   */
  documentStatus: z
    .string()
    .catch(DocumentStatus.UNCONTROLLED)
    .transform((valor) => valor as DocumentStatus),
  daysUntilReview: z.number().nullable().catch(null),
  canEditControl: z.boolean().optional().catch(undefined),
  // Mesma tolerância de `canEditControl` (change `superficies-de-pendencia`,
  // design.md D4): API anterior não traz o veredito, e ausência é "sem ícone".
  requiredReading: z.boolean().optional().catch(undefined),
});

/**
 * Espelha `FolderListItemResponse`: a subpasta da listagem com a contagem de
 * documentos diretos (change `contagem-de-documentos-nas-pastas`, design.md
 * D3). Mesma tolerância de `canEditControl`: API anterior não traz o campo, e
 * ausência (ou valor inválido) é "contagem desconhecida" — o cartão omite a
 * linha, nunca a apresenta como zero.
 */
const folderListItemResponseSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  ownerId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  createdAt: z.string(),
  documentCount: z.number().int().nonnegative().optional().catch(undefined),
});

/** Espelha `FolderContentsResponse` (design.md D8, `web-navegacao`). */
export const folderContentsResponseSchema: z.ZodType<FolderContentsResponse> = z.object({
  folder: folderResponseSchema.nullable(),
  breadcrumb: z.array(folderResponseSchema),
  folders: z.array(folderListItemResponseSchema),
  files: z.array(fileSummaryResponseSchema),
  // Veredito de `upload` resolvido pelo servidor (design.md D10 de
  // `identidade-visual-isetes`). Resolve como `false` quando ausente — uma
  // API mais antiga que a SPA simplesmente não oferece a ação na orientação
  // de pasta vazia, em vez de oferecê-la sem respaldo.
  canUpload: z.boolean().catch(false),
  // Favoritos entre os itens listados (change `favoritos`, design.md D5).
  // Ausentes numa API mais antiga: nada aparece como favorito, em vez de a
  // resposta inteira ser recusada.
  favoriteFolderIds: z.array(z.string()).optional().catch(undefined),
  favoriteFileIds: z.array(z.string()).optional().catch(undefined),
  // Navegação somente leitura em pasta compartilhada por outra unidade
  // (change `compartilhamento-entre-unidades`, design.md D6). Ausentes numa
  // API anterior: listagem comum.
  readOnly: z.boolean().optional().catch(undefined),
  sharedFrom: z
    .object({ unitId: z.string(), unitName: z.string() })
    .nullable()
    .optional()
    .catch(undefined),
  canDownload: z.boolean().optional().catch(undefined),
});

/** Espelha `SignedUrlResponse` (design.md D7, `web-visualizacao`). */
export const signedUrlResponseSchema: z.ZodType<SignedUrlResponse> = z.object({
  url: z.string(),
  expiresAt: z.string(),
  action: z.enum([FileAccessAction.VIEW, FileAccessAction.DOWNLOAD]),
});

/** Espelha `ViewUrlResponse` (união discriminada, design.md D7). */
export const viewUrlResponseSchema: z.ZodType<ViewUrlResponse> = z.discriminatedUnion(
  'previewAvailable',
  [
    z.object({
      previewAvailable: z.literal(true),
      url: z.string(),
      expiresAt: z.string(),
      action: z.enum([FileAccessAction.VIEW, FileAccessAction.DOWNLOAD]),
    }),
    z.object({
      previewAvailable: z.literal(false),
      reason: z.literal('unsupported_format'),
      download: z.object({ available: z.boolean() }),
    }),
  ],
);

/** Espelha `BatchUploadItemResult` (união discriminada em `ok`, design.md D8, `web-upload`). */
export const batchUploadItemResultSchema: z.ZodType<BatchUploadItemResult> = z.discriminatedUnion(
  'ok',
  [
    z.object({
      fileName: z.string(),
      ok: z.literal(true),
      uploadUrl: z.string(),
      objectPath: z.string(),
      folderId: z.string().nullable(),
      expiresAt: z.string(),
      /** US 10.9: o item nasceu pendente de cadastro por faltar dado exigido. */
      awaitingRegistration: z.boolean(),
    }),
    z.object({
      fileName: z.string(),
      ok: z.literal(false),
      error: z.string(),
    }),
  ],
);

/**
 * Espelha `UploadUrlResponse` — resposta da publicação de **um** documento
 * (`POST /files/upload-url`, Épico 10).
 */
export const uploadUrlResponseSchema: z.ZodType<UploadUrlResponse> = z.object({
  uploadUrl: z.string(),
  objectPath: z.string(),
  expiresAt: z.string(),
});

/** Espelha `BatchUploadUrlResponse` (design.md D8, `web-upload`). */
export const batchUploadUrlResponseSchema: z.ZodType<BatchUploadUrlResponse> = z.object({
  results: z.array(batchUploadItemResultSchema),
});

/**
 * Espelha `StorageQuotaResponse` (change `envio-multiplas-pastas-com-prechecagem`,
 * design.md D2) — a decomposição do espaço do próprio solicitante.
 */
export const storageQuotaResponseSchema: z.ZodType<StorageQuotaResponse> = z.object({
  quotaBytes: z.number(),
  usedBytes: z.number(),
  trashedBytes: z.number(),
  trashedFiles: z.number(),
  pendingBytes: z.number(),
  availableBytes: z.number(),
});

/** Espelha `SearchFilesResponse` (design.md D6, `web-busca`), reusando `fileSummaryResponseSchema`. */
export const searchFilesResponseSchema: z.ZodType<SearchFilesResponse> = z.object({
  files: z.array(fileSummaryResponseSchema),
});

/**
 * Espelha `RecentDocumentsResponse` (change `shell-e-inicio`, US 11.2),
 * estendendo `fileSummaryResponseSchema` com o instante derivado da alteração
 * e o nome da pasta que contém o documento.
 */
export const recentDocumentResponseSchema: z.ZodType<RecentDocumentResponse> =
  fileSummaryResponseSchema.and(
    z.object({ changedAt: z.string(), folderName: z.string().nullable() }),
  );

export const recentDocumentsResponseSchema: z.ZodType<RecentDocumentsResponse> = z.object({
  documents: z.array(recentDocumentResponseSchema),
});

/** `GET /files/recent/new-count` (change `conteudo-da-tela-inicio`, design.md D2/D3). */
export const newDocumentsCountResponseSchema: z.ZodType<NewDocumentsCountResponse> = z.object({
  days: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  capped: z.boolean(),
});

/**
 * Schema mínimo para `GET /users` (design.md D6, `web-busca`): valida só os
 * campos usados pelo filtro de autor (id + nome), tolerando os demais campos
 * de `PersonResponse` que o `Select` não precisa.
 */
export const authorPersonSchema = z.object({
  id: z.string(),
  fullName: z.string().nullable(),
  // Unidade da pessoa: a concessão comum só aceita pessoas da unidade do
  // recurso (change `compartilhamento-entre-unidades`, design.md D10).
  unitId: z.string().optional().catch(undefined),
});
export const authorPersonListSchema = z.array(authorPersonSchema);

/** Espelha `GrantResponse` (design.md D6, `web-permissoes`): uma linha por (pessoa, verbo). */
/**
 * Conjunto fechado de verbos, **uma vez**: a lista estava escrita à mão em
 * `grantResponseSchema` e em `grantNotificationPayloadSchema`, e a terceira
 * cópia entraria com `sharedPermissionResponseSchema`. Constante duplicada à
 * mão nos dois lados foi exatamente a causa do defeito que a change
 * `tabela-de-cadastro-no-envio-em-lote` teve de corrigir (design.md D9): a
 * origem é o enum `Permission` do contrato compartilhado.
 */
const permissionSchema = z.enum([
  Permission.VIEW,
  Permission.DOWNLOAD,
  Permission.UPLOAD,
  Permission.RENAME,
  Permission.DELETE,
]);

export const grantResponseSchema: z.ZodType<GrantResponse> = z.object({
  id: z.string(),
  unitId: z.string(),
  subjectUserId: z.string(),
  resourceType: z.enum([GrantResourceType.FOLDER, GrantResourceType.FILE]),
  resourceId: z.string(),
  permission: permissionSchema,
  grantedBy: z.string(),
  createdAt: z.string(),
  // Change `expiracao-permissoes`, design.md D1/D2: nulo = permanente;
  // `expired` é resolvido pelo servidor contra o relógio do banco.
  expiresAt: z.string().nullable(),
  expired: z.boolean(),
});

/** Espelha `GrantListResponse` (design.md D6, `web-permissoes`). */
export const grantListResponseSchema: z.ZodType<GrantListResponse> = z.object({
  grants: z.array(grantResponseSchema),
});

/**
 * Espelha `MoveBatchItemResult` (união discriminada em `ok`, design.md D2 do
 * change `mover-itens-em-lote`) — mesmo molde de `batchUploadItemResultSchema`.
 */
export const moveBatchItemResultSchema: z.ZodType<MoveBatchItemResult> = z.discriminatedUnion(
  'ok',
  [
    z.object({ id: z.string(), ok: z.literal(true) }),
    z.object({ id: z.string(), ok: z.literal(false), error: z.string() }),
  ],
);

/** Espelha `MoveBatchResponse` (design.md D2 do change `mover-itens-em-lote`). */
export const moveBatchResponseSchema: z.ZodType<MoveBatchResponse> = z.object({
  results: z.array(moveBatchItemResultSchema),
});

/** Espelha `TrashPurgeResponse` (change `esvaziar-lixeira`) — fronteira de `POST /trash/purge`. */
export const trashPurgeResponseSchema: z.ZodType<TrashPurgeResponse> = z.object({
  purgedFiles: z.number(),
  reclaimedBytes: z.number(),
  failedFiles: z.number(),
});

/** Espelha `TrashListResponse` (design.md D7, `web-lixeira`): item de raiz de exclusão. */
export const trashListResponseSchema: z.ZodType<TrashListResponse> = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum([GrantResourceType.FOLDER, GrantResourceType.FILE]),
      name: z.string(),
      deletedAt: z.string(),
      expiresAt: z.string(),
    }),
  ),
});

/**
 * Valida só o campo que a UI usa além de `FileSummaryResponse`
 * (`redirectedToRoot`, design.md D7, `web-lixeira`) — reusa
 * `fileSummaryResponseSchema` por interseção em vez de repetir os campos.
 */
export const fileRestoreResponseSchema: z.ZodType<FileRestoreResponse> =
  fileSummaryResponseSchema.and(z.object({ redirectedToRoot: z.boolean() }));

/** Espelha `PersonResponse` (design.md D7, `web-pessoas`) — fronteira de `GET/POST/PATCH /users`. */
export const personResponseSchema: z.ZodType<PersonResponse> = z.object({
  id: z.string(),
  unitId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  jobTitle: z.string().nullable(),
  sectorId: z.string().nullable(),
  sectorName: z.string().nullable(),
  notes: z.string().nullable(),
  // Change `gestor-de-acompanhamento`: ausente numa API anterior = não
  // acompanha.
  readingOversight: readingOversightSchema.nullable().catch(null),
  role: z.enum([UserRole.COLLABORATOR, UserRole.UNIT_ADMIN, UserRole.GLOBAL_ADMIN]),
  status: z.enum([PersonStatus.ACTIVE, PersonStatus.DISABLED]),
  createdAt: z.string(),
  storageUsedBytes: z.number(),
  storageQuotaBytes: z.number().nullable(),
});

/** Espelha a listagem de `GET /users` (design.md D7, `web-pessoas`). */
export const personListSchema = z.array(personResponseSchema);

/**
 * Espelha `SectorResponse` (change `funcao-e-setor-na-identidade`,
 * capability `setores`) — fronteira de `GET/POST/PATCH/DELETE /sectors`.
 */
export const sectorResponseSchema: z.ZodType<SectorResponse> = z.object({
  id: z.string(),
  unitId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  peopleCount: z.number(),
});

/** Espelha a listagem de `GET /sectors`. */
export const sectorListSchema = z.array(sectorResponseSchema);

/** Espelha `UnitResponse` (change `gestao-de-unidades`, `web-unidades`) — fronteira de `GET/POST/PATCH /units`. */
export const unitResponseSchema: z.ZodType<UnitResponse> = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum([UnitStatus.ACTIVE, UnitStatus.DISABLED]),
  createdAt: z.string(),
  // SEDE (change `compartilhamento-entre-unidades`, design.md D11).
  isHeadquarters: z.boolean().optional().catch(undefined),
});

/** Espelha a listagem de `GET /units`. */
export const unitListSchema = z.array(unitResponseSchema);

/** Espelha `DashboardResponse` (design.md D4, `web-painel`): agregados de `GET /dashboard`. */
export const dashboardResponseSchema: z.ZodType<DashboardResponse> = z.object({
  cards: z.object({
    totalFiles: z.number(),
    totalPeople: z.number(),
    usedBytes: z.number(),
    quotaUsedPct: z.number(),
  }),
  filesByType: z.array(
    z.object({
      category: z.enum([
        FileCategory.IMAGE,
        FileCategory.VIDEO,
        FileCategory.AUDIO,
        FileCategory.PDF,
        FileCategory.OFFICE,
        FileCategory.TEXT,
        FileCategory.OTHER,
      ]),
      count: z.number(),
    }),
  ),
  uploadsByMonth: z.array(
    z.object({
      month: z.string(),
      count: z.number(),
    }),
  ),
  storage: z.object({
    usedBytes: z.number(),
    quotaBytesPerUser: z.number(),
    userCount: z.number(),
    capacityBytes: z.number(),
    availableBytes: z.number(),
  }),
});

/** Espelha `MyProfileResponse` (change `troca-de-senha`, `web-minha-conta`) — fronteira de `GET /auth/profile`. */
export const myProfileResponseSchema: z.ZodType<MyProfileResponse> = z.object({
  fullName: z.string().nullable(),
  email: z.string(),
  unitName: z.string(),
  role: z.enum([UserRole.COLLABORATOR, UserRole.UNIT_ADMIN, UserRole.GLOBAL_ADMIN]),
});

/** Espelha `ResetPasswordResponse` (change `troca-de-senha`, `web-pessoas`) — fronteira de `POST /users/:id/password`. */
export const resetPasswordResponseSchema: z.ZodType<ResetPasswordResponse> = z.object({
  generatedPassword: z.string(),
});

/**
 * Espelha `PublicConfigResponse` (change `rebranding-doc7-setes`; `manualUrl`
 * acrescentado pela change `acesso-ao-manual-no-shell`, design.md D3) —
 * fronteira de `GET /auth/public-config`. `manualUrl` aceita string vazia
 * (ausência, design.md D4) ou um endereço `http`/`https` — a API já barra
 * esquema inválido no arranque (design.md D5); esta validação é defesa em
 * profundidade contra um backend divergente, não a linha principal.
 */
export const publicConfigResponseSchema: z.ZodType<PublicConfigResponse> = z.object({
  appName: z.string(),
  clientName: z.string(),
  manualUrl: z.union([z.literal(''), z.url({ protocol: /^https?$/ })]),
  // Texto livre (e-mail, ramal ou ambos) — a implantação escolhe a forma, e
  // a SPA não impõe `mailto:` (design.md D8 de `identidade-visual-isetes`).
  // Ausente numa API mais antiga que a SPA resolve como vazio, que é o mesmo
  // caso de "não configurado": o campo é opcional em ambas as pontas por
  // construção (design.md, Migration Plan).
  supportContact: z.string().catch(''),
});

/** Espelha `FolderDownloadManifestEntry` (design.md D1/D7, `download-pasta-zip`). */
export const folderDownloadManifestEntrySchema: z.ZodType<FolderDownloadManifestEntry> = z.object({
  relativePath: z.string(),
  fileName: z.string(),
  sizeBytes: z.number(),
  url: z.string(),
  expiresAt: z.string(),
});

/** Espelha `FolderDownloadManifestResponse` (design.md D3, `download-pasta-zip`). */
export const folderDownloadManifestResponseSchema: z.ZodType<FolderDownloadManifestResponse> =
  z.object({
    entries: z.array(folderDownloadManifestEntrySchema),
    totalFiles: z.number(),
    allowedFiles: z.number(),
    totalBytes: z.number(),
  });

/** Espelha `AuditQueryResponse` (design.md D6, `web-auditoria`): acessos (`view`/`download`) de um arquivo. */
export const auditQueryResponseSchema: z.ZodType<AuditQueryResponse> = z.object({
  events: z.array(
    z.object({
      actor: z.object({
        id: z.string(),
        name: z.string().nullable(),
        // Nulo para quem acessou vindo de outra unidade (design.md D9 de
        // `compartilhamento-entre-unidades`), com a unidade em `unitName`.
        email: z.string().nullable(),
        unitName: z.string().nullable().optional(),
      }),
      action: z.enum(['view', 'download']),
      createdAt: z.string(),
    }),
  ),
});

/** Espelha `GrantNotificationPayload` (change `expiracao-permissoes`, design.md D5). */
export const grantNotificationPayloadSchema: z.ZodType<GrantNotificationPayload> = z.object({
  resourceType: z.enum([GrantResourceType.FOLDER, GrantResourceType.FILE]),
  resourceId: z.string(),
  permissions: z.array(permissionSchema),
  expiresAt: z.string(),
  subjectUserId: z.string().optional(),
});

/** Espelha `RegistrationPendingNotificationPayload` (US 10.9). */
export const registrationPendingNotificationPayloadSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
});

/** Espelha `ReadingNotificationPayload` (change `avisos-e-atrasos`, design.md D1). */
export const readingNotificationPayloadSchema: z.ZodType<ReadingNotificationPayload> = z.object({
  assignmentId: z.string(),
  campaignId: z.string(),
  documentCode: z.string(),
  documentTitle: z.string(),
  documentRevision: z.number(),
  dueDate: z.string(),
});

/** Espelha `ReadingTeamOverdueNotificationPayload` (design.md D3). */
export const readingTeamOverdueNotificationPayloadSchema: z.ZodType<ReadingTeamOverdueNotificationPayload> =
  z.object({
    campaignId: z.string(),
    documentCode: z.string(),
    documentTitle: z.string(),
    documentRevision: z.number(),
    dueDate: z.string(),
    lateCount: z.number(),
    people: z.array(z.object({ name: z.string(), sectorName: z.string().nullable() })),
  });

/**
 * Espelha `NotificationResponse` (design.md D4, capability `notificacoes`).
 *
 * O `kind` e o `payload` precisam ser ampliados **juntos** a cada assunto
 * novo do canal: esta validação é a fronteira da SPA, e um `kind` fora do
 * `enum` reprova o `parse` da lista inteira — o sino pararia de abrir por
 * causa de uma notificação que ele apenas não sabe exibir. Por isso a união,
 * e não um `grantNotificationPayloadSchema` fixo.
 */
export const notificationResponseSchema: z.ZodType<NotificationResponse> = z.object({
  id: z.string(),
  kind: z.enum([
    NotificationKind.GRANT_CREATED,
    NotificationKind.GRANT_EXPIRING,
    NotificationKind.GRANT_EXPIRED,
    NotificationKind.REGISTRATION_PENDING,
    NotificationKind.READING_ASSIGNED,
    NotificationKind.READING_OVERDUE,
    NotificationKind.READING_OVERDUE_TEAM,
  ]),
  // A união tenta na ordem, e `z.object` descarta campos a mais: o payload do
  // gestor vem **antes** do do leitor, ou seria aceito por ele e perderia a
  // lista de pessoas (change `avisos-e-atrasos`, design.md D5).
  payload: z.union([
    grantNotificationPayloadSchema,
    readingTeamOverdueNotificationPayloadSchema,
    readingNotificationPayloadSchema,
    registrationPendingNotificationPayloadSchema,
  ]),
  createdAt: z.string(),
  readAt: z.string().nullable(),
});

/** Espelha `NotificationListResponse`. */
export const notificationListResponseSchema: z.ZodType<NotificationListResponse> = z.object({
  notifications: z.array(notificationResponseSchema),
});

/** Espelha `UnreadNotificationCountResponse`. */
export const unreadNotificationCountResponseSchema: z.ZodType<UnreadNotificationCountResponse> =
  z.object({
    count: z.number(),
  });

/**
 * Espelha `SharedPermissionResponse` (US 4.4, capability
 * `compartilhados-comigo`): o verbo com o **seu próprio** prazo.
 */
export const sharedPermissionResponseSchema: z.ZodType<SharedPermissionResponse> = z.object({
  permission: permissionSchema,
  expiresAt: z.string().nullable(),
});

/**
 * Espelha `SharedWithMeItemResponse`, reusando `fileSummaryResponseSchema` em
 * `file`: é o mesmo objeto que o `PreviewModal` consome, então validar aqui
 * com outro schema abriria a porta para a lista aceitar um arquivo que o
 * visualizador recusaria.
 */
export const sharedWithMeItemResponseSchema: z.ZodType<SharedWithMeItemResponse> = z.object({
  resourceType: z.enum([GrantResourceType.FOLDER, GrantResourceType.FILE]),
  id: z.string(),
  name: z.string(),
  folderName: z.string().nullable(),
  permissions: z.array(sharedPermissionResponseSchema),
  sharedAt: z.string(),
  file: fileSummaryResponseSchema.nullable(),
  // Unidade de origem do compartilhamento entre unidades (design.md D12).
  originUnit: z.object({ id: z.string(), name: z.string() }).nullable().optional().catch(undefined),
});

/** Espelha `SharedWithMeResponse` — `GET /grants/received`. */
export const sharedWithMeResponseSchema: z.ZodType<SharedWithMeResponse> = z.object({
  items: z.array(sharedWithMeItemResponseSchema),
});

/** Espelha `FavoriteItemResponse` — mesma forma da lista de compartilhados (change `favoritos`). */
export const favoriteItemResponseSchema: z.ZodType<FavoriteItemResponse> = z.object({
  resourceType: z.enum([GrantResourceType.FOLDER, GrantResourceType.FILE]),
  id: z.string(),
  name: z.string(),
  folderName: z.string().nullable(),
  permissions: z.array(permissionSchema),
  favoritedAt: z.string(),
  file: fileSummaryResponseSchema.nullable(),
});

/** Espelha `FavoritesResponse` — `GET /favorites`. */
export const favoritesResponseSchema: z.ZodType<FavoritesResponse> = z.object({
  items: z.array(favoriteItemResponseSchema),
});

/**
 * Compartilhamento entre unidades (change `compartilhamento-entre-unidades`,
 * design.md D7/D8) — fronteiras de `/grants/cross-unit*`.
 */
export const crossUnitGrantResponseSchema: z.ZodType<CrossUnitGrantResponse> = z.object({
  id: z.string(),
  unitId: z.string(),
  resourceType: z.enum([GrantResourceType.FOLDER, GrantResourceType.FILE]),
  resourceId: z.string(),
  subjectUnitId: z.string(),
  subjectUnitName: z.string().nullable(),
  subjectUserId: z.string().nullable(),
  subjectUserName: z.string().nullable(),
  permission: z.enum(['view', 'download']),
  grantedBy: z.string(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  expired: z.boolean(),
});

export const crossUnitGrantListResponseSchema: z.ZodType<CrossUnitGrantListResponse> = z.object({
  grants: z.array(crossUnitGrantResponseSchema),
});

export const crossUnitDestinationListResponseSchema: z.ZodType<CrossUnitDestinationListResponse> =
  z.object({
    headquartersDefined: z.boolean(),
    destinations: z.array(
      z.object({ id: z.string(), name: z.string(), isHeadquarters: z.boolean() }),
    ),
  });

export const crossUnitRecipientListResponseSchema: z.ZodType<CrossUnitRecipientListResponse> =
  z.object({
    recipients: z.array(
      z.object({
        id: z.string(),
        fullName: z.string().nullable(),
        jobTitle: z.string().nullable(),
        sectorName: z.string().nullable(),
      }),
    ),
  });
