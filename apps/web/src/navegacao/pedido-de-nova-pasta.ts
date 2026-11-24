/**
 * Idioma do **pedido de nova pasta** levado ao explorador pelo endereço
 * (`/pastas?nova-pasta=1`), no mesmo formato do pedido de envio — change
 * `conteudo-da-tela-inicio`, design.md D5.
 *
 * Atendido **só na raiz da unidade**, onde criar pasta é livre a qualquer
 * pessoa autenticada (`POST /folders` sem `parentId`). Numa subpasta a regra é
 * do servidor e o cliente não a antecipa: o pedido é descartado sem abrir o
 * formulário, e é assim que o atalho "Nova pasta" nunca conduz a uma recusa.
 */
export const PARAM_PEDIDO_DE_NOVA_PASTA = 'nova-pasta';

/** Endereço que anuncia o pedido de nova pasta na raiz do explorador. */
export const DESTINO_PEDIDO_DE_NOVA_PASTA = `/pastas?${PARAM_PEDIDO_DE_NOVA_PASTA}=1`;
