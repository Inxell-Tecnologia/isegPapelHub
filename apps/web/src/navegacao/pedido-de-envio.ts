/**
 * Idioma do **pedido de envio** levado ao explorador pelo próprio endereço
 * (`/pastas?enviar=1`), no mesmo formato de `/busca?q=` — change
 * `cartoes-de-atalho-acionaveis`, design.md D4; movido para cá por design.md
 * D4 do change `menu-lateral-e-barra-superior`.
 *
 * Mora na navegação, e não em `inicio/`, porque **quem atende o pedido é o
 * explorador**. A partir desta change há três emissores — o cartão da tela
 * inicial, a ação de envio da barra superior do shell e qualquer endereço
 * guardado por quem já usou um dos dois — e o shell não deve importar de uma
 * pasta de feature para falar com outra.
 *
 * Rota própria (`/pastas/enviar`) continua descartada: colidiria com
 * `/pastas/:folderId`, que capturaria `enviar` como identificador de pasta.
 *
 * Quem decide se há envio permitido é **sempre o servidor**, pelo veredito
 * `canUpload` do DTO de conteúdo da pasta alcançada. O parâmetro apenas
 * anuncia o pedido; nenhum emissor antecipa permissão.
 */
export const PARAM_PEDIDO_DE_ENVIO = 'enviar';

/** Endereço que anuncia o pedido de envio na raiz do explorador. */
export const DESTINO_PEDIDO_DE_ENVIO = `/pastas?${PARAM_PEDIDO_DE_ENVIO}=1`;
