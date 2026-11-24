# Spec Delta

## MODIFIED Requirements

### Requirement: Aplicação adota um ponto de ruptura único e declarado

A SPA SHALL adotar **um único** ponto de ruptura entre a forma larga e a forma
estreita da interface, definido em um único lugar do código e derivado dos
tokens do design system, e NÃO SHALL espalhar limiares independentes por tela ou
por componente. Acima do limiar, a interface SHALL permanecer com a forma larga
já entregue, sem alteração de comportamento.

O limiar SHALL ser posicionado de modo que um tablet em orientação retrato
receba a forma estreita, entregando a largura integral da tela ao conteúdo.

O veredito do ponto de ruptura SHALL valer desde a **primeira** composição da
interface: nenhuma tela SHALL ser montada na forma que não será apresentada para
só então se corrigir. A forma correta NÃO SHALL depender de trabalho posterior à
montagem — nem para chegar à tela, nem para ser observada por teste.

Referência: design.md D1 do change `responsividade-mobile-tablet`; design.md D1
do change `modo-estreito-no-primeiro-render`.

#### Scenario: Tablet em retrato recebe a forma estreita
- **WHEN** uma pessoa abre a aplicação num tablet em orientação retrato
- **THEN** a interface se apresenta na forma estreita, com a largura da tela
  dedicada ao conteúdo

#### Scenario: Acima do limiar a interface permanece inalterada
- **WHEN** uma pessoa abre a aplicação numa janela mais larga que o limiar
- **THEN** a interface se comporta exatamente como na forma larga já entregue,
  sem alteração perceptível

#### Scenario: O limiar tem uma definição única
- **WHEN** o valor do limiar precisa ser alterado
- **THEN** a alteração acontece em um único ponto do código e passa a valer para
  toda a aplicação, sem exigir ajuste tela a tela

#### Scenario: A primeira composição já está na forma correta
- **WHEN** uma tela responsiva é composta numa largura abaixo do limiar
- **THEN** a forma estreita vale nessa primeira composição, sem que a forma larga
  seja montada antes e descartada em seguida

#### Scenario: Verificar a forma estreita não exige espera
- **WHEN** uma verificação automatizada compõe uma tela numa largura abaixo do
  limiar e consulta de imediato o que foi composto
- **THEN** encontra a forma estreita, sem precisar aguardar uma segunda
  composição para que o veredito do limiar valha
