import { useEffect, useState } from 'react';
import { Tour } from 'antd';
import type { TourProps } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/session-context';
import { PASSOS_DO_TOUR, seletorDoAlvo } from './passos';
import { PARAM_PEDIDO_DE_TOUR } from './pedido-de-tour';

/**
 * Monta os passos com os alvos **presentes agora** (design.md D2): passo sem
 * elemento na tela é omitido, nunca apontado para o vazio.
 */
export function montarPassos(raiz: ParentNode = document): NonNullable<TourProps['steps']> {
  return PASSOS_DO_TOUR.flatMap((passo) => {
    const alvo = raiz.querySelector<HTMLElement>(seletorDoAlvo(passo.alvo));
    if (!alvo) return [];
    return [{ title: passo.titulo, description: passo.descricao, target: () => alvo }];
  });
}

/**
 * Tour guiado da tela inicial (change `tour-guiado`).
 *
 * Atende o **pedido no endereço** (design.md D3): monta os passos, retira o
 * parâmetro substituindo a entrada de histórico — recarregar não reabre — e
 * abre o tour. Concluir **ou fechar** registra, na conta, que o tour foi feito
 * (D4/D5); é isso que tira o convite da saudação.
 *
 * Não começa sozinho: sem pedido, nada acontece.
 */
export function TourGuiado() {
  const { markTourCompleted } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const pedido = searchParams.get(PARAM_PEDIDO_DE_TOUR) !== null;
  const [passos, setPassos] = useState<NonNullable<TourProps['steps']> | null>(null);

  useEffect(() => {
    if (!pedido) return;
    setPassos(montarPassos());
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.delete(PARAM_PEDIDO_DE_TOUR);
        return proximo;
      },
      { replace: true },
    );
  }, [pedido, setSearchParams]);

  function encerrar() {
    setPassos(null);
    // Falha ao registrar não impede nada: no pior caso o convite volta a
    // aparecer na próxima visita.
    void markTourCompleted().catch(() => undefined);
  }

  return (
    <Tour
      open={passos !== null && passos.length > 0}
      steps={passos ?? []}
      onClose={encerrar}
      onFinish={encerrar}
    />
  );
}
