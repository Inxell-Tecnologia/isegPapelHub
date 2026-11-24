import { useState } from 'react';
import { Button, Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import { IconeBuscar } from '../app/icons';
import { ALTURA_MINIMA_ACIONAMENTO, RAIO_CONTROLE } from '../app/theme';
import { useNarrowMode } from '../app/responsive';

/**
 * Campo de busca permanentemente acessível na barra superior (capability
 * `web-busca`, requisito "Campo de busca permanentemente acessível no
 * cabeçalho"; change `menu-lateral-e-barra-superior`, design.md D3).
 *
 * **Não consulta o servidor.** Acionar navega para a tela de resultados com o
 * termo na URL (`/busca?q=…`), e é ela que dispara a consulta. Essa divisão é
 * o que preserva o requisito "Busca acionada explicitamente pelo usuário", que
 * a change arquivada `busca-acionamento-explicito` normatizou por decisão
 * deliberada: busca a cada tecla multiplica requisições e produz resultados
 * que piscam. Termo vazio não navega.
 *
 * **O acionador vai dentro do campo, e por isso não é `Input.Search`.** O
 * `Input.Search` do design system renderiza o botão num
 * `ant-input-group-addon` — **adjacente** ao campo, fora da caixa — com ou sem
 * `enterButton`; foi o que a verificação mostrou. O requisito proíbe botão
 * adjacente, então o acionador entra como `suffix` de um `Input` comum, dentro
 * do `ant-input-affix-wrapper`. `type="search"` preserva o papel de
 * `searchbox`.
 *
 * Isso também apaga a ramificação `enterButton={!isNarrow}` que existia só
 * para o botão verde separado não consumir a largura do campo em 375px: sem
 * botão adjacente, o problema deixa de existir e o componente deixa de
 * precisar conhecer o modo de apresentação.
 *
 * **A largura é teto, não medida** (design.md D3): no limiar de 992px a barra
 * dispõe de 680px, e o campo divide com o sino, a ajuda e a ação de envio —
 * 600px fixos estourariam a linha e produziriam a rolagem horizontal que
 * `web-responsividade` proíbe. Medido na app: 400px em 992, 432 em 1024 e o
 * teto de 600 a partir de 1280.
 *
 * **Abaixo do limiar o teto não basta: o campo precisa de piso.** A medição em
 * 375px mostrou o campo colapsando para **24px** — caixa visível em que não se
 * digita. `flex: 1` sem piso cede toda a largura aos controles vizinhos; é o
 * mesmo defeito que a change `responsividade-mobile-tablet` já havia corrigido
 * uma vez, e que voltou ao se retirar o botão adjacente junto com o piso. O
 * piso vale só no modo estreito: no largo há folga de sobra, e um piso ali
 * competiria com o teto.
 */
export const TETO_LARGURA_BUSCA = 600;

/** Piso de largura útil do campo no modo estreito (medido em 375px). */
export const PISO_LARGURA_BUSCA = 120;

/**
 * **Altura do campo = altura do botão de envio** (`docs/demanda_cliente_3.md`,
 * item 9; change `marca-dagua-e-inicio-rodada-3`, design.md D6).
 *
 * Medido na app antes da correção: o campo tinha **66 px** e o botão "Enviar
 * documento" 44. O acionador interno herda o piso de 44 px
 * (`controlHeightSM`), e a caixa do campo somava a ele o seu preenchimento
 * vertical e a borda. A caixa passa a ter os 44 px exatos, sem preenchimento
 * vertical, e o acionador **mantém 44 px** estendendo-se sobre a borda de 1 px
 * em cima, embaixo e à direita — a área sensível não cai abaixo do piso, que
 * `sistema-de-design` não deixa relaxar.
 */
const ESTILO_CAIXA_DA_BUSCA = {
  height: ALTURA_MINIMA_ACIONAMENTO,
  paddingBlock: 0,
  paddingInlineEnd: 0,
} as const;

const ESTILO_ACIONADOR_DA_BUSCA = {
  height: ALTURA_MINIMA_ACIONAMENTO,
  width: ALTURA_MINIMA_ACIONAMENTO,
  marginBlock: -1,
  marginInlineEnd: -1,
  borderStartStartRadius: 0,
  borderEndStartRadius: 0,
  borderStartEndRadius: RAIO_CONTROLE,
  borderEndEndRadius: RAIO_CONTROLE,
} as const;

export const APOIO_BUSCA = 'Buscar por nome, código (ex.: PRT-NSP-001) ou palavra-chave';

export function BuscaNoCabecalho() {
  const navigate = useNavigate();
  const isNarrow = useNarrowMode();
  const [termo, setTermo] = useState('');

  function handleSearch() {
    const limpo = termo.trim();
    if (limpo === '') return;
    navigate(`/busca?q=${encodeURIComponent(limpo)}`);
  }

  return (
    <Input
      type="search"
      allowClear
      placeholder={APOIO_BUSCA}
      aria-label="Buscar documentos"
      style={{
        ...ESTILO_CAIXA_DA_BUSCA,
        flex: 1,
        maxWidth: TETO_LARGURA_BUSCA,
        minWidth: isNarrow ? PISO_LARGURA_BUSCA : 0,
      }}
      value={termo}
      onChange={(e) => setTermo(e.target.value)}
      onPressEnter={handleSearch}
      suffix={
        <Button
          type="text"
          size="small"
          aria-label="Buscar"
          icon={<IconeBuscar />}
          style={ESTILO_ACIONADOR_DA_BUSCA}
          onClick={handleSearch}
        />
      }
    />
  );
}
