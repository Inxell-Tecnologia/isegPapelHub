# Design — acesso-ao-manual-no-shell

## Contexto

O manual do usuário mora em `docs/manual/` (MkDocs Material, `strict: true`) e
é publicado no GitHub Pages por `.github/workflows/docs.yml` a cada push na
`main` que toca `docs/manual/**`. A aplicação é uma SPA React servida pela
própria API na mesma origem. Os dois artefatos são produzidos e implantados
por pipelines independentes, e hoje não há nenhuma referência de um ao outro.

A pergunta que originou esta change é estreita — "dá para colocar o manual
como uma opção na navegação?" — mas a resposta esbarra em três restrições que
já estão codificadas no repositório e que determinam o desenho.

## Decisões

### D1. Link para o site publicado, não manual embutido na imagem

**Decisão:** o item de navegação aponta para o site MkDocs já publicado no
GitHub Pages, aberto em nova aba. O manual **não** passa a ser empacotado na
imagem da API nem servido em `/manual`.

**Alternativa avaliada e recusada:** construir o site no Dockerfile e servi-lo
pela API em `/manual`. Ganharia mesma origem, funcionamento sem internet e a
possibilidade de colocar o conteúdo atrás da sessão. Custaria três coisas:

1. Um estágio Python no Dockerfile, que hoje é exclusivamente Node.
2. `/manual` viraria um prefixo **nem-API-nem-SPA**: precisaria entrar na
   guarda de sombreamento de `apps/api/src/lib/api-prefixes.ts` (senão
   `/manual/pagina-inexistente` devolveria o `index.html` da SPA) e no
   `api_proxy_prefixes` de `infra/terraform/locals.tf` (senão, na fase com
   domínio, o url-map mandaria `/manual` para o bucket da SPA, que não o tem).
   Isso adiciona uma terceira semântica a um invariante hoje binário.
3. **O custo decisivo:** `.github/workflows/deploy.yml` classifica merges que
   só tocam `docs/*` como "sem efeito em produção" e pula build/push/migração/
   deploy. É uma otimização deliberada. Se o manual compuser a imagem, ou a
   correção de texto nunca chega a produção, ou `docs/*` sai do allowlist e
   toda vírgula de documentação passa a reconstruir o container. A otimização
   existente e o embutimento são mutuamente exclusivos.

**Trade-off aceito:** o acesso depende de internet e do domínio `github.io`
estar alcançável na rede do cliente. Se alguma implantação futura não
satisfizer essa condição, a alternativa recusada volta à mesa como change
própria — `APP_MANUAL_URL` (D2) já deixa o endereço trocável sem tocar código.

### D2. Endereço por configuração de runtime, não literal nem build-time

**Decisão:** o endereço vem de `APP_MANUAL_URL`, variável de ambiente lida
pela API e entregue à SPA em runtime.

**Por que não literal no código:** travaria o host do manual no binário. Um
fork ou uma implantação white-label que hospede a própria versão do manual
teria de alterar código.

**Por que não `VITE_MANUAL_URL` (build-time):** seria a opção mais barata —
nenhuma mudança de contrato de API e nenhum conflito de spec. Mas quebra o
modelo de implantação já adotado: `APP_CLIENT_NAME` é variável de **runtime**
do Cloud Run precisamente para que **a mesma imagem** sirva clientes
diferentes. Um valor fixado em tempo de compilação obrigaria uma imagem por
cliente. O manual segue o mesmo padrão do nome do cliente porque tem a mesma
natureza: apresentação, pública, variável por implantação.

### D3. Transporte pelo `/auth/public-config`, ampliando o contrato por allowlist

**Decisão:** `manualUrl` entra na resposta do `GET /auth/public-config`
existente. O contrato passa de `{ appName, clientName }` para
`{ appName, clientName, manualUrl }`.

Isso **contradiz frontalmente** um requisito vigente da capability
`identidade-visual`, que exige que o endpoint devolva "**exclusivamente** o
nome da aplicação e a identificação do cliente" e "NÃO SHALL expor nenhum
outro valor de configuração, ambiente, versão, limite ou recurso de
infraestrutura". A contradição é reconhecida e resolvida por um requisito
MODIFIED, não ignorada.

O requisito passa de "exclusivamente estes dois valores" para uma **allowlist
nominal** de valores públicos de apresentação. A intenção original — impedir
que um endpoint sem autenticação vire despejo de configuração — é preservada
integralmente: o veto a ambiente, versão, limites e recursos de infraestrutura
continua literal, e a lista de valores permitidos é enumerada, não aberta a
"qualquer configuração de apresentação".

