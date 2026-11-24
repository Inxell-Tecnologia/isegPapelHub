# Tasks

## 1. Fundação: tokens, contraste e tipografia

- [x] 1.1 Acrescentar `lucide-react`, `@fontsource/lexend` e `@fontsource/source-sans-3` a `apps/web/package.json` e verificar que `npm install` conclui e `npm run build --workspace apps/web` segue passando
- [x] 1.2 Reescrever `apps/web/src/app/theme.ts` como módulo de tokens (paleta por função, raios 10px/14px, tokens de `Layout`, `Menu`, `Button`, `Card` e `Input`), incluindo os dois tokens de borda da decisão D3, e verificar que a aplicação sobe com a paleta nova em `npm run dev:web`
- [x] 1.3 Implementar utilitário de razão de contraste (WCAG 2.x) em `apps/web/src/app/` e cobrir com teste de unidade que confira os valores conhecidos da tabela da decisão D2
- [x] 1.4 Adicionar teste que percorra os pares de tokens normatizados e **reprove** quem ficar abaixo do piso (4,5:1 para texto, 3:1 para borda de controle, 7:1 para o fundo do login), travando a decisão D2/D3 contra regressão futura
- [x] 1.5 Importar as fontes locais no ponto de entrada da SPA, restritas a `woff2`/latino e aos pesos 400 e 600, e verificar no build que nenhuma requisição a domínio externo é emitida e que o tamanho do pacote foi medido antes e depois

## 2. Iconografia unificada

- [x] 2.1 Substituir todos os imports de `@ant-design/icons` por `lucide-react` nos arquivos da SPA, conferindo cada ícone contra o mapeamento do bloco 07 do guia do cliente, e verificar que `npm run build --workspace apps/web` passa sem import órfão
- [x] 2.2 Remover `@ant-design/icons` de `apps/web/package.json` e verificar que `npm run lint` e `npm run build` passam sem nenhuma referência remanescente
- [x] 2.3 Rodar `npm run test --workspace apps/web` e verificar que a suíte existente permanece verde — ela busca por texto e nome acessível, então serve de rede da substituição

## 3. Shell autenticado

- [x] 3.1 Aplicar o degradê azul-marinho à navegação lateral e ao painel sobreposto do modo estreito, verificando em tela larga e em 375px que o degradê cobre a navegação inteira sem faixa de outra cor
- [x] 3.2 Aplicar ao item de navegação ativo a pílula em verde da marca com rótulo e ícone escuros (decisão D2) e verificar, pelo teste de contraste de 1.4, que o par apurado é o de 7,77:1 e não o de 2,21:1 do desenho de referência
- [x] 3.3 Unificar os três mapas `ROLE_LABEL` (`shell/AppShell.tsx`, `conta/MinhaContaPage.tsx`, `pessoas/PessoaFormModal.tsx`) numa origem única e trocar o rótulo de `unit_admin` para "Gestor", mantendo "Colaborador" e "Administrador global"
- [x] 3.4 Adicionar teste que verifique o mesmo rótulo de papel nas três telas que o exibem, cobrindo o requisito "Rótulo do papel é idêntico em toda a interface"
- [x] 3.5 Atualizar `__tests__/pessoas.test.tsx` e `__tests__/role-guard.test.tsx`, que asseguram o rótulo antigo, e verificar que a suíte volta ao verde
- [x] 3.6 Atualizar a página do manual que nomeia os papéis de acesso em `docs/manual/docs/`, verificando que nenhuma ocorrência de "Administrador da unidade" permanece no manual

## 4. Contato do suporte na configuração pública

