import { Tag } from 'antd';
import type { ReactNode } from 'react';
import { type TomDeEstado, tonsDeEstado } from './theme';

/**
 * Rótulo de estado com tom semântico (change `identidade-visual-isetes`,
 * tasks 7.1).
 *
 * Existe porque os presets de cor do design system **reprovam** no piso de
 * contraste que esta change passa a exigir: o verde mede 3,37:1 e o laranja
 * 3,34:1 sobre os próprios fundos, contra o mínimo de 4,5:1. A alternativa
 * seria cada tela escrever as três cores do seu rótulo à mão — exatamente o
 * que o requisito "Tokens de apresentação têm origem única" proíbe.
 *
 * A tela escolhe o **significado** (`positivo`, `alerta`, `negativo`,
 * `informativo`, `neutro`); as cores vêm dos tokens e são apuradas por
 * cálculo em `__tests__/contraste.test.ts`.
 */
export function RotuloDeEstado({
  tom = 'neutro',
  children,
}: {
  tom?: TomDeEstado;
  children: ReactNode;
}) {
  const { texto, fundo, borda } = tonsDeEstado[tom];
  return <Tag style={{ color: texto, background: fundo, borderColor: borda }}>{children}</Tag>;
}
