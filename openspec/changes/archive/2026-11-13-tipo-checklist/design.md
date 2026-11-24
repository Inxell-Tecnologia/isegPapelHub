# Design

## D1 — Checklist é um valor novo do enum, não um subtipo de Formulário

Alternativas: (a) manter um tipo só e mostrar `FOR` ou `CHK` conforme o código
do documento; (b) valor novo `checklist` no `DocumentType`.

Escolhida **(b)**. A sigla é a portadora da informação (US 10.1, cenário 2) e
precisa vir do **tipo declarado**, não de uma inferência sobre o código — um
código livre como `FOR-NSP-002` num checklist mostraria a sigla errada. Um
valor próprio também dá ao checklist cor própria e o torna distinguível em
qualquer listagem que já lê `documentType`. O custo é baixo: `DOCUMENT_TYPES`
deriva do objeto, a API valida contra ele e não há CHECK no banco (migration
0016), então não há migration.

O valor `form` **não muda de nome** no contrato; muda só o rótulo de
apresentação ("Formulário/Checklist" → "Formulário"). Renomear o valor exigiria
migrar dados sem ganho.

## D2 — Sem reclassificação do acervo existente

Documentos gravados como `form` antes deste change podem ser formulários ou
checklists, e nada no banco permite separá-los com segurança — o código é
texto livre. Reclassificar por prefixo `CHK-` do código acertaria a maioria,
mas transformaria um palpite em afirmação sobre o documento, que é exatamente o
que o controle documental evita (o pendente de cadastro existe pelo mesmo
motivo). Quem administra reclassifica pela edição dos dados de controle, que já
existe. Registrado no manual.

## D3 — Tom do Checklist

Magenta (`#9E1068` sobre `#FCEBF4`, borda `#E5A6C8`): matiz ausente da paleta
de tipos, distinto do âmbar do Formulário para que os dois não se confundam lado
a lado. O par passa no piso de 4,5:1 por cálculo em `contraste.test.ts`, que
já percorre `tonsDeTipoDocumental` e exige uma entrada por tipo.

## D4 — Sugestão pelo nome do arquivo

`CHK` → `checklist`; `FOR` e `FRM` → `form` (FRM mantido para arquivos
nomeados com a sigla anterior da interface). Muda o comportamento de `CHK`, que
antes sugeria Formulário — é a correção pedida, não regressão.
