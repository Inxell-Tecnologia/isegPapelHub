# Spec — identidade-visual (delta)

O endpoint público de configuração passa a carregar um terceiro valor — o
endereço do manual do usuário (ver capability `documentacao-usuario`). O
requisito vigente trava a resposta em **exclusivamente** nome da aplicação e
identificação do cliente, então a ampliação exige modificá-lo em vez de
contorná-lo.

A modificação preserva integralmente a **intenção original** do requisito —
impedir que um endpoint sem autenticação vire despejo de configuração. O que
muda é a forma: de "exclusivamente estes dois valores" para uma **allowlist
nominal** de valores públicos de apresentação. O veto a ambiente, versão,
limites e recursos de infraestrutura permanece literal, e a lista é enumerada,
não aberta a "qualquer valor de apresentação".

O header do requisito é mantido para que o delta resolva contra o requisito
existente, embora o corpo passe a tratar de configuração pública de
apresentação de modo geral. Ver design.md D3.

## MODIFIED Requirements

### Requirement: Configuração de identidade visual disponível sem autenticação

O sistema SHALL expor a configuração pública de apresentação por um endpoint
que responde **sem sessão autenticada**, porque a tela onde parte dela precisa
aparecer é anterior ao login. Esse endpoint SHALL devolver **exclusivamente**
os valores desta lista nominal:

- o nome da aplicação;
- a identificação do cliente;
- o endereço do manual do usuário (capability `documentacao-usuario`).

O endpoint NÃO SHALL expor nenhum outro valor de configuração, ambiente,
versão, limite ou recurso de infraestrutura. Acrescentar um quarto valor à
resposta SHALL exigir a modificação explícita desta lista, e NÃO SHALL ser
tratado como extensão natural do contrato. Todo valor da lista SHALL ser
público por natureza — nenhum SHALL transitar pelo `SecretsPort`. O endpoint
NÃO SHALL abrir contexto de unidade nem consultar dado tenant-scoped.

#### Scenario: Requisição sem sessão obtém a configuração pública
- **WHEN** um cliente sem sessão autenticada requisita a configuração pública
  de apresentação
- **THEN** recebe o nome da aplicação, a identificação do cliente e o endereço
  do manual, sem erro de autenticação

#### Scenario: A resposta não carrega configuração fora da lista nominal
- **WHEN** um cliente requisita a configuração pública de apresentação
- **THEN** a resposta contém apenas os valores da lista nominal, e nenhum dado
  de ambiente, versão, limite ou infraestrutura

#### Scenario: Valor não configurado é devolvido como ausência, não omitido
- **WHEN** a identificação do cliente ou o endereço do manual não está
  configurado na implantação
- **THEN** o valor correspondente é devolvido vazio, mantendo a forma da
  resposta estável para o consumidor
