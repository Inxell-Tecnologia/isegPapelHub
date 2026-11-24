/**
 * Idioma do **pedido de tour** levado à tela inicial pelo endereço
 * (`/?tour=1`) — change `tour-guiado`, design.md D3. Mesmo ciclo dos pedidos de
 * envio e de nova pasta: atendido uma vez, retirado do endereço substituindo a
 * entrada de histórico.
 *
 * Os dois acionadores — o item Tour guiado do grupo AJUDA e o convite da
 * saudação — conduzem aqui, porque é na tela inicial que estão os alvos.
 */
export const PARAM_PEDIDO_DE_TOUR = 'tour';

export const DESTINO_PEDIDO_DE_TOUR = `/?${PARAM_PEDIDO_DE_TOUR}=1`;
