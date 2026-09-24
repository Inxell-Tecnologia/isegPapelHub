# Spec Delta

## MODIFIED Requirements

### Requirement: Cota permanece contada durante a retenção

Enquanto um arquivo está na lixeira, seus bytes SHALL continuar contando contra a
cota efetiva do dono (capability `cota-individual`), pois ainda ocupam o
armazenamento; a cota SHALL ser devolvida somente quando o expurgo remover o objeto
— seja o expurgo automático por decurso de prazo, seja o expurgo sob demanda do
requisito abaixo. A exclusão NÃO SHALL, por si só, reduzir `storage_used_bytes`.
Referência: PRD Épico 6 / US 6.1; RF #13; design.md D6.

#### Scenario: Excluir não devolve cota imediatamente
- **WHEN** uma pessoa exclui um arquivo (enviando-o à lixeira)
- **THEN** o espaço utilizado do dono permanece inalterado até o expurgo do item
