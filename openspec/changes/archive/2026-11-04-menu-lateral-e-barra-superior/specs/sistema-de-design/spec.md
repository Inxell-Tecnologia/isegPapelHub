# Spec Delta

## ADDED Requirements

### Requirement: Superfície de avatar carrega texto escuro

A SPA SHALL apresentar o avatar de identidade sobre a superfície de azul céu da
paleta, com as iniciais em **texto escuro**. O azul céu NÃO SHALL carregar texto
branco: o par mede 1,54:1 e reprova no piso de 4,5:1. O par adotado SHALL ser
apurado por cálculo, como todo par dos tokens.

Este requisito é da mesma natureza do que já veda o verde claro como fundo de
texto branco: a cor vem do guia da marca, e é o piso de acessibilidade que
decide o que vai escrito sobre ela.

#### Scenario: Iniciais do avatar aparecem em texto escuro
- **WHEN** uma pessoa autenticada com nome cadastrado visualiza o seu avatar
- **THEN** as iniciais são apresentadas em texto escuro sobre o azul céu, cujo
  contraste atende ao mínimo exigido

#### Scenario: O par com branco é recusado por cálculo
- **WHEN** o par formado pelo azul céu do avatar e o branco é apurado
- **THEN** o resultado fica abaixo do piso de 4,5:1, e o branco não é adotado
  como cor das iniciais

#### Scenario: A superfície do avatar se distingue do fundo que a cerca
- **WHEN** o avatar é apresentado sobre o fundo da navegação
- **THEN** o contraste entre a superfície do avatar e esse fundo atende ao piso
  de elemento de interface, mantendo o avatar perceptível como forma própria