- [x] 4.1 Acrescentar o quarto campo a `PublicConfigResponse` em `packages/shared/src/auth.ts`, atualizando o comentário da allowlist nominal, e verificar que `npm run build --workspace packages/shared` gera o `dist/` consumido pelos demais workspaces
- [x] 4.2 Ler a variável de ambiente nova na configuração da API, ao lado de `APP_CLIENT_NAME` e **sem** passar pelo `SecretsPort`, e devolvê-la em `GET /auth/public-config`
- [x] 4.3 Cobrir com teste de API os dois casos normatizados: valor configurado é devolvido, e valor ausente é devolvido vazio mantendo a forma da resposta estável
- [x] 4.4 Acrescentar a variável ao serviço Cloud Run em `infra/terraform/` e verificar que `terraform validate` passa
- [x] 4.5 Espelhar a variável em `.env.example` e verificar que o ambiente de dev sobe sem ela definida, exibindo a tela de login sem o aviso de contato

## 5. Tela de login recomposta

- [x] 5.1 Recompor `apps/web/src/auth/LoginPage.tsx` em dois campos — painel escuro com a logomarca e a proposta de valor, cartão de acesso à direita — mantendo a pintura do elemento raiz com a cor da marca (decisão D4) e verificando que a rolagem elástica continua revelando azul-marinho
- [x] 5.2 Atualizar `LOGIN_BACKGROUND_COLOR` para o azul-marinho da paleta e verificar, pelo teste de 1.4, que o contraste com branco permanece acima do nível AAA exigido
- [x] 5.3 Exibir o aviso de contato do suporte quando configurado e omiti-lo por completo quando ausente, sem espaço reservado
- [x] 5.4 Garantir que a tela **não** apresenta "Manter conectado" nem "Esqueci minha senha", e cobrir com teste que afirme a ausência dos dois controles
- [x] 5.5 Atualizar os casos de `__tests__/login.test.tsx` presos ao layout anterior ("aplica a cor de marca como fundo" e "o cartão de acesso é fluido com teto") e acrescentar caso de empilhamento em 375px sem rolagem horizontal
- [x] 5.6 Verificar que os casos já existentes de identificação do cliente, título do documento e degradação sem configuração pública continuam verdes, sem alteração de comportamento
- [x] 5.7 Atualizar a página de acesso do manual em `docs/manual/docs/` com fidelidade à tela entregue, verificando que ela **não** documenta manter conectado nem redefinição de senha pelo próprio usuário

## 6. Estado vazio no explorador

- [x] 6.1 Apresentar, em pasta sem itens visíveis, mensagem de orientação com a ação de envio no lugar da tabela vazia, oferecendo a ação apenas quando a permissão já resolvida pelo servidor a admitir
- [x] 6.2 Cobrir com teste os três cenários do requisito: pasta vazia com permissão de envio, pasta vazia sem ela, e pasta com itens que não exibe a orientação
- [x] 6.3 Atualizar a página do manual que descreve a navegação por pastas em `docs/manual/docs/`, verificando que o texto corresponde ao estado vazio efetivamente entregue

## 7. Verificação integrada

- [x] 7.1 Percorrer tela a tela a SPA com a paleta nova — incluindo componentes não redesenhados (tags, seleção de tabela, paginação, `Popconfirm`, diálogos) — e corrigir contraste ou cor fora de função onde a troca de `colorPrimary` tiver vazado
- [x] 7.2 Revalidar o modo estreito em 375px e em 768px, verificando que a pele nova não regride nenhum comportamento entregue pela change `responsividade-mobile-tablet` e que nenhuma tela produz rolagem horizontal
- [x] 7.3 Percorrer a aplicação apenas pelo teclado e verificar que o elemento focado é sempre distinguível e que os controles interativos respeitam a área mínima de 44px
- [x] 7.4 Rodar `npm run lint`, `npm run build`, `npm run test` e `npm run format:check` na raiz e verificar que todos passam, sem formatar `openspec/`, `docs/` nem `.claude/`

## Workflow follow-up

- Levar ao aceite do cliente a divergência deliberada da decisão D2: o item de navegação ativo usa rótulo escuro sobre o verde da marca, não branco, por exigência do item 17 do próprio pedido.
- Arquivar a change depois de satisfeitos os requisitos de revisão do projeto, sincronizando as specs em `openspec/specs/`.
