"""Genera index.html (un único archivo, sin dependencias) a partir de src/.
Uso: python3 build.py"""
src = lambda f: open('src/' + f, encoding='utf-8').read()
t = src('template.html')
for k, f in [('MODEL', 'model.js'), ('DEVICES', 'devices.js'), ('CASES', 'cases.js')]:
    t = t.replace('/*%s*/' % k, src(f))
t = t.replace('/*UI*/', src('ui.js').replace('/*TEACH*/', src('teach.js')).replace('/*GUIDE*/', src('guide.js')).replace('/*TUTOR*/', src('tutor.js')))  # docencia, orientación y tutorial dentro de la interfaz
head, body = t.split('<style>', 1)
style, rest = body.split('</style>', 1)
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
page = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '<style>' + style + '</style>\n</head>\n<body>\n' + rest + '\n</body>\n</html>\n')
open('index.html', 'w', encoding='utf-8').write(page)
print('index.html', len(page), 'bytes')
