"""Genera index.html (un único archivo, sin dependencias) a partir de src/.
Uso: python3 build.py"""
src = lambda f: open('src/' + f, encoding='utf-8').read()
t = src('template.html')
t = t.replace('/*MODEL*/', src('model.js'))
t = t.replace('/*DEVICES*/', src('devices.js') + '\n' + src('drugs.js'))  # los fármacos van con los equipos
t = t.replace('/*CASES*/', src('cases.js') + '\n' + src('variants.js'))  # el generador de variantes va junto a los casos
t = t.replace('/*UI*/', src('ui.js').replace('/*TEACH*/', src('teach.js')).replace('/*GUIDE*/', src('guide.js')).replace('/*TUTOR*/', src('tutor.js')).replace('/*LIBRARY*/', src('library.js')))  # docencia, orientación y tutorial dentro de la interfaz
head, body = t.split('<style>', 1)
style, rest = body.split('</style>', 1)
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
# instalable y sin conexión (solo en la versión publicada; el artefacto de claude.ai no lleva nada de esto)
pwa_head = ('<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#0d1d27">\n'
            '<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
            '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
            '<meta name="apple-mobile-web-app-title" content="Simulador SVA">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n')
page = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + pwa_head + head + '<style>' + style + '</style>\n</head>\n<body>\n' + rest + '\n<script>\n' + src('pwa.js') + '</script>\n</body>\n</html>\n')
open('index.html', 'w', encoding='utf-8').write(page)
# el service worker lleva la huella de esta versión: si cambia algo, el navegador ofrece actualizar
import hashlib
icons = b''.join(open('icons/' + f, 'rb').read() for f in ('icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png'))
ver = hashlib.sha1(page.encode('utf-8') + src('manifest.webmanifest').encode('utf-8') + icons).hexdigest()[:12]
open('sw.js', 'w', encoding='utf-8').write(src('sw.js').replace('__VERSION__', ver))
open('manifest.webmanifest', 'w', encoding='utf-8').write(src('manifest.webmanifest'))
print('index.html', len(page), 'bytes · sw.js versión', ver)
