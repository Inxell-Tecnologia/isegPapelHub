"""Deriva os ativos de marca do ISEG a partir das duas artes fornecidas
(JPG, fundo branco, sem transparência): o símbolo (1080x1080) e a logo
horizontal (1280x560).

Change sync-upstream-identidade-iseg, design.md D3 e D4. Generaliza o
derivar_marca.py da Forte Saúde: lá a marca tinha três tintas chapadas; aqui
o anel e a cruz são um DEGRADÊ contínuo (turquesa -> oliva -> laranja), então
não existe um conjunto finito de tintas. Cada pixel recebe a sua TINTA LOCAL:

  1. Núcleo: pixels claramente pintados (distância ao branco acima de um
     limiar) que formam um PLATÔ — nenhum vizinho é bem mais pintado que eles,
     ou seja, não estão na rampa antisserrilhada da borda. Funciona tanto no
     anel (traço largo) quanto no texto institucional (traço de ~4 px), onde
     uma erosão apagaria as letras. A cor deles é tinta pura.
  2. Campo de tinta: as bordas antisserrilhadas herdam, por dilatação
     iterativa, a média das tintas do núcleo vizinho.
  3. Desmistura sobre o branco, com a tinta local:

         c = a * tinta + (1 - a) * branco   =>   a = soma(255 - c) / soma(255 - tinta)

  O pixel de saída é a tinta pura com opacidade `a`: fundo transparente, sem
  franja branca na borda, degradê preservado.

Versões:
  cor      — tintas originais (fundo claro: marca d'água da área principal,
             favicon)
  negativa — as tintas NEUTRAS viram branco: o cinza #4F4F4F da sigla e o
             preto do filete e do texto institucional da logo horizontal; o
             degradê permanece (fundos escuros: login e navegação)

"Neutra" é tinta de saturação baixa (max - min dos canais). Medido nas artes:
sigla, filete e texto têm saturação 0; o degradê, mesmo nas sombras escuras
da borda do anel na arte horizontal (luminância ~35), tem saturação >= 68, e
o tom mais neutro dele (o oliva do meio) fica acima de 16.

As artes são grandes (o símbolo tem 985 px de diâmetro), então o trabalho é
feito na resolução original e só no fim reduzido (LANCZOS sobre cor
pré-multiplicada, para a borda não escurecer nem clarear).

Uso: python3 -I derivar_marca.py <dir-das-artes> <dir-de-saida>
Requer Pillow e NumPy.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

LIMIAR_PINTADO = 60  # soma(255 - c) acima disto = pixel com tinta
PLATO = 0.92  # núcleo: deficit >= PLATO * maior deficit da vizinhança 3x3
DILATACOES = 8  # px que o campo de tinta avança sobre a borda
RUIDO = 18  # soma(255 - c) abaixo disto = ruído de JPG no branco

NEUTRA_SAT_MAX = 14  # max(r,g,b) - min(r,g,b) da tinta local

VIZINHOS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def deslocar(m: np.ndarray, dy: int, dx: int, fill=0) -> np.ndarray:
    out = np.full_like(m, fill)
    h, w = m.shape[:2]
    ys = slice(max(dy, 0), h + min(dy, 0))
    yd = slice(max(-dy, 0), h + min(-dy, 0))
    xs = slice(max(dx, 0), w + min(dx, 0))
    xd = slice(max(-dx, 0), w + min(-dx, 0))
    out[ys, xs] = m[yd, xd]
    return out


def maior_vizinho(v: np.ndarray) -> np.ndarray:
    acc = v.copy()
    for dy, dx in VIZINHOS:
        acc = np.maximum(acc, deslocar(v, dy, dx))
    return acc


def campo_de_tinta(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Devolve (tinta local por pixel, máscara de pixels com tinta definida)."""
    deficit = (255.0 - rgb).sum(axis=2)
    nucleo = (deficit > LIMIAR_PINTADO) & (deficit >= PLATO * maior_vizinho(deficit))
    tinta = np.where(nucleo[..., None], rgb, 0.0)
    definido = nucleo.copy()
    for _ in range(DILATACOES):
        soma = np.zeros_like(tinta)
        cont = np.zeros(definido.shape, dtype=float)
        for dy, dx in VIZINHOS:
            soma += deslocar(tinta, dy, dx)
            cont += deslocar(definido, dy, dx, fill=False)
        novos = (~definido) & (cont > 0)
        tinta[novos] = soma[novos] / cont[novos][:, None]
        definido |= novos
    return tinta, definido