**Alternativa avaliada e recusada:** transportar `manualUrl` pelo
`GET /auth/me`, que já é autenticado. Deixaria o requisito de
`identidade-visual` intocado e restringiria a exposição a quem tem sessão. Foi
recusada porque `AuthenticatedIdentity` (`{ id, unitId, role }`) é um DTO de
**identidade**, que alimenta o raciocínio de contexto de tenant; injetar
configuração de apresentação ali contamina uma estrutura de segurança e
obrigaria a mexer na capability `autenticacao`. Troca uma contaminação por
outra, pior. Além disso, o valor aponta para um site **público**: expô-lo a
chamador anônimo não vaza nada que já não esteja aberto na internet.

**Dívida reconhecida:** o header do requisito continua "Configuração de
identidade visual disponível sem autenticação" para que o delta resolva contra
o requisito existente, embora o corpo agora trate de configuração pública de
apresentação em geral. Renomear o header é limpeza para uma change futura, não
para esta.

### D4. Ausência limpa quando não configurado

**Decisão:** `APP_MANUAL_URL` tem default vazio (`''`), espelhando
`appClientName`. Com valor vazio, o item **não é renderizado** — não é
renderizado desabilitado, nem com link morto, nem com aviso.

Isso cobre de graça um segundo caso: `apps/web/src/auth/session-context.tsx`
já cai em `DEFAULT_PUBLIC_CONFIG` quando `GET /auth/public-config` falha.
Com `manualUrl: ''` nesse default, uma falha do endpoint faz o item
desaparecer em vez de apontar para lugar nenhum — mesma degradação segura já
adotada para a identificação do cliente.

### D5. Endereço inválido derruba o arranque

**Decisão:** `APP_MANUAL_URL` preenchida com valor cujo esquema não seja
`http` ou `https` faz a API falhar no arranque, com mensagem nomeando a
variável.

Sem isso, uma variável mal preenchida (um `javascript:` colado por engano, um
caminho sem host) chega intacta ao `href` renderizado. O repositório já tem o
padrão certo para essa classe de erro: `WEB_DIST_DIR` inválido derruba o
`createApp` no arranque (`apps/api/src/app.ts`) em vez de degradar em silêncio
para uma aplicação sem frontend. Misconfiguração deve gritar na inicialização,
não virar comportamento estranho em produção. Valor **vazio** não é inválido —
é a ausência de D4.

### D6. Rodapé como segundo `<Menu>`, não como elemento solto

**Decisão:** o item fica num segundo `<Menu>` do Ant Design
(`theme="dark" mode="inline" selectable={false}`) com um único item, colocado
ao pé do `Sider`, separado do menu de navegação.

**Por que não uma `<div>` com ícone e link:** o `Menu` entrega de graça três
comportamentos que teriam de ser reimplementados à mão — o alinhamento
ícone+rótulo idêntico ao dos itens acima, os estados de hover/foco do tema
escuro e, o que mais importa, o **tooltip automático quando o Sider está
colapsado**, sem o qual o item vira um ícone sem nome. `selectable={false}` é
o que impede esse item de disputar `selectedKeys` com a navegação real: o
manual não é um destino da SPA e nunca deve aparecer como "tela atual".

**Incógnita mecânica, a resolver na implementação:** empurrar o bloco para o
pé depende de o container `.ant-layout-sider-children` do Ant Design 5.29 já
ser flex column (aí basta `margin-top: auto`) e de o trigger de colapso ser
irmão desse container, não filho. Se não for, entra um wrapper com
`height: 100%`. Não altera o desenho, só o CSS — verificar no navegador, nos
dois estados, antes de fechar a tarefa.

### D7. Somente no shell autenticado

**Decisão:** o acesso ao manual é oferecido apenas no shell autenticado. **Não
há** link na tela de login.

Custo reconhecido e aceito: a página "Primeiro acesso" do manual é justamente
a que serve quem ainda não entrou, e essa pessoa não tem como alcançá-la pela
aplicação. A tela de login já consome o mesmo `publicConfig`, então o custo
técnico de um link ali seria quase nulo — a exclusão é decisão de produto, não
limitação técnica, e pode ser revertida por uma change pequena.

**Limite honesto desta decisão:** o que fica restrito ao usuário autenticado é
a **afordância**, não o conteúdo. O site é público no GitHub Pages de um
repositório público e continua legível por qualquer pessoa que tenha o
endereço. Tornar o **conteúdo** exclusivo de quem tem conta é problema
diferente, que só a alternativa recusada em D1 (manual embutido, atrás da
sessão) resolveria.

### D8. Abertura em nova aba, com o desvio anunciado

**Decisão:** o link abre em nova aba (`target="_blank"`) com
`rel="noopener noreferrer"`, e seu nome acessível informa que sai da
aplicação.

Nova aba porque o usuário consulta o manual **enquanto** executa uma tarefa;
navegar para fora perderia o estado da tela (uma pasta aberta, um filtro de
busca, um envio em curso). `noopener noreferrer` é higiene padrão para link
externo. Anunciar o desvio no nome acessível é o que evita que um leitor de
tela apresente o item como se fosse mais um destino interno, indistinguível de
"Arquivos" ou "Lixeira" — a mesma distinção que a separação visual faz para
quem enxerga a tela.
