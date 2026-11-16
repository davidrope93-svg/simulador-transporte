"""Genera los iconos de la app (icons/) a partir del logo: python3 tools/iconos.py

Fuente: src/logo.png (cuadrado, fondo azul uniforme). Si hay un logo con más
resolución, basta con sustituir src/logo.png y volver a ejecutar este script
y build.py (la huella de sw.js cambia sola y los usuarios reciben el aviso).

- icon-192 / icon-512 / favicon-32: el logo con las esquinas redondeadas.
- maskable-512: Android lo recorta en círculo o «squircle»; el dibujo va
  reducido para que quepa entero en la zona segura (círculo del 80 %).
- apple-touch-icon (180): cuadrado y sin transparencia; iOS redondea solo.
"""
import os
from PIL import Image, ImageDraw
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONDO = (8, 41, 76)  # #08294c, el azul del logo
SAFE = 0.40          # radio de la zona segura de un icono «maskable»


def cargar():
    im = Image.open(os.path.join(ROOT, 'src', 'logo.png')).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    # Fondo exactamente uniforme (quita el ruido de compresión) con transición
    # suave para no crear halos alrededor del dibujo.
    d = np.sqrt(((a - np.array(FONDO, np.float32)) ** 2).sum(-1))
    t = np.clip((d - 6) / 6, 0, 1)[..., None]
    a = a * t + np.array(FONDO, np.float32) * (1 - t)
    return Image.fromarray(a.round().astype(np.uint8)), d > 12


def redondeado(im, size, radio):
    im = im.resize((size, size), Image.LANCZOS).convert('RGBA')
    if radio:
        k = 4  # máscara supermuestreada para un borde suave
        m = Image.new('L', (size * k, size * k), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, size * k - 1, size * k - 1), radio * k, fill=255)
        im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im


def maskable(im, dibujo, size):
    ys, xs = np.nonzero(dibujo)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    rmax = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()  # píxel del dibujo más alejado del centro
    escala = SAFE * size / rmax
    w = round(im.width * escala)
    peq = im.resize((w, w), Image.LANCZOS)
    lienzo = Image.new('RGB', (size, size), FONDO)
    lienzo.paste(peq, (round(size / 2 - cx * escala), round(size / 2 - cy * escala)))
    return lienzo


def main():
    im, dibujo = cargar()
    out = os.path.join(ROOT, 'icons')
    redondeado(im, 192, 42).save(os.path.join(out, 'icon-192.png'), optimize=True)
    redondeado(im, 512, 112).save(os.path.join(out, 'icon-512.png'), optimize=True)
    redondeado(im, 32, 7).save(os.path.join(out, 'favicon-32.png'), optimize=True)
    im.resize((180, 180), Image.LANCZOS).save(os.path.join(out, 'apple-touch-icon.png'), optimize=True)
    maskable(im, dibujo, 512).save(os.path.join(out, 'maskable-512.png'), optimize=True)
    print('iconos generados desde src/logo.png')


if __name__ == '__main__':
    main()