def desmisturar(rgb: np.ndarray, negativa: bool) -> np.ndarray:
    tinta, definido = campo_de_tinta(rgb)
    deficit = (255.0 - rgb).sum(axis=2)
    deficit_tinta = np.maximum((255.0 - tinta).sum(axis=2), 1.0)
    a = np.where(definido, np.clip(deficit / deficit_tinta, 0, 1), 0.0)
    a[deficit < RUIDO] = 0.0

    saida = tinta.copy()
    if negativa:
        sat = tinta.max(axis=2) - tinta.min(axis=2)
        saida[definido & (sat <= NEUTRA_SAT_MAX)] = 255.0

    out = np.zeros(rgb.shape[:2] + (4,), dtype=float)
    out[..., :3] = saida
    out[..., 3] = a * 255.0
    return out


def recortar(rgba: np.ndarray, margem: int = 2) -> np.ndarray:
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    y0, y1 = max(ys.min() - margem, 0), min(ys.max() + margem + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - margem, 0), min(xs.max() + margem + 1, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


def reduzir(rgba: np.ndarray, altura: int) -> Image.Image:
    """Reduz sobre cor pré-multiplicada, para a borda não ganhar halo."""
    h, w = rgba.shape[:2]
    largura = round(w * altura / h)
    a = rgba[..., 3:4] / 255.0
    pre = np.concatenate([rgba[..., :3] * a, rgba[..., 3:4]], axis=2)
    canais = [
        np.asarray(
            Image.fromarray(pre[..., i].astype(np.float32), 'F').resize(
                (largura, altura), Image.LANCZOS
            )
        )
        for i in range(4)
    ]
    pre_r = np.stack(canais, axis=2)
    alfa = np.clip(pre_r[..., 3], 0, 255)
    cor = np.where(alfa[..., None] > 0, pre_r[..., :3] / np.maximum(alfa[..., None], 1e-6) * 255.0, 0)
    out = np.zeros((altura, largura, 4), dtype=np.uint8)
    out[..., :3] = np.clip(np.round(cor), 0, 255).astype(np.uint8)
    out[..., 3] = np.round(alfa).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def favicon(simbolo_cor: np.ndarray, lado: int = 64, respiro: int = 2) -> Image.Image:
    """Símbolo inteiro em quadrado, sem distorcer: o símbolo já é circular
    (1:1); a margem transparente é só respiro."""
    interno = reduzir(simbolo_cor, lado - 2 * respiro)
    canvas = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    canvas.paste(interno, ((lado - interno.width) // 2, respiro))
    return canvas


def main() -> None:
    entrada, saida = Path(sys.argv[1]), Path(sys.argv[2])
    saida.mkdir(parents=True, exist_ok=True)

    simbolo = np.asarray(
        Image.open(entrada / 'iseg-original-simbolo.jpg').convert('RGB'), dtype=float
    )
    horizontal = np.asarray(
        Image.open(entrada / 'iseg-original-horizontal.jpg').convert('RGB'), dtype=float
    )

    simbolo_cor = recortar(desmisturar(simbolo, negativa=False))
    simbolo_neg = recortar(desmisturar(simbolo, negativa=True))
    logo_neg = recortar(desmisturar(horizontal, negativa=True))

    reduzir(logo_neg, 144).save(saida / 'iseg-logo-negativa.png', optimize=True)
    reduzir(simbolo_neg, 400).save(saida / 'iseg-simbolo-negativo.png', optimize=True)
    reduzir(simbolo_cor, 400).save(saida / 'iseg-simbolo-cor.png', optimize=True)
    favicon(simbolo_cor).save(saida / 'favicon.png', optimize=True)


if __name__ == '__main__':
    main()
