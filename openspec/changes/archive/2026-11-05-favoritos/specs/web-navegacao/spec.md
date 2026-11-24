# Spec Delta

## ADDED Requirements

### Requirement: Explorador oferece marcar e desmarcar favorito

O explorador SHALL oferecer, em cada pasta e arquivo listados, a ação de marcar
como favorito ou, quando o item já for favorito da pessoa, a de removê-lo dos
favoritos. A indicação de favorito SHALL vir do servidor, junto com a listagem
da pasta, e NÃO SHALL ser inferida pelo cliente. A indicação NÃO SHALL depender
apenas de cor. Referência: PRD US 2.5; capability `favoritos`.

#### Scenario: Item não favorito oferece favoritar
- **WHEN** uma pessoa abre as ações de um arquivo que não é seu favorito
- **THEN** encontra a ação de marcá-lo como favorito

#### Scenario: Item favorito oferece remover
- **WHEN** uma pessoa abre as ações de um arquivo que já é seu favorito
- **THEN** encontra a ação de removê-lo dos favoritos, e o item indica por texto
  ou nome acessível que é favorito

#### Scenario: Marcar reflete na listagem sem recarregar a tela
- **WHEN** uma pessoa marca um item como favorito no explorador
- **THEN** a indicação de favorito do item é atualizada, e o item passa a
  constar do destino de favoritos
