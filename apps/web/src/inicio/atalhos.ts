import type { ComponentType, CSSProperties } from 'react';
import { UserRole } from '@gdoc/shared';
import { IconeBuscar, IconeEnviar, IconeManual, IconeNovaPasta } from '../app/icons';
import type { TomDeAtalho } from '../app/theme';
import { DESTINO_PEDIDO_DE_ENVIO } from '../navegacao/pedido-de-envio';
import { DESTINO_PEDIDO_DE_NOVA_PASTA } from '../navegacao/pedido-de-nova-pasta';

/**
 * Atalhos da tela inicial (US 11.1, cenário 2; demanda nº 2, seção 1.3), com o
 * papel que cada um exige.
 *
 * Descrições curtas, do mockup da demanda nº 3 (item 6), **fiéis** ao produto
 * (design.md D4 de `marca-dagua-e-inicio-rodada-3`): a busca alcança nome e
 * código, não o conteúdo dos arquivos, e o manual não tem imagens — o mockup
 * prometia as duas coisas.
 *
 * O conjunto é o da demanda — Enviar documento, Nova pasta, Buscar documento,
 * Manual do usuário (change `conteudo-da-tela-inicio`, design.md D4). Os
 * atalhos de administração, Documentos e Lixeira saíram da tela: estão no
 * menu lateral, que é onde a demanda os põe.
 *
 * `roles` é a **mesma** condição que a guarda de rota do `router.tsx` aplica
 * ao destino — é isso que faz valer "atalho apresentado conduz a uma ação
 * executável, sem recusa por permissão". Os quatro atuais servem a qualquer
 * papel; o mecanismo fica, porque o requisito continua valendo para o atalho
 * que vier a entrar.
 *
 * A filtragem aqui é de **apresentação**, nunca linha de defesa: a API segue
 * sendo o único guardião de permissão.
 */
export interface Atalho {
  chave: string;
  rotulo: string;
  descricao: string;
  /** Endereço interno (`/…`) ou externo (`https://…`, abre em nova aba). */
  destino: string;
  externo?: boolean;
  icone: ComponentType<{ style?: CSSProperties }>;
  /**
   * Tom do ícone e do quadrado tingido — token de `tonsDeAtalho`, nunca valor
   * escrito aqui. Quatro matizes distintos (demanda nº 3, item 6: "ícones
   * coloridos"; change `marca-dagua-e-inicio-rodada-3`, design.md D3).
   */
  tom: TomDeAtalho;
  /** Ausente = qualquer papel autenticado. */
  roles?: readonly UserRole[];
}

export const ATALHOS_INTERNOS: readonly Atalho[] = [
  {
    chave: 'enviar',
    rotulo: 'Enviar documento',
    descricao: 'Arraste ou selecione o arquivo',
    destino: DESTINO_PEDIDO_DE_ENVIO,
    icone: IconeEnviar,
    tom: 'verde',
  },
  {
    chave: 'nova-pasta',
    rotulo: 'Nova pasta',
    descricao: 'Organize por setor ou tema',
    destino: DESTINO_PEDIDO_DE_NOVA_PASTA,
    icone: IconeNovaPasta,
    tom: 'azul',
  },
  {
    chave: 'buscar',
    rotulo: 'Buscar documento',
    descricao: 'Por nome ou código',
    destino: '/busca',
    icone: IconeBuscar,
    tom: 'roxo',
  },
];

/**
 * Atalhos do papel, na ordem da demanda. O do manual só existe quando a
 * implantação tem manual configurado — mesmo tratamento do item de menu, e
 * pela mesma razão: atalho sem destino é regressão.
 */
export function atalhosDoPapel(role: UserRole, manualUrl: string | null | undefined): Atalho[] {
  const atalhos = [...ATALHOS_INTERNOS];
  if (manualUrl) {
    atalhos.push({
      chave: 'manual',
      rotulo: 'Manual do usuário',
      descricao: 'Passo a passo de cada tela',
      destino: manualUrl,
      externo: true,
      icone: IconeManual,
      tom: 'laranja',
    });
  }
  return atalhos.filter((atalho) => !atalho.roles || atalho.roles.includes(role));
}
