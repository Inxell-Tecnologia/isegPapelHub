## MODIFIED Requirements

### Requirement: Endereço do manual configurado por implantação

O endereço do manual SHALL ser obtido de configuração da implantação, resolvida
em **tempo de execução**, de modo que uma implantação possa apontar para a sua
própria hospedagem do manual sem alteração de código e sem nova compilação do
frontend. O endereço NÃO SHALL ser fixado em tempo de compilação, para que uma
mesma imagem de aplicação sirva implantações distintas.

Quando a implantação **não expressar escolha** sobre o endereço, a aplicação
SHALL adotar o **endereço canônico** do manual publicado por este repositório, e
o acesso SHALL ser apresentado normalmente. Ausência de escolha SHALL abranger
tanto a configuração não definida quanto a configuração definida sem valor —
as duas formas SHALL produzir o mesmo resultado, para que nenhuma camada de
implantação possa anular o padrão apenas por declarar a configuração vazia.

Configurar o endereço SHALL **trocar o destino** do acesso, e NÃO SHALL ser
meio de ligar ou desligar sua apresentação: nenhum valor de configuração SHALL
suprimir o acesso ao manual. Assim, o requisito de alcançabilidade é satisfeito
por padrão em toda implantação, e não apenas naquelas que preenchem a
configuração.

A aplicação SHALL **omitir inteiramente** o acesso ao manual quando a
configuração de apresentação não puder ser obtida, e NÃO SHALL apresentar acesso
desabilitado, mensagem de erro ou referência que não leve a lugar nenhum.

Um endereço configurado com valor inválido SHALL impedir o arranque da
aplicação, com identificação da configuração responsável, em vez de ser
apresentado ao usuário.

Referência: design.md D2, D4, D5 do change `acesso-ao-manual-no-shell`;
design.md D1, D2, D3 do change `corrige-alcance-do-manual`.

#### Scenario: Implantação aponta para a própria hospedagem do manual
- **WHEN** o endereço do manual é alterado na configuração da implantação
- **THEN** o acesso na aplicação passa a levar ao novo endereço sem exigir nova
  compilação do frontend

#### Scenario: Implantação sem configuração alcança o manual canônico
- **WHEN** uma implantação não define o endereço do manual
- **THEN** o shell autenticado apresenta o acesso ao manual, apontando para o
  endereço canônico do manual publicado por este repositório

#### Scenario: Configuração declarada sem valor equivale a não configurada
- **WHEN** uma implantação declara a configuração do endereço do manual com
  valor vazio
- **THEN** o acesso é apresentado apontando para o endereço canônico, sem
  diferença observável em relação a não ter declarado a configuração

#### Scenario: Nenhum valor de configuração suprime o acesso
- **WHEN** qualquer valor válido é atribuído à configuração do endereço do
  manual
- **THEN** o acesso continua sendo apresentado, com o destino correspondente ao
  valor configurado

#### Scenario: Falha ao obter a configuração omite o acesso
- **WHEN** a aplicação não consegue obter a configuração pública
- **THEN** o acesso ao manual é omitido, sem erro exibido ao usuário e sem
  impedir o uso das demais telas

#### Scenario: Endereço inválido é barrado no arranque
- **WHEN** o endereço do manual é configurado com um valor que não é um
  endereço web válido
- **THEN** a aplicação falha ao iniciar, identificando a configuração
  responsável, em vez de renderizar o valor na tela
