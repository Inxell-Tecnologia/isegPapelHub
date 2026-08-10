# Tasks — acesso-ao-manual-no-shell

## 1. Contrato compartilhado

- [ ] 1.1 `packages/shared/src/auth.ts`: `PublicConfigResponse` ganha
  `manualUrl: string`. Comentar que é dado **público** de apresentação,
  configurado por implantação, e que a lista de campos é uma allowlist nominal
  fechada por spec (`identidade-visual`) — acrescentar um quarto campo exige
  modificar o requisito, não é extensão natural (design.md D3).
- [ ] 1.2 Recompilar: `npm run build --workspace packages/shared`. Sem isso,
  api e web continuam enxergando o DTO antigo (o pacote é consumido de
  `dist/`, não da fonte).

## 2. API — configuração e endpoint

- [ ] 2.1 `apps/api/src/config.ts`: `appManualUrl: optional('APP_MANUAL_URL',
  '')`, junto de `appClientName` e com comentário no mesmo estilo — dado
  público, **não passa pelo `SecretsPort`**; vazio ⇒ nenhum acesso ao manual é
  apresentado (design.md D2/D4).
- [ ] 2.2 Validação de esquema com falha no arranque: valor não vazio cujo
  esquema não seja `http`/`https` derruba a inicialização com mensagem que
  nomeia `APP_MANUAL_URL`. Espelhar o padrão de fail-fast já usado para
  `WEB_DIST_DIR` em `apps/api/src/app.ts` (design.md D5). Valor **vazio não é
  inválido** — é a ausência de D4.
- [ ] 2.3 `apps/api/src/routes/auth.ts`: `GET /auth/public-config` passa a
  responder `{ appName, clientName, manualUrl }`. Atualizar o comentário que
  hoje diz "contrato travado a exatamente `{ appName, clientName }`" para
  refletir a allowlist nominal de três valores.
- [ ] 2.4 Confirmar que nenhum prefixo de rota mudou — `api-prefixes.ts`,
  `apps/web/vite.config.ts` e `infra/terraform/locals.tf` **não** devem ser
  tocados (a rota já vive sob `/auth`).

## 3. Web — consumo da configuração

- [ ] 3.1 `apps/web/src/lib/schemas.ts`: `publicConfigResponseSchema` ganha
  `manualUrl`. Decidir e registrar se a validação do esquema `http`/`https`
  também acontece aqui — a API já barra no arranque (2.2), então isto é defesa
  em profundidade contra um backend divergente, não a linha principal.
- [ ] 3.2 `apps/web/src/auth/session-context.tsx`: `DEFAULT_PUBLIC_CONFIG`
  ganha `manualUrl: ''`, para que a falha do endpoint faça o item desaparecer
  em vez de apontar para lugar nenhum (design.md D4).

## 4. Web — rodapé do Sider

- [ ] 4.1 `apps/web/src/shell/AppShell.tsx`: bloco de rodapé com um segundo
  `<Menu theme="dark" mode="inline" selectable={false}>` de item único,
  separado visualmente do menu de navegação e posicionado ao pé do `Sider`
  (design.md D6). Renderizado **somente** quando `publicConfig.manualUrl` não
  é vazia.
- [ ] 4.2 Resolver a incógnita mecânica registrada em design.md D6: verificar
  no navegador se `.ant-layout-sider-children` (AntD 5.29) já é flex column e
  se o trigger de colapso é irmão do container. Se não for, envolver os filhos
  num wrapper com `height: 100%` e empurrar o rodapé com `margin-top: auto`.
  **Conferir nos dois estados**, expandido e colapsado.
- [ ] 4.3 O item abre em nova aba: `target="_blank"`,
  `rel="noopener noreferrer"`, e nome acessível que informa a saída da
  aplicação (design.md D8) — de modo que um leitor de tela não o apresente
  como mais um destino interno.
- [ ] 4.4 Rótulo "Manual do usuário" (fiel ao `site_name` do MkDocs) e ícone
  do conjunto já usado no shell. Confirmar que o tooltip do estado colapsado
  aparece e traz o rótulo completo.

## 5. Configuração de ambiente

- [ ] 5.1 `.env.example`: `APP_MANUAL_URL`, junto de `APP_CLIENT_NAME`,
  apontando para o site publicado
  (`https://carlossalesnaturaltec.github.io/gdoc/`) e com comentário de que é o
  endereço **desta implantação**, trocável sem alteração de código.
- [ ] 5.2 Registrar que em produção o valor entra como variável de ambiente do
  Cloud Run — dado público, **fora** do Secret Manager, mesmo tratamento de
  `APP_CLIENT_NAME`. Sem mudança de Terraform prevista; se a variável for
  gerida por IaC, seguir exatamente o padrão de `APP_CLIENT_NAME`.

## 6. Testes

- [ ] 6.1 `apps/api/src/__tests__/auth.test.ts`: a asserção
  `expect(Object.keys(res.body)).toEqual(['appName', 'clientName'])` passa a
  incluir `manualUrl`. **Alteração deliberada de contrato** (design.md D3) —
  o teste é a trava da allowlist nominal, não formalidade; manter a asserção
  por chaves exatas, nunca afrouxar para `toMatchObject`.
- [ ] 6.2 API: caso de arranque com `APP_MANUAL_URL` inválida (esquema não
  web) falhando com mensagem que nomeia a variável; e caso com valor vazio
  arrancando normalmente e respondendo `manualUrl: ''`.
- [ ] 6.3 Web, teste novo no shell: item presente com `href`, `target` e `rel`
  corretos quando `manualUrl` está configurada; **ausente** quando vazia;
  ausente quando a configuração pública falha; sem marcação de seleção em
  qualquer rota; nome acessível indicando saída da aplicação.
- [ ] 6.4 Rodar a suíte completa dos dois workspaces — o contrato do
  `public-config` é lido por vários testes de web que montam a sessão.

## 7. Documentação

- [ ] 7.1 `docs/manual/docs/a-tela.md`: descrever o acesso ao manual no rodapé
  da navegação lateral, com o rótulo exatamente como exibido na tela.
  Exigência de fidelidade da capability `documentacao-usuario` e regra do
  `CLAUDE.md` — a documentação acompanha o commit da feature.
- [ ] 7.2 Conferir se `docs/manual/docs/index.md` ou `primeiro-acesso.md`
  merecem menção ao acesso. **Não** documentar o item como disponível antes do
  login: ele não existe na tela de login (design.md D7).
- [ ] 7.3 Não formatar `docs/` nem `openspec/` com Prettier — estão fora do
  escopo por decisão (`.prettierignore`). Rodar `npm run format` apenas sobre
  o código alterado.

## 8. Fechamento

- [ ] 8.1 `npm run lint`, `npm run build`, `npm run test` e
  `npm run format:check` limpos na raiz.
- [ ] 8.2 `openspec validate acesso-ao-manual-no-shell --strict`.
- [ ] 8.3 Conferência visual final no navegador, autenticado, nos dois estados
  do Sider e em pelo menos dois papéis (`collaborator` e `unit_admin`), para
  confirmar que o item não varia por papel.
